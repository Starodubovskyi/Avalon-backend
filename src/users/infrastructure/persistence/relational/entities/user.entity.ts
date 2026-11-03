import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { RoleEntity } from '../../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { StatusEntity } from '../../../../../statuses/infrastructure/persistence/relational/entities/status.entity';
import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';

import { AuthProvidersEnum } from '../../../../../auth/auth-providers.enum';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import {
  DEFAULT_LOCALE,
  LOCALES,
  Locale,
  USER_BIO_MAX_LENGTH,
  USER_HEADLINE_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
} from '../../../../user-profile.constants';

// Profile columns and checks mirror migration 1794100000000-WalletProfilesI18n.
@Entity({
  name: 'user',
})
@Check('CHK_user_bio', `char_length("bio") <= ${USER_BIO_MAX_LENGTH}`)
@Check(
  'CHK_user_locale',
  `"locale" IN (${LOCALES.map((locale) => `'${locale}'`).join(', ')})`,
)
export class UserEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  // For "string | null" we need to use String type.
  // More info: https://github.com/typeorm/typeorm/issues/2567
  @Column({ type: String, unique: true, nullable: true })
  email: string | null;

  @Column({ nullable: true })
  password?: string;

  @Column({ default: AuthProvidersEnum.email })
  provider: string;

  @Index()
  @Column({ type: String, nullable: true })
  socialId?: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  firstName: string | null;

  @Index()
  @Column({ type: String, nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', length: USER_HEADLINE_MAX_LENGTH, nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: USER_PHONE_MAX_LENGTH, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 5, default: DEFAULT_LOCALE })
  locale: Locale;

  @OneToOne(() => FileEntity, {
    eager: true,
  })
  @JoinColumn()
  photo?: FileEntity | null;

  @ManyToOne(() => RoleEntity, {
    eager: true,
  })
  role?: RoleEntity | null;

  @ManyToOne(() => StatusEntity, {
    eager: true,
  })
  status?: StatusEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
