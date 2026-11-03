import { ApiProperty } from '@nestjs/swagger';
import {
  toUserCardRole,
  USER_CARD_ROLES,
  UserCardRole,
} from '../../users-directory/domain/user-card';
import { toUserRef, UserRef } from '../../users/domain/user-ref';

/** Owner (creator) of a point; the role decides who may see the email. */
export class MapPointCreator extends UserRef {
  @ApiProperty({ enum: USER_CARD_ROLES, example: 'staff' })
  role: UserCardRole;
}

export function toMapPointCreator(
  raw:
    | {
        id: number;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        role?: { id: number | string } | null;
      }
    | null
    | undefined,
): MapPointCreator | null {
  const ref = toUserRef(raw);
  if (!ref || !raw) {
    return null;
  }
  return Object.assign(new MapPointCreator(), ref, {
    role: toUserCardRole(raw.role?.id),
  });
}
