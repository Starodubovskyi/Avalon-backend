import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsIsoDateTime } from '../../utils/validators/is-iso-date-time';
import { MESSAGES_DEFAULT_LIMIT, MESSAGES_MAX_LIMIT } from '../chat.constants';

export class QueryMessagesDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Polling cursor: createdAt of the newest message the client has. Without it the latest `limit` messages are returned.',
  })
  @IsOptional()
  @IsIsoDateTime()
  after?: string;

  @ApiPropertyOptional({
    default: MESSAGES_DEFAULT_LIMIT,
    maximum: MESSAGES_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MESSAGES_MAX_LIMIT)
  limit?: number = MESSAGES_DEFAULT_LIMIT;
}
