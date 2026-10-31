import {
  toUserCard,
  UserCard,
} from '../../../../../users-directory/domain/user-card';
import { ChatMessage } from '../../../../domain/chat-message';
import {
  Conversation,
  ConversationLastMessage,
} from '../../../../domain/conversation';
import { ConversationKind } from '../../../../chat.constants';

export interface MessageRow {
  id: string;
  conversationId: string;
  body: string;
  createdAt: Date;
  senderId: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
}

export interface ConversationRow {
  id: string;
  kind: ConversationKind;
  title: string | null;
  lastMessageAt: Date | null;
  lastBody: string | null;
  lastSenderId: number | null;
  lastCreatedAt: Date | null;
  unreadCount: number;
}

export interface MemberRow {
  conversationId: string;
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
}

export class ChatMapper {
  static toMessage(row: MessageRow): ChatMessage {
    const message = new ChatMessage();
    message.id = row.id;
    message.conversationId = row.conversationId;
    message.body = row.body;
    message.createdAt = row.createdAt.toISOString();
    message.sender = toUserCard({
      id: row.senderId,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      roleId: row.roleId,
    });
    return message;
  }

  static toConversation(
    row: ConversationRow,
    members: UserCard[],
  ): Conversation {
    const conversation = new Conversation();
    conversation.id = row.id;
    conversation.kind = row.kind;
    conversation.title = row.title;
    conversation.members = members;
    conversation.unreadCount = Number(row.unreadCount);
    conversation.lastMessageAt = row.lastMessageAt?.toISOString() ?? null;

    if (row.lastCreatedAt && row.lastSenderId !== null) {
      const lastMessage = new ConversationLastMessage();
      lastMessage.body = row.lastBody ?? '';
      lastMessage.senderId = Number(row.lastSenderId);
      lastMessage.createdAt = row.lastCreatedAt.toISOString();
      conversation.lastMessage = lastMessage;
    } else {
      conversation.lastMessage = null;
    }
    return conversation;
  }

  static groupMembers(rows: MemberRow[]): Map<string, UserCard[]> {
    const byConversation = new Map<string, UserCard[]>();
    for (const row of rows) {
      const members = byConversation.get(row.conversationId) ?? [];
      members.push(toUserCard(row));
      byConversation.set(row.conversationId, members);
    }
    return byConversation;
  }
}
