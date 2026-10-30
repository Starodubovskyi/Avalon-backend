import {
  HttpStatus,
  Module,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { mkdir } from 'fs/promises';
import { diskStorage, memoryStorage, StorageEngine } from 'multer';
import { RelationalVesselPersistenceModule } from '../vessels/infrastructure/persistence/relational/relational-persistence.module';
import {
  buildStorageKey,
  getAllowedExtension,
  resolveDocumentsMaxFileSize,
} from './documents-storage';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { RelationalDocumentPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';
import { DocumentStorage } from './storage/document-storage';
import { createDocumentStorage } from './storage/document-storage.factory';
import {
  DOCUMENT_STORAGE_SETTINGS,
  DocumentStorageSettings,
  resolveDocumentStorageSettings,
} from './storage/document-storage-settings';
import { DocumentUploadsEnabledGuard } from './storage/document-uploads-enabled.guard';

/** s3 → bytes stay in memory until PutObject; local → random name on disk. */
function buildMulterStorage(settings: DocumentStorageSettings): StorageEngine {
  if (settings.s3) {
    return memoryStorage();
  }
  const directory = settings.localDirectory;
  return diskStorage({
    // lazy mkdir: a string destination would mkdir at boot (read-only FS on Vercel)
    destination: (_request, _file, callback) => {
      void mkdir(directory, { recursive: true }).then(
        () => callback(null, directory),
        (error: Error) => callback(error, directory),
      );
    },
    filename: (_request, file, callback) => {
      const extension = getAllowedExtension(file.originalname);
      if (!extension) {
        return callback(new Error('Unexpected file type'), '');
      }
      callback(null, buildStorageKey(extension));
    },
  });
}

@Module({
  imports: [
    RelationalDocumentPersistenceModule,
    RelationalVesselPersistenceModule,
    // Own multer config: private storage (not the public /files route),
    // extension allowlist, random storage names, size limit.
    MulterModule.registerAsync({
      useFactory: () => ({
        storage: buildMulterStorage(
          resolveDocumentStorageSettings(process.env),
        ),
        fileFilter: (_request, file, callback) => {
          if (!getAllowedExtension(file.originalname)) {
            return callback(
              new UnprocessableEntityException({
                status: HttpStatus.UNPROCESSABLE_ENTITY,
                errors: { file: 'cantUploadFileType' },
              }),
              false,
            );
          }
          callback(null, true);
        },
        limits: {
          fileSize: resolveDocumentsMaxFileSize(),
          files: 1,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentUploadsEnabledGuard,
    {
      provide: DOCUMENT_STORAGE_SETTINGS,
      useFactory: () => resolveDocumentStorageSettings(process.env),
    },
    {
      provide: DocumentStorage,
      inject: [DOCUMENT_STORAGE_SETTINGS],
      useFactory: createDocumentStorage,
    },
  ],
})
export class DocumentsModule {}
