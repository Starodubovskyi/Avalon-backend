import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  toUserSearchPattern,
  userOrderBy,
  userSearchCondition,
} from '../../../../../users-directory/infrastructure/persistence/relational/user-search';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SqlParams } from '../../../../../utils/sql-params';
import { Person } from '../../../../domain/person';
import { PeopleFilter } from '../../../../social.constants';
import {
  PeopleQuery,
  PeopleRepository,
  PersonQuery,
} from '../../people.repository';
import { FollowEntity } from '../entities/follow.entity';
import { PersonRow, SocialMapper } from '../mappers/social.mapper';

interface PeopleSelect {
  viewerId: number;
  roleIds: number[] | null;
  search?: string;
  filter: PeopleFilter;
  personId?: number;
  limit: number;
}

@Injectable()
export class PeopleRelationalRepository implements PeopleRepository {
  constructor(
    @InjectRepository(FollowEntity)
    private readonly followRepository: Repository<FollowEntity>,
  ) {}

  findPeople(query: PeopleQuery): Promise<Person[]> {
    return this.selectPeople(query);
  }

  async findPerson(query: PersonQuery): Promise<NullableType<Person>> {
    const [person] = await this.selectPeople({
      ...query,
      filter: 'all',
      limit: 1,
    });
    return person ?? null;
  }

  async follow(followerId: number, followeeId: number): Promise<void> {
    await this.followRepository
      .createQueryBuilder()
      .insert()
      .into(FollowEntity)
      .values({ followerId, followeeId })
      .orIgnore()
      .execute();
  }

  async unfollow(followerId: number, followeeId: number): Promise<void> {
    await this.followRepository.delete({ followerId, followeeId });
  }

  private async selectPeople(query: PeopleSelect): Promise<Person[]> {
    const params = new SqlParams();
    const viewer = params.add(query.viewerId);
    const followedByMe = `EXISTS (SELECT 1 FROM "follow" f WHERE f."followerId" = ${viewer} AND f."followeeId" = u."id")`;
    const followsMe = `EXISTS (SELECT 1 FROM "follow" f WHERE f."followerId" = u."id" AND f."followeeId" = ${viewer})`;

    const where = ['u."deletedAt" IS NULL', `u."id" <> ${viewer}`];
    if (query.roleIds) {
      where.push(`u."roleId" = ANY(${params.add(query.roleIds)}::int[])`);
    }
    if (query.personId !== undefined) {
      where.push(`u."id" = ${params.add(query.personId)}`);
    }
    const pattern = toUserSearchPattern(query.search);
    if (pattern) {
      where.push(userSearchCondition('u', params.add(pattern)));
    }
    if (query.filter === 'following' || query.filter === 'friends') {
      where.push(followedByMe);
    }
    if (query.filter === 'followers' || query.filter === 'friends') {
      where.push(followsMe);
    }

    // Follow counters ignore soft-deleted accounts on the other side.
    const rows: PersonRow[] = await this.followRepository.query(
      `SELECT u."id", u."firstName", u."lastName", u."email", u."roleId",
         ${followedByMe} AS "followedByMe",
         ${followsMe} AS "followsMe",
         (SELECT COUNT(*)::int FROM "follow" f
          JOIN "user" fu ON fu."id" = f."followerId" AND fu."deletedAt" IS NULL
          WHERE f."followeeId" = u."id") AS "followers",
         (SELECT COUNT(*)::int FROM "follow" f
          JOIN "user" fu ON fu."id" = f."followeeId" AND fu."deletedAt" IS NULL
          WHERE f."followerId" = u."id") AS "following",
         (SELECT COUNT(*)::int FROM "post" p
          WHERE p."authorId" = u."id" AND p."deletedAt" IS NULL) AS "posts"
       FROM "user" u
       WHERE ${where.join(' AND ')}
       ORDER BY ${userOrderBy('u')}
       LIMIT ${params.add(query.limit)}`,
      params.values,
    );
    return rows.map((row) => SocialMapper.toPerson(row));
  }
}
