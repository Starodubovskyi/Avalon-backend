/**
 * Pure parsing of AISStream frames. No I/O here so it is unit-testable.
 * Message shape: { MessageType, MetaData, Message: { [MessageType]: {...} } }.
 */

export interface AisPositionMessage {
  kind: 'position';
  mmsi: string;
  lat: number;
  lng: number;
  sog: number | null;
  cog: number | null;
}

export interface AisStaticMessage {
  kind: 'static';
  mmsi: string;
  imo: string;
}

export interface AisErrorMessage {
  kind: 'error';
  error: string;
}

export interface AisIgnoredMessage {
  kind: 'ignored';
  reason: string;
}

export type AisMessage =
  | AisPositionMessage
  | AisStaticMessage
  | AisErrorMessage
  | AisIgnoredMessage;

type JsonRecord = Record<string, unknown>;

const utf8Decoder = new TextDecoder('utf-8');

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ignored(reason: string): AisIgnoredMessage {
  return { kind: 'ignored', reason };
}

/** AISStream sends binary frames with UTF-8 JSON; text frames are accepted too. */
export async function decodeAisFrame(data: unknown): Promise<string | null> {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return utf8Decoder.decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return utf8Decoder.decode(data);
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return await data.text();
  }
  return null;
}

/** MMSI as a 9-digit string, or null when absent/invalid. */
export function normalizeMmsi(value: unknown): string | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > 999_999_999
  ) {
    return null;
  }
  return String(value).padStart(9, '0');
}

/** IMO as a 7-digit string; 0 (not available) and out-of-range values → null. */
export function normalizeImo(value: unknown): string | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1_000_000 ||
    value > 9_999_999
  ) {
    return null;
  }
  return String(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Latitude 91 / Longitude 181 mean "not available"; 0/0 is a garbage fix. */
export function isValidCoordinate(lat: number, lng: number): boolean {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }
  return !(lat === 0 && lng === 0);
}

/** SOG 102.3 = not available. */
export function normalizeSog(value: unknown): number | null {
  const sog = finiteNumber(value);
  return sog !== null && sog >= 0 && sog < 102.3 ? sog : null;
}

/** COG 360 = not available. */
export function normalizeCog(value: unknown): number | null {
  const cog = finiteNumber(value);
  return cog !== null && cog >= 0 && cog < 360 ? cog : null;
}

function parsePositionReport(raw: unknown): AisMessage {
  if (!isRecord(raw)) {
    return ignored('missing_body');
  }
  if (raw.Valid === false) {
    return ignored('invalid_flag');
  }
  const mmsi = normalizeMmsi(raw.UserID);
  const lat = finiteNumber(raw.Latitude);
  const lng = finiteNumber(raw.Longitude);
  if (!mmsi) {
    return ignored('invalid_mmsi');
  }
  if (lat === null || lng === null || !isValidCoordinate(lat, lng)) {
    return ignored('invalid_coordinates');
  }
  return {
    kind: 'position',
    mmsi,
    lat,
    lng,
    sog: normalizeSog(raw.Sog),
    cog: normalizeCog(raw.Cog),
  };
}

function parseShipStaticData(raw: unknown): AisMessage {
  if (!isRecord(raw)) {
    return ignored('missing_body');
  }
  if (raw.Valid === false) {
    return ignored('invalid_flag');
  }
  const mmsi = normalizeMmsi(raw.UserID);
  const imo = normalizeImo(raw.ImoNumber);
  if (!mmsi || !imo) {
    return ignored('invalid_identifiers');
  }
  return { kind: 'static', mmsi, imo };
}

export function parseAisMessage(text: string): AisMessage {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return ignored('invalid_json');
  }
  if (!isRecord(payload)) {
    return ignored('not_an_object');
  }
  if (payload.error !== undefined && payload.error !== null) {
    return {
      kind: 'error',
      error:
        typeof payload.error === 'string'
          ? payload.error
          : JSON.stringify(payload.error),
    };
  }

  const body = isRecord(payload.Message) ? payload.Message : {};
  switch (payload.MessageType) {
    case 'PositionReport':
      return parsePositionReport(body.PositionReport);
    case 'ShipStaticData':
      return parseShipStaticData(body.ShipStaticData);
    case 'SubscriptionConfirmation':
      return ignored('subscription_confirmation');
    default:
      return ignored('unsupported_type');
  }
}
