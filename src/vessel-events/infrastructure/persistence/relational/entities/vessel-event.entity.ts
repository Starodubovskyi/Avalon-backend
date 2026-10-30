import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { VesselEntity } from '../../../../../vessels/infrastructure/persistence/relational/entities/vessel.entity';
import {
  VesselEventAction,
  VesselEventChanges,
} from '../../../../domain/vessel-event';

// Mirrors migration 1793300000000-CreateVesselOperations; both indexes are
// created there with createdAt DESC (TypeORM does not model column order).
@Entity({
  name: 'vessel_event',
})
@Index('IDX_vessel_event_vessel_createdAt', ['vesselId', 'createdAt'])
@Index('IDX_vessel_event_createdAt', ['createdAt'])
export class VesselEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_vessel_event_id',
  })
  id: string;

  @Column({ type: 'uuid' })
  vesselId: string;

  @ManyToOne(() => VesselEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'vesselId',
    foreignKeyConstraintName: 'FK_vessel_event_vesselId',
  })
  vessel?: VesselEntity;

  @Column({ type: 'varchar', length: 120 })
  vesselName: string;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_vessel_event_userId',
  })
  user?: UserEntity | null;

  @Column({ type: 'varchar', length: 16 })
  action: VesselEventAction;

  @Column({ type: 'jsonb', default: {} })
  changes: VesselEventChanges;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
