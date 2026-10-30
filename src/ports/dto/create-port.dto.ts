import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  normalizePortStatus,
  normalizeUnlocode,
  PortOperationalStatus,
  UNLOCODE_PATTERN,
} from '../port-status.enum';

function pickTrimmedString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export class CreatePortDto {
  @ApiProperty({ example: 'Constanța', type: String })
  @Transform(({ value, obj }) =>
    pickTrimmedString(
      value,
      obj?.portname,
      obj?.portName,
      obj?.port,
      obj?.title,
    ),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'ROCND', type: String })
  @Transform(({ value, obj }) =>
    normalizeUnlocode(value ?? obj?.code ?? obj?.locode),
  )
  @IsString()
  @Matches(UNLOCODE_PATTERN)
  unlocode: string;

  @ApiPropertyOptional({ example: 'RO', type: String })
  @Transform(({ value, obj }) =>
    pickTrimmedString(value, obj?.countryCode, obj?.flag)?.toUpperCase(),
  )
  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;

  @ApiPropertyOptional({
    enum: PortOperationalStatus,
    example: PortOperationalStatus.OPEN,
  })
  @Transform(
    ({ value, obj }) =>
      normalizePortStatus(value ?? obj?.state) ?? PortOperationalStatus.OPEN,
  )
  @IsOptional()
  @IsEnum(PortOperationalStatus)
  status?: PortOperationalStatus;

  @ApiPropertyOptional({ example: 'Europe/Bucharest', type: String })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'UTC',
  )
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ example: 44.1598, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 28.6348, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
