import { ApiProperty } from '@nestjs/swagger';
import { MapPoint } from './map-point';
import { MapPointLogoMimeType } from '../map-point.constants';

/** A map point as returned by the API, with fields that depend on the caller. */
export class MapPointView extends MapPoint {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '1793700000000',
    description:
      'Cache key of the logo: request GET /map-points/:id/logo?v=<logoVersion>. Null when there is no logo.',
  })
  logoVersion: string | null;

  @ApiProperty({
    type: Boolean,
    description: 'In the personal favorites of the current user',
  })
  isFavorite: boolean;

  @ApiProperty({
    type: Number,
    example: 980,
    description: 'Rank of the user who created the point',
  })
  rank: number;
}

export class MapPointFavoriteState {
  @ApiProperty({ type: Boolean })
  isFavorite: boolean;
}

/** Decoded logo bytes, served with the stored (allowlisted) MIME type. */
export interface MapPointLogo {
  mimeType: MapPointLogoMimeType;
  bytes: Buffer;
}

/**
 * The logo version changes whenever the point is saved, so a client cache
 * keyed by `?v=` never serves a replaced logo.
 */
export function toMapPointView(
  point: MapPoint,
  isFavorite: boolean,
  rank: number,
): MapPointView {
  return Object.assign(new MapPointView(), point, {
    logoVersion: point.hasLogo ? String(point.updatedAt.getTime()) : null,
    isFavorite,
    rank,
  });
}
