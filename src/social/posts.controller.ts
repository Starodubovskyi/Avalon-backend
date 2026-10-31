import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post as HttpPost,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { toNetworkActor } from '../users-directory/user-visibility';
import { Post, PostLikeState } from './domain/post';
import { PostComment } from './domain/post-comment';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryFeedDto } from './dto/query-feed.dto';
import { PostsService } from './posts.service';

type AuthRequest = { user: JwtPayloadType };

@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'posts',
  version: '1',
})
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @ApiOkResponse({ type: [Post], description: 'Newest first' })
  @HttpCode(HttpStatus.OK)
  findFeed(
    @Request() request: AuthRequest,
    @Query() query: QueryFeedDto,
  ): Promise<Post[]> {
    return this.postsService.findFeed(query, toNetworkActor(request.user));
  }

  @HttpPost()
  @ApiCreatedResponse({ type: Post })
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { body: "empty" | "tooLong" } }',
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: AuthRequest,
    @Body() dto: CreatePostDto,
  ): Promise<Post> {
    return this.postsService.create(dto, toNetworkActor(request.user));
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Only the author or an admin' })
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.postsService.remove(id, toNetworkActor(request.user));
  }

  @HttpPost(':id/like')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: PostLikeState, description: 'Idempotent' })
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.OK)
  like(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PostLikeState> {
    return this.postsService.like(id, toNetworkActor(request.user));
  }

  @Delete(':id/like')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: PostLikeState, description: 'Idempotent' })
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.OK)
  unlike(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PostLikeState> {
    return this.postsService.unlike(id, toNetworkActor(request.user));
  }

  @Get(':id/comments')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({
    type: [PostComment],
    description: 'Ascending by time, at most the latest 200',
  })
  @ApiNotFoundResponse()
  @HttpCode(HttpStatus.OK)
  findComments(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<PostComment[]> {
    return this.postsService.findComments(id, toNetworkActor(request.user));
  }

  @HttpPost(':id/comments')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: PostComment })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { body: "empty" | "tooLong" } }',
  })
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateCommentDto,
  ): Promise<PostComment> {
    return this.postsService.addComment(id, dto, toNetworkActor(request.user));
  }
}
