import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { VESSEL_SCOPES, VesselScope } from '../vessel.constants';

export class QueryVesselDto {
  @ApiPropertyOptional({ enum: VESSEL_SCOPES, default: 'all' })
  @IsOptional()
  @IsIn(VESSEL_SCOPES)
  scope?: VesselScope = 'all';

  @ApiPropertyOptional({ type: String, description: 'Name or IMO (partial)' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
