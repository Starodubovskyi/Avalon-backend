import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  IsBodyText,
  trimString,
  trimToNull,
} from '../../utils/validators/is-body-text';
import { IsIsoDateTime } from '../../utils/validators/is-iso-date-time';
import { IsMailtoSafeEmail } from '../../utils/validators/is-mailto-safe-email';
import {
  DESTINATIONS,
  Destination,
  VESSEL_TYPES,
  VesselType,
} from '../../vessels/vessel.constants';
import { AGENCY_REQUEST_MAX_LENGTH as MAX } from '../agency-requests.constants';

/**
 * Trims and upper-cases before validation: upper-casing may lengthen a string
 * ("ß" → "SS"), so the length limit is checked on the stored value.
 */
function trimToUpperCase({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/*
 * Error codes (422 { errors: { field: code } }): required text → empty |
 * tooLong; email → invalidEmail | tooLong; imo → imoInvalid; vesselType /
 * destination → invalid; eta → invalidDateTime; optional text → tooLong.
 * The transforms produce the stored values: strings are trimmed, a blank
 * optional string becomes null, vesselName is upper-cased.
 */
export class CreateAgencyRequestDto {
  @ApiProperty({ type: String, maxLength: MAX.company })
  @Transform(trimString)
  @IsBodyText(MAX.company)
  company: string;

  @ApiProperty({ type: String, maxLength: MAX.contactName })
  @Transform(trimString)
  @IsBodyText(MAX.contactName)
  contactName: string;

  @ApiProperty({
    type: String,
    format: 'email',
    maxLength: MAX.email,
    description: 'Must not contain ? & % # / \\ or whitespace (mailto-safe)',
  })
  @Transform(trimString)
  @IsMailtoSafeEmail()
  @MaxLength(MAX.email, { message: 'tooLong' })
  email: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAX.phone,
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(MAX.phone, { message: 'tooLong' })
  phone?: string | null;

  @ApiProperty({
    type: String,
    maxLength: MAX.vesselName,
    example: 'MV Avalon Star',
    description: 'Stored upper-cased; the limit applies after upper-casing',
  })
  @Transform(trimToUpperCase)
  @IsBodyText(MAX.vesselName)
  vesselName: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '9123456',
    description: '7 digits',
  })
  @Transform(trimToNull)
  @IsOptional()
  @Matches(/^\d{7}$/, { message: 'imoInvalid' })
  imo?: string | null;

  @ApiProperty({ enum: VESSEL_TYPES })
  @IsIn(VESSEL_TYPES, { message: 'invalid' })
  vesselType: VesselType;

  @ApiProperty({ enum: DESTINATIONS })
  @IsIn(DESTINATIONS, { message: 'invalid' })
  destination: Destination;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'ETA Sulina, ISO date-time with offset',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsIsoDateTime()
  eta?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: MAX.cargo })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(MAX.cargo, { message: 'tooLong' })
  cargo?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: MAX.notes })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(MAX.notes, { message: 'tooLong' })
  notes?: string | null;
}
