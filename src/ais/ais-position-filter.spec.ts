import {
  distanceNm,
  impliedSpeedKnots,
  isPlausibleFix,
  PositionThrottle,
} from './ais-position-filter';
import { reconnectDelayMs } from './ais.constants';

const at = (iso: string) => new Date(iso);

describe('ais-position-filter', () => {
  describe('distanceNm', () => {
    it('should measure one degree of latitude as ~60 nm', () => {
      expect(
        distanceNm({ lat: 45, lng: 29 }, { lat: 46, lng: 29 }),
      ).toBeCloseTo(60.04, 1);
    });
  });

  describe('isPlausibleFix', () => {
    const previous = { lat: 45.15, lng: 29.66, at: at('2026-10-30T10:00:00Z') };

    it('should accept the first fix of a vessel', () => {
      expect(isPlausibleFix(undefined, previous)).toBe(true);
    });

    it('should accept a normal 10 kn move', () => {
      // 1 nm north in 6 minutes = 10 kn
      const next = {
        lat: 45.15 + 1 / 60,
        lng: 29.66,
        at: at('2026-10-30T10:06:00Z'),
      };
      expect(impliedSpeedKnots(previous, next)).toBeCloseTo(10, 0);
      expect(isPlausibleFix(previous, next)).toBe(true);
    });

    it('should drop a spoofed jump implying more than 40 kn', () => {
      // ~30 nm in one minute (GNSS jamming artefact)
      const next = { lat: 45.65, lng: 29.66, at: at('2026-10-30T10:01:00Z') };
      expect(isPlausibleFix(previous, next)).toBe(false);
    });

    it('should accept the same jump once enough time has passed', () => {
      const next = { lat: 45.65, lng: 29.66, at: at('2026-10-30T11:00:00Z') };
      expect(isPlausibleFix(previous, next)).toBe(true);
    });

    it('should not divide by zero for identical timestamps', () => {
      const same = { ...previous, lat: 45.1501 };
      expect(Number.isFinite(impliedSpeedKnots(previous, same))).toBe(true);
    });
  });

  describe('PositionThrottle', () => {
    it('should allow one write per vessel per minute', () => {
      const throttle = new PositionThrottle(60_000);
      expect(throttle.canWrite('a', 0)).toBe(true);
      throttle.markWritten('a', 0);
      expect(throttle.canWrite('a', 59_999)).toBe(false);
      expect(throttle.canWrite('b', 30_000)).toBe(true);
      expect(throttle.canWrite('a', 60_000)).toBe(true);
    });

    it('should forget vessels that are no longer tracked', () => {
      const throttle = new PositionThrottle(60_000);
      throttle.markWritten('a', 0);
      throttle.retain(new Set(['b']));
      expect(throttle.canWrite('a', 1)).toBe(true);
    });
  });

  describe('reconnectDelayMs', () => {
    it('should back off exponentially up to 5 minutes', () => {
      expect(reconnectDelayMs(0)).toBe(5_000);
      expect(reconnectDelayMs(1)).toBe(10_000);
      expect(reconnectDelayMs(3)).toBe(40_000);
      expect(reconnectDelayMs(20)).toBe(300_000);
    });
  });
});
