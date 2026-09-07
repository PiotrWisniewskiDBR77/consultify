/** Frontend projection of DEC-424. Codes and label keys come from the generated server SSOT. */
import {
  InitiativeStatus,
  INITIATIVE_FLAG_RULES as GENERATED_FLAG_RULES,
  INITIATIVE_STATUS_LABEL_KEYS,
  INITIATIVE_TRANSITION_MATRIX,
  INITIATIVE_VALID_TRANSITIONS,
  type InitiativeStatus as InitiativeStatusCode,
} from '../../packages/shared/src/constants/initiativeStatuses.generated';
import type { StatusTone } from '../components/ui/primitives/chips';

export type ModuleId = 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits' | 'reporting';
export interface ModuleConfig { id: ModuleId; name: string; route: string; statuses: InitiativeStatusCode[]; color: string; betaModuleId?: string }
export interface StatusMeta { labelKey: string; color: string; bgColor: string; dotColor: string; descriptionKey: string }
const ALL = Object.values(InitiativeStatus);

/**
 * ★ Do 2026-09-07 ta tablica była RĘCZNĄ kopią macierzy serwera i rozjechała się z nią:
 * pozwalała odrzucić szkic (serwer: brak takiej krawędzi -> 400 INVALID_TRANSITION po
 * kliknięciu). Teraz pochodzi z wygenerowanego SSOT (`scripts/generate-initiative-statuses.mjs`),
 * więc rozjazd jest niemożliwy bez przegenerowania pliku.
 */
export const VALID_TRANSITIONS: Record<InitiativeStatusCode, InitiativeStatusCode[]> =
  INITIATIVE_VALID_TRANSITIONS;
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

export interface StatusAction { labelKey: string; targetStatus: InitiativeStatusCode; variant: 'primary' | 'secondary' | 'danger'; requiresReason?: boolean; gate?: string }
/** Klucz etykiety per BRAMKA — słownictwo z tablicy DEC-424 zaakceptowanej przez właściciela. */
export const gateActionLabelKey = (gate: string): string => `initiatives.lifecycle.action.${gate}`;
export function getStatusActions(status: InitiativeStatusCode): StatusAction[] {
  return INITIATIVE_TRANSITION_MATRIX.filter((row) => row.from === status).map((row) => ({
    labelKey: gateActionLabelKey(row.gate),
    targetStatus: row.to as InitiativeStatusCode,
    // Crimson (`danger`) rezerwujemy dla semantyki krytycznej: odrzucenie/anulowanie.
    variant: row.to === InitiativeStatus.REJECTED ? 'danger' : row.gate === 'SEND_BACK' ? 'secondary' : 'primary',
    requiresReason: row.condition === 'REASON_REQUIRED',
    gate: row.gate,
  }));
}
export type ContextActionId = 'task' | 'decision' | 'raid';
export const getContextActions = (status: InitiativeStatusCode): ContextActionId[] => status === InitiativeStatus.IN_EXECUTION ? ['task', 'decision', 'raid'] : status === InitiativeStatus.DRAFT || status === InitiativeStatus.APPROVED ? ['task', 'raid'] : [];

/** Bramki, role i warunki — WYŁĄCZNIE z wygenerowanego SSOT DEC-424. */
export type GateTypeValue = (typeof INITIATIVE_TRANSITION_MATRIX)[number]['gate'];
export type GateRoleValue = (typeof INITIATIVE_TRANSITION_MATRIX)[number]['roles'][number];
export type InitiativeFlagOperation = (typeof GENERATED_FLAG_RULES)[number]['operation'];

export const GateType = Object.fromEntries(
  INITIATIVE_TRANSITION_MATRIX.map((row) => [row.gate, row.gate])
) as Record<GateTypeValue, GateTypeValue>;

export const GATE_PERMISSIONS: Record<string, string[]> = INITIATIVE_TRANSITION_MATRIX.reduce<
  Record<string, string[]>
