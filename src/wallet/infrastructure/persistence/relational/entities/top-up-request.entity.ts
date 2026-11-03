import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import {
  TOP_UP_AMOUNT,
  TOP_UP_NOTE_MAX_LENGTH,
  TOP_UP_REQUEST_STATUSES,
  TopUpRequestStatus,
} from '../../../../wallet.constants';

// Mirrors migration 1794100000000-WalletProfilesI18n. The partial unique
// index allows one pending request per user.
@Entity({ name: 'top_up_request' })
@Index('UQ_top_up_request_pending', ['userId'], {
  unique: true,
  where: `"status" = 'pending'`,
})
@Index('IDX_top_up_request_status_createdAt', ['status', 'createdAt'])
@Check(
  'CHK_top_up_request_amount',
  `"amount" BETWEEN ${TOP_UP_AMOUNT.min} AND ${TOP_UP_AMOUNT.max}`,
)
@Check(
  'CHK_top_up_request_status',
  `"status" IN (${TOP_UP_REQUEST_STATUSES.map((status) => `'${status}'`).join(', ')})`,
)
export class TopUpRequestEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_top_up_request_id',
  })
  id: string;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_top_up_request_userId',
  })
  user?: UserEntity;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: TOP_UP_NOTE_MAX_LENGTH, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: TopUpRequestStatus;

  @Column({ type: 'int', nullable: true })
  handledById: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'handledById',
    foreignKeyConstraintName: 'FK_top_up_request_handledById',
  })
  handledBy?: UserEntity | null;

  @Column({ type: 'timestamptz', precision: 3, nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
