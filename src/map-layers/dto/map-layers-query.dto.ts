import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MapLayersQueryDto {
  @ApiPropertyOptional({
    example: 'company,vessel,port',
    description: 'Comma-separated catalog kinds. person is ignored.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  kinds?: string;
}
