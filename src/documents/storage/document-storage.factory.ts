import { DocumentStorage } from './document-storage';
import { DocumentStorageSettings } from './document-storage-settings';
import { LocalDocumentStorage } from './local-document-storage';
import { S3DocumentStorage } from './s3-document-storage';

/**
 * A configured s3 driver gets the S3 storage; everything else falls back to
 * local disk (uploads possibly disabled), so existing records stay readable
 * and the app always boots.
 */
export function createDocumentStorage(
  settings: DocumentStorageSettings,
): DocumentStorage {
  if (settings.driver === 's3' && settings.s3) {
    return new S3DocumentStorage(settings.s3);
  }
  return new LocalDocumentStorage(
    settings.localDirectory,
    settings.uploadsEnabled,
    settings.disabledReason,
  );
}
