export const MAP_POINT_KINDS = ['company', 'person', 'employee'] as const;
export type MapPointKind = (typeof MAP_POINT_KINDS)[number];

export const DEFAULT_MAP_POINT_KIND: MapPointKind = 'person';
export const MAP_POINT_LIST_LIMIT = 1000;
export const MAP_POINT_NOTES_MAX_LENGTH = 2000;
