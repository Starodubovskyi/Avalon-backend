import { RoleEnum } from '../roles/roles.enum';
import { toUserCardRole } from './domain/user-card';
import { UserDirectoryRepository } from './infrastructure/persistence/user-directory.repository';
import {
  canDeleteContent,
  NetworkActor,
  toNetworkActor,
} from './user-visibility';
import { UsersDirectoryService } from './users-directory.service';

const ADMIN: NetworkActor = { userId: 1, roleId: RoleEnum.admin };
const STAFF: NetworkActor = { userId: 7, roleId: RoleEnum.staff };
const VIEWER: NetworkActor = { userId: 9, roleId: RoleEnum.user };

describe('UsersDirectoryService', () => {
  let service: UsersDirectoryService;
  let repo: { search: jest.Mock; findActiveRoles: jest.Mock };

  beforeEach(() => {
    repo = {
      search: jest.fn().mockResolvedValue([]),
      findActiveRoles: jest.fn().mockResolvedValue([
        { id: 1, roleId: RoleEnum.admin },
        { id: 3, roleId: RoleEnum.staff },
        { id: 4, roleId: RoleEnum.user },
        { id: 5, roleId: null },
      ]),
    };
    service = new UsersDirectoryService(
      repo as unknown as UserDirectoryRepository,
    );
  });

  it('should limit viewers to admin and staff and exclude the caller', async () => {
    await service.search(VIEWER, 'doe');

    expect(repo.search).toHaveBeenCalledWith({
      excludeUserId: 9,
      roleIds: [RoleEnum.admin, RoleEnum.staff],
      search: 'doe',
      limit: 200,
    });
  });

  it('should not restrict roles for admin and staff', async () => {
    await service.search(ADMIN);
    await service.search(STAFF);

    expect(repo.search).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ excludeUserId: 1, roleIds: null }),
    );
    expect(repo.search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ excludeUserId: 7, roleIds: null }),
    );
  });

  it('should hide viewers and role-less users from a viewer', async () => {
    await expect(service.classify(VIEWER, [1, 3, 4, 5, 99])).resolves.toEqual({
      visible: [1, 3],
      hidden: [4, 5],
      missing: [99],
    });
  });

  it('should show every active user to staff', async () => {
    await expect(service.classify(STAFF, [1, 3, 4, 5, 99])).resolves.toEqual({
      visible: [1, 3, 4, 5],
      hidden: [],
      missing: [99],
    });
  });

  it('should answer isVisible for a single user', async () => {
    repo.findActiveRoles.mockResolvedValue([{ id: 4, roleId: RoleEnum.user }]);

    await expect(service.isVisible(VIEWER, 4)).resolves.toBe(false);
    await expect(service.isVisible(STAFF, 4)).resolves.toBe(true);
  });
});

describe('user visibility helpers', () => {
  it('should map role ids to card roles', () => {
    expect(toUserCardRole(RoleEnum.admin)).toBe('admin');
    expect(toUserCardRole(RoleEnum.staff)).toBe('staff');
    expect(toUserCardRole(RoleEnum.user)).toBe('viewer');
    expect(toUserCardRole('3')).toBe('staff');
    expect(toUserCardRole(null)).toBe('viewer');
  });

  it('should build the actor from the JWT payload', () => {
    expect(
      toNetworkActor({
        id: '7',
        role: { id: '3' },
        sessionId: 1,
        iat: 0,
        exp: 0,
      } as never),
    ).toEqual({ userId: 7, roleId: 3 });
    expect(
      toNetworkActor({ id: 9, role: null, sessionId: 1, iat: 0, exp: 0 }),
    ).toEqual({ userId: 9, roleId: null });
  });

  it('should allow deleting content to its author and admins only', () => {
    expect(canDeleteContent(STAFF, 7)).toBe(true);
    expect(canDeleteContent(STAFF, 8)).toBe(false);
    expect(canDeleteContent(VIEWER, 8)).toBe(false);
    expect(canDeleteContent(ADMIN, 8)).toBe(true);
  });
});
