import { ApiProperty } from '@nestjs/swagger';
import {
  MAP_POINT_KINDS,
  MapPointKind,
} from '../../map-points/map-point.constants';
import { UserCard } from '../../users-directory/domain/user-card';
import { LOCALES, Locale } from '../../users/user-profile.constants';
import {
  COMPANY_MEMBER_ROLES,
  CompanyMemberRole,
} from '../../companies/companies.constants';

/** A company on a personal page: a point the person owns or works at. */
export class PersonCompany {
  @ApiProperty({ type: String, format: 'uuid' })
  pointId: string;

  @ApiProperty({ type: String, example: 'Avalon Shipping SRL' })
  title: string;

  @ApiProperty({ enum: MAP_POINT_KINDS, example: 'head_office' })
  kind: MapPointKind;

  @ApiProperty({ enum: COMPANY_MEMBER_ROLES, example: 'member' })
  role: CompanyMemberRole;

  @ApiProperty({ type: String, nullable: true, example: 'Port captain' })
  position: string | null;

  @ApiProperty({ type: Boolean })
  hasLogo: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'GET /map-points/:pointId/logo?v=<logoVersion>',
  })
  logoVersion: string | null;
}

export class PersonStats {
  @ApiProperty({
    type: Number,
    description: 'Map points visible to the caller',
  })
  points: number;

  @ApiProperty({ type: Number })
  posts: number;

  @ApiProperty({ type: Number })
  followers: number;

  @ApiProperty({ type: Number })
  following: number;
}

export class PersonProfile {
  @ApiProperty({
    type: () => UserCard,
    description: "Viewers do not get another client's email",
  })
  user: UserCard;

  @ApiProperty({ type: String, nullable: true, example: 'Operations manager' })
  headline: string | null;

  @ApiProperty({ type: String, nullable: true })
  bio: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Only for the person and admin/staff',
  })
  phone: string | null;

  @ApiProperty({ enum: LOCALES, example: 'en' })
  locale: Locale;

  @ApiProperty({ type: Number, example: 980 })
  rank: number;

  @ApiProperty({
    type: () => [PersonCompany],
    description:
      'Owned business points (head office, branch, self-employed, for sale) and active memberships (also authorities), visible to the caller; never private persons',
  })
  companies: PersonCompany[];

  @ApiProperty({ type: () => PersonStats })
  stats: PersonStats;

  @ApiProperty({ type: Boolean })
  isFollowing: boolean;

  @ApiProperty({ type: Boolean })
  canMessage: boolean;

  @ApiProperty({ type: Boolean })
  isMe: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  memberSince: string;
}
