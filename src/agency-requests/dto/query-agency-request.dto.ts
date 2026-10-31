import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  AGENCY_REQUEST_STATUSES,
  AgencyRequestStatus,
} from '../agency-requests.constants';

export class QueryAgencyRequestDto {
  @ApiPropertyOptional({ enum: AGENCY_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(AGENCY_REQUEST_STATUSES, { message: 'invalid' })
  status?: AgencyRequestStatus;
}
