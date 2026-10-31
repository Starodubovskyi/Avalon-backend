import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trimToNull } from '../../utils/validators/is-body-text';
import { IsPresent } from '../../utils/validators/is-present';
import {
  AGENCY_REQUEST_MAX_LENGTH,
  AGENCY_REQUEST_STATUSES,
  AgencyRequestStatus,
} from '../agency-requests.constants';

/** Team-only (admin, staff). Absent keys are left untouched; null clears. */
export class UpdateAgencyRequestDto {
  @ApiPropertyOptional({ enum: AGENCY_REQUEST_STATUSES })
  @IsPresent()
  @IsIn(AGENCY_REQUEST_STATUSES, { message: 'invalid' })
  status?: AgencyRequestStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: AGENCY_REQUEST_MAX_LENGTH.staffNote,
    description: 'Answer for the client; blank → null',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(AGENCY_REQUEST_MAX_LENGTH.staffNote, { message: 'tooLong' })
  staffNote?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Vessel on the board; null unlinks. Unknown → 422 { vesselId: "notFound" }',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsUUID('all', { message: 'invalid' })
  vesselId?: string | null;
}
