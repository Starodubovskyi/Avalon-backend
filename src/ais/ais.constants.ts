export const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

/**
 * Danube delta + Sulina approaches only (pairs are [lat, lon]). A narrow box
 * keeps the volume low: AISStream drops messages for slow consumers.
 */
export const AIS_BOUNDING_BOXES: [number, number][][] = [
  [
    [44.6, 27.7],
    [45.8, 30.4],
  ],
];

export const AIS_MESSAGE_TYPES = ['PositionReport', 'ShipStaticData'];

/** Re-read active vessels (IMO/MMSI maps) this often. */
export const AIS_VESSEL_RELOAD_INTERVAL_MS = 2 * 60 * 1000;

/** Max one stored position per vessel per minute. */
export const AIS_POSITION_MIN_INTERVAL_MS = 60 * 1000;

/** IMO->MMSI binding needs two consistent ShipStaticData frames this far apart. */
export const AIS_MMSI_CONFIRM_MS = 2 * 60 * 1000;

/** A fix implying a faster move from the previous AIS fix is treated as spoofed. */
export const AIS_MAX_PLAUSIBLE_SPEED_KN = 40;

export const AIS_RECONNECT_BASE_DELAY_MS = 5 * 1000;
export const AIS_RECONNECT_MAX_DELAY_MS = 5 * 60 * 1000;

/** Connected but silent this long → assume a dead socket and reconnect. */
export const AIS_STALE_CONNECTION_MS = 10 * 60 * 1000;

export function buildSubscriptionMessage(apiKey: string) {
  return {
    APIKey: apiKey,
    BoundingBoxes: AIS_BOUNDING_BOXES,
    FilterMessageTypes: AIS_MESSAGE_TYPES,
  };
}

export function reconnectDelayMs(attempt: number): number {
  return Math.min(
    AIS_RECONNECT_MAX_DELAY_MS,
    AIS_RECONNECT_BASE_DELAY_MS * 2 ** Math.max(0, attempt),
  );
}
