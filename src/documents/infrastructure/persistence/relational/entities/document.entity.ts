import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { VesselEntity } from '../../../../../vessels/infrastructure/persistence/relational/entities/vessel.entity';
import { DocumentCategory } from '../../../../document.constants';

@Entity({
  name: 'document',
})
// Mirrors migration 1793300000000-CreateVesselOperations (index/FK names).
export class DocumentEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_document_id',
  })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Index('IDX_document_category')
  @Column({ type: 'varchar', length: 32 })
  category: DocumentCategory;

  @Index('IDX_document_vesselId')
  @Column({ type: 'uuid', nullable: true })
  vesselId: string | null;

  @ManyToOne(() => VesselEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'vesselId',
    foreignKeyConstraintName: 'FK_document_vesselId',
  })
  vessel?: VesselEntity | null;

  @Column({ type: 'varchar', length: 255 })
  storageKey: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 127 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', nullable: true })
  uploadedById: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'uploadedById',
    foreignKeyConstraintName: 'FK_document_uploadedById',
  })
  uploadedBy?: UserEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
