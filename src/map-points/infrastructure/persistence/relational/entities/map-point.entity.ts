import {
  Check,
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
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';
import { MapPointKind } from '../../../../map-point.constants';

// Names mirror migrations 1788523200000-CreateMapPoint and
// 1793400000000-AddMapPointKind, so migration:generate stays empty.
@Entity({
  name: 'map_point',
})
@Index('IDX_map_point_userId_createdAt', ['userId', 'createdAt'])
@Check('CHK_map_point_kind', `"kind" IN ('company', 'person', 'employee')`)
export class MapPointEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_map_point_id',
  })
  id: string;

  /** Creator of the point (the map itself is shared by the whole team). */
  @Index('IDX_map_point_userId')
  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_map_point_userId',
  })
  user?: UserEntity;

  @Index('IDX_map_point_kind')
  @Column({ type: 'varchar', length: 16, default: 'person' })
  kind: MapPointKind;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  lastName: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  activity: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  photoId: string | null;

  @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'photoId',
    foreignKeyConstraintName: 'FK_map_point_photoId',
  })
  photo?: FileEntity | null;

  @Column({ type: 'boolean', default: false })
  isFavorite: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
