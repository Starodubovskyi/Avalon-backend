import { ApiProperty } from '@nestjs/swagger';
import { MapPointView } from '../../map-points/domain/map-point-view';
import { UserCard } from '../../users-directory/domain/user-card';
import {
  COMPANY_MEMBER_ROLES,
  COMPANY_MEMBER_STATUSES,
  COMPANY_MEMBERSHIPS,
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyMembership,
} from '../companies.constants';

/** A person of the company team: the owner (point creator) or a member. */
export class CompanyMember {
  @ApiProperty({ type: () => UserCard })
  user: UserCard;

  @ApiProperty({ type: String, nullable: true, example: 'Port captain' })
  position: string | null;

  @ApiProperty({ enum: COMPANY_MEMBER_ROLES, example: 'member' })
  role: CompanyMemberRole;

  @ApiProperty({ enum: COMPANY_MEMBER_STATUSES, example: 'active' })
  status: CompanyMemberStatus;

  @ApiProperty({ type: String, nullable: true })
  headline: string | null;

  @ApiProperty({ type: Number, example: 120 })
  rank: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Membership request time (the point creation for the owner)',
  })
  joinedAt: string;
}

export class CompanyProfile {
  @ApiProperty({ type: () => MapPointView })
  point: MapPointView;

  @ApiProperty({ type: () => MapPointView, nullable: true })
  parent: MapPointView | null;

  @ApiProperty({ type: () => [MapPointView] })
  branches: MapPointView[];

  @ApiProperty({
    type: () => [CompanyMember],
    description:
      'Owner first, then active members; pending requests only for the owner and admin/staff',
  })
  members: CompanyMember[];

  @ApiProperty({ enum: COMPANY_MEMBERSHIPS, nullable: true })
  myMembership: CompanyMembership | null;

  @ApiProperty({
    type: Boolean,
    description: 'Owner or admin/staff: approves and removes members',
  })
  canManage: boolean;
}

/** A membership row with the member's card, as stored. */
export interface CompanyMemberRecord {
  user: UserCard;
  headline: string | null;
  position: string | null;
  status: CompanyMemberStatus;
  createdAt: string;
}
