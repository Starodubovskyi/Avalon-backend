import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { RoleEnum } from '../roles/roles.enum';
import { toUserCard } from '../users-directory/domain/user-card';
import { NetworkActor } from '../users-directory/user-visibility';
import { NewWalletTransaction, TopUpRequest } from './domain/wallet';
import { WalletRepository } from './infrastructure/persistence/wallet.repository';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletService } from './wallet.service';

const VIEWER: NetworkActor = { userId: 13, roleId: RoleEnum.user };
const ADMIN: NetworkActor = { userId: 1, roleId: RoleEnum.admin };
const REQUEST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function topUp(overrides: Partial<TopUpRequest> = {}): TopUpRequest {
  return Object.assign(new TopUpRequest(), {
    id: REQUEST_ID,
    amount: 500,
    note: null,
    status: 'pending',
    user: toUserCard({
      id: 13,
      firstName: 'Ion',
      lastName: null,
      email: 'ion@example.com',
      roleId: RoleEnum.user,
    }),
    handledAt: null,
    createdAt: '2026-11-03T10:00:00.000Z',
    ...overrides,
  });
}

describe('Wallet', () => {
  const manager = {} as EntityManager;
  let repo: {
    lockWallet: jest.Mock;
    getBalance: jest.Mock;
    insertTransaction: jest.Mock;
    findTransactions: jest.Mock;
    insertRankBoost: jest.Mock;
    findActiveBoosts: jest.Mock;
    createTopUpRequest: jest.Mock;
    findTopUpRequest: jest.Mock;
    findPendingTopUpRequest: jest.Mock;
    findTopUpRequests: jest.Mock;
    handleTopUpRequest: jest.Mock;
    findAccounts: jest.Mock;
    userExists: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let ledger: WalletLedgerService;
  let service: WalletService;
  let calls: string[];

  const setBalance = (balance: number) =>
    repo.getBalance.mockImplementation(() => {
      calls.push('balance');
      return Promise.resolve(balance);
    });

  beforeEach(() => {
    calls = [];
    repo = {
      lockWallet: jest.fn(() => {
        calls.push('lock');
        return Promise.resolve();
      }),
      getBalance: jest.fn(() => {
        calls.push('balance');
        return Promise.resolve(0);
      }),
      insertTransaction: jest.fn((data: NewWalletTransaction) => {
        calls.push('insert');
        return Promise.resolve({ id: 't1', ...data, balanceAfter: 0 });
      }),
      findTransactions: jest.fn().mockResolvedValue([]),
      insertRankBoost: jest.fn(() => {
        calls.push('boost');
        return Promise.resolve();
      }),
      findActiveBoosts: jest.fn().mockResolvedValue([]),
      createTopUpRequest: jest.fn().mockResolvedValue(REQUEST_ID),
      findTopUpRequest: jest.fn().mockResolvedValue(topUp()),
      findPendingTopUpRequest: jest.fn().mockResolvedValue(null),
      findTopUpRequests: jest.fn().mockResolvedValue([]),
      handleTopUpRequest: jest.fn().mockResolvedValue(true),
      findAccounts: jest.fn().mockResolvedValue([]),
      userExists: jest.fn().mockResolvedValue(true),
    };
    // Runs the callback as the real DataSource would, inside "a transaction".
    dataSource = {
      transaction: jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
        work(manager),
      ),
    };
    ledger = new WalletLedgerService(
      repo as unknown as WalletRepository,
      dataSource as unknown as DataSource,
    );
    service = new WalletService(repo as unknown as WalletRepository, ledger);
  });

  describe('ledger', () => {
    it('should lock, check the balance, apply and insert -price, in this order', async () => {
      setBalance(120);
      const apply = jest.fn(() => {
        calls.push('apply');
        return Promise.resolve('bought');
      });

      const { result } = await ledger.spend(
        { userId: 13, price: 50, kind: 'activity_slot', pointId: 'p1' },
        apply,
      );

      expect(result).toBe('bought');
      expect(calls).toEqual(['lock', 'balance', 'apply', 'insert']);
      expect(repo.lockWallet).toHaveBeenCalledWith(13, manager);
      expect(repo.insertTransaction).toHaveBeenCalledWith(
        {
          userId: 13,
          amount: -50,
          kind: 'activity_slot',
          note: null,
          pointId: 'p1',
          createdById: 13,
        },
        manager,
      );
    });

    it('should return 422 insufficient and buy nothing when the balance is short', async () => {
      setBalance(49);
      const apply = jest.fn();

      await expect(
        ledger.spend({ userId: 13, price: 50, kind: 'activity_slot' }, apply),
      ).rejects.toMatchObject({
        response: { status: 422, errors: { balance: 'insufficient' } },
      });
      expect(apply).not.toHaveBeenCalled();
      expect(repo.insertTransaction).not.toHaveBeenCalled();
    });

    it('should allow spending the exact balance', async () => {
      setBalance(50);
      await ledger.spend(
        { userId: 13, price: 50, kind: 'activity_slot' },
        jest.fn(),
      );
      expect(repo.insertTransaction).toHaveBeenCalled();
    });

    it('should credit without a balance check, but never debit below zero', async () => {
      await ledger.credit({
        userId: 13,
        amount: 100,
        kind: 'top_up',
        note: null,
        pointId: null,
        createdById: 1,
      });
      expect(repo.getBalance).not.toHaveBeenCalled();

      setBalance(30);
      await expect(
        ledger.credit({
          userId: 13,
          amount: -31,
          kind: 'adjustment',
          note: null,
          pointId: null,
          createdById: 1,
        }),
      ).rejects.toMatchObject({
        response: { errors: { balance: 'insufficient' } },
      });
    });
  });

  describe('summary', () => {
    it('should combine balance, history, prices, pending request and boosts', async () => {
      setBalance(450);
      repo.findPendingTopUpRequest.mockResolvedValue(topUp());
      repo.findActiveBoosts.mockResolvedValue([
        { points: 250, expiresAt: '2026-12-03T10:00:00.000Z' },
      ]);

      await expect(service.getSummary(VIEWER)).resolves.toEqual({
        balance: 450,
        transactions: [],
        prices: {
          activitySlot: 50,
          rankBoost: 100,
          rankBoostPoints: 250,
          rankBoostDays: 30,
        },
        pendingTopUp: topUp(),
        activeBoosts: [{ points: 250, expiresAt: '2026-12-03T10:00:00.000Z' }],
      });
      expect(repo.findTransactions).toHaveBeenCalledWith(13, 50);
    });
  });

  describe('top-up requests', () => {
    it('should create a pending request for the caller', async () => {
      await expect(
        service.createTopUpRequest(VIEWER, { amount: 500, note: 'Invoice 12' }),
      ).resolves.toMatchObject({ id: REQUEST_ID, status: 'pending' });
      expect(repo.createTopUpRequest).toHaveBeenCalledWith({
        userId: 13,
        amount: 500,
        note: 'Invoice 12',
      });
    });

    it('should return 422 pendingExists while one is pending, also on a parallel submit', async () => {
      repo.findPendingTopUpRequest.mockResolvedValueOnce(topUp());
      await expect(
        service.createTopUpRequest(VIEWER, { amount: 100 }),
      ).rejects.toMatchObject({
        response: { status: 422, errors: { amount: 'pendingExists' } },
      });
      expect(repo.createTopUpRequest).not.toHaveBeenCalled();

      const race = new QueryFailedError('INSERT', [], new Error('duplicate'));
      Object.assign(race, {
        driverError: { code: '23505', constraint: 'UQ_top_up_request_pending' },
      });
      repo.createTopUpRequest.mockRejectedValueOnce(race);
      await expect(
        service.createTopUpRequest(VIEWER, { amount: 100 }),
      ).rejects.toMatchObject({
        response: { errors: { amount: 'pendingExists' } },
      });
    });

    it('should credit the amount once when approved', async () => {
      repo.findTopUpRequest
        .mockResolvedValueOnce(topUp())
        .mockResolvedValueOnce(topUp({ status: 'approved' }));

      await expect(
        service.approveTopUpRequest(REQUEST_ID, ADMIN),
      ).resolves.toMatchObject({ status: 'approved' });

      expect(repo.handleTopUpRequest).toHaveBeenCalledWith(
        REQUEST_ID,
        'approved',
        1,
        manager,
      );
      expect(repo.insertTransaction).toHaveBeenCalledTimes(1);
      expect(repo.insertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 13,
          amount: 500,
          kind: 'top_up',
          createdById: 1,
        }),
        manager,
      );
    });

    it('should not credit twice on a double click (alreadyHandled)', async () => {
      // second click after the first committed
      repo.findTopUpRequest.mockResolvedValue(topUp({ status: 'approved' }));
      await expect(
        service.approveTopUpRequest(REQUEST_ID, ADMIN),
      ).rejects.toMatchObject({
        response: { status: 422, errors: { status: 'alreadyHandled' } },
      });

      // simultaneous clicks: both read "pending", only one UPDATE matches
      repo.findTopUpRequest.mockResolvedValue(topUp());
      repo.handleTopUpRequest.mockResolvedValue(false);
      await expect(
        service.approveTopUpRequest(REQUEST_ID, ADMIN),
      ).rejects.toMatchObject({
        response: { errors: { status: 'alreadyHandled' } },
      });

      expect(repo.insertTransaction).not.toHaveBeenCalled();
    });

    it('should decline without crediting and 404 an unknown request', async () => {
      repo.findTopUpRequest
        .mockResolvedValueOnce(topUp())
        .mockResolvedValueOnce(topUp({ status: 'declined' }))
        .mockResolvedValueOnce(null);

      await expect(
        service.declineTopUpRequest(REQUEST_ID, ADMIN),
      ).resolves.toMatchObject({ status: 'declined' });
      expect(repo.handleTopUpRequest).toHaveBeenCalledWith(
        REQUEST_ID,
        'declined',
        1,
      );
      expect(repo.insertTransaction).not.toHaveBeenCalled();

      await expect(
        service.declineTopUpRequest(REQUEST_ID, ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('admin credits', () => {
    it('should record a positive credit as top_up and a negative one as adjustment', async () => {
      setBalance(1000);

      await service.credit({ userId: 13, amount: 300, note: 'Bonus' }, ADMIN);
      await service.credit({ userId: 13, amount: -100 }, ADMIN);

      expect(repo.insertTransaction).toHaveBeenNthCalledWith(
        1,
        {
          userId: 13,
          amount: 300,
          kind: 'top_up',
          note: 'Bonus',
          pointId: null,
          createdById: 1,
        },
        manager,
      );
      expect(repo.insertTransaction).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ amount: -100, kind: 'adjustment' }),
        manager,
      );
    });

    it('should return 422 userId notFound for an unknown or deleted user', async () => {
      repo.userExists.mockResolvedValue(false);
      await expect(
        service.credit({ userId: 99, amount: 10 }, ADMIN),
      ).rejects.toMatchObject({
        response: { errors: { userId: 'notFound' } },
      });
      expect(repo.insertTransaction).not.toHaveBeenCalled();
    });
  });

  describe('rank boost', () => {
    it('should charge 100 credits and add a +250 boost for 30 days', async () => {
      setBalance(100);

      await service.boostRank(VIEWER);

      expect(repo.insertRankBoost).toHaveBeenCalledWith(13, 250, 30, manager);
      expect(repo.insertTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 13,
          amount: -100,
          kind: 'rank_boost',
        }),
        manager,
      );
      // then the summary reads the new balance
      expect(calls.slice(0, 4)).toEqual(['lock', 'balance', 'boost', 'insert']);
    });

    it('should return 422 insufficient without boosting', async () => {
      setBalance(99);
      await expect(service.boostRank(VIEWER)).rejects.toMatchObject({
        response: { errors: { balance: 'insufficient' } },
      });
      expect(repo.insertRankBoost).not.toHaveBeenCalled();
    });
  });
});
