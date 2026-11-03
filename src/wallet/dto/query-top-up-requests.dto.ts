import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  TOP_UP_REQUEST_STATUSES,
  TopUpRequestStatus,
} from '../wallet.constants';

export class QueryTopUpRequestsDto {
  @ApiPropertyOptional({
    enum: TOP_UP_REQUEST_STATUSES,
    description: 'All statuses when omitted',
  })
  @IsOptional()
  @IsIn(TOP_UP_REQUEST_STATUSES, { message: 'invalid' })
  status?: TopUpRequestStatus;
}
