import { NullableType } from '../../../utils/types/nullable.type';
import { UserCard } from '../../../users-directory/domain/user-card';
import { Locale } from '../../../users/user-profile.constants';
import { PersonCompany, PersonStats } from '../../domain/person-profile';

/** A person as stored, with counters seen by one viewer. */
export interface ProfileRecord {
  user: UserCard;
  headline: string | null;
  bio: string | null;
  phone: string | null;
  locale: Locale;
  createdAt: string;
  stats: PersonStats;
  /** The viewer follows the person. */
  isFollowing: boolean;
}

/** Fields to change; undefined = keep, null = clear. */
export interface ProfilePatch {
  headline?: string | null;
  bio?: string | null;
  phone?: string | null;
  locale?: Locale;
}

/** Map points are filtered like GET /map-points: null = all, id = public + own. */
export abstract class ProfileRepository {
  /** null when the user does not exist or is soft-deleted. */
  abstract findProfile(
    userId: number,
    viewerId: number,
    pointsVisibleTo: number | null,
  ): Promise<NullableType<ProfileRecord>>;

  /** Owned non-private points and active memberships, newest first. */
  abstract findCompanies(
    userId: number,
    pointsVisibleTo: number | null,
    limit: number,
  ): Promise<PersonCompany[]>;

  abstract update(userId: number, patch: ProfilePatch): Promise<void>;
}
