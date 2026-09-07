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

export type InitiativeGate = (typeof INITIATIVE_TRANSITION_MATRIX)[number]['gate'];
export type InitiativeTransitionCondition = (typeof INITIATIVE_TRANSITION_MATRIX)[number]['condition'];

/** Macierz DEC-424 — brak wiersza oznacza zakaz. Nie dopisuj krawędzi tutaj. */
export const INITIATIVE_TRANSITION_MATRIX = [
  { from: 'PROPOSED', to: 'DRAFT', gate: 'CREATE_DRAFT', roles: ['CONSULTANT'], condition: 'TITLE_AND_JUSTIFICATION', authorOnly: true },
  { from: 'PROPOSED', to: 'REJECTED', gate: 'REJECT', roles: ['PROJECT_MANAGER'], condition: 'REASON_REQUIRED', authorOnly: false },
  { from: 'DRAFT', to: 'PENDING_APPROVAL', gate: 'SUBMIT_FOR_REVIEW', roles: ['CONSULTANT'], condition: 'CARD_COMPLETE', authorOnly: true },
  { from: 'PENDING_APPROVAL', to: 'APPROVED', gate: 'APPROVE', roles: ['PROJECT_SPONSOR', 'STEERING_COMMITTEE'], condition: 'CURRENT_GO_DECISION', authorOnly: false },
  { from: 'PENDING_APPROVAL', to: 'DRAFT', gate: 'SEND_BACK', roles: ['PROJECT_SPONSOR', 'STEERING_COMMITTEE'], condition: 'REASON_REQUIRED', authorOnly: false },
  { from: 'PENDING_APPROVAL', to: 'REJECTED', gate: 'REJECT', roles: ['PROJECT_SPONSOR', 'STEERING_COMMITTEE'], condition: 'REASON_REQUIRED', authorOnly: false },
  { from: 'APPROVED', to: 'IN_EXECUTION', gate: 'START', roles: ['PMO'], condition: 'HANDOFF_AND_START_DATE', authorOnly: false },
  { from: 'APPROVED', to: 'REJECTED', gate: 'REJECT', roles: ['PMO', 'STEERING_COMMITTEE'], condition: 'REASON_REQUIRED', authorOnly: false },
  { from: 'IN_EXECUTION', to: 'CLOSED', gate: 'COMPLETE', roles: ['INITIATIVE_OWNER', 'PMO'], condition: 'NO_OPEN_WORK', authorOnly: false },
  { from: 'IN_EXECUTION', to: 'REJECTED', gate: 'CANCEL', roles: ['PMO', 'STEERING_COMMITTEE'], condition: 'REASON_REQUIRED', authorOnly: false },
] as const;

export const INITIATIVE_FLAG_RULES = [
  { operation: 'HOLD', gate: 'BLOCK', roles: ['INITIATIVE_OWNER', 'PMO'], reasonRequired: true },
  { operation: 'RESUME', gate: 'UNBLOCK', roles: ['PROJECT_SPONSOR', 'STEERING_COMMITTEE'], reasonRequired: false },
  { operation: 'ARCHIVE', gate: 'ARCHIVE', roles: ['PMO', 'STEERING_COMMITTEE'], reasonRequired: false },
] as const;

export const INITIATIVE_VALID_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  PROPOSED: ['DRAFT', 'REJECTED'],
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'REJECTED'],
  APPROVED: ['IN_EXECUTION', 'REJECTED'],
  IN_EXECUTION: ['CLOSED', 'REJECTED'],
  CLOSED: [],
  REJECTED: [],
};
