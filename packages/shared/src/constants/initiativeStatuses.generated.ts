// NIE EDYTUJ RĘCZNIE. Źródło: server/src/constants/initiativeStatuses.ts
// Generator: scripts/generate-initiative-statuses.mjs
export const InitiativeStatus = {
  PROPOSED: 'PROPOSED',
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  IN_EXECUTION: 'IN_EXECUTION',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
} as const;

export type InitiativeStatus = (typeof InitiativeStatus)[keyof typeof InitiativeStatus];
export const INITIATIVE_FLAGS = ['on_hold', 'archived'] as const;
export type InitiativeFlag = (typeof INITIATIVE_FLAGS)[number];
export const LEGACY_INITIATIVE_STATUS_CODES = ['PROPOSED', 'DRAFT', 'PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'IN_PROGRESS', 'IN_EXECUTION', 'BLOCKED', 'DONE', 'TRACKING', 'ARCHIVED', 'CLOSED', 'CANCELLED', 'REJECTED'] as const;

export const INITIATIVE_STATUS_LABEL_KEYS: Record<InitiativeStatus, string> = {
  PROPOSED: 'initiatives.status.PROPOSED',
  DRAFT: 'initiatives.status.DRAFT',
  PENDING_APPROVAL: 'initiatives.status.PENDING_APPROVAL',
  APPROVED: 'initiatives.status.APPROVED',
  IN_EXECUTION: 'initiatives.status.IN_EXECUTION',
  CLOSED: 'initiatives.status.CLOSED',
  REJECTED: 'initiatives.status.REJECTED',
};