>((out, row) => {
  out[row.gate] = Array.from(new Set([...(out[row.gate] ?? []), ...row.roles]));
  return out;
}, GENERATED_FLAG_RULES.reduce<Record<string, string[]>>((out, rule) => {
  out[rule.gate] = Array.from(new Set([...(out[rule.gate] ?? []), ...rule.roles]));
  return out;
}, {}));

export const GATE_TRANSITIONS: Record<string, { from: InitiativeStatusCode[]; to: InitiativeStatusCode | null }> =
  INITIATIVE_TRANSITION_MATRIX.reduce<Record<string, { from: InitiativeStatusCode[]; to: InitiativeStatusCode | null }>>(
    (out, row) => {
      const entry = out[row.gate] ?? { from: [] as InitiativeStatusCode[], to: row.to as InitiativeStatusCode };
      if (!entry.from.includes(row.from as InitiativeStatusCode)) entry.from.push(row.from as InitiativeStatusCode);
      out[row.gate] = entry;
      return out;
    },
    {}
  );

/** Zachowany kontrakt nazw ról dla ekranów, które indeksują `GATE_PERMISSIONS`. */
export const GateRole = {
  ADMIN: 'ADMIN', SUPERADMIN: 'SUPERADMIN', CONSULTANT: 'CONSULTANT',
  PROJECT_MANAGER: 'PROJECT_MANAGER', PROJECT_LEAD: 'PROJECT_LEAD',
  INITIATIVE_OWNER: 'INITIATIVE_OWNER', PROJECT_SPONSOR: 'PROJECT_SPONSOR',
  PMO: 'PMO', STEERING_COMMITTEE: 'STEERING_COMMITTEE',
  PORTFOLIO_OWNER: 'PORTFOLIO_OWNER', TEAM_MEMBER: 'TEAM_MEMBER',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
} as const;

export const INITIATIVE_FLAG_RULES = GENERATED_FLAG_RULES;

export function getTransitionRow(from: InitiativeStatusCode, to: InitiativeStatusCode) {
  return INITIATIVE_TRANSITION_MATRIX.find((row) => row.from === from && row.to === to) ?? null;
}
export function getGateForTransition(from: InitiativeStatusCode, to: InitiativeStatusCode): GateTypeValue | null {
  return getTransitionRow(from, to)?.gate ?? null;
}
export function canUserExecuteGate(roles: string[], gate: string): boolean {
  return roles.includes('ADMIN') || roles.includes('SUPERADMIN') || (GATE_PERMISSIONS[gate] ?? []).some((role) => roles.includes(role));
}
export function getFilteredStatusActions(status: InitiativeStatusCode, roles: string[]) {
  return getStatusActions(status).map((action) => {
    const gate = getGateForTransition(status, action.targetStatus);
    const requiredRoles = gate ? (GATE_PERMISSIONS[gate] ?? []) : [];
    return { ...action, gate, requiredRoles, variant: !gate || canUserExecuteGate(roles, gate) ? action.variant : ('disabled' as any) };
  });
}
export function getRequiredRolesForNextGate(status: InitiativeStatusCode) { return getValidNextStatuses(status).flatMap((targetStatus) => { const gate = getGateForTransition(status, targetStatus); return gate ? [{ gate, requiredRoles: GATE_PERMISSIONS[gate], targetStatus }] : []; }); }

export default { VALID_TRANSITIONS, MODULES, STATUS_METADATA, getModuleForStatus, getModuleConfigForStatus, isValidTransition, getValidNextStatuses, willChangeModule, getTargetModule, getStatusMeta, getLocalizedStatusLabel, getLocalizedStatusDescription, getStatusesForModule, isStatusInModule, getLifecycleProgress, getLifecycleOrder, isTerminalStatus, isActiveStatus, needsAttention, getStatusActions, getContextActions, GATE_PERMISSIONS, GATE_TRANSITIONS, getGateForTransition, canUserExecuteGate, getFilteredStatusActions, getRequiredRolesForNextGate, getTransitionRow, INITIATIVE_FLAG_RULES };
