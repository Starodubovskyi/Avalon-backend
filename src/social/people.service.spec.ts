import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RoleEnum } from '../roles/roles.enum';
import { NetworkActor } from '../users-directory/user-visibility';
import { Person } from './domain/person';
import { PeopleRepository } from './infrastructure/persistence/people.repository';
import { PeopleService } from './people.service';

const STAFF: NetworkActor = { userId: 7, roleId: RoleEnum.staff };
const VIEWER: NetworkActor = { userId: 9, roleId: RoleEnum.user };

function buildPerson(overrides: Partial<Person> = {}): Person {
  return Object.assign(new Person(), {
    id: 3,
    firstName: 'Test',
    lastName: 'Person',
    email: 'test.person@example.com',
    role: 'staff',
    followedByMe: false,
    followsMe: false,
    followers: 0,
    following: 0,
    posts: 0,
    ...overrides,
  });
}

describe('PeopleService', () => {
  let service: PeopleService;
  let people: {
    findPeople: jest.Mock;
    findPerson: jest.Mock;
    follow: jest.Mock;
    unfollow: jest.Mock;
  };

  beforeEach(() => {
    people = {
      findPeople: jest.fn().mockResolvedValue([]),
      findPerson: jest.fn().mockResolvedValue(buildPerson()),
      follow: jest.fn().mockResolvedValue(undefined),
      unfollow: jest.fn().mockResolvedValue(undefined),
    };
    service = new PeopleService(people as unknown as PeopleRepository);
  });

  it('should restrict viewers to admin and staff', async () => {
    await service.findPeople({ search: 'ann', filter: 'friends' }, VIEWER);

    expect(people.findPeople).toHaveBeenCalledWith({
      viewerId: 9,
      roleIds: [RoleEnum.admin, RoleEnum.staff],
      search: 'ann',
      filter: 'friends',
      limit: 200,
    });
  });

  it('should not restrict roles for staff', async () => {
    await service.findPeople({}, STAFF);

    expect(people.findPeople).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: 7, roleIds: null, filter: 'all' }),
    );
  });

  it('should reject following yourself with 422', async () => {
    await expect(service.follow(7, STAFF)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(people.follow).not.toHaveBeenCalled();
  });

  it('should return 404 when a viewer follows someone they cannot see', async () => {
    people.findPerson.mockResolvedValue(null);

    await expect(service.follow(4, VIEWER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(people.findPerson).toHaveBeenCalledWith({
      viewerId: 9,
      roleIds: [RoleEnum.admin, RoleEnum.staff],
      personId: 4,
    });
    expect(people.follow).not.toHaveBeenCalled();
  });

  it('should follow and return the refreshed person', async () => {
    people.findPerson
      .mockResolvedValueOnce(buildPerson())
      .mockResolvedValueOnce(buildPerson({ followedByMe: true, followers: 1 }));

    const person = await service.follow(3, VIEWER);

    expect(people.follow).toHaveBeenCalledWith(9, 3);
    expect(person).toMatchObject({ followedByMe: true, followers: 1 });
  });

  it('should unfollow and return the refreshed person', async () => {
    const person = await service.unfollow(3, STAFF);

    expect(people.unfollow).toHaveBeenCalledWith(7, 3);
    expect(person.followedByMe).toBe(false);
  });
});
