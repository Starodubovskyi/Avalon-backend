import { ApiProperty } from '@nestjs/swagger';
import { UserCard } from '../../users-directory/domain/user-card';
import { CONVERSATION_KINDS, ConversationKind } from '../chat.constants';

export class ConversationLastMessage {
  @ApiProperty({ type: String })
  body: string;

  @ApiProperty({ type: Number })
  senderId: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

/** A conversation as seen by one member (unreadCount is per member). */
export class Conversation {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ enum: CONVERSATION_KINDS })
  kind: ConversationKind;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Group title; null for direct conversations',
  })
  title: string | null;

  @ApiProperty({
    type: () => [UserCard],
    description: 'All members, including the caller',
  })
  members: UserCard[];

  @ApiProperty({ type: () => ConversationLastMessage, nullable: true })
  lastMessage: ConversationLastMessage | null;

  @ApiProperty({
    type: Number,
    description: "Messages from others newer than the caller's lastReadAt",
  })
  unreadCount: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastMessageAt: string | null;
}

export class ChatUnread {
  @ApiProperty({ type: Number, example: 3 })
  total: number;
}

export interface NewConversation {
  kind: ConversationKind;
  title: string | null;
  createdById: number;
  directKey: string | null;
  /** Every member, the creator included. */
  memberIds: number[];
}
