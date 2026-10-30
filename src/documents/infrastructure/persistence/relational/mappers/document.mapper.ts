import { toUserRef } from '../../../../../users/domain/user-ref';
import { StoredDocument } from '../../../../domain/document';
import { DocumentEntity } from '../entities/document.entity';

export class DocumentMapper {
  static toDomain(raw: DocumentEntity): StoredDocument {
    const document = new StoredDocument();
    document.id = raw.id;
    document.title = raw.title;
    document.category = raw.category;
    document.vesselId = raw.vesselId;
    document.vesselName = raw.vessel?.name ?? null;
    document.storageKey = raw.storageKey;
    document.originalName = raw.originalName;
    document.mimeType = raw.mimeType;
    document.size = raw.size;
    document.notes = raw.notes;
    document.uploadedById = raw.uploadedById;
    document.uploadedBy = toUserRef(raw.uploadedBy);
    document.createdAt = raw.createdAt;
    document.updatedAt = raw.updatedAt;
    document.deletedAt = raw.deletedAt;
    return document;
  }
}
