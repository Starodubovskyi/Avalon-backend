import path from 'path';
import { DEFAULT_DOCUMENTS_DIR } from '../document.constants';

export const DOCUMENT_STORAGE_DRIVERS = ['local', 's3'] as const;
export type DocumentStorageDriver = (typeof DOCUMENT_STORAGE_DRIVERS)[number];

export const DEFAULT_DOCUMENTS_S3_REGION = 'auto';

/** Injection token for the resolved settings. */
export const DOCUMENT_STORAGE_SETTINGS = Symbol('DOCUMENT_STORAGE_SETTINGS');

export interface S3StorageSettings {
  bucket: string;
  region: string;
  /** Custom endpoint for S3-compatible stores (Cloudflare R2, MinIO). */
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface DocumentStorageSettings {
  driver: DocumentStorageDriver;
  uploadsEnabled: boolean;
  /** Why uploads are disabled (logged once at startup); null when enabled. */
  disabledReason: string | null;
  localDirectory: string;
  /** Present only when the s3 driver is fully configured. */
  s3: S3StorageSettings | null;
}

type Env = Record<string, string | undefined>;

function read(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/**
 * Pure: picks the documents storage from env.
 * - DOCUMENTS_DRIVER unset/local → local disk (DOCUMENTS_DIR); on Vercel
 *   (read-only FS) uploads are disabled.
 * - DOCUMENTS_DRIVER=s3 → S3/R2; uploads are disabled until bucket and keys
 *   are all set.
 * Never throws, so a misconfiguration cannot stop the app from booting.
 */
export function resolveDocumentStorageSettings(
  env: Env,
): DocumentStorageSettings {
  const requested = (read(env, 'DOCUMENTS_DRIVER') ?? 'local').toLowerCase();
  const localDirectory = path.resolve(
    read(env, 'DOCUMENTS_DIR') ?? DEFAULT_DOCUMENTS_DIR,
  );
  const serverless = Boolean(read(env, 'VERCEL'));

  if (requested === 's3') {
    const bucket = read(env, 'DOCUMENTS_S3_BUCKET');
    const accessKeyId = read(env, 'DOCUMENTS_S3_ACCESS_KEY_ID');
    const secretAccessKey = read(env, 'DOCUMENTS_S3_SECRET_ACCESS_KEY');
    if (!bucket || !accessKeyId || !secretAccessKey) {
      return {
        driver: 's3',
        uploadsEnabled: false,
        disabledReason:
          'DOCUMENTS_DRIVER=s3 needs DOCUMENTS_S3_BUCKET, DOCUMENTS_S3_ACCESS_KEY_ID and DOCUMENTS_S3_SECRET_ACCESS_KEY',
        localDirectory,
        s3: null,
      };
    }
    return {
      driver: 's3',
      uploadsEnabled: true,
      disabledReason: null,
      localDirectory,
      s3: {
        bucket,
        region: read(env, 'DOCUMENTS_S3_REGION') ?? DEFAULT_DOCUMENTS_S3_REGION,
        endpoint: read(env, 'DOCUMENTS_S3_ENDPOINT'),
        accessKeyId,
        secretAccessKey,
      },
    };
  }

  if (requested !== 'local') {
    return {
      driver: 'local',
      uploadsEnabled: false,
      disabledReason: `Unknown DOCUMENTS_DRIVER "${requested}" (expected local or s3)`,
      localDirectory,
      s3: null,
    };
  }

  return {
    driver: 'local',
    uploadsEnabled: !serverless,
    disabledReason: serverless
      ? 'Local disk is read-only on Vercel; set DOCUMENTS_DRIVER=s3'
      : null,
    localDirectory,
    s3: null,
  };
}
