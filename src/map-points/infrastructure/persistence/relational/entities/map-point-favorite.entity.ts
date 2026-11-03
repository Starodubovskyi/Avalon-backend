import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { MapPointEntity } from './map-point.entity';

// Mirrors migration 1794000000000-GeoPointsV2; the composite PK makes adding
// a favorite idempotent (INSERT ... ON CONFLICT DO NOTHING).
@Entity({
  name: 'map_point_favorite',
})
export class MapPointFavoriteEntity extends EntityRelationalHelper {
  @PrimaryColumn({
    type: 'int',
    primaryKeyConstraintName: 'PK_map_point_favorite',
  })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_map_point_favorite_userId',
  })
  user?: UserEntity;

  @Index('IDX_map_point_favorite_pointId')
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_map_point_favorite',
  })
  pointId: string;

  @ManyToOne(() => MapPointEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'pointId',
    foreignKeyConstraintName: 'FK_map_point_favorite_pointId',
  })
  point?: MapPointEntity;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
