import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';
import { trimToNull } from '../../utils/validators/is-body-text';
import {
  CREDIT_AMOUNT_LIMIT,
  WALLET_NOTE_MAX_LENGTH,
} from '../wallet.constants';

/** 422 codes: userId / amount → invalid; note → tooLong. */
export class CreateWalletCreditDto {
  @ApiProperty({ type: Number, example: 13 })
  @Type(() => Number)
  @IsInt({ message: 'invalid' })
  @Min(1, { message: 'invalid' })
  userId: number;

  @ApiProperty({
    type: Number,
    minimum: -CREDIT_AMOUNT_LIMIT,
    maximum: CREDIT_AMOUNT_LIMIT,
    example: 500,
    description:
      'Non-zero whole credits: positive → kind top_up, negative → kind adjustment (never below a zero balance)',
  })
  @Type(() => Number)
  @IsInt({ message: 'invalid' })
  @NotEquals(0, { message: 'invalid' })
  @Min(-CREDIT_AMOUNT_LIMIT, { message: 'invalid' })
  @Max(CREDIT_AMOUNT_LIMIT, { message: 'invalid' })
  amount: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: WALLET_NOTE_MAX_LENGTH,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(WALLET_NOTE_MAX_LENGTH, { message: 'tooLong' })
  note?: string | null;
}
