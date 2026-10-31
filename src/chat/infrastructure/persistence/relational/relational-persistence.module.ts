import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConversationRepository } from '../conversation.repository';
import { MessageRepository } from '../message.repository';
import { ConversationMemberEntity } from './entities/conversation-member.entity';
import { ConversationEntity } from './entities/conversation.entity';
import { MessageEntity } from './entities/message.entity';
import { ConversationRelationalRepository } from './repositories/conversation.repository';
import { MessageRelationalRepository } from './repositories/message.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConversationEntity,
      ConversationMemberEntity,
      MessageEntity,
    ]),
  ],
  providers: [
    {
      provide: ConversationRepository,
      useClass: ConversationRelationalRepository,
    },
    {
      provide: MessageRepository,
      useClass: MessageRelationalRepository,
    },
  ],
  exports: [ConversationRepository, MessageRepository],
})
export class RelationalChatPersistenceModule {}
