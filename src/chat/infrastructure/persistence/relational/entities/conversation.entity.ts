import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ConversationKind } from '../../../../chat.constants';

// Mirrors migration 1793700000000-CreateNetwork (names must match, otherwise
// migration:generate would drop/recreate them).
@Entity({
  name: 'conversation',
})
@Index('UQ_conversation_directKey', ['directKey'], {
  unique: true,
  where: '"directKey" IS NOT NULL',
})
@Check('CHK_conversation_kind', `"kind" IN ('direct', 'group')`)
export class ConversationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_conversation_id',
  })
  id: string;

  @Column({ type: 'varchar', length: 8 })
  kind: ConversationKind;

  @Column({ type: 'varchar', length: 80, nullable: true })
  title: string | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'createdById',
    foreignKeyConstraintName: 'FK_conversation_createdById',
  })
  createdBy?: UserEntity | null;

  /** "minUserId:maxUserId" for direct conversations, null for groups. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  directKey: string | null;

  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
