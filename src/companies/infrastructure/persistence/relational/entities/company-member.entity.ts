import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { MapPointEntity } from '../../../../../map-points/infrastructure/persistence/relational/entities/map-point.entity';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import {
  COMPANY_MEMBER_STATUSES,
  COMPANY_POSITION_MAX_LENGTH,
  CompanyMemberStatus,
} from '../../../../companies.constants';

// Mirrors migration 1794100000000-WalletProfilesI18n. The composite PK makes
// "I work here" unique per person and point.
@Entity({ name: 'company_member' })
@Index('IDX_company_member_userId', ['userId'])
@Check(
  'CHK_company_member_status',
  `"status" IN (${COMPANY_MEMBER_STATUSES.map((status) => `'${status}'`).join(', ')})`,
)
export class CompanyMemberEntity extends EntityRelationalHelper {
  @PrimaryColumn({
    type: 'uuid',
    primaryKeyConstraintName: 'PK_company_member',
  })
  pointId: string;

  @ManyToOne(() => MapPointEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'pointId',
    foreignKeyConstraintName: 'FK_company_member_pointId',
  })
  point?: MapPointEntity;

  @PrimaryColumn({ type: 'int', primaryKeyConstraintName: 'PK_company_member' })
  userId: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_company_member_userId',
  })
  user?: UserEntity;

  @Column({
    type: 'varchar',
    length: COMPANY_POSITION_MAX_LENGTH,
    nullable: true,
  })
  position: string | null;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: CompanyMemberStatus;

  @CreateDateColumn({ type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
