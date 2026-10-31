import {
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';

// Mirrors migration 1793700000000-CreateNetwork.
@Entity({
  name: 'follow',
})
@Index('IDX_follow_followeeId', ['followeeId'])
@Check('CHK_follow_not_self', `"followerId" <> "followeeId"`)
export class FollowEntity extends EntityRelationalHelper {
  @PrimaryColumn({ type: 'int', primaryKeyConstraintName: 'PK_follow' })
  followerId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'followerId',
    foreignKeyConstraintName: 'FK_follow_followerId',
  })
  follower?: UserEntity;

  @PrimaryColumn({ type: 'int', primaryKeyConstraintName: 'PK_follow' })
  followeeId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'followeeId',
    foreignKeyConstraintName: 'FK_follow_followeeId',
  })
  followee?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
