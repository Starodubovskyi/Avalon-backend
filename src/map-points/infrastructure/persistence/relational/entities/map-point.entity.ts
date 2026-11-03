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
  VirtualColumn,
} from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';
import {
  ACTIVITY_CODES,
  ActivityCode,
  DEFAULT_ACTIVITY_SLOTS,
  DEFAULT_MAP_POINT_KIND,
  MAP_POINT_DESCRIPTION_MAX_LENGTH,
  MAP_POINT_KINDS,
  MAP_POINT_LOGO_MAX_LENGTH,
  MAP_POINT_VISIBILITIES,
  MAP_POINT_WEBSITE_MAX_LENGTH,
  MAX_ACTIVITY_SLOTS,
  MapPointKind,
  MapPointVisibility,
} from '../../../../map-point.constants';

/** `'a', 'b'` for CHECK expressions (constant code lists only). */
const sqlList = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

// Names mirror migrations 1788523200000-CreateMapPoint,
// 1793400000000-AddMapPointKind, 1794000000000-GeoPointsV2 and
// 1794100000000-WalletProfilesI18n, so migration:generate stays empty.
@Entity({
  name: 'map_point',
})
@Index('IDX_map_point_userId_createdAt', ['userId', 'createdAt'])
@Check('CHK_map_point_kind', `"kind" IN (${sqlList(MAP_POINT_KINDS)})`)
@Check(
  'CHK_map_point_activities',
  `"activities" <@ ARRAY[${sqlList(ACTIVITY_CODES)}]::text[]`,
)
@Check(
  'CHK_map_point_logo',
  `"logo" IS NULL OR ("logo" LIKE 'data:image/%' AND char_length("logo") <= ${MAP_POINT_LOGO_MAX_LENGTH})`,
)
@Check(
  'CHK_map_point_visibility',
  `"visibility" IN (${sqlList(MAP_POINT_VISIBILITIES)})`,
)
@Check(
  'CHK_map_point_description',
  `char_length("description") <= ${MAP_POINT_DESCRIPTION_MAX_LENGTH}`,
)
@Check('CHK_map_point_parent_not_self', `"parentId" <> "id"`)
@Check(
  'CHK_map_point_activitySlots',
  `"activitySlots" BETWEEN 1 AND ${MAX_ACTIVITY_SLOTS}`,
)
@Check(
  'CHK_map_point_activities_slots',
  `cardinality("activities") <= "activitySlots"`,
)
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
  @Column({ type: 'varchar', length: 16, default: DEFAULT_MAP_POINT_KIND })
  kind: MapPointKind;

  @Column({ type: 'varchar', length: 10, default: 'public' })
  visibility: MapPointVisibility;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  lastName: string;

  /** Legacy free-text activity, superseded by `activities`. */
  @Column({ type: 'varchar', length: 255, default: '' })
  activity: string;

  @Column({ type: 'text', array: true, default: [] })
  activities: ActivityCode[];

  /** Bought with credits; activities never outnumber slots (CHECK). */
  @Column({ type: 'smallint', default: DEFAULT_ACTIVITY_SLOTS })
  activitySlots: number;

  /**
   * Base64 data URL (image/webp, image/png or image/jpeg), up to 150 000
   * chars. Never selected by default (lists stay small): read it with an
   * explicit select (GET /map-points/:id/logo); `hasLogo` tells if it is set.
   */
  @Column({ type: 'text', nullable: true, select: false })
  logo?: string | null;

  /** Computed on read; never written or synchronised. */
  @VirtualColumn({
    type: 'boolean',
    query: (alias) => `${alias}."logo" IS NOT NULL`,
  })
  hasLogo?: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'varchar',
    length: MAP_POINT_WEBSITE_MAX_LENGTH,
    nullable: true,
  })
  website: string | null;

  /** Parent company of a branch. */
  @Index('IDX_map_point_parentId')
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => MapPointEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'parentId',
    foreignKeyConstraintName: 'FK_map_point_parentId',
  })
  parent?: MapPointEntity | null;

  /** Set when the current `email` was confirmed; cleared when it changes. */
  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** Last verification email (one per minute). */
  @Column({ type: 'timestamptz', nullable: true })
  emailVerificationSentAt: Date | null;

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

  /**
   * Legacy team-wide flag, no longer read or written by the API: favorites
   * are per user (map_point_favorite). Kept so existing data is untouched.
   */
  @Column({ type: 'boolean', default: false })
  isFavorite: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
