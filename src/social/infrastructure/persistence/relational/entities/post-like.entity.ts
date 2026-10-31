import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PostEntity } from './post.entity';

// Mirrors migration 1793700000000-CreateNetwork; the composite PK makes a
// like idempotent (INSERT ... ON CONFLICT DO NOTHING).
@Entity({
  name: 'post_like',
})
export class PostLikeEntity extends EntityRelationalHelper {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_post_like' })
  postId: string;

  @ManyToOne(() => PostEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'postId',
    foreignKeyConstraintName: 'FK_post_like_postId',
  })
  post?: PostEntity;

  @PrimaryColumn({ type: 'int', primaryKeyConstraintName: 'PK_post_like' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_post_like_userId',
  })
  user?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
