export const MAP_POINT_KINDS = [
  'head_office',
  'branch',
  'self_employed',
  'for_sale',
  'authority',
  'private_person',
] as const;
export type MapPointKind = (typeof MAP_POINT_KINDS)[number];

export const DEFAULT_MAP_POINT_KIND: MapPointKind = 'private_person';
export const MAP_POINT_LIST_LIMIT = 1000;
export const MAP_POINT_NOTES_MAX_LENGTH = 2000;
export const MAP_POINT_TITLE_MAX_LENGTH = 120;

/** Business Activity codes, in the order shown to users. */
export const ACTIVITY_CODES = [
  'ship_agency',
  'ship_supply',
  'ship_operation',
  'ship_management',
  'crewing',
  'ship_repair',
  'shipowners',
  'bunker_supply',
  'ship_charterers',
  'ship_brokers',
  'cargo_brokers',
  'cargo_charterers',
  'cargo_shippers',
  'commodity_trading',
] as const;
export type ActivityCode = (typeof ACTIVITY_CODES)[number];

export const ACTIVITY_LABELS: Readonly<Record<ActivityCode, string>> = {
  ship_agency: 'Ship agency',
  ship_supply: 'Ship supply, ship chandler',
  ship_operation: 'Ship operation',
  ship_management: 'Ship management',
  crewing: 'Crew management / crewing',
  ship_repair: 'Ship repair',
  shipowners: 'Shipowners',
  bunker_supply: 'Bunker and oil supply',
  ship_charterers: 'Ship charterers',
  ship_brokers: 'Ship brokers',
  cargo_brokers: 'Cargo brokers',
  cargo_charterers: 'Cargo charterers',
  cargo_shippers: 'Cargo shippers',
  commodity_trading: 'Commodity trading',
};

/** Activities a point may have without a paid plan (more → premiumRequired). */
export const FREE_ACTIVITIES_LIMIT = 1;

export const MAP_POINT_LOGO_MAX_LENGTH = 150_000;
export const MAP_POINT_LOGO_MIME_TYPES = [
  'image/webp',
  'image/png',
  'image/jpeg',
] as const;
export type MapPointLogoMimeType = (typeof MAP_POINT_LOGO_MIME_TYPES)[number];
/** Logos never change under the same `?v=` key (see MapPointView.logoVersion). */
export const MAP_POINT_LOGO_CACHE_CONTROL =
  'private, max-age=31536000, immutable';
