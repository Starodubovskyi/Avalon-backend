import { NullableType } from '../../../utils/types/nullable.type';
import { DocumentCategory } from '../../document.constants';
import { NewStoredDocument, StoredDocument } from '../../domain/document';

export interface DocumentListFilter {
  vesselId?: string;
  category?: DocumentCategory;
  search?: string;
  limit: number;
}

export abstract class DocumentRepository {
  abstract create(data: NewStoredDocument): Promise<StoredDocument>;

  /** Newest first, soft-deleted excluded. */
  abstract findMany(filter: DocumentListFilter): Promise<StoredDocument[]>;

  abstract findById(
    id: StoredDocument['id'],
  ): Promise<NullableType<StoredDocument>>;

  /** Returns false when the document does not exist (or is already deleted). */
  abstract softDelete(id: StoredDocument['id']): Promise<boolean>;
}
