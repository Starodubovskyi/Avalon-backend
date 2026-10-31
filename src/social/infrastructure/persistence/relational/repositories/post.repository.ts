import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SqlParams } from '../../../../../utils/sql-params';
import { PostData, PostRef } from '../../../../domain/post';
import { FeedFilter, PostRepository } from '../../post.repository';
import { PostLikeEntity } from '../entities/post-like.entity';
import { PostEntity } from '../entities/post.entity';
import { PostRow, SocialMapper } from '../mappers/social.mapper';

@Injectable()
export class PostRelationalRepository implements PostRepository {
  constructor(
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
    @InjectRepository(PostLikeEntity)
    private readonly likeRepository: Repository<PostLikeEntity>,
  ) {}

  async findFeed(filter: FeedFilter): Promise<PostData[]> {
    const params = new SqlParams();
    const viewer = params.add(filter.viewerId);
    const where = ['p."deletedAt" IS NULL'];
    const roles = filter.authorRoleIds
      ? params.add(filter.authorRoleIds)
      : null;
    if (roles) {
      where.push(`(p."authorId" = ${viewer} OR u."roleId" = ANY(${roles}))`);
    }
    if (filter.scope === 'following') {
      where.push(
        `(p."authorId" = ${viewer} OR p."authorId" IN (SELECT f."followeeId" FROM "follow" f WHERE f."followerId" = ${viewer}))`,
      );
    }
    // createdAt is timestamptz(3), the precision of the ISO strings returned.
    if (filter.before) {
      where.push(
        `p."createdAt" < CAST(${params.add(filter.before)} AS timestamptz)`,
      );
    }
    return this.selectPosts(
      params,
      viewer,
      where,
      `ORDER BY p."createdAt" DESC, p."id" DESC LIMIT ${params.add(filter.limit)}`,
      roles,
    );
  }

  async findOne(id: string, viewerId: number): Promise<NullableType<PostData>> {
    const params = new SqlParams();
    const viewer = params.add(viewerId);
    const [post] = await this.selectPosts(params, viewer, [
      'p."deletedAt" IS NULL',
      `p."id" = ${params.add(id)}`,
    ]);
    return post ?? null;
  }

  async findActiveRef(id: string): Promise<NullableType<PostRef>> {
    const entity = await this.postRepository.findOne({
      select: { id: true, authorId: true },
      where: { id, deletedAt: IsNull() },
    });
    return entity ? { id: entity.id, authorId: entity.authorId } : null;
  }

  async create(authorId: number, body: string): Promise<string> {
    const result = await this.postRepository.insert({ authorId, body });
    return (result.identifiers[0] as { id: string }).id;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.postRepository.update(
      { id, deletedAt: IsNull() },
      { deletedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }

  async like(postId: string, userId: number): Promise<void> {
    await this.likeRepository
      .createQueryBuilder()
      .insert()
      .into(PostLikeEntity)
      .values({ postId, userId })
      .orIgnore()
      .execute();
  }

  async unlike(postId: string, userId: number): Promise<void> {
    await this.likeRepository.delete({ postId, userId });
  }

  countLikes(postId: string): Promise<number> {
    return this.likeRepository.count({ where: { postId } });
  }

  private async selectPosts(
    params: SqlParams,
    viewer: string,
    where: string[],
    tail = '',
    commentRoles: string | null = null,
  ): Promise<PostData[]> {
    // Hidden authors' comments are not counted, so the count matches the visible thread.
    const commentVisible = commentRoles
      ? `AND (pc."authorId" = ${viewer} OR EXISTS (SELECT 1 FROM "user" cu
              WHERE cu."id" = pc."authorId" AND cu."roleId" = ANY(${commentRoles})))`
      : '';
    // Authors stay visible even if their account was soft-deleted.
    const rows: PostRow[] = await this.postRepository.query(
      `SELECT p."id", p."body", p."createdAt",
         u."id" AS "authorId", u."firstName", u."lastName", u."email", u."roleId",
         (SELECT COUNT(*)::int FROM "post_like" l WHERE l."postId" = p."id") AS "likeCount",
         (SELECT COUNT(*)::int FROM "post_comment" pc
          WHERE pc."postId" = p."id" AND pc."deletedAt" IS NULL ${commentVisible}) AS "commentCount",
         EXISTS (SELECT 1 FROM "post_like" ml
                 WHERE ml."postId" = p."id" AND ml."userId" = ${viewer}) AS "likedByMe"
       FROM "post" p
       JOIN "user" u ON u."id" = p."authorId"
       WHERE ${where.join(' AND ')}
       ${tail}`,
      params.values,
    );
    return rows.map((row) => SocialMapper.toPost(row));
  }
}
