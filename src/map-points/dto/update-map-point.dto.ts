import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateMapPointDto } from './create-map-point.dto';

export class UpdateMapPointDto extends PartialType(CreateMapPointDto) {
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;
}
