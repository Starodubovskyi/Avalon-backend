import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { isTeamRole, NetworkActor } from '../users-directory/user-visibility';
import { MapPoint } from './domain/map-point';

type PointAccessFacts = Pick<MapPoint, 'userId' | 'visibility'>;

export function isPointOwner(
  actor: NetworkActor,
  point: Pick<MapPoint, 'userId'>,
): boolean {
  return Number(point.userId) === actor.userId;
}

/** The team sees every point; others see public points and their own. */
export function canSeePoint(
  actor: NetworkActor,
  point: PointAccessFacts,
): boolean {
  return (
    isTeamRole(actor.roleId) ||
    point.visibility === 'public' ||
    isPointOwner(actor, point)
  );
}

/** Edit, delete, buy slots, send the email verification: owner or team. */
export function canEditPoint(
  actor: NetworkActor,
  point: Pick<MapPoint, 'userId'>,
): boolean {
  return isTeamRole(actor.roleId) || isPointOwner(actor, point);
}

/** List filter: null = every point; a user id = public points + own. */
export function pointListScope(actor: NetworkActor): number | null {
  return isTeamRole(actor.roleId) ? null : actor.userId;
}

/** A point the actor cannot see reads as missing (404), never 403. */
export function assertCanSeePoint<T extends PointAccessFacts>(
  actor: NetworkActor,
  point: T | null,
): T {
  if (!point || !canSeePoint(actor, point)) {
    throw new NotFoundException('Map point not found');
  }
  return point;
}

/** 404 when invisible, 403 when visible but not editable. */
export function assertCanEditPoint<T extends PointAccessFacts>(
  actor: NetworkActor,
  point: T | null,
): T {
  const visible = assertCanSeePoint(actor, point);
  if (!canEditPoint(actor, visible)) {
    throw new ForbiddenException();
  }
  return visible;
}
