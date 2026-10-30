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
import {
  Destination,
  OkStatus,
  PositionSource,
  T1Status,
  VesselCondition,
  VesselType,
} from '../../../../vessel.constants';

// Mirrors migration 1793300000000-CreateVesselOperations (names must match,
// otherwise migration:generate would drop/recreate them).
@Entity({
  name: 'vessel',
})
@Index('UQ_vessel_imo_active', ['imo'], {
  unique: true,
  where: '"imo" IS NOT NULL AND "deletedAt" IS NULL',
})
export class VesselEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_vessel_id' })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  imo: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  mmsi: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: VesselType;

  @Column({ type: 'varchar', length: 32 })
  destination: Destination;

  @Column({ type: 'varchar', length: 16, nullable: true })
  condition: VesselCondition | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  masterName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  masterPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  masterEmail: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  officeName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  officePhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  officeEmail: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  portAgent: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  etaSulina: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  arrivedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  inPortAt: Date | null;

  @Index('IDX_vessel_departedAt')
  @Column({ type: 'timestamptz', nullable: true })
  departedAt: Date | null;

  @Column({ type: 'varchar', length: 8, default: 'not_ok' })
  prearrivalsIn: OkStatus;

  @Column({ type: 'varchar', length: 8, default: 'not_ok' })
  prearrivalsOut: OkStatus;

  @Column({ type: 'boolean', default: false })
  mswIn: boolean;

  @Column({ type: 'boolean', default: false })
  mswOut: boolean;

  @Column({ type: 'boolean', default: false })
  pdaSent: boolean;

  @Column({ type: 'boolean', default: false })
  paid: boolean;

  @Column({ type: 'varchar', length: 16, nullable: true })
  t1: T1Status | null;

  @Column({ type: 'boolean', default: false })
  pilotageArranged: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pilot: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({ type: 'double precision', nullable: true })
  sog: number | null;

  @Column({ type: 'double precision', nullable: true })
  cog: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  positionSource: PositionSource | null;

  @Column({ type: 'timestamptz', nullable: true })
  positionAt: Date | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'createdById',
    foreignKeyConstraintName: 'FK_vessel_createdById',
  })
  createdBy?: UserEntity | null;

  @Column({ type: 'int', nullable: true })
  updatedById: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'updatedById',
    foreignKeyConstraintName: 'FK_vessel_updatedById',
  })
  updatedBy?: UserEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
