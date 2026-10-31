import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimToNull } from '../../utils/validators/is-body-text';
import { IsIsoDateTime } from '../../utils/validators/is-iso-date-time';
import { IsPresent } from '../../utils/validators/is-present';
import {
  DESTINATIONS,
  Destination,
  OK_STATUSES,
  OkStatus,
  T1_STATUSES,
  T1Status,
  VESSEL_CONDITIONS,
  VESSEL_TYPES,
  VesselCondition,
  VesselType,
} from '../vessel.constants';

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/*
 * Convention: `@IsOptional()` = nullable optional field (null clears it);
 * `IsPresent()` = optional but not nullable. UpdateVesselDto relies on this
 * (PartialType with skipNullProperties: false).
 */
export class CreateVesselDto {
  @ApiProperty({ type: String, example: 'MV AVALON STAR', minLength: 2 })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '9123456' })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @Matches(/^\d{7}$/, { message: 'imoInvalid' })
  imo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '271000123' })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @Matches(/^\d{9}$/, { message: 'mmsiInvalid' })
  mmsi?: string | null;

  @ApiProperty({ enum: VESSEL_TYPES })
  @IsIn(VESSEL_TYPES)
  type: VesselType;

  @ApiProperty({ enum: DESTINATIONS })
  @IsIn(DESTINATIONS)
  destination: Destination;

  @ApiPropertyOptional({ enum: VESSEL_CONDITIONS, nullable: true })
  @IsOptional()
  @IsIn(VESSEL_CONDITIONS)
  condition?: VesselCondition | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  masterName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  masterPhone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  masterEmail?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  officeName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  officePhone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  officeEmail?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  portAgent?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsIsoDateTime()
  etaSulina?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsIsoDateTime()
  arrivedAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsIsoDateTime()
  inPortAt?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsIsoDateTime()
  departedAt?: string | null;

  @ApiPropertyOptional({ enum: OK_STATUSES, default: 'not_ok' })
  @IsPresent()
  @IsIn(OK_STATUSES)
  prearrivalsIn?: OkStatus;

  @ApiPropertyOptional({ enum: OK_STATUSES, default: 'not_ok' })
  @IsPresent()
  @IsIn(OK_STATUSES)
  prearrivalsOut?: OkStatus;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsPresent()
  @IsBoolean()
  mswIn?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsPresent()
  @IsBoolean()
  mswOut?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsPresent()
  @IsBoolean()
  pdaSent?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsPresent()
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional({ enum: T1_STATUSES, nullable: true })
  @IsOptional()
  @IsIn(T1_STATUSES)
  t1?: T1Status | null;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsPresent()
  @IsBoolean()
  pilotageArranged?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  pilot?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 4000 })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: -90,
    maximum: 90,
    description: 'Manual position (sets positionSource=manual)',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: -180,
    maximum: 180,
    description: 'Manual position (sets positionSource=manual)',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  lng?: number | null;
}
