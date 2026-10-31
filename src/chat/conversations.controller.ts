import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { toNetworkActor } from '../users-directory/user-visibility';
import { ChatService } from './chat.service';
import { ChatMessage } from './domain/chat-message';
import { Conversation } from './domain/conversation';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';

type AuthRequest = { user: JwtPayloadType };

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'conversations',
  version: '1',
})
export class ConversationsController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOkResponse({
    type: [Conversation],
    description: 'Conversations of the caller, latest activity first',
  })
  @HttpCode(HttpStatus.OK)
  findAll(@Request() request: AuthRequest): Promise<Conversation[]> {
    return this.chatService.findConversations(toNetworkActor(request.user));
  }

  @Post()
  @ApiCreatedResponse({
    type: Conversation,
    description:
      'One userId → direct (the existing one is returned); two or more → group',
  })
  @ApiUnprocessableEntityResponse({
    description:
      '{ errors: { userIds: "notAllowed" | "notFound" } } or { errors: { title: "required" } }',
  })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() request: AuthRequest,
    @Body() dto: CreateConversationDto,
  ): Promise<Conversation> {
    return this.chatService.createConversation(
      dto,
      toNetworkActor(request.user),
    );
  }

  @Get(':id/messages')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiOkResponse({ type: [ChatMessage], description: 'Ascending by time' })
  @ApiNotFoundResponse({ description: 'Not a member of this conversation' })
  @HttpCode(HttpStatus.OK)
  findMessages(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: QueryMessagesDto,
  ): Promise<ChatMessage[]> {
    return this.chatService.findMessages(
      id,
      query,
      toNetworkActor(request.user),
    );
  }

  @Post(':id/messages')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiCreatedResponse({ type: ChatMessage })
  @ApiNotFoundResponse({ description: 'Not a member of this conversation' })
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { body: "empty" | "tooLong" } }',
  })
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<ChatMessage> {
    return this.chatService.sendMessage(id, dto, toNetworkActor(request.user));
  }

  @Post(':id/read')
  @ApiParam({ name: 'id', type: String, required: true })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Not a member of this conversation' })
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Request() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.chatService.markRead(id, toNetworkActor(request.user));
  }
}
