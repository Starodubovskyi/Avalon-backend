import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsIsoDateTime } from '../../utils/validators/is-iso-date-time';
import {
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  FEED_SCOPES,
  FeedScope,
} from '../social.constants';

export class QueryFeedDto {
  @ApiPropertyOptional({
    enum: FEED_SCOPES,
    default: 'all',
    description: 'following = authors I follow + me',
  })
  @IsOptional()
  @IsIn(FEED_SCOPES)
  scope?: FeedScope = 'all';

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Cursor: createdAt of the last post of the previous page',
  })
  @IsOptional()
  @IsIsoDateTime()
  before?: string;

  @ApiPropertyOptional({ default: FEED_DEFAULT_LIMIT, maximum: FEED_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEED_MAX_LIMIT)
  limit?: number = FEED_DEFAULT_LIMIT;
}
