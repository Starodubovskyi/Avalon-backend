import { NullableType } from '../../../utils/types/nullable.type';
import { Person } from '../../domain/person';
import { PeopleFilter } from '../../social.constants';

export interface PeopleQuery {
  /** The caller: never part of the result; drives followedByMe/followsMe. */
  viewerId: number;
  /** null = any role. */
  roleIds: number[] | null;
  search?: string;
  /** friends = mutual follow. */
  filter: PeopleFilter;
  limit: number;
}

export interface PersonQuery {
  viewerId: number;
  roleIds: number[] | null;
  personId: number;
}

/** Soft-deleted users are never returned. Counters are computed in SQL. */
export abstract class PeopleRepository {
  abstract findPeople(query: PeopleQuery): Promise<Person[]>;

  /** null when the person does not exist, is deleted or not visible. */
  abstract findPerson(query: PersonQuery): Promise<NullableType<Person>>;

  /** Idempotent. */
  abstract follow(followerId: number, followeeId: number): Promise<void>;

  /** Idempotent. */
  abstract unfollow(followerId: number, followeeId: number): Promise<void>;
}
