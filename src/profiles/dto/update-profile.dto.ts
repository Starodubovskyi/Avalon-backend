import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToNull } from '../../utils/validators/is-body-text';
import { IsPresent } from '../../utils/validators/is-present';
import {
  LOCALES,
  Locale,
  USER_BIO_MAX_LENGTH,
  USER_HEADLINE_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
} from '../../users/user-profile.constants';

/** Text fields: blank or null clears them; 422 codes invalid | tooLong. */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: USER_HEADLINE_MAX_LENGTH,
    example: 'Operations manager',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(USER_HEADLINE_MAX_LENGTH, { message: 'tooLong' })
  headline?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: USER_BIO_MAX_LENGTH,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(USER_BIO_MAX_LENGTH, { message: 'tooLong' })
  bio?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: USER_PHONE_MAX_LENGTH,
    example: '+40 721 000 000',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(USER_PHONE_MAX_LENGTH, { message: 'tooLong' })
  phone?: string | null;

  @ApiPropertyOptional({
    enum: LOCALES,
    description: 'Interface language. 422 { locale: "invalid" }',
  })
  @IsPresent()
  @IsIn(LOCALES, { message: 'invalid' })
  locale?: Locale;
}
