import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { toNetworkActor } from '../users-directory/user-visibility';
import { ChatService } from './chat.service';
import { ChatUnread } from './domain/conversation';

type AuthRequest = { user: JwtPayloadType };

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'chat',
  version: '1',
})
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('unread')
  @ApiOkResponse({
    type: ChatUnread,
    description: 'Unread messages over all conversations (sidebar badge)',
  })
  @HttpCode(HttpStatus.OK)
  unread(@Request() request: AuthRequest): Promise<ChatUnread> {
    return this.chatService.countUnread(toNetworkActor(request.user));
  }
}
