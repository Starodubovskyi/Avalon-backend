import { RoleEnum } from '../roles/roles.enum';
import { toUserCard, toUserCardRole } from './domain/user-card';
import { UserDirectoryRepository } from './infrastructure/persistence/user-directory.repository';
import {
  userOrderBy,
  userSearchCondition,
} from './infrastructure/persistence/relational/user-search';
import {
  canDeleteContent,
  canSeeEmail,
  canSeeUser,
  NetworkActor,
  redactUserCard,
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
        { id: 1, roleId: RoleEnum.admin, publicProfile: false },
        { id: 3, roleId: RoleEnum.staff, publicProfile: false },
        { id: 4, roleId: RoleEnum.user, publicProfile: false },
        { id: 5, roleId: null, publicProfile: false },
        { id: 6, roleId: RoleEnum.user, publicProfile: true },
      ]),
    };
    service = new UsersDirectoryService(
      repo as unknown as UserDirectoryRepository,
    );
  });

  it('should limit viewers to admin, staff and public profiles and exclude the caller', async () => {
    await service.search(VIEWER, 'doe');

    expect(repo.search).toHaveBeenCalledWith({
      excludeUserId: 9,
      visibleUsers: {
        roleIds: [RoleEnum.admin, RoleEnum.staff],
        publicProfiles: true,
      },
      search: 'doe',
      limit: 200,
    });
  });

  it('should hide the emails of other clients from a viewer, not from staff', async () => {
    const cards = () => [
      toUserCard({
        id: 3,
        firstName: 'Ana',
        lastName: null,
        email: 'staff@example.com',
        roleId: RoleEnum.staff,
      }),
      toUserCard({
        id: 6,
        firstName: 'Ion',
        lastName: null,
        email: 'client@example.com',
        roleId: RoleEnum.user,
      }),
    ];
    repo.search.mockResolvedValueOnce(cards()).mockResolvedValueOnce(cards());

    const forViewer = await service.search(VIEWER);
    const forStaff = await service.search(STAFF);

    expect(forViewer.map((card) => card.email)).toEqual([
      'staff@example.com',
      null,
    ]);
    expect(forStaff.map((card) => card.email)).toEqual([
      'staff@example.com',
      'client@example.com',
    ]);
  });

  it('should not restrict roles for admin and staff', async () => {
    await service.search(ADMIN);
    await service.search(STAFF);

    expect(repo.search).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ excludeUserId: 1, visibleUsers: null }),
    );
    expect(repo.search).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ excludeUserId: 7, visibleUsers: null }),
    );
  });

  it('should hide non-public viewers and role-less users from a viewer', async () => {
    await expect(
      service.classify(VIEWER, [1, 3, 4, 5, 6, 99]),
    ).resolves.toEqual({
      visible: [1, 3, 6],
      hidden: [4, 5],
      missing: [99],
    });
  });

  it('should show every active user to staff', async () => {
    await expect(service.classify(STAFF, [1, 3, 4, 5, 6, 99])).resolves.toEqual(
      {
        visible: [1, 3, 4, 5, 6],
        hidden: [],
        missing: [99],
      },
    );
  });

  it('should answer isVisible for a single user', async () => {
    repo.findActiveRoles.mockResolvedValue([
      { id: 4, roleId: RoleEnum.user, publicProfile: false },
    ]);

    await expect(service.isVisible(VIEWER, 4)).resolves.toBe(false);
    await expect(service.isVisible(STAFF, 4)).resolves.toBe(true);

    // a viewer who owns or works at a public point has a public profile
    repo.findActiveRoles.mockResolvedValue([
      { id: 4, roleId: RoleEnum.user, publicProfile: true },
    ]);
    await expect(service.isVisible(VIEWER, 4)).resolves.toBe(true);
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

describe('public profiles and emails', () => {
  it('should let a viewer see the team and public profiles only', () => {
    expect(
      canSeeUser(VIEWER, { roleId: RoleEnum.staff, publicProfile: false }),
    ).toBe(true);
    expect(
      canSeeUser(VIEWER, { roleId: RoleEnum.user, publicProfile: true }),
    ).toBe(true);
    expect(
      canSeeUser(VIEWER, { roleId: RoleEnum.user, publicProfile: false }),
    ).toBe(false);
    expect(canSeeUser(VIEWER, { roleId: null, publicProfile: false })).toBe(
      false,
    );
    expect(
      canSeeUser(STAFF, { roleId: RoleEnum.user, publicProfile: false }),
    ).toBe(true);
  });

  it('should show a client email only to the team and to the client', () => {
    expect(canSeeEmail(VIEWER, { id: 6, role: 'viewer' })).toBe(false);
    expect(canSeeEmail(VIEWER, { id: 9, role: 'viewer' })).toBe(true);
    expect(canSeeEmail(VIEWER, { id: 3, role: 'staff' })).toBe(true);
    expect(canSeeEmail(ADMIN, { id: 6, role: 'viewer' })).toBe(true);
  });

  it('should null the email of a redacted card and keep the rest', () => {
    const card = toUserCard({
      id: 6,
      firstName: 'Ion',
      lastName: 'Popescu',
      email: 'client@example.com',
      roleId: RoleEnum.user,
    });

    expect(redactUserCard(card, VIEWER)).toMatchObject({
      id: 6,
      firstName: 'Ion',
      email: null,
      role: 'viewer',
    });
  });
});

describe('people search SQL', () => {
  it('should match any email for the team', () => {
    expect(userSearchCondition('u', '$1')).toContain('"u"."email" ILIKE $1 OR');
  });

  it('should let a viewer match emails of the team and their own only', () => {
    const condition = userSearchCondition('u', '$1', {
      roleIdsParam: '$2',
      selfParam: '$3',
    });
    expect(condition).toContain(
      '("u"."email" ILIKE $1 AND ("u"."roleId" = ANY($2::int[]) OR "u"."id" = $3))',
    );
    expect(condition).toContain('"u"."firstName" ILIKE $1');
  });

  it('should leave the email out of the order for viewers', () => {
    expect(userOrderBy('u')).toContain('"u"."email"');
    expect(userOrderBy('u', false)).not.toContain('email');
  });
});
