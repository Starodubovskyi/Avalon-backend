import {
  VesselEventChanges,
  VesselFieldValue,
} from '../vessel-events/domain/vessel-event';
import { Vessel, VesselWritable } from './domain/vessel';
import { CreateVesselDto } from './dto/create-vessel.dto';
import { UpdateVesselDto } from './dto/update-vessel.dto';
import {
  VESSEL_DATE_FIELDS,
  VESSEL_EDITABLE_FIELDS,
  VesselDateField,
  VesselEditableField,
} from './vessel.constants';

/** Values of the client-editable fields, in domain types (dates as Date). */
export type VesselEditableValues = Pick<VesselWritable, VesselEditableField>;

const DATE_FIELDS: ReadonlySet<string> = new Set<string>(VESSEL_DATE_FIELDS);

function isDateField(field: string): field is VesselDateField {
  return DATE_FIELDS.has(field);
}

/** Normalizes a value for comparison and storage in the audit diff. */
export function toFieldValue(value: unknown): VesselFieldValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return JSON.stringify(value);
}

/** Picks only the fields present in the DTO and converts ISO strings to Date. */
export function pickEditableFields(
  dto: CreateVesselDto | UpdateVesselDto,
): Partial<VesselEditableValues> {
  const result: Partial<Record<VesselEditableField, unknown>> = {};
  for (const field of VESSEL_EDITABLE_FIELDS) {
    const value: unknown = dto[field];
    if (value === undefined) {
      continue;
    }
    result[field] =
      isDateField(field) && typeof value === 'string' ? new Date(value) : value;
  }
  return result as Partial<VesselEditableValues>;
}

/** Fields whose requested value differs from the current one (dates compared as ISO). */
export function diffVesselFields(
  current: Vessel,
  requested: Partial<VesselEditableValues>,
): VesselEventChanges {
  const changes: VesselEventChanges = {};
  for (const field of VESSEL_EDITABLE_FIELDS) {
    if (!(field in requested)) {
      continue;
    }
    const from = toFieldValue(current[field]);
    const to = toFieldValue(requested[field]);
    if (from !== to) {
      changes[field] = { from, to };
    }
  }
  return changes;
}

/** "created" event payload: every value that was actually set. */
export function toCreatedChanges(
  values: Partial<VesselEditableValues>,
): VesselEventChanges {
  const changes: VesselEventChanges = {};
  for (const field of VESSEL_EDITABLE_FIELDS) {
    const to = toFieldValue(values[field]);
    if (to !== null) {
      changes[field] = { from: null, to };
    }
  }
  return changes;
}

/** Returns the field that is missing when only one coordinate is set. */
export function findIncompletePositionField(
  lat: number | null,
  lng: number | null,
): 'lat' | 'lng' | null {
  if (lat === null && lng !== null) return 'lat';
  if (lng === null && lat !== null) return 'lng';
  return null;
}

/** Builds a full row for INSERT, applying column defaults and manual position. */
export function buildNewVessel(
  values: Partial<VesselEditableValues> &
    Pick<VesselEditableValues, 'name' | 'type' | 'destination'>,
  userId: number,
  now: Date,
): VesselWritable {
  const lat = values.lat ?? null;
  const lng = values.lng ?? null;
  const hasPosition = lat !== null && lng !== null;
  return {
    name: values.name,
    imo: values.imo ?? null,
    mmsi: values.mmsi ?? null,
    type: values.type,
    destination: values.destination,
    condition: values.condition ?? null,
    masterName: values.masterName ?? null,
    masterPhone: values.masterPhone ?? null,
    masterEmail: values.masterEmail ?? null,
    officeName: values.officeName ?? null,
    officePhone: values.officePhone ?? null,
    officeEmail: values.officeEmail ?? null,
    portAgent: values.portAgent ?? null,
    etaSulina: values.etaSulina ?? null,
    arrivedAt: values.arrivedAt ?? null,
    inPortAt: values.inPortAt ?? null,
    departedAt: values.departedAt ?? null,
    prearrivalsIn: values.prearrivalsIn ?? 'not_ok',
    prearrivalsOut: values.prearrivalsOut ?? 'not_ok',
    mswIn: values.mswIn ?? false,
    mswOut: values.mswOut ?? false,
    pdaSent: values.pdaSent ?? false,
    paid: values.paid ?? false,
    t1: values.t1 ?? null,
    pilotageArranged: values.pilotageArranged ?? false,
    pilot: values.pilot ?? null,
    notes: values.notes ?? null,
    lat,
    lng,
    sog: null,
    cog: null,
    positionSource: hasPosition ? 'manual' : null,
    positionAt: hasPosition ? now : null,
    createdById: userId,
    updatedById: userId,
  };
}
