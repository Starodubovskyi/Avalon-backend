import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString, trimToNull } from '../../utils/validators/is-body-text';
import { IsImageDataUrl } from '../../utils/validators/is-image-data-url';
import { IsPresent } from '../../utils/validators/is-present';
import {
  ACTIVITY_CODES,
  ActivityCode,
  DEFAULT_ACTIVITY_SLOTS,
  DEFAULT_MAP_POINT_KIND,
  MAP_POINT_DESCRIPTION_MAX_LENGTH,
  MAP_POINT_KINDS,
  MAP_POINT_LOGO_MAX_LENGTH,
  MAP_POINT_LOGO_MIME_TYPES,
  MAP_POINT_NOTES_MAX_LENGTH,
  MAP_POINT_TITLE_MAX_LENGTH,
  MAP_POINT_VISIBILITIES,
  MAP_POINT_WEBSITE_MAX_LENGTH,
  MapPointKind,
  MapPointVisibility,
} from '../map-point.constants';
import { IsActivityCodes, uniqueItems } from './map-point-validators';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim().length === 0 ? undefined : value.trim();
}

/** Empty string clears the value (null). */
function emptyToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim().length === 0 ? null : value.trim();
}

/*
 * Convention: `@IsOptional()` = nullable optional field (null clears it);
 * `IsPresent()` = optional but not nullable. UpdateMapPointDto relies on this
 * (PartialType with skipNullProperties: false).
 */
export class CreateMapPointDto {
  @ApiPropertyOptional({
    enum: MAP_POINT_KINDS,
    default: DEFAULT_MAP_POINT_KIND,
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

  @ApiProperty({
    example: 'Avalon Shipping SRL',
    type: String,
    minLength: 1,
    maxLength: MAP_POINT_TITLE_MAX_LENGTH,
    description: 'Title of the point',
  })
  @Transform(emptyToUndefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAP_POINT_TITLE_MAX_LENGTH)
  firstName: string;

  // lastName and activity keep "" (trimmed) so an update can clear them: the
  // map form merges the old first + last name into the Title and sends "".
  @ApiPropertyOptional({
    type: String,
    deprecated: true,
    description:
      'Kept for compatibility; the map UI sends "" to clear it (merged into the Title)',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @ApiPropertyOptional({
    type: String,
    deprecated: true,
    description:
      'Legacy free-text activity, kept for compatibility ("" clears it); use `activities`',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  activity?: string;

  @ApiPropertyOptional({
    enum: ACTIVITY_CODES,
    isArray: true,
    default: [],
    example: ['ship_agency'],
    description: `Business Activity codes (duplicates are dropped). At most \`activitySlots\` of the point (a new point has ${DEFAULT_ACTIVITY_SLOTS}); more → 422 { activities: "premiumRequired" }. Unknown code or null → 422 { activities: "invalid" }.`,
  })
  @Transform(uniqueItems)
  @IsPresent()
  @IsActivityCodes()
  activities?: ActivityCode[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAP_POINT_LOGO_MAX_LENGTH,
    example: 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4IAYAAAAwAQCdASo=',
    description:
      'Logo as a base64 data URL (image/webp, image/png or image/jpeg); null or "" clears it. 422 { logo: "invalid" | "tooLong" }.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsImageDataUrl(MAP_POINT_LOGO_MIME_TYPES, MAP_POINT_LOGO_MAX_LENGTH)
  logo?: string | null;

  @ApiPropertyOptional({ example: '+40 721 000 000', type: String })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ example: 'office@avalon.example', type: String })
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
    deprecated: true,
    maxLength: MAP_POINT_NOTES_MAX_LENGTH,
    description: 'Kept for compatibility; the map UI no longer sends it',
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

  @ApiPropertyOptional({
    enum: MAP_POINT_VISIBILITIES,
    description:
      'public: everyone signed in; team: admin/staff and the owner only. Default on create: team for private_person, else public. 422 { visibility: "invalid" }.',
  })
  @IsPresent()
  @IsIn(MAP_POINT_VISIBILITIES, { message: 'invalid' })
  visibility?: MapPointVisibility;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAP_POINT_DESCRIPTION_MAX_LENGTH,
    description:
      'About the company; null or "" clears it. 422 { description: "tooLong" }.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'invalid' })
  @MaxLength(MAP_POINT_DESCRIPTION_MAX_LENGTH, { message: 'tooLong' })
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAP_POINT_WEBSITE_MAX_LENGTH,
    example: 'https://avalon.example',
    description:
      'http(s) URL; null or "" clears it. 422 { website: "invalid" | "tooLong" }.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @MaxLength(MAP_POINT_WEBSITE_MAX_LENGTH, { message: 'tooLong' })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'invalid' },
  )
  website?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Parent company (for a branch): a point visible to the caller, not the point itself or one of its branches; null clears it. 422 { parentId: "invalid" | "notFound" }.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'invalid' })
  parentId?: string | null;
}
