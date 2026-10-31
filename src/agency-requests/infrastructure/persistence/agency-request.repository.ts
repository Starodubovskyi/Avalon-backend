import { NullableType } from '../../../utils/types/nullable.type';
import { AgencyRequestStatus } from '../../agency-requests.constants';
import {
  AgencyRequest,
  AgencyRequestPatch,
  NewAgencyRequest,
} from '../../domain/agency-request';

export interface AgencyRequestListFilter {
  /** Only requests created by this user; null = everyone's (team). */
  createdById: number | null;
  status?: AgencyRequestStatus;
  limit: number;
}

export abstract class AgencyRequestRepository {
  /** Newest first. */
  abstract findMany(filter: AgencyRequestListFilter): Promise<AgencyRequest[]>;

  /**
   * createdById restricts the lookup to that author (a foreign request reads
   * as missing); null = any author.
   */
  abstract findOne(
    id: string,
    createdById: number | null,
  ): Promise<NullableType<AgencyRequest>>;

  /** Returns the new request id. */
  abstract create(data: NewAgencyRequest): Promise<string>;

  /** false when the request does not exist. */
  abstract update(id: string, patch: AgencyRequestPatch): Promise<boolean>;
}
