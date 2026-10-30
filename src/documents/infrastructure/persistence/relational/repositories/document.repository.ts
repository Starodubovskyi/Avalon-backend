import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { escapeLikePattern } from '../../../../../utils/escape-like';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { NewStoredDocument, StoredDocument } from '../../../../domain/document';
import {
  DocumentListFilter,
  DocumentRepository,
} from '../../document.repository';
import { DocumentEntity } from '../entities/document.entity';
import { DocumentMapper } from '../mappers/document.mapper';

@Injectable()
export class DocumentRelationalRepository implements DocumentRepository {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
  ) {}

  /**
   * withDeleted() keeps vessel name / uploader visible after they are
   * soft-deleted; deleted documents are excluded explicitly.
   */
  private baseQuery(): SelectQueryBuilder<DocumentEntity> {
    return this.documentRepository
      .createQueryBuilder('document')
      .withDeleted()
      .leftJoin('document.vessel', 'vessel')
      .addSelect(['vessel.id', 'vessel.name'])
      .leftJoin('document.uploadedBy', 'uploadedBy')
      .addSelect([
        'uploadedBy.id',
        'uploadedBy.firstName',
        'uploadedBy.lastName',
        'uploadedBy.email',
      ])
      .where('document.deletedAt IS NULL');
  }

  async create(data: NewStoredDocument): Promise<StoredDocument> {
    const saved = await this.documentRepository.save(
      this.documentRepository.create({
        title: data.title,
        category: data.category,
        vesselId: data.vesselId,
        storageKey: data.storageKey,
        originalName: data.originalName,
        mimeType: data.mimeType,
        size: data.size,
        notes: data.notes,
        uploadedById: data.uploadedById,
      }),
    );
    const created = await this.findById(saved.id);
    return created ?? DocumentMapper.toDomain(saved);
  }

  async findMany(filter: DocumentListFilter): Promise<StoredDocument[]> {
    const query = this.baseQuery();

    if (filter.vesselId) {
      query.andWhere('document.vesselId = :vesselId', {
        vesselId: filter.vesselId,
      });
    }
    if (filter.category) {
      query.andWhere('document.category = :category', {
        category: filter.category,
      });
    }
    const search = filter.search?.trim();
    if (search) {
      const pattern = `%${escapeLikePattern(search)}%`;
      query.andWhere(
        new Brackets((where) => {
          where
            .where('document.title ILIKE :pattern', { pattern })
            .orWhere('document.originalName ILIKE :pattern', { pattern })
            .orWhere('vessel.name ILIKE :pattern', { pattern });
        }),
      );
    }

    const entities = await query
      .orderBy('document.createdAt', 'DESC')
      .addOrderBy('document.id', 'DESC')
      .limit(filter.limit)
      .getMany();
    return entities.map((entity) => DocumentMapper.toDomain(entity));
  }

  async findById(
    id: StoredDocument['id'],
  ): Promise<NullableType<StoredDocument>> {
    const entity = await this.baseQuery()
      .andWhere('document.id = :id', { id })
      .getOne();
    return entity ? DocumentMapper.toDomain(entity) : null;
  }

  async softDelete(id: StoredDocument['id']): Promise<boolean> {
    const result = await this.documentRepository.softDelete({ id });
    return (result.affected ?? 0) > 0;
  }
}
