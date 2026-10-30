import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PortOperationalStatus } from '../../../../port-status.enum';

@Entity({
  name: 'port',
})
export class PortEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index('IDX_port_unlocode', { unique: true, where: '"deletedAt" IS NULL' })
  @Column({ type: 'varchar', length: 5 })
  unlocode: string;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  country: string | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    default: PortOperationalStatus.OPEN,
  })
  status: PortOperationalStatus;

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone: string;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
