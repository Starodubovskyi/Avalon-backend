import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { MAP_POINT_KINDS, MapPointKind } from '../map-point.constants';

export class QueryMapPointDto {
  @ApiPropertyOptional({ enum: MAP_POINT_KINDS })
  @IsOptional()
  @IsIn(MAP_POINT_KINDS)
  kind?: MapPointKind;
}
