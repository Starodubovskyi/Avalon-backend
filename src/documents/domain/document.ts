import { ApiProperty } from '@nestjs/swagger';
import { UserRef } from '../../users/domain/user-ref';
import { DOCUMENT_CATEGORIES, DocumentCategory } from '../document.constants';

/** Internal document record (storageKey never leaves the server). */
export class StoredDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  vesselId: string | null;
  vesselName: string | null;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  notes: string | null;
  uploadedById: number | null;
  uploadedBy: UserRef | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type NewStoredDocument = Omit<
  StoredDocument,
  'id' | 'vesselName' | 'uploadedBy' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

/** API representation of a document. */
export class DocumentView {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  id: string;

  @ApiProperty({ type: String, example: 'Notice of readiness' })
  title: string;

  @ApiProperty({ enum: DOCUMENT_CATEGORIES })
  category: DocumentCategory;

  @ApiProperty({ type: String, nullable: true })
  vesselId: string | null;

  @ApiProperty({ type: String, nullable: true })
  vesselName: string | null;

  @ApiProperty({ type: String, example: 'NOR.pdf' })
  originalName: string;

  @ApiProperty({ type: String, example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ type: Number, example: 102400 })
  size: number;

  @ApiProperty({ type: String, nullable: true })
  notes: string | null;

  @ApiProperty({ type: () => UserRef, nullable: true })
  uploadedBy: UserRef | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;
}

export function toDocumentView(document: StoredDocument): DocumentView {
  const view = new DocumentView();
  view.id = document.id;
  view.title = document.title;
  view.category = document.category;
  view.vesselId = document.vesselId;
  view.vesselName = document.vesselName;
  view.originalName = document.originalName;
  view.mimeType = document.mimeType;
  view.size = document.size;
  view.notes = document.notes;
  view.uploadedBy = document.uploadedBy;
  view.createdAt = document.createdAt.toISOString();
  return view;
}
