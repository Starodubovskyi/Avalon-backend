import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '../../roles/roles.enum';

export const USER_CARD_ROLES = ['admin', 'staff', 'viewer'] as const;
export type UserCardRole = (typeof USER_CARD_ROLES)[number];

/** Public person card used by the directory, chat and social sections. */
export class UserCard {
  @ApiProperty({ type: Number, example: 1 })
  id: number;

  @ApiProperty({ type: String, nullable: true, example: 'John' })
  firstName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Doe' })
  lastName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'john@example.com' })
  email: string | null;

  @ApiProperty({ enum: USER_CARD_ROLES, example: 'staff' })
  role: UserCardRole;
}

/** Shape of a user row as selected by the raw SQL of chat/social/directory. */
export interface UserCardRow {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  roleId: number | null;
}

/** RoleEnum.user is presented as "viewer"; unknown/missing roles too. */
export function toUserCardRole(
  roleId: number | string | null | undefined,
): UserCardRole {
  switch (Number(roleId)) {
    case RoleEnum.admin:
      return 'admin';
    case RoleEnum.staff:
      return 'staff';
    default:
      return 'viewer';
  }
}

export function toUserCard(row: UserCardRow): UserCard {
  const card = new UserCard();
  card.id = Number(row.id);
  card.firstName = row.firstName ?? null;
  card.lastName = row.lastName ?? null;
  card.email = row.email ?? null;
  card.role = toUserCardRole(row.roleId);
  return card;
}
