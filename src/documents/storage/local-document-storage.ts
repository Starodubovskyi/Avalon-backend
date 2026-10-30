import { Logger, OnModuleInit } from '@nestjs/common';
import { createReadStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import path from 'path';
import { DocumentStorage, StoredDocumentObject } from './document-storage';

/**
 * Local disk (dev / single server). Multer's diskStorage has already written
 * the file under a random name; on errors CleanupUploadOnErrorInterceptor
 * removes it, so discard() has nothing to do.
 */
export class LocalDocumentStorage
  extends DocumentStorage
  implements OnModuleInit
{
  readonly driver = 'local' as const;
  private readonly logger = new Logger(LocalDocumentStorage.name);

  constructor(
    private readonly directory: string,
    readonly uploadsEnabled: boolean,
    private readonly disabledReason: string | null,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    if (!this.uploadsEnabled) {
      this.logger.warn(
        `Document uploads disabled: ${this.disabledReason ?? 'not configured'}`,
      );
      return;
    }
    try {
      await mkdir(this.directory, { recursive: true });
    } catch (error) {
      this.logger.error(
        `Cannot create documents directory ${this.directory}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  save(file: Express.Multer.File): Promise<string> {
    if (!file.filename || !file.path) {
      return Promise.reject(new Error('Upload was not stored on disk'));
    }
    return Promise.resolve(file.filename);
  }

  discard(): Promise<void> {
    return Promise.resolve();
  }

  async open(storageKey: string): Promise<StoredDocumentObject | null> {
    const filePath = path.join(this.directory, storageKey);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) {
      return null;
    }
    return { stream: createReadStream(filePath), size: fileStat.size };
  }
}
