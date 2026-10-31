import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PostEntity } from './post.entity';

// Mirrors migration 1793700000000-CreateNetwork.
@Entity({
  name: 'post_comment',
})
@Index('IDX_post_comment_post_createdAt', ['postId', 'createdAt'])
export class PostCommentEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_post_comment_id',
  })
  id: string;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => PostEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'postId',
    foreignKeyConstraintName: 'FK_post_comment_postId',
  })
  post?: PostEntity;

  @Column({ type: 'int' })
  authorId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'authorId',
    foreignKeyConstraintName: 'FK_post_comment_authorId',
  })
  author?: UserEntity;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
