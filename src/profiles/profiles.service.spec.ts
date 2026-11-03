import { NotFoundException } from '@nestjs/common';
import { RoleEnum } from '../roles/roles.enum';
import { UserRankService } from '../user-rank/user-rank.service';
import { toUserCard } from '../users-directory/domain/user-card';
import { NetworkActor } from '../users-directory/user-visibility';
import { UsersDirectoryService } from '../users-directory/users-directory.service';
import {
  ProfileRecord,
  ProfileRepository,
} from './infrastructure/persistence/profile.repository';
import { ProfilesService } from './profiles.service';

const VIEWER: NetworkActor = { userId: 13, roleId: RoleEnum.user };
const STAFF: NetworkActor = { userId: 3, roleId: RoleEnum.staff };

function record(userId: number, roleId: number): ProfileRecord {
  return {
    user: toUserCard({
      id: userId,
      firstName: 'Ion',
      lastName: 'Popescu',
      email: `user${userId}@example.com`,
      roleId,
    }),
    headline: 'Port agent',
    bio: 'About me',
    phone: '+40 721 000 000',
    locale: 'ro',
    createdAt: '2026-01-01T00:00:00.000Z',
    stats: { points: 2, posts: 1, followers: 3, following: 4 },
    isFollowing: true,
  };
}

describe('ProfilesService', () => {
  let repo: {
    findProfile: jest.Mock;
    findCompanies: jest.Mock;
    update: jest.Mock;
  };
  let directory: { isVisible: jest.Mock };
  let service: ProfilesService;

  beforeEach(() => {
    repo = {
      findProfile: jest.fn((userId: number) =>
        Promise.resolve(record(userId, RoleEnum.user)),
      ),
      findCompanies: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    };
    directory = { isVisible: jest.fn().mockResolvedValue(true) };
    service = new ProfilesService(
      repo as unknown as ProfileRepository,
      directory as unknown as UsersDirectoryService,
      {
        getRanks: jest.fn().mockResolvedValue(new Map([[20, 260]])),
      } as unknown as UserRankService,
    );
  });

  it('should show a viewer the public profile of another client without email and phone', async () => {
    const profile = await service.findOne(VIEWER, 20);

    expect(directory.isVisible).toHaveBeenCalledWith(VIEWER, 20);
    expect(repo.findProfile).toHaveBeenCalledWith(20, 13, 13);
    expect(profile).toMatchObject({
      user: { id: 20, email: null, role: 'viewer' },
      headline: 'Port agent',
      bio: 'About me',
      phone: null,
      locale: 'ro',
      rank: 260,
      isFollowing: true,
      canMessage: true,
      isMe: false,
      memberSince: '2026-01-01T00:00:00.000Z',
    });
  });

  it('should return 404 to a viewer for a client without a public profile', async () => {
    directory.isVisible.mockResolvedValue(false);

    await expect(service.findOne(VIEWER, 21)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findProfile).not.toHaveBeenCalled();
  });

  it('should show the team the email and the phone', async () => {
    await expect(service.findOne(STAFF, 20)).resolves.toMatchObject({
      user: { email: 'user20@example.com' },
      phone: '+40 721 000 000',
    });
    expect(repo.findProfile).toHaveBeenCalledWith(20, 3, null);
  });

  it('should always show me my own profile, with phone and without Message/Follow', async () => {
    const me = await service.findOne(VIEWER, 13);

    expect(directory.isVisible).not.toHaveBeenCalled();
    expect(me).toMatchObject({
      user: { id: 13, email: 'user13@example.com' },
      phone: '+40 721 000 000',
      isMe: true,
      canMessage: false,
      isFollowing: false,
    });
  });

  it('should return 404 for a deleted user', async () => {
    repo.findProfile.mockResolvedValue(null);
    await expect(service.findOne(STAFF, 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should update only the sent fields of my profile and return it', async () => {
    await service.updateMe(VIEWER, { headline: 'Broker', locale: 'ru' });

    expect(repo.update).toHaveBeenCalledWith(13, {
      headline: 'Broker',
      bio: undefined,
      phone: undefined,
      locale: 'ru',
    });
    expect(repo.findProfile).toHaveBeenCalledWith(13, 13, 13);
  });
});
