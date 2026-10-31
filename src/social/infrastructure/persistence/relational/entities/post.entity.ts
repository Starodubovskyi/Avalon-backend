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

// Mirrors migration 1793700000000-CreateNetwork; both indexes are created
// there with createdAt DESC (TypeORM does not model column order).
@Entity({
  name: 'post',
})
@Index('IDX_post_createdAt', ['createdAt'])
@Index('IDX_post_author_createdAt', ['authorId', 'createdAt'])
export class PostEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_post_id' })
  id: string;

  @Column({ type: 'int' })
  authorId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'authorId',
    foreignKeyConstraintName: 'FK_post_authorId',
  })
  author?: UserEntity;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
