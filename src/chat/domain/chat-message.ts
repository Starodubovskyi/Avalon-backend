import { ApiProperty } from '@nestjs/swagger';
import { UserCard } from '../../users-directory/domain/user-card';

export class ChatMessage {
  @ApiProperty({ type: String, format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, format: 'uuid' })
  conversationId: string;

  @ApiProperty({ type: () => UserCard })
  sender: UserCard;

  @ApiProperty({ type: String, example: 'Pilot booked for 14:00' })
  body: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

export interface NewChatMessage {
  conversationId: string;
  senderId: number;
  body: string;
}
