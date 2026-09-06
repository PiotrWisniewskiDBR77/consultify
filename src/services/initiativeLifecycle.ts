/** Frontend projection of DEC-424. Codes and label keys come from the generated server SSOT. */
import { InitiativeStatus, INITIATIVE_STATUS_LABEL_KEYS, type InitiativeStatus as InitiativeStatusCode } from '../../packages/shared/src/constants/initiativeStatuses.generated';
import type { StatusTone } from '../components/ui/primitives/chips';

export type ModuleId = 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits' | 'reporting';
export interface ModuleConfig { id: ModuleId; name: string; route: string; statuses: InitiativeStatusCode[]; color: string; betaModuleId?: string }
export interface StatusMeta { labelKey: string; color: string; bgColor: string; dotColor: string; descriptionKey: string }
const ALL = Object.values(InitiativeStatus);

export const VALID_TRANSITIONS: Record<InitiativeStatusCode, InitiativeStatusCode[]> = {
  PROPOSED: [InitiativeStatus.DRAFT, InitiativeStatus.REJECTED], DRAFT: [InitiativeStatus.PENDING_APPROVAL, InitiativeStatus.REJECTED],
  PENDING_APPROVAL: [InitiativeStatus.DRAFT, InitiativeStatus.APPROVED, InitiativeStatus.REJECTED], APPROVED: [InitiativeStatus.IN_EXECUTION, InitiativeStatus.REJECTED],
  IN_EXECUTION: [InitiativeStatus.CLOSED, InitiativeStatus.REJECTED], CLOSED: [], REJECTED: [],
};
export const MODULES: Record<ModuleId, ModuleConfig> = {
  tools: { id: 'tools', name: 'Tools', route: '/tools', statuses: [InitiativeStatus.PROPOSED, InitiativeStatus.DRAFT], color: 'slate' },
  assessment: { id: 'assessment', name: 'Assessment', route: '/assessment', statuses: [InitiativeStatus.PROPOSED, InitiativeStatus.DRAFT], color: 'slate' },
  initiatives: { id: 'initiatives', name: 'Initiatives', route: '/initiatives', statuses: ALL, color: 'slate' },
  execution: { id: 'execution', name: 'Execution', route: '/execution', statuses: [InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION, InitiativeStatus.CLOSED], color: 'slate' },
  benefits: { id: 'benefits', name: 'Benefits', route: '/results', statuses: [InitiativeStatus.CLOSED], color: 'slate', betaModuleId: 'MODULE_BENEFITS' },
  reporting: { id: 'reporting', name: 'Reporting', route: '/reports', statuses: ALL, color: 'slate' },
};
const neutral = { color: 'text-c-text-secondary', bgColor: 'bg-c-surface-2', dotColor: 'bg-c-text-tertiary' };
export const STATUS_METADATA = Object.fromEntries(ALL.map((status) => [status, { labelKey: INITIATIVE_STATUS_LABEL_KEYS[status], ...neutral, descriptionKey: `initiatives.statusDescription.${status}` }])) as Record<InitiativeStatusCode, StatusMeta>;
const FALLBACK: StatusMeta = { labelKey: 'initiatives.status.unknown', ...neutral, descriptionKey: 'initiatives.statusDescription.unknown' };

