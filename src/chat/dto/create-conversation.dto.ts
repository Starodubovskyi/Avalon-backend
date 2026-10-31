import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CONVERSATION_MAX_PARTICIPANTS,
  CONVERSATION_TITLE_MAX_LENGTH,
} from '../chat.constants';

/** Trims; a blank title counts as "not given". */
function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class CreateConversationDto {
  @ApiProperty({
    type: [Number],
    example: [5],
    description:
      'Other participants. One id → direct conversation (reused if it exists); two or more → group (title required).',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'empty' })
  @ArrayMaxSize(CONVERSATION_MAX_PARTICIPANTS, { message: 'tooMany' })
  @IsInt({ each: true })
  @Min(1, { each: true })
  userIds: number[];

  @ApiPropertyOptional({
    type: String,
    maxLength: CONVERSATION_TITLE_MAX_LENGTH,
    description: 'Required for groups, ignored for direct conversations',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(CONVERSATION_TITLE_MAX_LENGTH, { message: 'tooLong' })
  title?: string;
}
