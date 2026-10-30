import { RoleEnum } from '../roles/roles.enum';
import { Vessel } from './domain/vessel';
import { VesselChecklist, VesselView } from './domain/vessel-view';
import { CHECKLIST_KEYS, ChecklistKey, VesselStage } from './vessel.constants';

type StageInput = Pick<Vessel, 'arrivedAt' | 'inPortAt' | 'departedAt'>;
type ChecklistInput = Pick<Vessel, ChecklistKey>;

export function computeStage(vessel: StageInput): VesselStage {
  if (vessel.departedAt) {
    return 'departed';
  }
  if (vessel.inPortAt) {
    return 'in_port';
  }
  if (vessel.arrivedAt) {
    return 'at_roads';
  }
  return 'expected';
}

function isChecklistItemDone(vessel: ChecklistInput, key: ChecklistKey) {
  switch (key) {
    case 'prearrivalsIn':
      return vessel.prearrivalsIn === 'ok';
    case 'prearrivalsOut':
      return vessel.prearrivalsOut === 'ok';
    case 't1':
      return vessel.t1 === 'yes' || vessel.t1 === 'not_needed';
    default:
      return vessel[key] === true;
  }
}

export function computeChecklist(vessel: ChecklistInput): VesselChecklist {
  const pending = CHECKLIST_KEYS.filter(
    (key) => !isChecklistItemDone(vessel, key),
  );
  const checklist = new VesselChecklist();
  checklist.total = CHECKLIST_KEYS.length;
  checklist.done = CHECKLIST_KEYS.length - pending.length;
  checklist.pending = [...pending];
  return checklist;
}

export function isUnpaidAfterDeparture(
  vessel: Pick<Vessel, 'departedAt' | 'paid'>,
): boolean {
  return Boolean(vessel.departedAt) && !vessel.paid;
}

/** Admin and staff see internal data; every other role (incl. unknown) is a viewer. */
export function canSeeInternalVesselData(
  roleId: number | string | null | undefined,
): boolean {
  const id = Number(roleId);
  return id === RoleEnum.admin || id === RoleEnum.staff;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toVesselView(
  vessel: Vessel,
  roleId: number | string | null | undefined,
): VesselView {
  const restricted = !canSeeInternalVesselData(roleId);
  const view = new VesselView();

  view.id = vessel.id;
  view.name = vessel.name;
  view.imo = vessel.imo;
  view.mmsi = vessel.mmsi;
  view.type = vessel.type;
  view.destination = vessel.destination;
  view.condition = vessel.condition;
  view.etaSulina = toIso(vessel.etaSulina);
  view.arrivedAt = toIso(vessel.arrivedAt);
  view.inPortAt = toIso(vessel.inPortAt);
  view.departedAt = toIso(vessel.departedAt);
  view.lat = vessel.lat;
  view.lng = vessel.lng;
  view.sog = vessel.sog;
  view.cog = vessel.cog;
  view.positionSource = vessel.positionSource;
  view.positionAt = toIso(vessel.positionAt);
  view.stage = computeStage(vessel);
  view.createdAt = vessel.createdAt.toISOString();
  view.updatedAt = vessel.updatedAt.toISOString();
  view.restricted = restricted;

  if (restricted) {
    view.masterName = null;
    view.masterPhone = null;
    view.masterEmail = null;
    view.officeName = null;
    view.officePhone = null;
    view.officeEmail = null;
    view.portAgent = null;
    view.prearrivalsIn = null;
    view.prearrivalsOut = null;
    view.mswIn = null;
    view.mswOut = null;
    view.pdaSent = null;
    view.paid = null;
    view.t1 = null;
    view.pilotageArranged = null;
    view.pilot = null;
    view.notes = null;
    view.checklist = null;
    view.unpaidAfterDeparture = null;
    view.updatedBy = null;
    return view;
  }

  view.masterName = vessel.masterName;
  view.masterPhone = vessel.masterPhone;
  view.masterEmail = vessel.masterEmail;
  view.officeName = vessel.officeName;
  view.officePhone = vessel.officePhone;
  view.officeEmail = vessel.officeEmail;
  view.portAgent = vessel.portAgent;
  view.prearrivalsIn = vessel.prearrivalsIn;
  view.prearrivalsOut = vessel.prearrivalsOut;
  view.mswIn = vessel.mswIn;
  view.mswOut = vessel.mswOut;
  view.pdaSent = vessel.pdaSent;
  view.paid = vessel.paid;
  view.t1 = vessel.t1;
  view.pilotageArranged = vessel.pilotageArranged;
  view.pilot = vessel.pilot;
  view.notes = vessel.notes;
  view.checklist = computeChecklist(vessel);
  view.unpaidAfterDeparture = isUnpaidAfterDeparture(vessel);
  view.updatedBy = vessel.updatedBy;
  return view;
}
