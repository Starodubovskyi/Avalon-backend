import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { SqlParams } from '../../../../../utils/sql-params';
import {
  toUserCard,
  UserCard,
  UserCardRow,
} from '../../../../domain/user-card';
import {
  DirectoryUserRole,
  UserDirectoryFilter,
  UserDirectoryRepository,
} from '../../user-directory.repository';
import {
  toUserSearchPattern,
  userOrderBy,
  userSearchCondition,
} from '../user-search';

@Injectable()
export class UserDirectoryRelationalRepository
  implements UserDirectoryRepository
{
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async search(filter: UserDirectoryFilter): Promise<UserCard[]> {
    const params = new SqlParams();
    const where = [
      'u."deletedAt" IS NULL',
      `u."id" <> ${params.add(filter.excludeUserId)}`,
    ];
    if (filter.roleIds) {
      where.push(`u."roleId" = ANY(${params.add(filter.roleIds)}::int[])`);
    }
    const pattern = toUserSearchPattern(filter.search);
    if (pattern) {
      where.push(userSearchCondition('u', params.add(pattern)));
    }

    const rows: UserCardRow[] = await this.userRepository.query(
      `SELECT u."id", u."firstName", u."lastName", u."email", u."roleId"
       FROM "user" u
       WHERE ${where.join(' AND ')}
       ORDER BY ${userOrderBy('u')}
       LIMIT ${params.add(filter.limit)}`,
      params.values,
    );
    return rows.map(toUserCard);
  }

  async findActiveRoles(ids: number[]): Promise<DirectoryUserRole[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows: { id: number; roleId: number | null }[] =
      await this.userRepository.query(
        `SELECT u."id", u."roleId" FROM "user" u
         WHERE u."id" = ANY($1::int[]) AND u."deletedAt" IS NULL`,
        [ids],
      );
    return rows.map((row) => ({
      id: Number(row.id),
      roleId: row.roleId === null ? null : Number(row.roleId),
    }));
  }
}
