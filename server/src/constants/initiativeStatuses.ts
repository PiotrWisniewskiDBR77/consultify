/** Kanoniczny, ręcznie edytowany słownik statusów inicjatywy (DEC-424). */
export const InitiativeStatus = {
  PROPOSED: 'PROPOSED',
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  IN_EXECUTION: 'IN_EXECUTION',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
} as const;

export type InitiativeStatusType = (typeof InitiativeStatus)[keyof typeof InitiativeStatus];
export const INITIATIVE_FLAGS = ['on_hold', 'archived'] as const;
export type InitiativeFlag = (typeof INITIATIVE_FLAGS)[number];
export interface InitiativeFlags { on_hold: boolean; archived: boolean }

/** Granica zgodności dla danych zastanych; nie rozszerza słownika docelowego. */
export const LEGACY_INITIATIVE_STATUS_MAP = {
  PROPOSED: InitiativeStatus.PROPOSED,
  DRAFT: InitiativeStatus.DRAFT,
  PENDING_REVIEW: InitiativeStatus.PENDING_APPROVAL,
  REVIEW: InitiativeStatus.PENDING_APPROVAL,
  PROMOTED: InitiativeStatus.PENDING_APPROVAL,
  PLANNING: InitiativeStatus.PENDING_APPROVAL,
  PENDING_APPROVAL: InitiativeStatus.PENDING_APPROVAL,
  APPROVED: InitiativeStatus.APPROVED,
  SCHEDULED: InitiativeStatus.APPROVED,
  EXECUTING: InitiativeStatus.IN_EXECUTION,
  IN_PROGRESS: InitiativeStatus.IN_EXECUTION,
  IN_EXECUTION: InitiativeStatus.IN_EXECUTION,
  BLOCKED: InitiativeStatus.IN_EXECUTION,
  DONE: InitiativeStatus.CLOSED,
  TRACKING: InitiativeStatus.CLOSED,
  ARCHIVED: InitiativeStatus.CLOSED,
  CLOSED: InitiativeStatus.CLOSED,
  CANCELLED: InitiativeStatus.REJECTED,
  REJECTED: InitiativeStatus.REJECTED,
} as const satisfies Record<string, InitiativeStatusType>;

export function normalizeInitiativeStatus(value: string): InitiativeStatusType | null {
  return LEGACY_INITIATIVE_STATUS_MAP[
    String(value || '').trim().toUpperCase() as keyof typeof LEGACY_INITIATIVE_STATUS_MAP
  ] ?? null;
}

export const Role = {
  ADMIN: 'ADMIN', SUPERADMIN: 'SUPERADMIN', CONSULTANT: 'CONSULTANT',
  PROJECT_MANAGER: 'PROJECT_MANAGER', PROJECT_LEAD: 'PROJECT_LEAD',
  INITIATIVE_OWNER: 'INITIATIVE_OWNER', PROJECT_SPONSOR: 'PROJECT_SPONSOR',
  PMO: 'PMO', STEERING_COMMITTEE: 'STEERING_COMMITTEE',
  PORTFOLIO_OWNER: 'PORTFOLIO_OWNER', TEAM_MEMBER: 'TEAM_MEMBER',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
} as const;
export type RoleType = (typeof Role)[keyof typeof Role];

/** Nazwy bramek są zachowanym kontraktem tras i audytu. */
export const GateType = {
  CREATE_DRAFT: 'CREATE_DRAFT', SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW',
  SEND_BACK: 'SEND_BACK', APPROVE_TO_INITIATIVE: 'APPROVE_TO_INITIATIVE',
  ACCEPT: 'ACCEPT', REJECT: 'REJECT', START_PLANNING: 'START_PLANNING',
  APPROVE: 'APPROVE', SCHEDULE: 'SCHEDULE', START: 'START', BLOCK: 'BLOCK',
  UNBLOCK: 'UNBLOCK', COMPLETE: 'COMPLETE', START_TRACKING: 'START_TRACKING',
  CANCEL: 'CANCEL', ARCHIVE: 'ARCHIVE',
} as const;
export type GateTypeValue = (typeof GateType)[keyof typeof GateType];

export type InitiativeTransitionCondition =
  | 'TITLE_AND_JUSTIFICATION' | 'REASON_REQUIRED' | 'CARD_COMPLETE'
  | 'CURRENT_GO_DECISION' | 'HANDOFF_AND_START_DATE' | 'NO_OPEN_WORK';
