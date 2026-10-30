import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DOCUMENT_CATEGORIES, DocumentCategory } from '../document.constants';

function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class QueryDocumentDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsUUID()
  vesselId?: string;

  @ApiPropertyOptional({ enum: DOCUMENT_CATEGORIES })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsIn(DOCUMENT_CATEGORIES)
  category?: DocumentCategory;

  @ApiPropertyOptional({
    type: String,
    description: 'Title, file name or vessel name (partial)',
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