export const getStatusMeta = (status: InitiativeStatusCode): StatusMeta => STATUS_METADATA[status] ?? FALLBACK;
export const getLocalizedStatusLabel = (status: InitiativeStatusCode, t: (key: string) => string): string => t(getStatusMeta(status).labelKey);
export const getLocalizedStatusDescription = (status: InitiativeStatusCode, t: (key: string) => string): string => t(getStatusMeta(status).descriptionKey);
export const getInitiativeStatusChipTone = (_status: InitiativeStatusCode, flags?: { onHold?: boolean }): StatusTone => flags?.onHold ? 'warning' : 'neutral';
export const getValidNextStatuses = (status: InitiativeStatusCode): InitiativeStatusCode[] => VALID_TRANSITIONS[status] ?? [];
export const isValidTransition = (from: InitiativeStatusCode, to: InitiativeStatusCode): boolean => getValidNextStatuses(from).includes(to);
export const getStatusesForModule = (moduleId: ModuleId): InitiativeStatusCode[] => MODULES[moduleId]?.statuses ?? [];
export const isStatusInModule = (status: InitiativeStatusCode, moduleId: ModuleId): boolean => getStatusesForModule(moduleId).includes(status);
export function getModuleForStatus(status: InitiativeStatusCode): ModuleId { return status === InitiativeStatus.APPROVED || status === InitiativeStatus.IN_EXECUTION ? 'execution' : 'initiatives'; }
export const getModuleConfigForStatus = (status: InitiativeStatusCode): ModuleConfig => MODULES[getModuleForStatus(status)];
export const willChangeModule = (from: InitiativeStatusCode, to: InitiativeStatusCode): boolean => getModuleForStatus(from) !== getModuleForStatus(to);
export const getTargetModule = (to: InitiativeStatusCode): ModuleConfig => getModuleConfigForStatus(to);
export const getLifecycleOrder = (): InitiativeStatusCode[] => [...ALL];
export const getLifecycleProgress = (status: InitiativeStatusCode): number => ({ PROPOSED: 0, DRAFT: 10, PENDING_APPROVAL: 30, APPROVED: 50, IN_EXECUTION: 75, CLOSED: 100, REJECTED: 0 })[status];
export const isTerminalStatus = (status: InitiativeStatusCode): boolean => status === InitiativeStatus.CLOSED || status === InitiativeStatus.REJECTED;
export const isActiveStatus = (status: InitiativeStatusCode): boolean => !isTerminalStatus(status);
export const needsAttention = (status: InitiativeStatusCode): boolean => status === InitiativeStatus.PENDING_APPROVAL;

export interface StatusAction { labelKey: string; targetStatus: InitiativeStatusCode; variant: 'primary' | 'secondary' | 'danger'; requiresReason?: boolean }
const ACTION_KEYS: Partial<Record<InitiativeStatusCode, string>> = { DRAFT: 'initiatives.transition.createDraft', PENDING_APPROVAL: 'initiatives.transition.submitForReview', APPROVED: 'initiatives.transition.approve', IN_EXECUTION: 'initiatives.transition.startExecution', CLOSED: 'initiatives.transition.markComplete' };
export function getStatusActions(status: InitiativeStatusCode): StatusAction[] { return getValidNextStatuses(status).map((targetStatus) => ({ labelKey: targetStatus === InitiativeStatus.REJECTED ? 'initiatives.transition.reject' : ACTION_KEYS[targetStatus] ?? 'initiatives.transition.changeStatus', targetStatus, variant: targetStatus === InitiativeStatus.REJECTED ? 'danger' : targetStatus === InitiativeStatus.DRAFT ? 'secondary' : 'primary', requiresReason: targetStatus === InitiativeStatus.REJECTED })); }
export type ContextActionId = 'task' | 'decision' | 'raid';
export const getContextActions = (status: InitiativeStatusCode): ContextActionId[] => status === InitiativeStatus.IN_EXECUTION ? ['task', 'decision', 'raid'] : status === InitiativeStatus.DRAFT || status === InitiativeStatus.APPROVED ? ['task', 'raid'] : [];

