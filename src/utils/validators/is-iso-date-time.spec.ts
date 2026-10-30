import { isIsoDateTime } from './is-iso-date-time';

describe('isIsoDateTime', () => {
  it('should accept full date-times with Z or an explicit offset', () => {
    for (const value of [
      '2026-10-30T10:00:00.000Z',
      '2026-10-30T10:00Z',
      '2026-10-30T10:00:00+02:00',
      '2026-10-30T10:00:00.123456-05:30',
      '2028-02-29T00:00:00Z',
    ]) {
      expect(isIsoDateTime(value)).toBe(true);
    }
  });

  it('should reject ISO forms that Date cannot parse or that lack an offset', () => {
    for (const value of [
      '20261030',
      '2026-W44',
      '2026-303',
      '2026-10-30',
      '2026-10-30T10:00:00',
      '2026-10-30T25:00:00Z',
      '2026-02-30T10:00:00Z',
      '2026-13-01T10:00:00Z',
      '',
      1793354400000,
      null,
    ]) {
      expect(isIsoDateTime(value)).toBe(false);
    }
  });
});
