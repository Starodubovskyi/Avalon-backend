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
import { ConversationEntity } from './conversation.entity';

// Mirrors migration 1793700000000-CreateNetwork.
@Entity({
  name: 'message',
})
@Index('IDX_message_conversation_createdAt', ['conversationId', 'createdAt'])
export class MessageEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_message_id' })
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => ConversationEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversationId',
    foreignKeyConstraintName: 'FK_message_conversationId',
  })
  conversation?: ConversationEntity;

  @Column({ type: 'int' })
  senderId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'senderId',
    foreignKeyConstraintName: 'FK_message_senderId',
  })
  sender?: UserEntity;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
