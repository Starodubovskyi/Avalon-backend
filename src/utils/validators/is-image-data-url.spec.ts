import { decodeImageDataUrl, imageDataUrlError } from './is-image-data-url';

const MIME_TYPES = ['image/webp', 'image/png', 'image/jpeg'] as const;
const MAX = 150_000;

const SIGNATURES = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  webp: Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from('WEBPVP8 ', 'latin1'),
  ]),
};

function dataUrl(mime: string, head: Buffer, bodyBytes = 32): string {
  const payload = Buffer.concat([head, Buffer.alloc(bodyBytes, 7)]);
  return `data:${mime};base64,${payload.toString('base64')}`;
}

describe('imageDataUrlError', () => {
  it('should accept webp, png and jpeg data URLs with matching content', () => {
    expect(
      imageDataUrlError(
        dataUrl('image/webp', SIGNATURES.webp),
        MIME_TYPES,
        MAX,
      ),
    ).toBeNull();
    expect(
      imageDataUrlError(dataUrl('image/png', SIGNATURES.png), MIME_TYPES, MAX),
    ).toBeNull();
    expect(
      imageDataUrlError(
        dataUrl('image/jpeg', SIGNATURES.jpeg),
        MIME_TYPES,
        MAX,
      ),
    ).toBeNull();
  });

  it('should reject other image types, including svg', () => {
    expect(
      imageDataUrlError(dataUrl('image/gif', SIGNATURES.png), MIME_TYPES, MAX),
    ).toBe('invalid');
    const svg = `data:image/svg+xml;base64,${Buffer.from('<svg onload="x()"/>').toString('base64')}`;
    expect(imageDataUrlError(svg, MIME_TYPES, MAX)).toBe('invalid');
  });

  it('should reject content that is not the declared image type', () => {
    expect(
      imageDataUrlError(dataUrl('image/png', SIGNATURES.jpeg), MIME_TYPES, MAX),
    ).toBe('invalid');
    const html = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;
    expect(imageDataUrlError(html, MIME_TYPES, MAX)).toBe('invalid');
  });

  it('should reject non data URLs, plain text and broken base64', () => {
    expect(
      imageDataUrlError('https://example.com/logo.png', MIME_TYPES, MAX),
    ).toBe('invalid');
    expect(imageDataUrlError('data:image/png,abc', MIME_TYPES, MAX)).toBe(
      'invalid',
    );
    const valid = dataUrl('image/png', SIGNATURES.png);
    expect(imageDataUrlError(`${valid}*`, MIME_TYPES, MAX)).toBe('invalid');
    expect(imageDataUrlError(valid.slice(0, -1), MIME_TYPES, MAX)).toBe(
      'invalid',
    );
    expect(imageDataUrlError(42, MIME_TYPES, MAX)).toBe('invalid');
  });

  it('should report values over the limit as tooLong', () => {
    const big = dataUrl('image/png', SIGNATURES.png, 120_000);
    expect(big.length).toBeGreaterThan(MAX);
    expect(imageDataUrlError(big, MIME_TYPES, MAX)).toBe('tooLong');

    const fits = dataUrl('image/png', SIGNATURES.png, 100_000);
    expect(fits.length).toBeLessThanOrEqual(MAX);
    expect(imageDataUrlError(fits, MIME_TYPES, MAX)).toBeNull();
  });
});

describe('decodeImageDataUrl', () => {
  it('should return the bytes and the allowlisted MIME type', () => {
    const payload = Buffer.concat([SIGNATURES.jpeg, Buffer.alloc(20, 5)]);
    const decoded = decodeImageDataUrl(
      `data:image/jpeg;base64,${payload.toString('base64')}`,
      MIME_TYPES,
    );
    expect(decoded?.mimeType).toBe('image/jpeg');
    expect(decoded?.bytes.equals(payload)).toBe(true);
  });

  it('should return null for a type outside the allowlist or mismatching content', () => {
    expect(
      decodeImageDataUrl(dataUrl('image/png', SIGNATURES.png), ['image/webp']),
    ).toBeNull();
    expect(
      decodeImageDataUrl(dataUrl('image/png', SIGNATURES.jpeg), MIME_TYPES),
    ).toBeNull();
    expect(decodeImageDataUrl('not a data url', MIME_TYPES)).toBeNull();
  });
});
