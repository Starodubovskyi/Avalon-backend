import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canDeleteContent,
  NetworkActor,
  visibleRoleIds,
} from '../users-directory/user-visibility';
import { Post, PostData, PostLikeState, PostRef } from './domain/post';
import { PostComment, PostCommentData } from './domain/post-comment';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { PostCommentRepository } from './infrastructure/persistence/post-comment.repository';
import { PostRepository } from './infrastructure/persistence/post.repository';
import { COMMENTS_LIMIT, FEED_DEFAULT_LIMIT } from './social.constants';

@Injectable()
export class PostsService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly commentRepository: PostCommentRepository,
  ) {}

  async findFeed(query: QueryFeedDto, actor: NetworkActor): Promise<Post[]> {
    const posts = await this.postRepository.findFeed({
      viewerId: actor.userId,
      scope: query.scope ?? 'all',
      authorRoleIds: visibleRoleIds(actor),
      before: query.before,
      limit: query.limit ?? FEED_DEFAULT_LIMIT,
    });
    return posts.map((post) => this.toPost(post, actor));
  }

  async create(dto: CreatePostDto, actor: NetworkActor): Promise<Post> {
    const id = await this.postRepository.create(actor.userId, dto.body);
    const post = await this.postRepository.findOne(id, actor.userId);
    if (!post) {
      throw this.postNotFound();
    }
    return this.toPost(post, actor);
  }

  /** Soft delete; the post's comments disappear with it. */
  async remove(id: string, actor: NetworkActor): Promise<void> {
    const post = await this.getActivePostOrFail(id);
    this.assertCanDelete(actor, post.authorId);
    if (!(await this.postRepository.softDelete(id))) {
      throw this.postNotFound();
    }
  }

  async like(id: string, actor: NetworkActor): Promise<PostLikeState> {
    await this.getActivePostOrFail(id);
    await this.postRepository.like(id, actor.userId);
    return this.likeState(id, true);
  }

  async unlike(id: string, actor: NetworkActor): Promise<PostLikeState> {
    await this.getActivePostOrFail(id);
    await this.postRepository.unlike(id, actor.userId);
    return this.likeState(id, false);
  }

  async findComments(
    postId: string,
    actor: NetworkActor,
  ): Promise<PostComment[]> {
    await this.getActivePostOrFail(postId);
    const comments = await this.commentRepository.findByPost(
      postId,
      COMMENTS_LIMIT,
      { viewerId: actor.userId, authorRoleIds: visibleRoleIds(actor) },
    );
    return comments.map((comment) => this.toComment(comment, actor));
  }

  async addComment(
    postId: string,
    dto: CreateCommentDto,
    actor: NetworkActor,
  ): Promise<PostComment> {
    await this.getActivePostOrFail(postId);
    const comment = await this.commentRepository.create({
      postId,
      authorId: actor.userId,
      body: dto.body,
    });
    return this.toComment(comment, actor);
  }

  async removeComment(id: string, actor: NetworkActor): Promise<void> {
    const comment = await this.commentRepository.findActiveRef(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    this.assertCanDelete(actor, comment.authorId);
    if (!(await this.commentRepository.softDelete(id))) {
      throw new NotFoundException('Comment not found');
    }
  }

  private async likeState(
    postId: string,
    likedByMe: boolean,
  ): Promise<PostLikeState> {
    const state = new PostLikeState();
    state.likeCount = await this.postRepository.countLikes(postId);
    state.likedByMe = likedByMe;
    return state;
  }

  private async getActivePostOrFail(id: string): Promise<PostRef> {
    const post = await this.postRepository.findActiveRef(id);
    if (!post) {
      throw this.postNotFound();
    }
    return post;
  }

  private assertCanDelete(actor: NetworkActor, authorId: number): void {
    if (!canDeleteContent(actor, authorId)) {
      throw new ForbiddenException();
    }
  }

  private toPost(data: PostData, actor: NetworkActor): Post {
    return Object.assign(new Post(), data, {
      canDelete: canDeleteContent(actor, data.author.id),
    });
  }

  private toComment(data: PostCommentData, actor: NetworkActor): PostComment {
    return Object.assign(new PostComment(), data, {
      canDelete: canDeleteContent(actor, data.author.id),
    });
  }

  private postNotFound(): NotFoundException {
    return new NotFoundException('Post not found');
  }
}
