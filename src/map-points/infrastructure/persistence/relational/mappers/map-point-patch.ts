import { MapPoint } from '../../../../domain/map-point';
import { ActivityCode } from '../../../../map-point.constants';
import { MapPointPatch } from '../../map-point.repository';
import { MapPointPersistenceInput } from './map-point.mapper';

/** undefined = keep `current`; null clears; anything else is stored as text. */
function nullableText(value: unknown, current: string | null): string | null {
  if (value === undefined) {
    return current;
  }
  return value === null ? null : String(value);
}

/**
 * The stored point with `payload` applied. The owner (`userId`) never
 * changes, whoever edits the point; `logo` undefined keeps the stored logo
 * (it is not loaded for updates).
 */
export function mergeMapPointPatch(
  current: MapPoint,
  ownerId: number,
  payload: MapPointPatch,
): MapPointPersistenceInput {
  return {
    ...current,
    userId: ownerId,
    kind: typeof payload.kind === 'string' ? payload.kind : current.kind,
    visibility:
      typeof payload.visibility === 'string'
        ? payload.visibility
        : current.visibility,
    lat: typeof payload.lat === 'number' ? payload.lat : current.lat,
    lng: typeof payload.lng === 'number' ? payload.lng : current.lng,
    firstName:
      typeof payload.firstName === 'string'
        ? payload.firstName
        : current.firstName,
    // "" is a value: it clears the legacy lastName / activity
    lastName:
      typeof payload.lastName === 'string'
        ? payload.lastName
        : current.lastName,
    activity:
      typeof payload.activity === 'string'
        ? payload.activity
        : current.activity,
    activities: Array.isArray(payload.activities)
      ? payload.activities.filter(
          (code): code is ActivityCode => typeof code === 'string',
        )
      : current.activities,
    logo:
      payload.logo === undefined
        ? undefined
        : payload.logo === null
          ? null
          : String(payload.logo),
    phone: nullableText(payload.phone, current.phone),
    email: nullableText(payload.email, current.email),
    address: nullableText(payload.address, current.address),
    notes: nullableText(payload.notes, current.notes),
    photoId: nullableText(payload.photoId, current.photoId),
    description: nullableText(payload.description, current.description),
    website: nullableText(payload.website, current.website),
    parentId: nullableText(payload.parentId, current.parentId),
  };
}
