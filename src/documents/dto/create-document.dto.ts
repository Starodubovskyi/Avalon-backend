import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { DOCUMENT_CATEGORIES, DocumentCategory } from '../document.constants';

/** Multipart text fields arrive as strings; empty means "not provided". */
function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** Text fields of the multipart upload (the binary part is `file`). */
export class CreateDocumentDto {
  @ApiProperty({ type: String, example: 'Notice of readiness' })
  @Transform(trimToUndefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: DOCUMENT_CATEGORIES })
  @IsIn(DOCUMENT_CATEGORIES)
  category: DocumentCategory;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsUUID()
  vesselId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 4000 })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
