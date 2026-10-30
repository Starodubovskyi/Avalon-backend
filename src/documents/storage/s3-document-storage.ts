import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Readable } from 'stream';
import { DocumentExtension } from '../document.constants';
import { buildStorageKey, mimeTypeForExtension } from '../documents-storage';
import { DocumentStorage, StoredDocumentObject } from './document-storage';
import { S3StorageSettings } from './document-storage-settings';

const OBJECT_PREFIX = 'documents/';

function isNotFound(error: unknown): boolean {
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate?.name === 'NoSuchKey' ||
    candidate?.name === 'NotFound' ||
    candidate?.$metadata?.httpStatusCode === 404
  );
}

/** S3-compatible object storage (AWS S3, Cloudflare R2). Uploads come from multer memoryStorage. */
export class S3DocumentStorage extends DocumentStorage implements OnModuleInit {
  readonly driver = 's3' as const;
  readonly uploadsEnabled = true;
  private readonly logger = new Logger(S3DocumentStorage.name);
  private readonly client: S3Client;

  constructor(
    private readonly settings: S3StorageSettings,
    client?: S3Client,
  ) {
    super();
    this.client =
      client ??
      new S3Client({
        region: settings.region,
        endpoint: settings.endpoint,
        forcePathStyle: Boolean(settings.endpoint),
        credentials: {
          accessKeyId: settings.accessKeyId,
          secretAccessKey: settings.secretAccessKey,
        },
        // R2 and other S3-compatible stores reject the SDK's default checksums
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
  }

  onModuleInit(): void {
    this.logger.log(
      `Document storage: s3 bucket "${this.settings.bucket}"${
        this.settings.endpoint ? ` at ${this.settings.endpoint}` : ''
      }`,
    );
  }

  async save(
    file: Express.Multer.File,
    extension: DocumentExtension,
  ): Promise<string> {
    if (!file.buffer) {
      throw new Error('Upload is not in memory');
    }
    const storageKey = buildStorageKey(extension);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: OBJECT_PREFIX + storageKey,
        Body: file.buffer,
        ContentLength: file.size,
        ContentType: mimeTypeForExtension(extension),
      }),
    );
    return storageKey;
  }

  async discard(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.settings.bucket,
          Key: OBJECT_PREFIX + storageKey,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to discard object ${storageKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async open(storageKey: string): Promise<StoredDocumentObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.settings.bucket,
          Key: OBJECT_PREFIX + storageKey,
        }),
      );
      const body = response.Body;
      if (!body) {
        return null;
      }
      // In Node the SDK returns an http.IncomingMessage (a Readable).
      const stream =
        body instanceof Readable
          ? body
          : Readable.from(await body.transformToByteArray());
      return { stream, size: response.ContentLength ?? null };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }
}
