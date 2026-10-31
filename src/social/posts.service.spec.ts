import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleEnum } from '../roles/roles.enum';
import { toUserCard } from '../users-directory/domain/user-card';
import { NetworkActor } from '../users-directory/user-visibility';
import { PostData } from './domain/post';
import { PostCommentData } from './domain/post-comment';
import { PostCommentRepository } from './infrastructure/persistence/post-comment.repository';
import { PostRepository } from './infrastructure/persistence/post.repository';
import { PostsService } from './posts.service';

const POST_ID = '44444444-4444-4444-4444-444444444444';
const COMMENT_ID = '55555555-5555-5555-5555-555555555555';
const ADMIN: NetworkActor = { userId: 1, roleId: RoleEnum.admin };
const STAFF_AUTHOR: NetworkActor = { userId: 7, roleId: RoleEnum.staff };
const OTHER_STAFF: NetworkActor = { userId: 8, roleId: RoleEnum.staff };
const VIEWER: NetworkActor = { userId: 9, roleId: RoleEnum.user };

function buildPost(authorId: number, overrides: Partial<PostData> = {}) {
  return {
    id: POST_ID,
    author: toUserCard({
      id: authorId,
      firstName: 'Test',
      lastName: 'Author',
      email: 'test.author@example.com',
      roleId: RoleEnum.staff,
    }),
    body: 'Berth 4 is free',
    createdAt: '2026-10-31T10:00:00.000Z',
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    ...overrides,
  } satisfies PostData;
}

function buildComment(authorId: number): PostCommentData {
  return {
    id: COMMENT_ID,
    postId: POST_ID,
    author: toUserCard({
      id: authorId,
      firstName: null,
      lastName: null,
      email: null,
      roleId: RoleEnum.user,
    }),
    body: 'Thanks',
    createdAt: '2026-10-31T10:01:00.000Z',
  };
}

