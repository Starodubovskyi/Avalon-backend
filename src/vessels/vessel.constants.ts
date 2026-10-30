export const VESSEL_TYPES = ['general_cargo', 'tanker', 'livestock'] as const;
export type VesselType = (typeof VESSEL_TYPES)[number];

export const DESTINATIONS = [
  'IZMAIL',
  'RENI',
  'ORLIVKA',
  'GIURGIULESTI',
  'GALATI',
  'BRAILA',
  'TULCEA',
] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const VESSEL_CONDITIONS = ['ballast', 'loaded'] as const;
export type VesselCondition = (typeof VESSEL_CONDITIONS)[number];

export const OK_STATUSES = ['ok', 'not_ok'] as const;
export type OkStatus = (typeof OK_STATUSES)[number];

export const T1_STATUSES = ['yes', 'no', 'not_needed'] as const;
export type T1Status = (typeof T1_STATUSES)[number];

export const VESSEL_STAGES = [
  'expected',
  'at_roads',
  'in_port',
  'departed',
] as const;
export type VesselStage = (typeof VESSEL_STAGES)[number];

export const POSITION_SOURCES = ['ais', 'manual'] as const;
export type PositionSource = (typeof POSITION_SOURCES)[number];

export const CHECKLIST_KEYS = [
  'prearrivalsIn',
  'mswIn',
  'pdaSent',
  't1',
  'pilotageArranged',
  'paid',
  'prearrivalsOut',
  'mswOut',
] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export const VESSEL_SCOPES = ['active', 'departed', 'all'] as const;
export type VesselScope = (typeof VESSEL_SCOPES)[number];

export const VESSEL_LIST_LIMIT = 500;

/** Fields a client may set through CreateVesselDto / UpdateVesselDto. */
export const VESSEL_EDITABLE_FIELDS = [
  'name',
  'imo',
  'mmsi',
  'type',
  'destination',
  'condition',
  'masterName',
  'masterPhone',
  'masterEmail',
  'officeName',
  'officePhone',
  'officeEmail',
  'portAgent',
  'etaSulina',
  'arrivedAt',
  'inPortAt',
  'departedAt',
  'prearrivalsIn',
  'prearrivalsOut',
  'mswIn',
  'mswOut',
  'pdaSent',
  'paid',
  't1',
  'pilotageArranged',
  'pilot',
  'notes',
  'lat',
  'lng',
] as const;
export type VesselEditableField = (typeof VESSEL_EDITABLE_FIELDS)[number];

export const VESSEL_DATE_FIELDS = [
  'etaSulina',
  'arrivedAt',
  'inPortAt',
  'departedAt',
] as const;
export type VesselDateField = (typeof VESSEL_DATE_FIELDS)[number];
