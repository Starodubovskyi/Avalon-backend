import { calculateRank, UserRankInputs } from './domain/user-rank';
import { UserRankRepository } from './infrastructure/persistence/user-rank.repository';
import { UserRankService } from './user-rank.service';

const zero: Omit<UserRankInputs, 'userId'> = {
  mapPoints: 0,
  mapPointsWithLogo: 0,
  posts: 0,
  comments: 0,
  agencyRequests: 0,
};

describe('calculateRank', () => {
  it('should weigh each contribution: 10 × points + 5 × logos + 3 × posts + 1 × comments + 5 × requests', () => {
    expect(calculateRank({ userId: 1, ...zero, mapPoints: 1 })).toBe(10);
    expect(
      calculateRank({ userId: 1, ...zero, mapPoints: 1, mapPointsWithLogo: 1 }),
    ).toBe(15);
    expect(calculateRank({ userId: 1, ...zero, posts: 1 })).toBe(3);
    expect(calculateRank({ userId: 1, ...zero, comments: 1 })).toBe(1);
    expect(calculateRank({ userId: 1, ...zero, agencyRequests: 1 })).toBe(5);
  });

  it('should add all contributions together', () => {
    expect(
      calculateRank({
        userId: 1,
        mapPoints: 80,
        mapPointsWithLogo: 20,
        posts: 30,
        comments: 40,
        agencyRequests: 12,
      }),
    ).toBe(800 + 100 + 90 + 40 + 60);
  });

  it('should be 0 without any contribution', () => {
    expect(calculateRank({ userId: 1, ...zero })).toBe(0);
  });
});

describe('UserRankService', () => {
  let repo: { findInputs: jest.Mock };
  let service: UserRankService;

  beforeEach(() => {
    repo = { findInputs: jest.fn() };
    service = new UserRankService(repo as unknown as UserRankRepository);
  });

  it('should query each valid user once and map ids to ranks', async () => {
    repo.findInputs.mockResolvedValue([
      { userId: 7, ...zero, mapPoints: 2, posts: 1 },
      { userId: 9, ...zero },
    ]);

    const ranks = await service.getRanks([7, 9, 7, 0, -1, Number.NaN]);

    expect(repo.findInputs).toHaveBeenCalledWith([7, 9]);
    expect([...ranks.entries()]).toEqual([
      [7, 23],
      [9, 0],
    ]);
  });

  it('should not query the database without user ids', async () => {
    await expect(service.getRanks([])).resolves.toEqual(new Map());
    expect(repo.findInputs).not.toHaveBeenCalled();
  });
});
