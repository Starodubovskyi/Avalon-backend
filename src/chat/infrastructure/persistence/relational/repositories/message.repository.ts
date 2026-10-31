import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SqlParams } from '../../../../../utils/sql-params';
import { ChatMessage, NewChatMessage } from '../../../../domain/chat-message';
import { MessageListFilter, MessageRepository } from '../../message.repository';
import { MessageEntity } from '../entities/message.entity';
import { ChatMapper, MessageRow } from '../mappers/chat.mapper';

const SENDER_COLUMNS = `u."id" AS "senderId", u."firstName", u."lastName", u."email", u."roleId"`;

@Injectable()
export class MessageRelationalRepository implements MessageRepository {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
  ) {}

  async findMany(filter: MessageListFilter): Promise<ChatMessage[]> {
    const params = new SqlParams();
    const where = [
      `m."conversationId" = ${params.add(filter.conversationId)}`,
      'm."deletedAt" IS NULL',
    ];
    // createdAt is timestamptz(3), the same precision as the ISO strings the
    // API returns, so "strictly after the last seen message" is exact.
    if (filter.after) {
      where.push(
        `m."createdAt" > CAST(${params.add(filter.after)} AS timestamptz)`,
      );
    }
    // Polling reads forward from the cursor; the initial load takes the tail.
    const direction = filter.after ? 'ASC' : 'DESC';

    const rows: MessageRow[] = await this.messageRepository.query(
      `SELECT m."id", m."conversationId", m."body", m."createdAt", ${SENDER_COLUMNS}
       FROM "message" m
       JOIN "user" u ON u."id" = m."senderId"
       WHERE ${where.join(' AND ')}
       ORDER BY m."createdAt" ${direction}, m."id" ${direction}
       LIMIT ${params.add(filter.limit)}`,
      params.values,
    );
    const messages = rows.map((row) => ChatMapper.toMessage(row));
    return filter.after ? messages : messages.reverse();
  }

  async create(
    data: NewChatMessage,
    manager: EntityManager,
  ): Promise<ChatMessage> {
    const [row]: MessageRow[] = await manager.query(
      `WITH m AS (
         INSERT INTO "message" ("conversationId", "senderId", "body")
         VALUES ($1, $2, $3)
         RETURNING "id", "conversationId", "senderId", "body", "createdAt"
       )
       SELECT m."id", m."conversationId", m."body", m."createdAt", ${SENDER_COLUMNS}
       FROM m
       JOIN "user" u ON u."id" = m."senderId"`,
      [data.conversationId, data.senderId, data.body],
    );
    return ChatMapper.toMessage(row);
  }
}
