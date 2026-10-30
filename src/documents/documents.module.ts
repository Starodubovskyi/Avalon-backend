import {
  HttpStatus,
  Logger,
  Module,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { mkdir } from 'fs/promises';
import { diskStorage } from 'multer';
import { RelationalVesselPersistenceModule } from '../vessels/infrastructure/persistence/relational/relational-persistence.module';
import {
  buildStorageKey,
  getAllowedExtension,
  resolveDocumentsDir,
  resolveDocumentsMaxFileSize,
} from './documents-storage';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { RelationalDocumentPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

@Module({
  imports: [
    RelationalDocumentPersistenceModule,
    RelationalVesselPersistenceModule,
    // Own multer config: private directory (not the public /files route),
    // extension allowlist, random storage names, size limit.
    MulterModule.registerAsync({
      useFactory: () => {
        const directory = resolveDocumentsDir();
        return {
          storage: diskStorage({
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
          }),
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
        };
      },
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule implements OnModuleInit {
  private readonly logger = new Logger(DocumentsModule.name);

  async onModuleInit(): Promise<void> {
    const directory = resolveDocumentsDir();
    try {
      await mkdir(directory, { recursive: true });
    } catch (error) {
      this.logger.error(
        `Cannot create documents directory ${directory}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
