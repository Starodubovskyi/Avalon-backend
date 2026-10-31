import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { toNetworkActor } from '../users-directory/user-visibility';
import { Person } from './domain/person';
import { QueryPeopleDto } from './dto/query-people.dto';
import { PeopleService } from './people.service';

type AuthRequest = { user: JwtPayloadType };

@ApiTags('Social')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'people',
  version: '1',
})
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  @ApiOkResponse({
    type: [Person],
    description:
      'Without the caller and soft-deleted users; viewers only get admin/staff. Max 200.',
  })
  @HttpCode(HttpStatus.OK)
  findAll(
    @Request() request: AuthRequest,
    @Query() query: QueryPeopleDto,
  ): Promise<Person[]> {
    return this.peopleService.findPeople(query, toNetworkActor(request.user));
  }

  @Post(':id/follow')
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiOkResponse({ type: Person, description: 'Idempotent' })
  @ApiNotFoundResponse({ description: 'Unknown or not visible to the caller' })
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { id: "cannotFollowSelf" } }',
  })
  @HttpCode(HttpStatus.OK)
  follow(
    @Request() request: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Person> {
    return this.peopleService.follow(id, toNetworkActor(request.user));
  }

  @Delete(':id/follow')
  @ApiParam({ name: 'id', type: Number, required: true })
  @ApiOkResponse({ type: Person, description: 'Idempotent' })
  @ApiNotFoundResponse({ description: 'Unknown or not visible to the caller' })
  @ApiUnprocessableEntityResponse({
    description: '{ errors: { id: "cannotFollowSelf" } }',
  })
  @HttpCode(HttpStatus.OK)
  unfollow(
    @Request() request: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Person> {
    return this.peopleService.unfollow(id, toNetworkActor(request.user));
  }
}
