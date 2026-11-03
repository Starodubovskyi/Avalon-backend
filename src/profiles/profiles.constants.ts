import { MapPointKind } from '../map-points/map-point.constants';

/**
 * Point kinds listed as "owner" companies on a personal page: businesses
 * only. The owner is the creator, so a staff member who put an authority
 * (e.g. a harbour master) or a private person on the map is not shown as
 * its owner.
 */
export const OWNED_COMPANY_KINDS: readonly MapPointKind[] = [
  'head_office',
  'branch',
  'self_employed',
  'for_sale',
];

/** Kinds listed for active memberships: people do work at authorities. */
export const MEMBER_COMPANY_KINDS: readonly MapPointKind[] = [
  ...OWNED_COMPANY_KINDS,
  'authority',
];

/** Safety cap for PersonProfile.companies. */
export const PERSON_COMPANIES_LIMIT = 100;
