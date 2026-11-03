import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RoleEnum } from '../roles/roles.enum';
import { NetworkActor } from '../users-directory/user-visibility';
import { WalletLedgerService } from '../wallet/wallet-ledger.service';
import { MapPoint } from './domain/map-point';
import { MapPointView } from './domain/map-point-view';
import { MapPointRepository } from './infrastructure/persistence/map-point.repository';
import { MapPointActivitySlotsService } from './map-point-activity-slots.service';
import { MapPointPresenter } from './map-point.presenter';
import { MapPointsService } from './map-points.service';

const OWNER: NetworkActor = { userId: 7, roleId: RoleEnum.user };
const OTHER_VIEWER: NetworkActor = { userId: 9, roleId: RoleEnum.user };
const MANAGER = {} as EntityManager;

describe('MapPointActivitySlotsService', () => {
  const point = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    userId: 7,
    visibility: 'public',
    firstName: 'Avalon Shipping',
    activitySlots: 1,
  } as MapPoint;

  let points: { getEditablePoint: jest.Mock; getVisiblePoint: jest.Mock };
  let repo: { addActivitySlot: jest.Mock };
  let ledger: { spend: jest.Mock };
  let presenter: { presentOne: jest.Mock };
  let service: MapPointActivitySlotsService;

  beforeEach(() => {
    points = {
      getEditablePoint: jest.fn().mockResolvedValue(point),
      getVisiblePoint: jest
        .fn()
        .mockResolvedValue({ ...point, activitySlots: 2 }),
    };
    repo = { addActivitySlot: jest.fn().mockResolvedValue('added') };
    // Runs the purchase like the real ledger: apply() inside the "transaction".
    ledger = {
      spend: jest.fn(
        async (
          _charge: unknown,
          apply: (m: EntityManager) => Promise<void>,
        ) => ({ result: await apply(MANAGER), transaction: {} }),
      ),
    };
    presenter = {
      presentOne: jest.fn((_actor: NetworkActor, p: MapPoint) =>
        Promise.resolve(p as MapPointView),
      ),
    };
    service = new MapPointActivitySlotsService(
      points as unknown as MapPointsService,
      repo as unknown as MapPointRepository,
      ledger as unknown as WalletLedgerService,
      presenter as unknown as MapPointPresenter,
    );
  });

  it('should charge 50 credits to the caller and add one slot in the same transaction', async () => {
    const view = await service.purchase(OWNER, point.id);

    expect(ledger.spend).toHaveBeenCalledWith(
      {
        userId: 7,
        price: 50,
        kind: 'activity_slot',
        pointId: point.id,
        note: 'Business Activity slot: Avalon Shipping',
      },
      expect.any(Function),
    );
    expect(repo.addActivitySlot).toHaveBeenCalledWith(point.id, 14, MANAGER);
    expect(view.activitySlots).toBe(2);
  });

  it('should return 422 max at 14 slots without charging', async () => {
    points.getEditablePoint.mockResolvedValue({ ...point, activitySlots: 14 });

    await expect(service.purchase(OWNER, point.id)).rejects.toMatchObject({
      response: { status: 422, errors: { activitySlots: 'max' } },
    });
    expect(ledger.spend).not.toHaveBeenCalled();
  });

  it('should roll back with 422 max when a parallel purchase took the last slot', async () => {
    repo.addActivitySlot.mockResolvedValue('max');

    await expect(service.purchase(OWNER, point.id)).rejects.toMatchObject({
      response: { errors: { activitySlots: 'max' } },
    });
  });

  it('should roll back with 404 when the point was deleted during the purchase', async () => {
    repo.addActivitySlot.mockResolvedValue('notFound');

    await expect(service.purchase(OWNER, point.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(points.getVisiblePoint).not.toHaveBeenCalled();
  });

  it('should pass on insufficient balance from the ledger', async () => {
    ledger.spend.mockRejectedValue(
      new UnprocessableEntityException({
        status: 422,
        errors: { balance: 'insufficient' },
      }),
    );

    await expect(service.purchase(OWNER, point.id)).rejects.toMatchObject({
      response: { errors: { balance: 'insufficient' } },
    });
    expect(repo.addActivitySlot).not.toHaveBeenCalled();
  });

  it('should return 403 to a viewer buying for someone else’s point', async () => {
    points.getEditablePoint.mockRejectedValue(new ForbiddenException());

    await expect(
      service.purchase(OTHER_VIEWER, point.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ledger.spend).not.toHaveBeenCalled();
  });
});
