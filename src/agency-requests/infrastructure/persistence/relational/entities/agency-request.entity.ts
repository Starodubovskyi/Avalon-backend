import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { VesselEntity } from '../../../../../vessels/infrastructure/persistence/relational/entities/vessel.entity';
import {
  DESTINATIONS,
  Destination,
  VESSEL_TYPES,
  VesselType,
} from '../../../../../vessels/vessel.constants';
import {
  AGENCY_REQUEST_STATUSES,
  AgencyRequestStatus,
} from '../../../../agency-requests.constants';

function sqlInList(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

// Mirrors migration 1793900000000-CreateAgencyRequest (names must match,
// otherwise migration:generate would drop/recreate them). Both indexes are
// created there with createdAt DESC (TypeORM does not model column order).
@Entity({
  name: 'agency_request',
})
@Index('IDX_agency_request_status_createdAt', ['status', 'createdAt'])
@Index('IDX_agency_request_createdById_createdAt', ['createdById', 'createdAt'])
@Check(
  'CHK_agency_request_vesselType',
  `"vesselType" IN (${sqlInList(VESSEL_TYPES)})`,
)
@Check(
  'CHK_agency_request_destination',
  `"destination" IN (${sqlInList(DESTINATIONS)})`,
)
@Check(
  'CHK_agency_request_status',
  `"status" IN (${sqlInList(AGENCY_REQUEST_STATUSES)})`,
)
export class AgencyRequestEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_agency_request_id',
  })
  id: string;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'createdById',
    foreignKeyConstraintName: 'FK_agency_request_createdById',
  })
  createdBy?: UserEntity | null;

  @Column({ type: 'varchar', length: 120 })
  company: string;

  @Column({ type: 'varchar', length: 120 })
  contactName: string;

  @Column({ type: 'varchar', length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 80 })
  vesselName: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  imo: string | null;

  @Column({ type: 'varchar', length: 20 })
  vesselType: VesselType;

  @Column({ type: 'varchar', length: 20 })
  destination: Destination;

  /** ETA Sulina. */
  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  eta: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  cargo: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 12, default: 'new' })
  status: AgencyRequestStatus;

  /** Agent's answer, visible to the client. */
  @Column({ type: 'text', nullable: true })
  staffNote: string | null;

  /** Vessel on the board once the request is accepted. */
  @Column({ type: 'uuid', nullable: true })
  vesselId: string | null;

  @ManyToOne(() => VesselEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'vesselId',
    foreignKeyConstraintName: 'FK_agency_request_vesselId',
  })
  vessel?: VesselEntity | null;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
