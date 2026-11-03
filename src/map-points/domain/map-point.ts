import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRef } from '../../users/domain/user-ref';
import {
  ACTIVITY_CODES,
  ActivityCode,
  MAP_POINT_KINDS,
  MapPointKind,
} from '../map-point.constants';

export class MapPoint {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  id: string;

  @ApiProperty({
    type: Number,
    example: 1,
  })
  userId: number | string;

  @ApiProperty({ enum: MAP_POINT_KINDS, example: 'head_office' })
  kind: MapPointKind;

  @ApiProperty({
    type: Number,
    example: 45.42,
  })
  lat: number;

  @ApiProperty({
    type: Number,
    example: 28.2,
  })
  lng: number;

  @ApiProperty({
    type: String,
    example: 'Avalon Shipping SRL',
    description: 'Title of the point',
  })
  firstName: string;

  @ApiProperty({
    type: String,
    example: '',
    deprecated: true,
  })
  lastName: string;

  @ApiProperty({
    type: String,
    example: 'Ship agency',
    deprecated: true,
    description: 'Legacy free-text activity; see `activities`',
  })
  activity: string;

  @ApiProperty({
    enum: ACTIVITY_CODES,
    isArray: true,
    example: ['ship_agency'],
    description: 'Business Activity codes',
  })
  activities: ActivityCode[];

  /** The logo itself is served by GET /map-points/:id/logo, never inline. */
  @ApiProperty({
    type: Boolean,
    description: 'The point has a logo (GET /map-points/:id/logo)',
  })
  hasLogo: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  phone: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  email: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  address: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 2000,
    deprecated: true,
  })
  notes: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  photoId: string | null;

  @ApiProperty({
    type: () => UserRef,
    nullable: true,
    description: 'Creator of the point (userId)',
  })
  createdBy: UserRef | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  deletedAt?: Date | null;
}
