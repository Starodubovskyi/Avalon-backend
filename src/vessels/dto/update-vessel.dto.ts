import { PartialType } from '@nestjs/swagger';
import { CreateVesselDto } from './create-vessel.dto';

/**
 * skipNullProperties: false keeps the Create DTO null semantics:
 * nullable fields (@IsOptional) accept null, non-nullable ones reject it.
 */
export class UpdateVesselDto extends PartialType(CreateVesselDto, {
  skipNullProperties: false,
}) {}
