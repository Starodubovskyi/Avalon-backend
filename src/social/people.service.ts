import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  NetworkActor,
  visibleRoleIds,
} from '../users-directory/user-visibility';
import { Person } from './domain/person';
import { QueryPeopleDto } from './dto/query-people.dto';
import { PeopleRepository } from './infrastructure/persistence/people.repository';
import { PEOPLE_LIMIT } from './social.constants';

/** Same visibility as the directory: viewers only see (and follow) admin/staff. */
@Injectable()
export class PeopleService {
  constructor(private readonly peopleRepository: PeopleRepository) {}

  findPeople(query: QueryPeopleDto, actor: NetworkActor): Promise<Person[]> {
    return this.peopleRepository.findPeople({
      viewerId: actor.userId,
      roleIds: visibleRoleIds(actor),
      search: query.search,
      filter: query.filter ?? 'all',
      limit: PEOPLE_LIMIT,
    });
  }

  async follow(personId: number, actor: NetworkActor): Promise<Person> {
    this.assertNotSelf(personId, actor);
    await this.getVisibleOrFail(personId, actor);
    await this.peopleRepository.follow(actor.userId, personId);
    return this.getVisibleOrFail(personId, actor);
  }

  async unfollow(personId: number, actor: NetworkActor): Promise<Person> {
    this.assertNotSelf(personId, actor);
    await this.getVisibleOrFail(personId, actor);
    await this.peopleRepository.unfollow(actor.userId, personId);
    return this.getVisibleOrFail(personId, actor);
  }

  private assertNotSelf(personId: number, actor: NetworkActor): void {
    if (personId === actor.userId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { id: 'cannotFollowSelf' },
      });
    }
  }

  /** Unknown, deleted and hidden people all look the same: 404. */
  private async getVisibleOrFail(
    personId: number,
    actor: NetworkActor,
  ): Promise<Person> {
    const person = await this.peopleRepository.findPerson({
      viewerId: actor.userId,
      roleIds: visibleRoleIds(actor),
      personId,
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }
    return person;
  }
}
