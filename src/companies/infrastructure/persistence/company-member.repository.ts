import { NullableType } from '../../../utils/types/nullable.type';
import { UserCard } from '../../../users-directory/domain/user-card';
import { CompanyMemberRecord } from '../../domain/company';
import { CompanyMemberStatus } from '../../companies.constants';

export interface CompanyMemberPatch {
  status?: CompanyMemberStatus;
  /** null clears it. */
  position?: string | null;
}

/** A user card with the profile headline. */
export interface PersonCardRecord {
  user: UserCard;
  headline: string | null;
}

/**
 * company_member rows ("I work here"). Members whose account was soft
 * deleted are never returned.
 */
export abstract class CompanyMemberRepository {
  /** Active members (plus pending ones with `includePending`), active first. */
  abstract findMembers(
    pointId: string,
    includePending: boolean,
    limit: number,
  ): Promise<CompanyMemberRecord[]>;

  abstract findMember(
    pointId: string,
    userId: number,
  ): Promise<NullableType<CompanyMemberRecord>>;

  /** Throws a unique violation (PK_company_member) when it exists. */
  abstract create(
    pointId: string,
    userId: number,
    position: string | null,
  ): Promise<void>;

  /** false when there is no such membership. */
  abstract update(
    pointId: string,
    userId: number,
    patch: CompanyMemberPatch,
  ): Promise<boolean>;

  /** false when there is no such membership. */
  abstract remove(pointId: string, userId: number): Promise<boolean>;

  /** Points where the user is an active member. */
  abstract findActivePointIds(userId: number): Promise<string[]>;

  /** Card + headline of an active (not deleted) user. */
  abstract findPersonCard(
    userId: number,
  ): Promise<NullableType<PersonCardRecord>>;
}
