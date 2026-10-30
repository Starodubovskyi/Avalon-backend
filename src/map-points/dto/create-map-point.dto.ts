import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAP_POINT_KINDS,
  MAP_POINT_NOTES_MAX_LENGTH,
  MapPointKind,
} from '../map-point.constants';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim().length === 0 ? undefined : value.trim();
}

/** Empty string clears the value (null). */
function emptyToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim().length === 0 ? null : value.trim();
}

export class CreateMapPointDto {
  @ApiPropertyOptional({
    enum: MAP_POINT_KINDS,
    default: 'person',
    description: 'Point type on the shared map',
  })
  @IsOptional()
  @IsIn(MAP_POINT_KINDS)
  kind?: MapPointKind;

  @ApiProperty({ example: 45.42, type: Number })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 28.2, type: Number })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({ example: 'Ion', type: String })
  @Transform(emptyToUndefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName: string;

  @ApiPropertyOptional({ example: 'Popescu', type: String })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Port agent', type: String })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  activity?: string;

  @ApiPropertyOptional({ example: '+40 721 000 000', type: String })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'ion@example.com', type: String })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'Galati, Romania', type: String })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAP_POINT_NOTES_MAX_LENGTH,
  })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAP_POINT_NOTES_MAX_LENGTH)
  notes?: string | null;

  @ApiPropertyOptional({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  @IsOptional()
  @IsUUID()
  photoId?: string;
}
