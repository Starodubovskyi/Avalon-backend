import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { RoleEnum } from '../roles/roles.enum';
import { UsersDirectoryService } from '../users-directory/users-directory.service';
import { NetworkActor } from '../users-directory/user-visibility';
import { ChatService } from './chat.service';
import { ChatMessage } from './domain/chat-message';
import { Conversation } from './domain/conversation';
import { ConversationRepository } from './infrastructure/persistence/conversation.repository';
import { MessageRepository } from './infrastructure/persistence/message.repository';

const CONVERSATION_ID = '33333333-3333-3333-3333-333333333333';
const STAFF: NetworkActor = { userId: 7, roleId: RoleEnum.staff };
const VIEWER: NetworkActor = { userId: 9, roleId: RoleEnum.user };

function buildConversation(overrides: Partial<Conversation> = {}) {
  return Object.assign(new Conversation(), {
    id: CONVERSATION_ID,
    kind: 'direct',
    title: null,
    members: [],
    lastMessage: null,
    unreadCount: 0,
    lastMessageAt: null,
    ...overrides,
  });
}

function getErrors(error: unknown): Record<string, string> {
  return (
    (error as UnprocessableEntityException).getResponse() as {
      errors: Record<string, string>;
    }
  ).errors;
}

describe('ChatService', () => {
  let service: ChatService;
  let conversations: {
    findIdByDirectKey: jest.Mock;
    create: jest.Mock;
    isMember: jest.Mock;
    findForMember: jest.Mock;
    findOneForMember: jest.Mock;
    markRead: jest.Mock;
    countUnread: jest.Mock;
    touchAfterMessage: jest.Mock;
  };
  let messages: { findMany: jest.Mock; create: jest.Mock };
  let directory: { classify: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  const manager = {} as EntityManager;

  beforeEach(() => {
    conversations = {
      findIdByDirectKey: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(CONVERSATION_ID),
      isMember: jest.fn().mockResolvedValue(true),
      findForMember: jest.fn().mockResolvedValue([]),
      findOneForMember: jest.fn().mockResolvedValue(buildConversation()),
      markRead: jest.fn().mockResolvedValue(true),
      countUnread: jest.fn().mockResolvedValue(0),
      touchAfterMessage: jest.fn().mockResolvedValue(undefined),
    };
    messages = { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() };
    directory = {
      classify: jest.fn((_actor: NetworkActor, ids: number[]) =>
        Promise.resolve({ visible: ids, hidden: [], missing: [] }),
      ),
    };
    dataSource = {
      transaction: jest.fn(
        (work: (entityManager: EntityManager) => Promise<unknown>) =>
          work(manager),
      ),
    };
    service = new ChatService(
      conversations as unknown as ConversationRepository,
      messages as unknown as MessageRepository,
      directory as unknown as UsersDirectoryService,
      dataSource as unknown as DataSource,
    );
  });

  describe('createConversation: direct', () => {
    it('should return the existing direct conversation instead of creating another', async () => {
      conversations.findIdByDirectKey.mockResolvedValue(CONVERSATION_ID);

      const result = await service.createConversation({ userIds: [3] }, STAFF);

      expect(conversations.findIdByDirectKey).toHaveBeenCalledWith('3:7');
      expect(conversations.create).not.toHaveBeenCalled();
      expect(conversations.findOneForMember).toHaveBeenCalledWith(
        CONVERSATION_ID,
        STAFF.userId,
      );
      expect(result.id).toBe(CONVERSATION_ID);
    });

    it('should create a direct conversation keyed min:max with both members', async () => {
      await service.createConversation({ userIds: [12] }, STAFF);

      expect(conversations.create).toHaveBeenCalledWith(
        {
          kind: 'direct',
          title: null,
          createdById: 7,
          directKey: '7:12',
          memberIds: [7, 12],
        },
        manager,
      );
    });

    it('should ignore a title, duplicates and the caller for a single other user', async () => {
      await service.createConversation(
        { userIds: [12, 12, 7], title: 'Ignored' },
        STAFF,
      );

      expect(conversations.create).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'direct', title: null }),
        manager,
      );
    });

    it('should reuse the winner when a concurrent request created the same direct conversation', async () => {
      const violation = new QueryFailedError('INSERT', [], {
        code: '23505',
        constraint: 'UQ_conversation_directKey',
      } as unknown as Error);
      dataSource.transaction.mockRejectedValueOnce(violation);
      conversations.findIdByDirectKey
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(CONVERSATION_ID);

      const result = await service.createConversation({ userIds: [12] }, STAFF);

      expect(result.id).toBe(CONVERSATION_ID);
      expect(conversations.findIdByDirectKey).toHaveBeenCalledTimes(2);
    });

    it('should reject a conversation with only the caller', async () => {
      await expect(
        service.createConversation({ userIds: [7] }, STAFF),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(directory.classify).not.toHaveBeenCalled();
    });
  });

  describe('createConversation: group', () => {
    it('should require a title for two or more other users', async () => {
      const error = await service
        .createConversation({ userIds: [3, 4] }, STAFF)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect(getErrors(error)).toEqual({ title: 'required' });
      expect(conversations.create).not.toHaveBeenCalled();
    });

    it('should create a group with the caller and all participants', async () => {
      await service.createConversation(
        { userIds: [3, 4], title: 'Reni berth' },
        STAFF,
      );

      expect(conversations.findIdByDirectKey).not.toHaveBeenCalled();
      expect(conversations.create).toHaveBeenCalledWith(
        {
          kind: 'group',
          title: 'Reni berth',
          createdById: 7,
          directKey: null,
          memberIds: [7, 3, 4],
        },
        manager,
      );
    });
  });

  describe('createConversation: viewer restrictions', () => {
    it('should reject a viewer writing to another viewer with userIds notAllowed', async () => {
      directory.classify.mockResolvedValue({
        visible: [],
        hidden: [4],
        missing: [],
      });

      const error = await service
        .createConversation({ userIds: [4] }, VIEWER)
        .catch((caught: unknown) => caught);

      expect(getErrors(error)).toEqual({ userIds: 'notAllowed' });
      expect(conversations.findIdByDirectKey).not.toHaveBeenCalled();
      expect(conversations.create).not.toHaveBeenCalled();
    });

    it('should reject a group of a viewer that includes a hidden user', async () => {
      directory.classify.mockResolvedValue({
        visible: [1],
        hidden: [4],
        missing: [],
      });

      const error = await service
        .createConversation({ userIds: [1, 4], title: 'Mixed' }, VIEWER)
        .catch((caught: unknown) => caught);

      expect(getErrors(error)).toEqual({ userIds: 'notAllowed' });
    });

    it('should report unknown users to a viewer as notAllowed, not notFound', async () => {
      directory.classify.mockResolvedValue({
        visible: [],
        hidden: [],
        missing: [999],
      });

      const error = await service
        .createConversation({ userIds: [999] }, VIEWER)
        .catch((caught: unknown) => caught);

      expect(getErrors(error)).toEqual({ userIds: 'notAllowed' });
    });

    it('should report unknown users to staff as notFound', async () => {
      directory.classify.mockResolvedValue({
        visible: [],
        hidden: [],
        missing: [999],
      });

      const error = await service
        .createConversation({ userIds: [999] }, STAFF)
        .catch((caught: unknown) => caught);

      expect(getErrors(error)).toEqual({ userIds: 'notFound' });
    });
  });

  describe('membership', () => {
    beforeEach(() => {
      conversations.isMember.mockResolvedValue(false);
      conversations.markRead.mockResolvedValue(false);
    });

    it('should return 404 to a non-member reading messages', async () => {
      await expect(
        service.findMessages(CONVERSATION_ID, {}, STAFF),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(messages.findMany).not.toHaveBeenCalled();
    });

    it('should return 404 to a non-member sending a message', async () => {
      await expect(
        service.sendMessage(CONVERSATION_ID, { body: 'hi' }, STAFF),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('should return 404 to a non-member marking a conversation read', async () => {
      await expect(
        service.markRead(CONVERSATION_ID, STAFF),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('messages and unread', () => {
    it('should read the latest 50 messages by default', async () => {
      await service.findMessages(CONVERSATION_ID, {}, STAFF);

      expect(messages.findMany).toHaveBeenCalledWith({
        conversationId: CONVERSATION_ID,
        after: undefined,
        limit: 50,
      });
    });

    it('should pass the polling cursor through', async () => {
      await service.findMessages(
        CONVERSATION_ID,
        { after: '2026-10-31T10:00:00.000Z', limit: 10 },
        STAFF,
      );

      expect(messages.findMany).toHaveBeenCalledWith({
        conversationId: CONVERSATION_ID,
        after: '2026-10-31T10:00:00.000Z',
        limit: 10,
      });
    });

    it("should bump lastMessageAt and the sender's lastReadAt in the message transaction", async () => {
      const message = Object.assign(new ChatMessage(), {
        id: 'm1',
        conversationId: CONVERSATION_ID,
        body: 'Pilot at 14:00',
        createdAt: '2026-10-31T10:00:00.123Z',
      });
      messages.create.mockResolvedValue(message);

      const result = await service.sendMessage(
        CONVERSATION_ID,
        { body: 'Pilot at 14:00' },
        STAFF,
      );

      expect(messages.create).toHaveBeenCalledWith(
        {
          conversationId: CONVERSATION_ID,
          senderId: 7,
          body: 'Pilot at 14:00',
        },
        manager,
      );
      expect(conversations.touchAfterMessage).toHaveBeenCalledWith(
        CONVERSATION_ID,
        7,
        new Date('2026-10-31T10:00:00.123Z'),
        manager,
      );
      expect(result).toBe(message);
    });

    it('should mark a conversation read for a member', async () => {
      await expect(
        service.markRead(CONVERSATION_ID, STAFF),
      ).resolves.toBeUndefined();
      expect(conversations.markRead).toHaveBeenCalledWith(CONVERSATION_ID, 7);
    });

    it("should return the caller's unread total", async () => {
      conversations.countUnread.mockResolvedValue(4);

      await expect(service.countUnread(VIEWER)).resolves.toEqual({ total: 4 });
      expect(conversations.countUnread).toHaveBeenCalledWith(9);
    });
  });
});
