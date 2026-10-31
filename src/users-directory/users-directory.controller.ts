import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { UserCard } from './domain/user-card';
import { QueryUserDirectoryDto } from './dto/query-user-directory.dto';
import { toNetworkActor } from './user-visibility';
import { UsersDirectoryService } from './users-directory.service';

type AuthRequest = { user: JwtPayloadType };

/**
 * Person picker for chat/people, open to every signed-in role. Lives apart
 * from the admin-only UsersController; UsersDirectoryModule is imported
 * before UsersModule so this static route wins over `GET /users/:id`.
 */
@ApiTags('Users directory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'users/directory',
  version: '1',
})
export class UsersDirectoryController {
  constructor(private readonly directoryService: UsersDirectoryService) {}

  @Get()
  @ApiOkResponse({
    type: [UserCard],
    description:
      'Without the caller and soft-deleted users; viewers only get admin/staff. Max 200.',
  })
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request: AuthRequest,
    @Query() query: QueryUserDirectoryDto,
  ): Promise<UserCard[]> {
    return this.directoryService.search(
      toNetworkActor(request.user),
      query.search,
    );
  }
}
