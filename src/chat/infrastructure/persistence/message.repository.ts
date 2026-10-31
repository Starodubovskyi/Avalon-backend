import { EntityManager } from 'typeorm';
import { ChatMessage, NewChatMessage } from '../../domain/chat-message';

export interface MessageListFilter {
  conversationId: string;
  /** ISO date-time: only messages created strictly after it. */
  after?: string;
  limit: number;
}

export abstract class MessageRepository {
  /**
   * Always ascending by time. Without `after`: the latest `limit` messages;
   * with `after`: the first `limit` messages newer than it (polling).
   */
  abstract findMany(filter: MessageListFilter): Promise<ChatMessage[]>;

  abstract create(
    data: NewChatMessage,
    manager: EntityManager,
  ): Promise<ChatMessage>;
}
