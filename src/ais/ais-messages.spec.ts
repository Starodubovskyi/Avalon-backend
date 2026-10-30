import { decodeAisFrame, parseAisMessage } from './ais-messages';
import { AIS_BOUNDING_BOXES, buildSubscriptionMessage } from './ais.constants';

function positionFrame(report: Record<string, unknown>): string {
  return JSON.stringify({
    MessageType: 'PositionReport',
    MetaData: { MMSI: 271000123 },
    Message: { PositionReport: report },
  });
}

function staticFrame(data: Record<string, unknown>): string {
  return JSON.stringify({
    MessageType: 'ShipStaticData',
    Message: { ShipStaticData: data },
  });
}

describe('ais-messages', () => {
  describe('decodeAisFrame', () => {
    const json = '{"MessageType":"PositionReport","name":"Sulină"}';

    it('should pass text frames through', async () => {
      await expect(decodeAisFrame(json)).resolves.toBe(json);
    });

    it('should decode UTF-8 binary frames (ArrayBuffer and views)', async () => {
      const bytes = new TextEncoder().encode(json);
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      await expect(decodeAisFrame(arrayBuffer)).resolves.toBe(json);
      await expect(decodeAisFrame(bytes)).resolves.toBe(json);
      await expect(decodeAisFrame(Buffer.from(json, 'utf8'))).resolves.toBe(
        json,
      );
    });

    it('should decode Blob frames', async () => {
      await expect(decodeAisFrame(new Blob([json]))).resolves.toBe(json);
    });

    it('should return null for unsupported payloads', async () => {
      await expect(decodeAisFrame(42)).resolves.toBeNull();
      await expect(decodeAisFrame(null)).resolves.toBeNull();
    });
  });

  describe('parseAisMessage', () => {
    it('should parse a valid PositionReport', () => {
      expect(
        parseAisMessage(
          positionFrame({
            UserID: 271000123,
            Latitude: 45.155,
            Longitude: 29.72,
            Sog: 9.4,
            Cog: 271.3,
            Valid: true,
          }),
        ),
      ).toEqual({
        kind: 'position',
        mmsi: '271000123',
        lat: 45.155,
        lng: 29.72,
        sog: 9.4,
        cog: 271.3,
      });
    });

    it('should store n/a speed (102.3) and course (360) as null', () => {
      const message = parseAisMessage(
        positionFrame({
          UserID: 271000123,
          Latitude: 45.1,
          Longitude: 29.7,
          Sog: 102.3,
          Cog: 360,
        }),
      );
      expect(message).toMatchObject({ kind: 'position', sog: null, cog: null });
    });

    it('should drop unavailable or invalid coordinates', () => {
      for (const [lat, lng] of [
        [91, 29.7],
        [45.1, 181],
        [0, 0],
        [-95, 10],
      ]) {
        expect(
          parseAisMessage(
            positionFrame({ UserID: 271000123, Latitude: lat, Longitude: lng }),
          ),
        ).toEqual({ kind: 'ignored', reason: 'invalid_coordinates' });
      }
    });

    it('should drop reports flagged Valid=false', () => {
      expect(
        parseAisMessage(
          positionFrame({
            UserID: 271000123,
            Latitude: 45.1,
            Longitude: 29.7,
            Valid: false,
          }),
        ),
      ).toEqual({ kind: 'ignored', reason: 'invalid_flag' });
    });

    it('should pad short MMSI values to 9 digits and reject garbage', () => {
      expect(
        parseAisMessage(
          positionFrame({ UserID: 2710001, Latitude: 45.1, Longitude: 29.7 }),
        ),
      ).toMatchObject({ mmsi: '002710001' });
      expect(
        parseAisMessage(
          positionFrame({ UserID: '271000123', Latitude: 45, Longitude: 29 }),
        ),
      ).toEqual({ kind: 'ignored', reason: 'invalid_mmsi' });
    });

    it('should parse ShipStaticData with a 7-digit IMO', () => {
      expect(
        parseAisMessage(staticFrame({ UserID: 271000123, ImoNumber: 9123456 })),
      ).toEqual({ kind: 'static', mmsi: '271000123', imo: '9123456' });
    });

    it('should ignore ShipStaticData with IMO 0 or out of range', () => {
      for (const imo of [0, 123, 12345678, 9123456.5]) {
        expect(
          parseAisMessage(staticFrame({ UserID: 271000123, ImoNumber: imo })),
        ).toEqual({ kind: 'ignored', reason: 'invalid_identifiers' });
      }
    });

    it('should surface provider errors', () => {
      expect(parseAisMessage('{"error":"Api Key Is Not Valid"}')).toEqual({
        kind: 'error',
        error: 'Api Key Is Not Valid',
      });
    });

    it('should ignore subscription confirmations, other types and bad JSON', () => {
      expect(
        parseAisMessage('{"MessageType":"SubscriptionConfirmation"}'),
      ).toEqual({ kind: 'ignored', reason: 'subscription_confirmation' });
      expect(
        parseAisMessage('{"MessageType":"AidsToNavigationReport"}'),
      ).toEqual({ kind: 'ignored', reason: 'unsupported_type' });
      expect(parseAisMessage('not json')).toEqual({
        kind: 'ignored',
        reason: 'invalid_json',
      });
    });
  });

  describe('buildSubscriptionMessage', () => {
    it('should subscribe to the Danube delta box with both message types', () => {
      expect(buildSubscriptionMessage('key')).toEqual({
        APIKey: 'key',
        BoundingBoxes: [
          [
            [44.6, 27.7],
            [45.8, 30.4],
          ],
        ],
        FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
      });
      expect(AIS_BOUNDING_BOXES).toHaveLength(1);
    });
  });
});