export interface InitiativeTransitionDefinition {
  from: InitiativeStatusType;
  to: InitiativeStatusType;
  gate: GateTypeValue;
  roles: readonly RoleType[];
  condition: InitiativeTransitionCondition;
  authorOnly?: boolean;
}
export const INITIATIVE_FLAG_RULES = {
  HOLD: { gate: GateType.BLOCK, roles: [Role.INITIATIVE_OWNER, Role.PMO], reasonRequired: true },
  RESUME: { gate: GateType.UNBLOCK, roles: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE], reasonRequired: false },
  ARCHIVE: { gate: GateType.ARCHIVE, roles: [Role.PMO, Role.STEERING_COMMITTEE], reasonRequired: false },
} as const;
export type InitiativeFlagOperation = keyof typeof INITIATIVE_FLAG_RULES;

/** Brak wiersza oznacza zakaz. Admin omija role, nigdy warunek merytoryczny. */
export const INITIATIVE_TRANSITION_MATRIX = [
  { from: InitiativeStatus.PROPOSED, to: InitiativeStatus.DRAFT, gate: GateType.CREATE_DRAFT,
    roles: [Role.CONSULTANT], condition: 'TITLE_AND_JUSTIFICATION', authorOnly: true },
  { from: InitiativeStatus.PROPOSED, to: InitiativeStatus.REJECTED, gate: GateType.REJECT,
    roles: [Role.PROJECT_MANAGER], condition: 'REASON_REQUIRED' },
  { from: InitiativeStatus.DRAFT, to: InitiativeStatus.PENDING_APPROVAL,
    gate: GateType.SUBMIT_FOR_REVIEW, roles: [Role.CONSULTANT], condition: 'CARD_COMPLETE', authorOnly: true },
  { from: InitiativeStatus.PENDING_APPROVAL, to: InitiativeStatus.APPROVED, gate: GateType.APPROVE,
    roles: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE], condition: 'CURRENT_GO_DECISION' },
  { from: InitiativeStatus.PENDING_APPROVAL, to: InitiativeStatus.DRAFT, gate: GateType.SEND_BACK,
    roles: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE], condition: 'REASON_REQUIRED' },
  { from: InitiativeStatus.PENDING_APPROVAL, to: InitiativeStatus.REJECTED, gate: GateType.REJECT,
    roles: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE], condition: 'REASON_REQUIRED' },
  { from: InitiativeStatus.APPROVED, to: InitiativeStatus.IN_EXECUTION, gate: GateType.START,
    roles: [Role.PMO], condition: 'HANDOFF_AND_START_DATE' },
  { from: InitiativeStatus.APPROVED, to: InitiativeStatus.REJECTED, gate: GateType.REJECT,
    roles: [Role.PMO, Role.STEERING_COMMITTEE], condition: 'REASON_REQUIRED' },
  { from: InitiativeStatus.IN_EXECUTION, to: InitiativeStatus.CLOSED, gate: GateType.COMPLETE,
    roles: [Role.INITIATIVE_OWNER, Role.PMO], condition: 'NO_OPEN_WORK' },
  { from: InitiativeStatus.IN_EXECUTION, to: InitiativeStatus.REJECTED, gate: GateType.CANCEL,
    roles: [Role.PMO, Role.STEERING_COMMITTEE], condition: 'REASON_REQUIRED' },
] as const satisfies readonly InitiativeTransitionDefinition[];

export const GATE_PERMISSIONS: Record<GateTypeValue, RoleType[]> = Object.values(GateType).reduce(
  (out, gate) => {
    out[gate] = Array.from(new Set([
      ...INITIATIVE_TRANSITION_MATRIX.filter((row) => row.gate === gate).flatMap((row) => row.roles),
      ...Object.values(INITIATIVE_FLAG_RULES).filter((row) => row.gate === gate).flatMap((row) => row.roles),
    ]));
    return out;
  }, {} as Record<GateTypeValue, RoleType[]>)
;

/** Indeks kompatybilności. Pełna egzekucja korzysta z macierzy, nie z `to`. */
export const GATE_TRANSITIONS = Object.fromEntries(Object.values(GateType).map((gate) => {
  const rows = INITIATIVE_TRANSITION_MATRIX.filter((row) => row.gate === gate);
  return [gate, { from: rows.map((row) => row.from), to: rows[0]?.to ?? null }];
})) as Record<GateTypeValue, { from: InitiativeStatusType[]; to: InitiativeStatusType | null }>;

export const VALID_TRANSITIONS: Record<InitiativeStatusType, InitiativeStatusType[]> = {
  PROPOSED: [InitiativeStatus.DRAFT, InitiativeStatus.REJECTED],
  DRAFT: [InitiativeStatus.PENDING_APPROVAL],
  PENDING_APPROVAL: [InitiativeStatus.APPROVED, InitiativeStatus.DRAFT, InitiativeStatus.REJECTED],
  APPROVED: [InitiativeStatus.IN_EXECUTION, InitiativeStatus.REJECTED],
  IN_EXECUTION: [InitiativeStatus.CLOSED, InitiativeStatus.REJECTED],
  CLOSED: [], REJECTED: [],
};

