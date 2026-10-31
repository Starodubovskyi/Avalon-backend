import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { SqlParams } from '../../../../../utils/sql-params';
import { Conversation, NewConversation } from '../../../../domain/conversation';
import { ConversationRepository } from '../../conversation.repository';
import { ConversationMemberEntity } from '../entities/conversation-member.entity';
import { ConversationEntity } from '../entities/conversation.entity';
import { ChatMapper, ConversationRow, MemberRow } from '../mappers/chat.mapper';

@Injectable()
export class ConversationRelationalRepository
  implements ConversationRepository
{
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepository: Repository<ConversationEntity>,
    @InjectRepository(ConversationMemberEntity)
    private readonly memberRepository: Repository<ConversationMemberEntity>,
  ) {}

  async findIdByDirectKey(directKey: string): Promise<NullableType<string>> {
    const entity = await this.conversationRepository.findOne({
      select: { id: true },
      where: { directKey },
    });
    return entity?.id ?? null;
  }

  async create(data: NewConversation, manager: EntityManager): Promise<string> {
    const result = await manager.getRepository(ConversationEntity).insert({
      kind: data.kind,
      title: data.title,
      createdById: data.createdById,
      directKey: data.directKey,
    });
    const id = (result.identifiers[0] as { id: string }).id;
    await manager
      .getRepository(ConversationMemberEntity)
      .insert(data.memberIds.map((userId) => ({ conversationId: id, userId })));
    return id;
  }

  isMember(conversationId: string, userId: number): Promise<boolean> {
    return this.memberRepository.exists({ where: { conversationId, userId } });
  }

  findForMember(userId: number, limit: number): Promise<Conversation[]> {
    return this.findConversations(userId, { limit });
  }

  async findOneForMember(
    conversationId: string,
    userId: number,
  ): Promise<NullableType<Conversation>> {
    const [conversation] = await this.findConversations(userId, {
      conversationId,
      limit: 1,
    });
    return conversation ?? null;
  }

  async markRead(conversationId: string, userId: number): Promise<boolean> {
    const result = await this.memberRepository.update(
      { conversationId, userId },
      // monotonic: a message the user sent may already have set it to now
      { lastReadAt: () => 'GREATEST(COALESCE("lastReadAt", now()), now())' },
    );
    return (result.affected ?? 0) > 0;
  }

  async countUnread(userId: number): Promise<number> {
    const [row]: { total: number }[] = await this.memberRepository.query(
      `SELECT COUNT(*)::int AS "total"
       FROM "conversation_member" me
       JOIN "message" m ON m."conversationId" = me."conversationId"
       WHERE me."userId" = $1
         AND m."senderId" <> $1
         AND m."deletedAt" IS NULL
         AND (me."lastReadAt" IS NULL OR m."createdAt" > me."lastReadAt")`,
      [userId],
    );
    return Number(row?.total ?? 0);
  }

  async touchAfterMessage(
    conversationId: string,
    senderId: number,
    at: Date,
    manager: EntityManager,
  ): Promise<void> {
    // GREATEST keeps both timestamps monotonic under concurrent sends.
    await manager.query(
      `UPDATE "conversation"
       SET "lastMessageAt" = GREATEST(COALESCE("lastMessageAt", CAST($2 AS timestamptz)), CAST($2 AS timestamptz))
       WHERE "id" = $1`,
      [conversationId, at],
    );
    await manager.query(
      `UPDATE "conversation_member"
       SET "lastReadAt" = GREATEST(COALESCE("lastReadAt", CAST($3 AS timestamptz)), CAST($3 AS timestamptz))
       WHERE "conversationId" = $1 AND "userId" = $2`,
      [conversationId, senderId, at],
    );
  }

  /**
   * Two queries regardless of the number of conversations: conversations
   * with last message (LATERAL, uses IDX_message_conversation_createdAt) and
   * unread count, then all members of the page in one batch.
   */
  private async findConversations(
    userId: number,
    options: { conversationId?: string; limit: number },
  ): Promise<Conversation[]> {
    const params = new SqlParams();
    const me = params.add(userId);
    const where = [`me."userId" = ${me}`];
    if (options.conversationId) {
      where.push(`c."id" = ${params.add(options.conversationId)}`);
    }

    const rows: ConversationRow[] = await this.conversationRepository.query(
      `SELECT c."id", c."kind", c."title", c."lastMessageAt",
         lm."body" AS "lastBody", lm."senderId" AS "lastSenderId",
         lm."createdAt" AS "lastCreatedAt",
         (SELECT COUNT(*)::int FROM "message" um
          WHERE um."conversationId" = c."id"
            AND um."deletedAt" IS NULL
            AND um."senderId" <> me."userId"
            AND (me."lastReadAt" IS NULL OR um."createdAt" > me."lastReadAt")
         ) AS "unreadCount"
       FROM "conversation_member" me
       JOIN "conversation" c ON c."id" = me."conversationId"
       LEFT JOIN LATERAL (
         SELECT m."body", m."senderId", m."createdAt"
         FROM "message" m
         WHERE m."conversationId" = c."id" AND m."deletedAt" IS NULL
         ORDER BY m."createdAt" DESC, m."id" DESC
         LIMIT 1
       ) lm ON true
       WHERE ${where.join(' AND ')}
       ORDER BY COALESCE(c."lastMessageAt", c."createdAt") DESC, c."id" DESC
       LIMIT ${params.add(options.limit)}`,
      params.values,
    );
    if (rows.length === 0) {
      return [];
    }

    // Soft-deleted users stay listed as members (history keeps its authors).
    const memberRows: MemberRow[] = await this.memberRepository.query(
      `SELECT cm."conversationId", u."id", u."firstName", u."lastName",
         u."email", u."roleId"
       FROM "conversation_member" cm
       JOIN "user" u ON u."id" = cm."userId"
       WHERE cm."conversationId" = ANY($1::uuid[])
       ORDER BY cm."joinedAt" ASC, u."id" ASC`,
      [rows.map((row) => row.id)],
    );
    const members = ChatMapper.groupMembers(memberRows);

    return rows.map((row) =>
      ChatMapper.toConversation(row, members.get(row.id) ?? []),
    );
  }
}
