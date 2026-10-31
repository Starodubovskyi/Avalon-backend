import { Module } from '@nestjs/common';
import { UsersDirectoryModule } from '../users-directory/users-directory.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationsController } from './conversations.controller';
import { RelationalChatPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [RelationalChatPersistenceModule, UsersDirectoryModule],
  controllers: [ConversationsController, ChatController],
  providers: [ChatService],
})
export class ChatModule {}
