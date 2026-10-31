import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { ConversationEntity } from './conversation.entity';

// Mirrors migration 1793700000000-CreateNetwork.
@Entity({
  name: 'conversation_member',
})
@Index('IDX_conversation_member_userId', ['userId'])
export class ConversationMemberEntity extends EntityRelationalHelper {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_conversation_member',
  })
  conversationId: string;

  @ManyToOne(() => ConversationEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversationId',
    foreignKeyConstraintName: 'FK_conversation_member_conversationId',
  })
  conversation?: ConversationEntity;

  @PrimaryColumn({
    type: 'int',
    primaryKeyConstraintName: 'PK_conversation_member',
  })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_conversation_member_userId',
  })
  user?: UserEntity;

  /** null = never opened: every message from others counts as unread. */
  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  joinedAt: Date;
}
