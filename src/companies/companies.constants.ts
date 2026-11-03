export const COMPANY_MEMBER_STATUSES = ['pending', 'active'] as const;
export type CompanyMemberStatus = (typeof COMPANY_MEMBER_STATUSES)[number];

export const COMPANY_MEMBER_ROLES = ['owner', 'member'] as const;
export type CompanyMemberRole = (typeof COMPANY_MEMBER_ROLES)[number];

/** owner = the point's creator; otherwise the caller's membership status. */
export const COMPANY_MEMBERSHIPS = ['owner', 'active', 'pending'] as const;
export type CompanyMembership = (typeof COMPANY_MEMBERSHIPS)[number];

export const COMPANY_POSITION_MAX_LENGTH = 120;
/** Safety caps for the company profile. */
export const COMPANY_MEMBERS_LIMIT = 500;
export const COMPANY_BRANCHES_LIMIT = 200;