export function getTransitionDefinition(from: InitiativeStatusType, to: InitiativeStatusType): InitiativeTransitionDefinition | null {
  return INITIATIVE_TRANSITION_MATRIX.find((row) => row.from === from && row.to === to) ?? null;
}
export function getGateForTransition(from: InitiativeStatusType, to: InitiativeStatusType): GateTypeValue | null {
  return getTransitionDefinition(from, to)?.gate ?? null;
}
export function isValidTransition(from: InitiativeStatusType, to: InitiativeStatusType): boolean {
  return getTransitionDefinition(from, to) !== null;
}
export function getValidNextStatuses(status: InitiativeStatusType): InitiativeStatusType[] {
  return [...VALID_TRANSITIONS[status]];
}
export function canExecuteGate(role: RoleType, gate: GateTypeValue): boolean {
  return role === Role.ADMIN || role === Role.SUPERADMIN || GATE_PERMISSIONS[gate].includes(role);
}

export interface TransitionValidationContext {
  userRole: RoleType; isAuthor?: boolean; title?: string | null; justification?: string | null;
  description?: string | null; ownerId?: string | null; scope?: string | null;
  reason?: string | null; blockedReason?: string; pendingTasks?: number;
  hasBlockingDecisions?: boolean; hasCurrentGoDecision?: boolean;
  hasAcceptedHandoff?: boolean; startDate?: string | null;
  hasRequiredArtefacts?: boolean; isScheduled?: boolean;
  escalationLevel?: 'none' | 'amber' | 'red';
}
export interface TransitionValidationResult { valid: boolean; reason?: string; requiredRoles?: RoleType[] }
const nonEmpty = (value: unknown): boolean => String(value ?? '').trim().length > 0;

export function validateTransition(from: InitiativeStatusType, to: InitiativeStatusType,
  context: TransitionValidationContext): TransitionValidationResult {
  const row = getTransitionDefinition(from, to);
  if (!row) return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
  const admin = context.userRole === Role.ADMIN || context.userRole === Role.SUPERADMIN;
  if (!admin && !row.roles.includes(context.userRole)) {
    return { valid: false, reason: `Role ${context.userRole} cannot execute gate ${row.gate}`,
      requiredRoles: [...row.roles] };
  }
  if (row.authorOnly && !admin && context.isAuthor !== true)
    return { valid: false, reason: 'Transition is limited to the initiative author' };
  if (row.condition === 'TITLE_AND_JUSTIFICATION' && (!nonEmpty(context.title) || !nonEmpty(context.justification)))
    return { valid: false, reason: 'Title and justification are required' };
  if (row.condition === 'REASON_REQUIRED' && !nonEmpty(context.reason ?? context.blockedReason))
    return { valid: false, reason: 'Reason is required' };
  if (row.condition === 'CARD_COMPLETE' && (!nonEmpty(context.description) || !nonEmpty(context.ownerId) || !nonEmpty(context.scope)))
    return { valid: false, reason: 'Description, owner and scope are required' };
  if (row.condition === 'CURRENT_GO_DECISION' && context.hasCurrentGoDecision !== true)
    return { valid: false, reason: 'A current GO decision is required' };
  if (row.condition === 'HANDOFF_AND_START_DATE' && (context.hasAcceptedHandoff !== true || !nonEmpty(context.startDate)))
    return { valid: false, reason: 'Accepted handoff and start date are required' };
  if (row.condition === 'NO_OPEN_WORK' && ((context.pendingTasks ?? 0) > 0 || context.hasBlockingDecisions === true))
    return { valid: false, reason: 'Open tasks or blocking decisions prevent closure' };
  return { valid: true };
}

export type ModuleId = 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits' | 'reporting';
export interface ModuleConfig { id: ModuleId; name: string; namePL: string; route: string;
  statuses: InitiativeStatusType[]; color: string; description: string }
export const MODULES: Record<ModuleId, ModuleConfig> = {
  tools: { id: 'tools', name: 'Tools', namePL: 'Narzędzia', route: '/tools', statuses: [InitiativeStatus.PROPOSED, InitiativeStatus.DRAFT], color: 'slate', description: 'Initiative proposals and drafts' },
  assessment: { id: 'assessment', name: 'Assessment', namePL: 'Ocena', route: '/assessment', statuses: [InitiativeStatus.PROPOSED, InitiativeStatus.DRAFT], color: 'slate', description: 'Assessment initiatives' },
  initiatives: { id: 'initiatives', name: 'Initiatives', namePL: 'Inicjatywy', route: '/initiatives', statuses: Object.values(InitiativeStatus), color: 'slate', description: 'Initiative management' },
  execution: { id: 'execution', name: 'Execution', namePL: 'Realizacja', route: '/execution', statuses: [InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED], color: 'slate', description: 'Initiative execution' },
  benefits: { id: 'benefits', name: 'Benefits', namePL: 'Korzyści', route: '/benefits', statuses: [InitiativeStatus.CLOSED], color: 'slate', description: 'Closed initiative benefits' },
  reporting: { id: 'reporting', name: 'Reporting', namePL: 'Raportowanie', route: '/reports', statuses: Object.values(InitiativeStatus), color: 'slate', description: 'Initiative reporting' },
};

