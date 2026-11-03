import { PartialType } from '@nestjs/swagger';
import { CreateMapPointDto } from './create-map-point.dto';

/**
 * skipNullProperties: false keeps the Create DTO null semantics: nullable
 * fields (@IsOptional) accept null, non-nullable ones (title, coordinates,
 * activities) reject it. Favorites are per user: see POST/DELETE
 * /map-points/:id/favorite (the legacy shared `isFavorite` is not writable).
 */
export class UpdateMapPointDto extends PartialType(CreateMapPointDto, {
  skipNullProperties: false,
}) {}
