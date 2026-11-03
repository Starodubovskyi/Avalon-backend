import { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { RoleEnum } from '../roles/roles.enum';
import { UserCard } from './domain/user-card';

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
 * Who the actor may see in the directory, people, chat, follows, the feed
 * and profiles. null = everyone (admin/staff). A viewer sees the team roles
 * and "public profiles": owners and active members of public map points.
 */
export interface VisibleUsers {
  roleIds: number[];
  publicProfiles: boolean;
}

export function visibleUsers(actor: NetworkActor): VisibleUsers | null {
  return isTeamRole(actor.roleId)
    ? null
    : { roleIds: [RoleEnum.admin, RoleEnum.staff], publicProfiles: true };
}

/** What visibility depends on, for one target user. */
export interface UserVisibilityFacts {
  roleId: number | null;
  /** Owns or actively works at a public map point. */
  publicProfile: boolean;
}

export function canSeeUser(
  actor: NetworkActor,
  target: UserVisibilityFacts,
): boolean {
  const scope = visibleUsers(actor);
  if (scope === null) {
    return true;
  }
  return (
    (target.roleId !== null && scope.roleIds.includes(target.roleId)) ||
    (scope.publicProfiles && target.publicProfile)
  );
}

/** Viewers never see the email of another client (role user); the team does. */
export function canSeeEmail(
  actor: NetworkActor,
  target: Pick<UserCard, 'id' | 'role'>,
): boolean {
  return (
    isTeamRole(actor.roleId) ||
    target.id === actor.userId ||
    target.role !== 'viewer'
  );
}

/** The card as the actor may see it (email hidden where canSeeEmail says no). */
export function redactUserCard<T extends UserCard>(
  card: T,
  actor: NetworkActor,
): T {
  return canSeeEmail(actor, card) ? card : Object.assign(card, { email: null });
}

/** Posts and comments: the author, or any admin. */
export function canDeleteContent(
  actor: NetworkActor,
  authorId: number,
): boolean {
  return authorId === actor.userId || isAdmin(actor);
}
