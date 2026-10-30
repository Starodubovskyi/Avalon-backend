export enum PortOperationalStatus {
  OPEN = 'OPEN',
  CONGESTED = 'CONGESTED',
  CLOSED = 'CLOSED',
}

export function normalizePortStatus(
  raw: unknown,
): PortOperationalStatus | undefined {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined;
  }

  const value = raw.trim().toUpperCase();
  if (value.includes('CONGEST')) {
    return PortOperationalStatus.CONGESTED;
  }
  if (value.includes('CLOSE')) {
    return PortOperationalStatus.CLOSED;
  }
  if (value.includes('OPEN')) {
    return PortOperationalStatus.OPEN;
  }

  return undefined;
}

export const UNLOCODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;

export function normalizeUnlocode(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const code = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5);
  return UNLOCODE_PATTERN.test(code) ? code : undefined;
}
