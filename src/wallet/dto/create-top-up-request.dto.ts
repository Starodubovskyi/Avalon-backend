import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToNull } from '../../utils/validators/is-body-text';
import { TOP_UP_AMOUNT, TOP_UP_NOTE_MAX_LENGTH } from '../wallet.constants';

/** 422 codes: amount → invalid; note → tooLong. */
export class CreateTopUpRequestDto {
  @ApiProperty({
    type: Number,
    minimum: TOP_UP_AMOUNT.min,
    maximum: TOP_UP_AMOUNT.max,
    example: 500,
    description: 'Whole credits',
  })
  @Type(() => Number)
  @IsInt({ message: 'invalid' })
  @Min(TOP_UP_AMOUNT.min, { message: 'invalid' })
  @Max(TOP_UP_AMOUNT.max, { message: 'invalid' })
  amount: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: TOP_UP_NOTE_MAX_LENGTH,
    description: 'Message to the admin; blank → null',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(TOP_UP_NOTE_MAX_LENGTH, { message: 'tooLong' })
  note?: string | null;
}
