import { AIS_MAX_PLAUSIBLE_SPEED_KN } from './ais.constants';

export interface GeoFix {
  lat: number;
  lng: number;
  at: Date;
}

const EARTH_RADIUS_NM = 3440.065;
const MIN_ELAPSED_MS = 1000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in nautical miles (haversine). */
export function distanceNm(
  a: Pick<GeoFix, 'lat' | 'lng'>,
  b: Pick<GeoFix, 'lat' | 'lng'>,
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function impliedSpeedKnots(previous: GeoFix, next: GeoFix): number {
  const elapsedMs = Math.max(
    next.at.getTime() - previous.at.getTime(),
    MIN_ELAPSED_MS,
  );
  return distanceNm(previous, next) / (elapsedMs / 3_600_000);
}

/**
 * GNSS jamming/spoofing over the Danube delta produces jumps; reject a fix
 * that implies more than `maxKnots` from the previous stored AIS fix.
 */
export function isPlausibleFix(
  previous: GeoFix | null | undefined,
  next: GeoFix,
  maxKnots: number = AIS_MAX_PLAUSIBLE_SPEED_KN,
): boolean {
  if (!previous) {
    return true;
  }
  return impliedSpeedKnots(previous, next) <= maxKnots;
}

/** Allows at most one write per key per `minIntervalMs`. */
export class PositionThrottle {
  private readonly lastWriteAt = new Map<string, number>();

  constructor(private readonly minIntervalMs: number) {}

  canWrite(key: string, nowMs: number): boolean {
    const last = this.lastWriteAt.get(key);
    return last === undefined || nowMs - last >= this.minIntervalMs;
  }

  markWritten(key: string, nowMs: number): void {
    this.lastWriteAt.set(key, nowMs);
  }

  /** Drops state for keys no longer tracked. */
  retain(keys: ReadonlySet<string>): void {
    for (const key of this.lastWriteAt.keys()) {
      if (!keys.has(key)) {
        this.lastWriteAt.delete(key);
      }
    }
  }
}
