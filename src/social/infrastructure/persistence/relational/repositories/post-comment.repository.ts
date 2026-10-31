import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import {
  PostCommentData,
  PostCommentRef,
} from '../../../../domain/post-comment';
import {
  NewPostComment,
  PostCommentRepository,
} from '../../post-comment.repository';
import { PostCommentEntity } from '../entities/post-comment.entity';
import { CommentRow, SocialMapper } from '../mappers/social.mapper';
import { SqlParams } from '../../../../../utils/sql-params';

const AUTHOR_COLUMNS = `u."id" AS "authorId", u."firstName", u."lastName", u."email", u."roleId"`;

@Injectable()
export class PostCommentRelationalRepository implements PostCommentRepository {
  constructor(
    @InjectRepository(PostCommentEntity)
    private readonly commentRepository: Repository<PostCommentEntity>,
  ) {}

  async findByPost(
    postId: string,
    limit: number,
    visibility?: { viewerId: number; authorRoleIds: number[] | null },
  ): Promise<PostCommentData[]> {
    const params = new SqlParams();
    const where = [
      `c."postId" = ${params.add(postId)}`,
      'c."deletedAt" IS NULL',
    ];
    if (visibility?.authorRoleIds) {
      where.push(
        `(c."authorId" = ${params.add(visibility.viewerId)} OR u."roleId" = ANY(${params.add(visibility.authorRoleIds)}))`,
      );
    }
    const rows: CommentRow[] = await this.commentRepository.query(
      `SELECT c."id", c."postId", c."body", c."createdAt", ${AUTHOR_COLUMNS}
       FROM "post_comment" c
       JOIN "user" u ON u."id" = c."authorId"
       WHERE ${where.join(' AND ')}
       ORDER BY c."createdAt" DESC, c."id" DESC
       LIMIT ${params.add(limit)}`,
      params.values,
    );
    return rows.map((row) => SocialMapper.toComment(row)).reverse();
  }

  async create(data: NewPostComment): Promise<PostCommentData> {
    const [row]: CommentRow[] = await this.commentRepository.query(
      `WITH c AS (
         INSERT INTO "post_comment" ("postId", "authorId", "body")
         VALUES ($1, $2, $3)
         RETURNING "id", "postId", "authorId", "body", "createdAt"
       )
       SELECT c."id", c."postId", c."body", c."createdAt", ${AUTHOR_COLUMNS}
       FROM c
       JOIN "user" u ON u."id" = c."authorId"`,
      [data.postId, data.authorId, data.body],
    );
    return SocialMapper.toComment(row);
  }

  async findActiveRef(id: string): Promise<NullableType<PostCommentRef>> {
    const [row]: PostCommentRef[] = await this.commentRepository.query(
      `SELECT c."id", c."postId", c."authorId"
       FROM "post_comment" c
       JOIN "post" p ON p."id" = c."postId" AND p."deletedAt" IS NULL
       WHERE c."id" = $1 AND c."deletedAt" IS NULL`,
      [id],
    );
    return row
      ? { id: row.id, postId: row.postId, authorId: Number(row.authorId) }
      : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.commentRepository.update(
      { id, deletedAt: IsNull() },
      { deletedAt: new Date() },
    );
    return (result.affected ?? 0) > 0;
  }
}
