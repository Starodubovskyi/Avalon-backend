import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToNull } from '../../utils/validators/is-body-text';
import { COMPANY_POSITION_MAX_LENGTH } from '../companies.constants';

export class JoinCompanyDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: COMPANY_POSITION_MAX_LENGTH,
    example: 'Port captain',
    description: 'Blank → null. 422 { position: "tooLong" }',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(COMPANY_POSITION_MAX_LENGTH, { message: 'tooLong' })
  position?: string | null;
}
