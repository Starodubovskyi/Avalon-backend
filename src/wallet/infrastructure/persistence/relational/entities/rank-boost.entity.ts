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

// Mirrors migration 1794100000000-WalletProfilesI18n. Active boosts
// (expiresAt in the future) add their points to the user RANK.
@Entity({ name: 'rank_boost' })
@Index('IDX_rank_boost_userId_expiresAt', ['userId', 'expiresAt'])
@Check('CHK_rank_boost_points', `"points" > 0`)
export class RankBoostEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_rank_boost_id',
  })
  id: string;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_rank_boost_userId',
  })
  user?: UserEntity;

  @Column({ type: 'int' })
  points: number;

  @Column({ type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