export interface StatusMeta { labelKey: string; descriptionKey: string; color: string; bgColor: string;
  dotColor: string; icon: string; order: number }
const neutral = (code: string, icon: string, order: number): StatusMeta => ({
  labelKey: `initiatives.status.${code}`, descriptionKey: `initiatives.statusDescription.${code}`,
  color: 'text-slate-600', bgColor: 'bg-slate-500/10', dotColor: 'bg-slate-400', icon, order,
});
export const STATUS_METADATA: Record<InitiativeStatusType, StatusMeta> = {
  PROPOSED: neutral('PROPOSED', 'Lightbulb', 1), DRAFT: neutral('DRAFT', 'FileText', 2),
  PENDING_APPROVAL: neutral('PENDING_APPROVAL', 'Clock', 3), APPROVED: neutral('APPROVED', 'CheckCircle', 4),
  IN_EXECUTION: neutral('IN_EXECUTION', 'Play', 5), CLOSED: neutral('CLOSED', 'CheckCircle2', 6),
  REJECTED: neutral('REJECTED', 'XCircle', 7),
};
export function getStatusLabel(status: InitiativeStatusType): string { return STATUS_METADATA[status].labelKey; }
export function getModuleForStatus(status: InitiativeStatusType): ModuleId {
  if (status === InitiativeStatus.IN_EXECUTION) return 'execution';
  if (status === InitiativeStatus.CLOSED) return 'benefits';
  return 'initiatives';
}
export function getModuleConfigForStatus(status: InitiativeStatusType): ModuleConfig { return MODULES[getModuleForStatus(status)]; }
export function willChangeModule(from: InitiativeStatusType, to: InitiativeStatusType): boolean { return getModuleForStatus(from) !== getModuleForStatus(to); }
export function getStatusesForModule(moduleId: ModuleId): InitiativeStatusType[] { return [...MODULES[moduleId].statuses]; }
export function isStatusInModule(status: InitiativeStatusType, moduleId: ModuleId): boolean { return MODULES[moduleId].statuses.includes(status); }
export function getLifecycleProgress(status: InitiativeStatusType): number {
  return ({ PROPOSED: 0, DRAFT: 10, PENDING_APPROVAL: 30, APPROVED: 50,
    IN_EXECUTION: 75, CLOSED: 100, REJECTED: 0 } as Record<InitiativeStatusType, number>)[status];
}
export function isTerminalStatus(status: InitiativeStatusType): boolean { return status === InitiativeStatus.CLOSED || status === InitiativeStatus.REJECTED; }
export function isActiveStatus(status: InitiativeStatusType): boolean { return !isTerminalStatus(status); }
export const SCHEDULED_ONWARD_STATUSES = [InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED];
export function isScheduledOnward(status: InitiativeStatusType | string): boolean {
  const normalized = normalizeInitiativeStatus(String(status));
  return normalized ? SCHEDULED_ONWARD_STATUSES.includes(normalized as never) : false;
}
export function needsAttention(status: InitiativeStatusType): boolean { return status === InitiativeStatus.PENDING_APPROVAL; }
export function getLifecycleOrder(): InitiativeStatusType[] { return Object.values(InitiativeStatus); }
export function getToolsVisibleStatuses(): InitiativeStatusType[] { return [InitiativeStatus.PROPOSED, InitiativeStatus.DRAFT]; }
export function getAssessmentVisibleStatuses(): InitiativeStatusType[] { return [InitiativeStatus.PROPOSED, InitiativeStatus.DRAFT]; }
export function getInitiativesVisibleStatuses(): InitiativeStatusType[] { return Object.values(InitiativeStatus); }
export function getExecutionVisibleStatuses(): InitiativeStatusType[] { return [InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED]; }
export function getBenefitsVisibleStatuses(): InitiativeStatusType[] { return [InitiativeStatus.CLOSED]; }
export function buildStatusFilterSQL(statuses: InitiativeStatusType[], tableAlias = 'i'):
  { sql: string; params: InitiativeStatusType[] } {
  if (statuses.length === 0) return { sql: '1 = 0', params: [] };
  return { sql: `${tableAlias}.status IN (${statuses.map(() => '?').join(', ')})`, params: statuses };
}
