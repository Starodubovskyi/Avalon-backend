export const DOCUMENT_CATEGORIES = [
  'vessel',
  'customs',
  'port',
  'crew',
  'finance',
  'template',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/**
 * Allowed upload extensions and the Content-Type served on download.
 * The type is derived from the extension, never from the client's header.
 */
export const DOCUMENT_MIME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
} as const;
export type DocumentExtension = keyof typeof DOCUMENT_MIME_TYPES;

export const DEFAULT_DOCUMENTS_DIR = './storage/documents';
export const DEFAULT_DOCUMENTS_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const DOCUMENT_LIST_LIMIT = 500;
