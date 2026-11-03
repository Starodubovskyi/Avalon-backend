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
import { MapPointEntity } from '../../../../../map-points/infrastructure/persistence/relational/entities/map-point.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import {
  WALLET_NOTE_MAX_LENGTH,
  WALLET_TRANSACTION_KINDS,
  WalletTransactionKind,
} from '../../../../wallet.constants';

// Mirrors migration 1794100000000-WalletProfilesI18n (the index is created
// there with createdAt DESC; TypeORM does not model column order).
// Insert-only: the balance is the sum of `amount`.
@Entity({ name: 'wallet_transaction' })
@Index('IDX_wallet_transaction_userId_createdAt', ['userId', 'createdAt'])
@Check('CHK_wallet_transaction_amount', `"amount" <> 0`)
@Check(
  'CHK_wallet_transaction_kind',
  `"kind" IN (${WALLET_TRANSACTION_KINDS.map((kind) => `'${kind}'`).join(', ')})`,
)
export class WalletTransactionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_wallet_transaction_id',
  })
  id: string;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_wallet_transaction_userId',
  })
  user?: UserEntity;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 20 })
  kind: WalletTransactionKind;

  @Column({ type: 'varchar', length: WALLET_NOTE_MAX_LENGTH, nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  pointId: string | null;

  @ManyToOne(() => MapPointEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'pointId',
    foreignKeyConstraintName: 'FK_wallet_transaction_pointId',
  })
  point?: MapPointEntity | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'createdById',
    foreignKeyConstraintName: 'FK_wallet_transaction_createdById',
  })
  createdBy?: UserEntity | null;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;

  /**
   * Ledger order (history and running balanceAfter). Assigned on insert,
   * under the wallet lock, so it follows the order of balance checks.
   * bigint comes back from pg as a string.
   */
  @Column({
    type: 'bigint',
    generated: 'identity',
    generatedIdentity: 'ALWAYS',
    insert: false,
    update: false,
  })
  seq: string;
}
