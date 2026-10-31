import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsersDirectoryService } from '../users-directory/users-directory.service';
import { isTeamRole, NetworkActor } from '../users-directory/user-visibility';
import { isUniqueViolation } from '../utils/is-unique-violation';
import {
  CONVERSATION_LIST_LIMIT,
  MESSAGES_DEFAULT_LIMIT,
  toDirectKey,
} from './chat.constants';
import { ChatMessage } from './domain/chat-message';
import { ChatUnread, Conversation } from './domain/conversation';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { ConversationRepository } from './infrastructure/persistence/conversation.repository';
import { MessageRepository } from './infrastructure/persistence/message.repository';

const DIRECT_KEY_INDEX = 'UQ_conversation_directKey';

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly messageRepository: MessageRepository,
    private readonly directoryService: UsersDirectoryService,
    private readonly dataSource: DataSource,
  ) {}

  findConversations(actor: NetworkActor): Promise<Conversation[]> {
    return this.conversationRepository.findForMember(
      actor.userId,
      CONVERSATION_LIST_LIMIT,
    );
  }

  /** One other user → the direct conversation (reused); more → a new group. */
  async createConversation(
    dto: CreateConversationDto,
    actor: NetworkActor,
  ): Promise<Conversation> {
    const others = [...new Set(dto.userIds)].filter(
      (id) => id !== actor.userId,
    );
    if (others.length === 0) {
      throw this.validationError('userIds', 'notAllowed');
    }
    await this.assertReachable(actor, others);

    const id =
      others.length === 1
        ? await this.openDirect(actor, others[0])
        : await this.createGroup(actor, others, dto.title);
    return this.getForMemberOrFail(id, actor);
  }

  async findMessages(
    conversationId: string,
    query: QueryMessagesDto,
    actor: NetworkActor,
  ): Promise<ChatMessage[]> {
    await this.assertMember(conversationId, actor);
    return this.messageRepository.findMany({
      conversationId,
      after: query.after,
      limit: query.limit ?? MESSAGES_DEFAULT_LIMIT,
    });
  }

  async sendMessage(
    conversationId: string,
    dto: CreateMessageDto,
    actor: NetworkActor,
  ): Promise<ChatMessage> {
    await this.assertMember(conversationId, actor);
    return this.dataSource.transaction(async (manager) => {
      const message = await this.messageRepository.create(
        { conversationId, senderId: actor.userId, body: dto.body },
        manager,
      );
      // the sender has read everything up to their own message
      await this.conversationRepository.touchAfterMessage(
        conversationId,
        actor.userId,
        new Date(message.createdAt),
        manager,
      );
      return message;
    });
  }

  async markRead(conversationId: string, actor: NetworkActor): Promise<void> {
    if (
      !(await this.conversationRepository.markRead(
        conversationId,
        actor.userId,
      ))
    ) {
      throw this.conversationNotFound();
    }
  }

  async countUnread(actor: NetworkActor): Promise<ChatUnread> {
    const unread = new ChatUnread();
    unread.total = await this.conversationRepository.countUnread(actor.userId);
    return unread;
  }

  private async openDirect(
    actor: NetworkActor,
    otherId: number,
  ): Promise<string> {
    const directKey = toDirectKey(actor.userId, otherId);
    const existing =
      await this.conversationRepository.findIdByDirectKey(directKey);
    if (existing) {
      return existing;
    }

    try {
      return await this.dataSource.transaction((manager) =>
        this.conversationRepository.create(
          {
            kind: 'direct',
            title: null,
            createdById: actor.userId,
            directKey,
            memberIds: [actor.userId, otherId],
          },
          manager,
        ),
      );
    } catch (error) {
      // Two simultaneous "Message" clicks: the unique index keeps one row.
      if (isUniqueViolation(error, DIRECT_KEY_INDEX)) {
        const winner =
          await this.conversationRepository.findIdByDirectKey(directKey);
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  private createGroup(
    actor: NetworkActor,
    others: number[],
    title: string | undefined,
  ): Promise<string> {
    if (!title) {
      throw this.validationError('title', 'required');
    }
    return this.dataSource.transaction((manager) =>
      this.conversationRepository.create(
        {
          kind: 'group',
          title,
          createdById: actor.userId,
          directKey: null,
          memberIds: [actor.userId, ...others],
        },
        manager,
      ),
    );
  }

  /**
   * Viewers may only talk to admin/staff. For them an unknown id is reported
   * like a hidden one, so the response does not reveal which viewers exist.
   */
  private async assertReachable(
    actor: NetworkActor,
    userIds: number[],
  ): Promise<void> {
    const { hidden, missing } = await this.directoryService.classify(
      actor,
      userIds,
    );
    if (
      hidden.length > 0 ||
      (missing.length > 0 && !isTeamRole(actor.roleId))
    ) {
      throw this.validationError('userIds', 'notAllowed');
    }
    if (missing.length > 0) {
      throw this.validationError('userIds', 'notFound');
    }
  }

  private async assertMember(
    conversationId: string,
    actor: NetworkActor,
  ): Promise<void> {
    if (
      !(await this.conversationRepository.isMember(
        conversationId,
        actor.userId,
      ))
    ) {
      throw this.conversationNotFound();
    }
  }

  private async getForMemberOrFail(
    conversationId: string,
    actor: NetworkActor,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOneForMember(
      conversationId,
      actor.userId,
    );
    if (!conversation) {
      throw this.conversationNotFound();
    }
    return conversation;
  }

  private conversationNotFound(): NotFoundException {
    return new NotFoundException('Conversation not found');
  }

  private validationError(
    field: string,
    code: string,
  ): UnprocessableEntityException {
    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { [field]: code },
    });
  }
}
