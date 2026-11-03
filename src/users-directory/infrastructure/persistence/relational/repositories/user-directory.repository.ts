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
import {
  emailSearchScope,
  publicProfileSql,
  visibleUserSql,
} from '../user-visibility-sql';

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
    const visible = visibleUserSql('u', filter.visibleUsers, params);
    if (visible) {
      where.push(visible);
    }
    const pattern = toUserSearchPattern(filter.search);
    if (pattern) {
      where.push(
        userSearchCondition(
          'u',
          params.add(pattern),
          emailSearchScope(filter.visibleUsers, filter.excludeUserId, params),
        ),
      );
    }

    const rows: UserCardRow[] = await this.userRepository.query(
      `SELECT u."id", u."firstName", u."lastName", u."email", u."roleId"
       FROM "user" u
       WHERE ${where.join(' AND ')}
       ORDER BY ${userOrderBy('u', filter.visibleUsers === null)}
       LIMIT ${params.add(filter.limit)}`,
      params.values,
    );
    return rows.map(toUserCard);
  }

  async findActiveRoles(ids: number[]): Promise<DirectoryUserRole[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows: {
      id: number;
      roleId: number | null;
      publicProfile: boolean;
    }[] = await this.userRepository.query(
      `SELECT u."id", u."roleId", ${publicProfileSql('u."id"')} AS "publicProfile"
       FROM "user" u
       WHERE u."id" = ANY($1::int[]) AND u."deletedAt" IS NULL`,
      [ids],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      roleId: row.roleId === null ? null : Number(row.roleId),
      publicProfile: Boolean(row.publicProfile),
    }));
  }
}
