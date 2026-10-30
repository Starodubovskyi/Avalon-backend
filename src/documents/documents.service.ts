import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createReadStream, ReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { VesselRepository } from '../vessels/infrastructure/persistence/vessel.repository';
import { DOCUMENT_LIST_LIMIT } from './document.constants';
import {
  buildContentDisposition,
  decodeUploadedName,
  getAllowedExtension,
  isSafeStorageKey,
  mimeTypeForExtension,
  resolveDocumentsDir,
  sanitizeOriginalName,
} from './documents-storage';
import { DocumentView, toDocumentView } from './domain/document';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { DocumentRepository } from './infrastructure/persistence/document.repository';

export interface DocumentDownload {
  stream: ReadStream;
  mimeType: string;
  size: number;
  contentDisposition: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly vesselRepository: VesselRepository,
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
   * The file is already on disk (multer); on any error thrown here the
   * CleanupUploadOnErrorInterceptor removes it.
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
    const extension = getAllowedExtension(file.filename);
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

    const created = await this.documentRepository.create({
      title: dto.title,
      category: dto.category,
      vesselId: dto.vesselId ?? null,
      storageKey: file.filename,
      originalName: sanitizeOriginalName(decodeUploadedName(file.originalname)),
      mimeType: mimeTypeForExtension(extension),
      size: file.size,
      notes: dto.notes ?? null,
      uploadedById: userId,
    });
    return toDocumentView(created);
  }

  async openDownload(id: string): Promise<DocumentDownload> {
    const document = await this.documentRepository.findById(id);
    if (!document || !isSafeStorageKey(document.storageKey)) {
      throw new NotFoundException('Document not found');
    }

    const filePath = path.join(resolveDocumentsDir(), document.storageKey);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) {
      throw new NotFoundException('Document file not found');
    }

    return {
      stream: createReadStream(filePath),
      mimeType: document.mimeType,
      size: fileStat.size,
      contentDisposition: buildContentDisposition(document.originalName),
    };
  }

  /** Soft delete: the file stays on disk so the record can be restored. */
  async remove(id: string): Promise<void> {
    const deleted = await this.documentRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException('Document not found');
    }
  }
}
