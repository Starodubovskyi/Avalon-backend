import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RoleEnum } from '../roles/roles.enum';

/** The authenticated caller: id and role always come from the JWT. */
export interface NetworkActor {
  userId: number;
  roleId: number | null;
}

export function toNetworkActor(user: JwtPayloadType): NetworkActor {
  const roleId = Number(user.role?.id);
  return {
    userId: Number(user.id),
    roleId: Number.isFinite(roleId) ? roleId : null,
  };
}

/** admin and staff are the team; everyone else is a viewer (observer). */
export function isTeamRole(roleId: number | null | undefined): boolean {
  return roleId === RoleEnum.admin || roleId === RoleEnum.staff;
}

export function isAdmin(actor: NetworkActor): boolean {
  return actor.roleId === RoleEnum.admin;
}

/**
 * Roles of the people the actor may see (directory, people, chat partners,
 * follows). null = no role restriction (admin/staff see everyone).
 */
export function visibleRoleIds(actor: NetworkActor): number[] | null {
  return isTeamRole(actor.roleId) ? null : [RoleEnum.admin, RoleEnum.staff];
}

export function canSeeUser(
  actor: NetworkActor,
  targetRoleId: number | null,
): boolean {
  const roles = visibleRoleIds(actor);
  return (
    roles === null || (targetRoleId !== null && roles.includes(targetRoleId))
  );
}

/** Posts and comments: the author, or any admin. */
export function canDeleteContent(
  actor: NetworkActor,
  authorId: number,
): boolean {
  return authorId === actor.userId || isAdmin(actor);
}
