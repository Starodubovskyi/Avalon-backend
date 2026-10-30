import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Readable } from 'stream';
import { VesselRepository } from '../vessels/infrastructure/persistence/vessel.repository';
import { DOCUMENT_LIST_LIMIT } from './document.constants';
import {
  buildContentDisposition,
  decodeUploadedName,
  getAllowedExtension,
  isSafeStorageKey,
  mimeTypeForExtension,
  sanitizeOriginalName,
} from './documents-storage';
import { DocumentView, toDocumentView } from './domain/document';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { DocumentRepository } from './infrastructure/persistence/document.repository';
import { DocumentStorage } from './storage/document-storage';

export interface DocumentDownload {
  stream: Readable;
  mimeType: string;
  /** null when the storage does not report a length */
  size: number | null;
  contentDisposition: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly vesselRepository: VesselRepository,
    private readonly storage: DocumentStorage,
  ) {}

  async findAll(query: QueryDocumentDto): Promise<DocumentView[]> {
    const documents = await this.documentRepository.findMany({
      vesselId: query.vesselId,
      category: query.category,
      search: query.search,
      limit: DOCUMENT_LIST_LIMIT,
    });
    return documents.map(toDocumentView);
  }

  /**
   * Local driver: multer already wrote the file and the
   * CleanupUploadOnErrorInterceptor removes it on any error thrown here.
   * S3 driver: the object is written only after validation and discarded
   * if the DB insert fails.
   */
  async upload(
    file: Express.Multer.File | undefined,
    dto: CreateDocumentDto,
    userId: number,
  ): Promise<DocumentView> {
    if (!file) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'selectFile' },
      });
    }
    const extension = getAllowedExtension(file.originalname);
    if (!extension) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { file: 'cantUploadFileType' },
      });
    }
    if (dto.vesselId && !(await this.vesselRepository.findById(dto.vesselId))) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { vesselId: 'vesselNotExists' },
      });
    }

    const storageKey = await this.storage.save(file, extension);
    try {
      const created = await this.documentRepository.create({
        title: dto.title,
        category: dto.category,
        vesselId: dto.vesselId ?? null,
        storageKey,
        originalName: sanitizeOriginalName(
          decodeUploadedName(file.originalname),
        ),
        mimeType: mimeTypeForExtension(extension),
        size: file.size,
        notes: dto.notes ?? null,
        uploadedById: userId,
      });
      return toDocumentView(created);
    } catch (error) {
      await this.storage.discard(storageKey);
      throw error;
    }
  }

  async openDownload(id: string): Promise<DocumentDownload> {
    const document = await this.documentRepository.findById(id);
    if (!document || !isSafeStorageKey(document.storageKey)) {
      throw new NotFoundException('Document not found');
    }

    const stored = await this.storage.open(document.storageKey);
    if (!stored) {
      throw new NotFoundException('Document file not found');
    }

    return {
      stream: stored.stream,
      mimeType: document.mimeType,
      size: stored.size,
      contentDisposition: buildContentDisposition(document.originalName),
    };
  }

  /** Soft delete: the stored file stays so the record can be restored. */
  async remove(id: string): Promise<void> {
    const deleted = await this.documentRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException('Document not found');
    }
  }
}
