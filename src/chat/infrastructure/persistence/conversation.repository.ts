import { EntityManager } from 'typeorm';
import { NullableType } from '../../../utils/types/nullable.type';
import { Conversation, NewConversation } from '../../domain/conversation';

/**
 * Reads return the conversation as seen by one member (unread count, last
 * message, all members). Writes that must commit together with a message
 * take the EntityManager of the caller's transaction.
 */
export abstract class ConversationRepository {
  abstract findIdByDirectKey(directKey: string): Promise<NullableType<string>>;

  /** Inserts the conversation and all its members; returns the new id. */
  abstract create(
    data: NewConversation,
    manager: EntityManager,
  ): Promise<string>;

  abstract isMember(conversationId: string, userId: number): Promise<boolean>;

  /** Latest activity first (lastMessageAt, else createdAt). */
  abstract findForMember(
    userId: number,
    limit: number,
  ): Promise<Conversation[]>;

  /** null when the conversation does not exist or the user is not a member. */
  abstract findOneForMember(
    conversationId: string,
    userId: number,
  ): Promise<NullableType<Conversation>>;

  /** Sets the member's lastReadAt to now; false when not a member. */
  abstract markRead(conversationId: string, userId: number): Promise<boolean>;

  /** Unread messages over all conversations of the user. */
  abstract countUnread(userId: number): Promise<number>;

  /** After a new message: bumps lastMessageAt and the sender's lastReadAt. */
  abstract touchAfterMessage(
    conversationId: string,
    senderId: number,
    at: Date,
    manager: EntityManager,
  ): Promise<void>;
}