describe('PostsService', () => {
  let service: PostsService;
  let likes: Set<string>;
  let posts: {
    findFeed: jest.Mock;
    findOne: jest.Mock;
    findActiveRef: jest.Mock;
    create: jest.Mock;
    softDelete: jest.Mock;
    like: jest.Mock;
    unlike: jest.Mock;
    countLikes: jest.Mock;
  };
  let comments: {
    findByPost: jest.Mock;
    create: jest.Mock;
    findActiveRef: jest.Mock;
    softDelete: jest.Mock;
  };

  beforeEach(() => {
    // In-memory stand-in honouring the repository contract (PK postId+userId).
    likes = new Set<string>();
    posts = {
      findFeed: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(buildPost(STAFF_AUTHOR.userId)),
      findActiveRef: jest
        .fn()
        .mockResolvedValue({ id: POST_ID, authorId: STAFF_AUTHOR.userId }),
      create: jest.fn().mockResolvedValue(POST_ID),
      softDelete: jest.fn().mockResolvedValue(true),
      like: jest.fn((postId: string, userId: number) => {
        likes.add(`${postId}:${userId}`);
        return Promise.resolve();
      }),
      unlike: jest.fn((postId: string, userId: number) => {
        likes.delete(`${postId}:${userId}`);
        return Promise.resolve();
      }),
      countLikes: jest.fn((postId: string) =>
        Promise.resolve(
          [...likes].filter((key) => key.startsWith(`${postId}:`)).length,
        ),
      ),
    };
    comments = {
      findByPost: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(buildComment(VIEWER.userId)),
      findActiveRef: jest.fn().mockResolvedValue({
        id: COMMENT_ID,
        postId: POST_ID,
        authorId: VIEWER.userId,
      }),
      softDelete: jest.fn().mockResolvedValue(true),
    };
    service = new PostsService(
      posts as unknown as PostRepository,
      comments as unknown as PostCommentRepository,
    );
  });

  describe('findFeed', () => {
    it('should default to the all scope and 20 posts, team authors only for a viewer', async () => {
      await service.findFeed({}, VIEWER);

      expect(posts.findFeed).toHaveBeenCalledWith({
        viewerId: 9,
        scope: 'all',
        authorRoleIds: [RoleEnum.admin, RoleEnum.staff],
        before: undefined,
        limit: 20,
      });
    });

    it('should ask for the following scope of the caller', async () => {
      await service.findFeed(
        { scope: 'following', before: '2026-10-31T10:00:00.000Z', limit: 5 },
        STAFF_AUTHOR,
      );

      expect(posts.findFeed).toHaveBeenCalledWith({
        viewerId: 7,
        scope: 'following',
        authorRoleIds: null,
        before: '2026-10-31T10:00:00.000Z',
        limit: 5,
      });
    });

    it('should set canDelete for the author and admins only', async () => {
      posts.findFeed.mockResolvedValue([buildPost(STAFF_AUTHOR.userId)]);

      const [asAuthor] = await service.findFeed({}, STAFF_AUTHOR);
      const [asOther] = await service.findFeed({}, OTHER_STAFF);
      const [asAdmin] = await service.findFeed({}, ADMIN);

      expect(asAuthor.canDelete).toBe(true);
      expect(asOther.canDelete).toBe(false);
      expect(asAdmin.canDelete).toBe(true);
    });
  });

  describe('likes', () => {
    it('should not double a repeated like', async () => {
      const first = await service.like(POST_ID, VIEWER);
      const second = await service.like(POST_ID, VIEWER);

      expect(first).toEqual({ likeCount: 1, likedByMe: true });
      expect(second).toEqual({ likeCount: 1, likedByMe: true });
    });

    it('should count likes of different users and unlike idempotently', async () => {
      await service.like(POST_ID, VIEWER);
      await service.like(POST_ID, OTHER_STAFF);

      await expect(service.unlike(POST_ID, VIEWER)).resolves.toEqual({
        likeCount: 1,
        likedByMe: false,
      });
      await expect(service.unlike(POST_ID, VIEWER)).resolves.toEqual({
        likeCount: 1,
        likedByMe: false,
      });
    });

    it('should return 404 when liking a deleted post', async () => {
      posts.findActiveRef.mockResolvedValue(null);

      await expect(service.like(POST_ID, VIEWER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(posts.like).not.toHaveBeenCalled();
    });
  });

  describe('remove post', () => {
    it('should let the author delete their post', async () => {
      await service.remove(POST_ID, STAFF_AUTHOR);

      expect(posts.softDelete).toHaveBeenCalledWith(POST_ID);
    });

    it("should forbid staff from deleting someone else's post", async () => {
      await expect(service.remove(POST_ID, OTHER_STAFF)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(posts.softDelete).not.toHaveBeenCalled();
    });

    it("should forbid a viewer from deleting someone else's post", async () => {
      await expect(service.remove(POST_ID, VIEWER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('should let an admin delete any post', async () => {
      await service.remove(POST_ID, ADMIN);

      expect(posts.softDelete).toHaveBeenCalledWith(POST_ID);
    });

    it('should return 404 for a missing or already deleted post', async () => {
      posts.findActiveRef.mockResolvedValue(null);

      await expect(service.remove(POST_ID, ADMIN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('comments', () => {
    it('should return 404 for comments of a deleted post', async () => {
      posts.findActiveRef.mockResolvedValue(null);

      await expect(
        service.findComments(POST_ID, VIEWER),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(comments.findByPost).not.toHaveBeenCalled();
    });

    it('should list at most 200 comments with canDelete per caller', async () => {
      comments.findByPost.mockResolvedValue([buildComment(VIEWER.userId)]);

      const [own] = await service.findComments(POST_ID, VIEWER);
      const [foreign] = await service.findComments(POST_ID, OTHER_STAFF);

      expect(comments.findByPost).toHaveBeenCalledWith(POST_ID, 200, {
        viewerId: VIEWER.userId,
        authorRoleIds: [RoleEnum.admin, RoleEnum.staff],
      });
      expect(comments.findByPost).toHaveBeenLastCalledWith(POST_ID, 200, {
        viewerId: OTHER_STAFF.userId,
        authorRoleIds: null,
      });
      expect(own.canDelete).toBe(true);
      expect(foreign.canDelete).toBe(false);
    });

    it('should add a comment as the caller', async () => {
      const comment = await service.addComment(
        POST_ID,
        { body: 'Thanks' },
        VIEWER,
      );

      expect(comments.create).toHaveBeenCalledWith({
        postId: POST_ID,
        authorId: 9,
        body: 'Thanks',
      });
      expect(comment.canDelete).toBe(true);
    });

    it("should forbid staff from deleting someone else's comment", async () => {
      await expect(
        service.removeComment(COMMENT_ID, OTHER_STAFF),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(comments.softDelete).not.toHaveBeenCalled();
    });

    it('should let the author and an admin delete a comment', async () => {
      await service.removeComment(COMMENT_ID, VIEWER);
      await service.removeComment(COMMENT_ID, ADMIN);

      expect(comments.softDelete).toHaveBeenCalledTimes(2);
    });

    it('should return 404 for a comment of a deleted post', async () => {
      comments.findActiveRef.mockResolvedValue(null);

      await expect(
        service.removeComment(COMMENT_ID, ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
