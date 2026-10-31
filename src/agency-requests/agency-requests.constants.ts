export const AGENCY_REQUEST_STATUSES = [
  'new',
  'quoted',
  'accepted',
  'declined',
] as const;
export type AgencyRequestStatus = (typeof AGENCY_REQUEST_STATUSES)[number];

/** Safety cap for GET /agency-requests (newest first). */
export const AGENCY_REQUEST_LIST_LIMIT = 200;

/** Max lengths of the agency_request columns (migration 1793900000000). */
export const AGENCY_REQUEST_MAX_LENGTH = {
  company: 120,
  contactName: 120,
  email: 160,
  phone: 40,
  vesselName: 80,
  cargo: 160,
  notes: 2000,
  staffNote: 2000,
} as const;
