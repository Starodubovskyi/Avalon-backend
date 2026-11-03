import { ValidateBy, ValidationOptions } from 'class-validator';

const DATA_URL_PATTERN = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Leading bytes of each supported image format (WebP also needs "WEBP" at 8). */
function hasImageSignature(mimeType: string, head: Buffer): boolean {
  switch (mimeType) {
    case 'image/png':
      return head
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/webp':
      return (
        head.subarray(0, 4).toString('latin1') === 'RIFF' &&
        head.subarray(8, 12).toString('latin1') === 'WEBP'
      );
    default:
      return false;
  }
}

export type ImageDataUrlError = 'invalid' | 'tooLong';

/**
 * Checks a base64 image data URL: allowed MIME type, padded base64 payload
 * and file signature matching the declared type. Returns the error code or
 * null when the value is acceptable.
 */
export function imageDataUrlError(
  value: unknown,
  mimeTypes: readonly string[],
  maxLength: number,
): ImageDataUrlError | null {
  if (typeof value !== 'string') return 'invalid';
  if (value.length > maxLength) return 'tooLong';
  const match = DATA_URL_PATTERN.exec(value);
  if (!match || !mimeTypes.includes(match[1]) || match[2].length % 4 !== 0) {
    return 'invalid';
  }
  // 16 base64 chars = 12 bytes: enough for every signature above.
  const head = Buffer.from(match[2].slice(0, 16), 'base64');
  return hasImageSignature(match[1], head) ? null : 'invalid';
}

export interface DecodedImage<T extends string> {
  mimeType: T;
  bytes: Buffer;
}

/**
 * Decodes a stored image data URL into bytes, re-checking the MIME type
 * against the allowlist and the file signature. Null when the value is not
 * an acceptable image (it is then never served).
 */
export function decodeImageDataUrl<T extends string>(
  value: string,
  mimeTypes: readonly T[],
): DecodedImage<T> | null {
  const match = DATA_URL_PATTERN.exec(value);
  const mimeType = match
    ? mimeTypes.find((type) => type === match[1])
    : undefined;
  if (!match || !mimeType || match[2].length % 4 !== 0) {
    return null;
  }
  const bytes = Buffer.from(match[2], 'base64');
  return hasImageSignature(mimeType, bytes) ? { mimeType, bytes } : null;
}

/**
 * Image as a base64 data URL (`data:image/png;base64,...`). One constraint →
 * one error code: `tooLong` (over maxLength characters) or `invalid`
 * (not a data URL, other MIME type, broken base64 or content that is not
 * the declared image type). Combine with `@IsOptional()` for nullable fields.
 */
export function IsImageDataUrl(
  mimeTypes: readonly string[],
  maxLength: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isImageDataUrl',
      constraints: [mimeTypes, maxLength],
      validator: {
        validate: (value: unknown) =>
          imageDataUrlError(value, mimeTypes, maxLength) === null,
        defaultMessage: (args) =>
          imageDataUrlError(args?.value, mimeTypes, maxLength) ?? 'invalid',
      },
    },
    validationOptions,
  );
}
