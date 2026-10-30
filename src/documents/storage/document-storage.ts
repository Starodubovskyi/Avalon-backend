import { Readable } from 'stream';
import { DocumentExtension } from '../document.constants';
import { DocumentStorageDriver } from './document-storage-settings';

export interface StoredDocumentObject {
  stream: Readable;
  /** Byte length when known (sent as Content-Length). */
  size: number | null;
}

/** Where document bytes live. Records (metadata) stay in Postgres. */
export abstract class DocumentStorage {
  abstract readonly driver: DocumentStorageDriver;

  /** false → POST /documents answers 503 documentsStorageNotConfigured. */
  abstract readonly uploadsEnabled: boolean;

  /** Persists an accepted multer upload and returns its storage key. */
  abstract save(
    file: Express.Multer.File,
    extension: DocumentExtension,
  ): Promise<string>;

  /** Best-effort removal of a just-saved object when the DB insert fails. */
  abstract discard(storageKey: string): Promise<void>;

  /** null when the object does not exist. */
  abstract open(storageKey: string): Promise<StoredDocumentObject | null>;
}