export const GateType = { SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW', SEND_BACK: 'SEND_BACK', APPROVE: 'APPROVE', START: 'START', COMPLETE: 'COMPLETE', REJECT: 'REJECT' } as const;
export type GateTypeValue = (typeof GateType)[keyof typeof GateType];
export const GateRole = { ADMIN: 'ADMIN', CONSULTANT: 'CONSULTANT', PROJECT_MANAGER: 'PROJECT_MANAGER', PROJECT_LEAD: 'PROJECT_LEAD', INITIATIVE_OWNER: 'INITIATIVE_OWNER', PROJECT_SPONSOR: 'PROJECT_SPONSOR', PMO: 'PMO', STEERING_COMMITTEE: 'STEERING_COMMITTEE', TEAM_MEMBER: 'TEAM_MEMBER', BUSINESS_OWNER: 'BUSINESS_OWNER' } as const;
export type GateRoleValue = (typeof GateRole)[keyof typeof GateRole];
export const GATE_PERMISSIONS: Record<GateTypeValue, GateRoleValue[]> = { SUBMIT_FOR_REVIEW: [GateRole.CONSULTANT, GateRole.INITIATIVE_OWNER], SEND_BACK: [GateRole.PROJECT_MANAGER, GateRole.PMO], APPROVE: [GateRole.PROJECT_SPONSOR, GateRole.STEERING_COMMITTEE], START: [GateRole.PMO], COMPLETE: [GateRole.INITIATIVE_OWNER, GateRole.PMO], REJECT: [GateRole.PROJECT_SPONSOR, GateRole.STEERING_COMMITTEE] };
export const GATE_TRANSITIONS: Record<GateTypeValue, { from: InitiativeStatusCode[]; to: InitiativeStatusCode }> = {
  SUBMIT_FOR_REVIEW: { from: [InitiativeStatus.DRAFT], to: InitiativeStatus.PENDING_APPROVAL }, SEND_BACK: { from: [InitiativeStatus.PENDING_APPROVAL], to: InitiativeStatus.DRAFT }, APPROVE: { from: [InitiativeStatus.PENDING_APPROVAL], to: InitiativeStatus.APPROVED }, START: { from: [InitiativeStatus.APPROVED], to: InitiativeStatus.IN_EXECUTION }, COMPLETE: { from: [InitiativeStatus.IN_EXECUTION], to: InitiativeStatus.CLOSED }, REJECT: { from: [InitiativeStatus.PROPOSED, InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL, InitiativeStatus.APPROVED, InitiativeStatus.IN_EXECUTION], to: InitiativeStatus.REJECTED },
};
export function getGateForTransition(from: InitiativeStatusCode, to: InitiativeStatusCode): GateTypeValue | null { return (Object.entries(GATE_TRANSITIONS).find(([, v]) => v.from.includes(from) && v.to === to)?.[0] as GateTypeValue | undefined) ?? null; }
export function canUserExecuteGate(roles: string[], gate: GateTypeValue): boolean { return roles.includes('ADMIN') || roles.includes('SUPERADMIN') || GATE_PERMISSIONS[gate].some((role) => roles.includes(role)); }
export function getFilteredStatusActions(status: InitiativeStatusCode, roles: string[]) { return getStatusActions(status).map((action) => { const gate = getGateForTransition(status, action.targetStatus); const requiredRoles = gate ? GATE_PERMISSIONS[gate] : []; return { ...action, gate, requiredRoles, variant: !gate || canUserExecuteGate(roles, gate) ? action.variant : 'disabled' as any }; }); }
export function getRequiredRolesForNextGate(status: InitiativeStatusCode) { return getValidNextStatuses(status).flatMap((targetStatus) => { const gate = getGateForTransition(status, targetStatus); return gate ? [{ gate, requiredRoles: GATE_PERMISSIONS[gate], targetStatus }] : []; }); }

export default { VALID_TRANSITIONS, MODULES, STATUS_METADATA, getModuleForStatus, getModuleConfigForStatus, isValidTransition, getValidNextStatuses, willChangeModule, getTargetModule, getStatusMeta, getLocalizedStatusLabel, getLocalizedStatusDescription, getStatusesForModule, isStatusInModule, getLifecycleProgress, getLifecycleOrder, isTerminalStatus, isActiveStatus, needsAttention, getStatusActions, getContextActions, GATE_PERMISSIONS, GATE_TRANSITIONS, getGateForTransition, canUserExecuteGate, getFilteredStatusActions, getRequiredRolesForNextGate };
