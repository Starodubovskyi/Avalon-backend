import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsIsoDateTime } from '../../utils/validators/is-iso-date-time';

export const VESSEL_EVENTS_MAX_LIMIT = 200;

export class QueryVesselEventDto {
  @ApiPropertyOptional({ default: 100, maximum: VESSEL_EVENTS_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(VESSEL_EVENTS_MAX_LIMIT)
  limit?: number = 100;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description:
      'Cursor: createdAt of the last event of the previous page (required with beforeId)',
  })
  // optional, but mandatory once beforeId is given
  @ValidateIf(
    (query: QueryVesselEventDto, value: unknown) =>
      value !== undefined || query.beforeId !== undefined,
  )
  @IsIsoDateTime()
  before?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Cursor tie-breaker: id of the last event of the previous page (keyset on createdAt, id)',
  })
  @IsOptional()
  @IsUUID()
  beforeId?: string;
}
