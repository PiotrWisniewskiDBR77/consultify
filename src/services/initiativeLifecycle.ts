/**
 * Initiative Lifecycle Service
 *
 * Centralized logic for initiative status transitions and module routing.
 * Implements the status-driven architecture where InitiativeStatus determines
 * which module displays the initiative.
 *
 * Canonical flow (PMO):
 * DRAFT → PENDING_REVIEW → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED
 *   → EXECUTING ↔ BLOCKED → DONE → TRACKING
 * + CANCELLED is terminal and can be reached from most non-terminal states.
 */

import { InitiativeStatus } from '../types';

/**
 * Valid status transitions map
 * Defines which statuses can transition to which other statuses
 */
export const VALID_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  // FAZA 1: Tools/Assessment
  [InitiativeStatus.DRAFT]: [InitiativeStatus.PENDING_REVIEW, InitiativeStatus.CANCELLED],
  [InitiativeStatus.PENDING_REVIEW]: [
    InitiativeStatus.REVIEW, // approve to initiatives
    InitiativeStatus.DRAFT, // send back
    InitiativeStatus.CANCELLED,
  ],

  // FAZA 2: Initiatives
  [InitiativeStatus.REVIEW]: [
    InitiativeStatus.PROMOTED, // accept
    InitiativeStatus.DRAFT, // reject
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.PROMOTED]: [InitiativeStatus.PLANNING, InitiativeStatus.CANCELLED],
  [InitiativeStatus.PLANNING]: [InitiativeStatus.APPROVED, InitiativeStatus.CANCELLED],
  [InitiativeStatus.APPROVED]: [InitiativeStatus.SCHEDULED, InitiativeStatus.CANCELLED],
  [InitiativeStatus.SCHEDULED]: [InitiativeStatus.EXECUTING, InitiativeStatus.CANCELLED],

  // FAZA 3: Execution
  [InitiativeStatus.EXECUTING]: [
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.BLOCKED]: [InitiativeStatus.EXECUTING, InitiativeStatus.CANCELLED],
  [InitiativeStatus.DONE]: [InitiativeStatus.TRACKING],

  // FAZA 4: Benefits
  [InitiativeStatus.TRACKING]: [InitiativeStatus.ARCHIVED],

  // Terminal
  [InitiativeStatus.CANCELLED]: [InitiativeStatus.ARCHIVED],
  [InitiativeStatus.ARCHIVED]: [],
};

/**
 * Module identifiers for routing
 */
export type ModuleId =
  'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits' | 'reporting';

/**
 * Module configuration
 */
export interface ModuleConfig {
  id: ModuleId;
  name: string;
  route: string;
  statuses: InitiativeStatus[];
  color: string;
  betaModuleId?: string;
}

/**
 * Module definitions with their associated statuses
 */
export const MODULES: Record<ModuleId, ModuleConfig> = {
  tools: {
    id: 'tools',
    name: 'Tools',
    route: '/tools',
    statuses: [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW],
    color: 'slate',
  },
  assessment: {
    id: 'assessment',
    name: 'Assessment',
    route: '/assessment',
    statuses: [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW],
    color: 'slate',
  },
  initiatives: {
    id: 'initiatives',
    name: 'Initiatives',
    route: '/initiatives',
    // D1.2: Complete statuses — includes execution/done + archived/cancelled for visibility
    statuses: [
      InitiativeStatus.DRAFT,
      InitiativeStatus.PENDING_REVIEW,
      InitiativeStatus.REVIEW,
      InitiativeStatus.PROMOTED,
      InitiativeStatus.PLANNING,
      InitiativeStatus.APPROVED,
      InitiativeStatus.SCHEDULED,
      InitiativeStatus.EXECUTING,
      InitiativeStatus.BLOCKED,
      InitiativeStatus.DONE,
      InitiativeStatus.TRACKING,
      InitiativeStatus.CANCELLED,
      InitiativeStatus.ARCHIVED,
    ],
    color: 'purple',
  },
  execution: {
    id: 'execution',
    name: 'Execution',
    route: '/execution',
    statuses: [
      InitiativeStatus.SCHEDULED,
      InitiativeStatus.EXECUTING,
      InitiativeStatus.BLOCKED,
      InitiativeStatus.DONE,
    ],
    color: 'cyan',
  },
  benefits: {
    id: 'benefits',
    name: 'Benefits',
    route: '/results',
    statuses: [InitiativeStatus.TRACKING],
    color: 'teal',
    betaModuleId: 'MODULE_BENEFITS',
  },
  reporting: {
    id: 'reporting',
    name: 'Reporting',
    route: '/reports',
    statuses: Object.values(InitiativeStatus),
    color: 'indigo',
  },
};

/**
 * Status metadata for UI display
 */
export interface StatusMeta {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  description: string;
}

export const STATUS_METADATA: Record<InitiativeStatus, StatusMeta> = {
  [InitiativeStatus.DRAFT]: {
    label: 'Draft',
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    dotColor: 'bg-slate-400',
    description: 'Initial draft, needs review',
  },
  [InitiativeStatus.PENDING_REVIEW]: {
    label: 'Pending Review',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    dotColor: 'bg-amber-400',
    description: 'Awaiting PM/Lead review',
  },
  [InitiativeStatus.REVIEW]: {
    label: 'In Review',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    dotColor: 'bg-amber-400',
    description: 'Business review (Go/No-Go)',
  },
  [InitiativeStatus.PROMOTED]: {
    label: 'Promoted',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
    description: 'Accepted for planning',
  },
  [InitiativeStatus.PLANNING]: {
    label: 'Planning',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    dotColor: 'bg-indigo-400',
    description: 'Being planned and scoped',
  },
  [InitiativeStatus.APPROVED]: {
    label: 'Approved',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    dotColor: 'bg-emerald-400',
    description: 'Approved, ready for scheduling',
  },
  [InitiativeStatus.SCHEDULED]: {
    label: 'Scheduled',
    color: 'text-primary-500',
    bgColor: 'bg-primary-500/10',
    dotColor: 'bg-primary-400',
    description: 'Scheduled in roadmap',
  },
  [InitiativeStatus.EXECUTING]: {
    label: 'Executing',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
    description: 'Currently being implemented',
  },
  [InitiativeStatus.BLOCKED]: {
    label: 'Blocked',
    color: 'text-danger-500',
    bgColor: 'bg-danger-500/10',
    dotColor: 'bg-danger-400',
    description: 'Blocked by an issue',
  },
  [InitiativeStatus.DONE]: {
    label: 'Done',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-400',
    description: 'Successfully completed',
  },
  [InitiativeStatus.TRACKING]: {
    label: 'Tracking',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
    description: 'Benefits tracking in progress',
  },
  [InitiativeStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    dotColor: 'bg-gray-400',
    description: 'Initiative was cancelled',
  },
  [InitiativeStatus.ARCHIVED]: {
    label: 'Archived',
    color: 'text-slate-600',
    bgColor: 'bg-slate-400/10',
    dotColor: 'bg-slate-500',
    description: 'Archived for reference',
  },
};

/**
 * Get the module for a given status
 */
export function getModuleForStatus(status: InitiativeStatus): ModuleId {
  // Cancelled is kept historically in Initiatives / Reporting
  if (status === InitiativeStatus.CANCELLED || status === InitiativeStatus.ARCHIVED) {
    return 'initiatives';
  }

  for (const [moduleId, config] of Object.entries(MODULES)) {
    if (config.statuses.includes(status)) {
      return moduleId as ModuleId;
    }
  }
  return 'initiatives'; // Default fallback
}

/**
 * Get the module configuration for a given status
 */
export function getModuleConfigForStatus(status: InitiativeStatus): ModuleConfig {
  const moduleId = getModuleForStatus(status);
  return MODULES[moduleId];
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: InitiativeStatus, to: InitiativeStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next statuses from current status
 */
export function getValidNextStatuses(currentStatus: InitiativeStatus): InitiativeStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if transitioning to a new status will change the module
 */
export function willChangeModule(from: InitiativeStatus, to: InitiativeStatus): boolean {
  return getModuleForStatus(from) !== getModuleForStatus(to);
}

/**
 * Get the target module when transitioning to a new status
 */
export function getTargetModule(to: InitiativeStatus): ModuleConfig {
  return getModuleConfigForStatus(to);
}

/**
 * Get status metadata (with safe fallback for unknown statuses)
 */
const FALLBACK_STATUS_META: StatusMeta = {
  label: 'Unknown',
  color: 'text-slate-500',
  bgColor: 'bg-slate-500/10',
  dotColor: 'bg-slate-400',
  description: 'Unknown status',
};

export function getStatusMeta(status: InitiativeStatus): StatusMeta {
  return STATUS_METADATA[status] ?? FALLBACK_STATUS_META;
}

/**
 * Canonical PL/EN label for an initiative status, shared by every consumer
 * that displays InitiativeStatus (Initiatives, Execution, Results) — CB-06 /
 * RB-035. `STATUS_METADATA[status].label` stays as the English default so
 * existing English-only callers are unaffected; pass a `t()` to localize.
 */
export function getLocalizedStatusLabel(
  status: InitiativeStatus,
  t: (key: string, defaultValue: string) => string
): string {
  const fallback = STATUS_METADATA[status]?.label ?? status;
  return t(`initiativeStatus.${status.toLowerCase()}`, fallback);
}

/**
 * Get all statuses for a module
 */
export function getStatusesForModule(moduleId: ModuleId): InitiativeStatus[] {
  return MODULES[moduleId]?.statuses || [];
}

/**
 * Check if a status belongs to a specific module
 */
export function isStatusInModule(status: InitiativeStatus, moduleId: ModuleId): boolean {
  return MODULES[moduleId]?.statuses.includes(status) ?? false;
}

/**
 * Get the progress percentage through the lifecycle
 * Flow: DRAFT -> REVIEW -> APPROVED -> PLANNING -> EXECUTING -> DONE
 */
export function getLifecycleProgress(status: InitiativeStatus): number {
  const progressMap: Record<InitiativeStatus, number> = {
    [InitiativeStatus.DRAFT]: 5,
    [InitiativeStatus.PENDING_REVIEW]: 10,
    [InitiativeStatus.REVIEW]: 20,
    [InitiativeStatus.PROMOTED]: 30,
    [InitiativeStatus.PLANNING]: 40,
    [InitiativeStatus.APPROVED]: 50,
    [InitiativeStatus.SCHEDULED]: 60,
    [InitiativeStatus.EXECUTING]: 75,
    [InitiativeStatus.BLOCKED]: 70,
    [InitiativeStatus.DONE]: 90,
    [InitiativeStatus.TRACKING]: 100,
    [InitiativeStatus.CANCELLED]: 0,
    [InitiativeStatus.ARCHIVED]: 100,
  };
  return progressMap[status] ?? 0;
}

/**
 * Get the ordered list of statuses in the lifecycle
 * Flow: DRAFT -> REVIEW -> APPROVED -> PLANNING -> EXECUTING -> DONE
 */
export function getLifecycleOrder(): InitiativeStatus[] {
  return [
    InitiativeStatus.DRAFT,
    InitiativeStatus.PENDING_REVIEW,
    InitiativeStatus.REVIEW,
    InitiativeStatus.PROMOTED,
    InitiativeStatus.PLANNING,
    InitiativeStatus.APPROVED,
    InitiativeStatus.SCHEDULED,
    InitiativeStatus.EXECUTING,
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.TRACKING,
    InitiativeStatus.CANCELLED,
    InitiativeStatus.ARCHIVED,
  ];
}

/**
 * Check if an initiative is in a terminal state
 */
export function isTerminalStatus(status: InitiativeStatus): boolean {
  return status === InitiativeStatus.CANCELLED || status === InitiativeStatus.ARCHIVED;
}

/**
 * Check if an initiative is active (not terminal)
 */
export function isActiveStatus(status: InitiativeStatus): boolean {
  return !isTerminalStatus(status);
}

/**
 * Check if an initiative needs attention (blocked or in review)
 */
export function needsAttention(status: InitiativeStatus): boolean {
  return (
    status === InitiativeStatus.BLOCKED ||
    status === InitiativeStatus.PENDING_REVIEW ||
    status === InitiativeStatus.REVIEW
  );
}

/**
 * Get action buttons for a given status
 */
export interface StatusAction {
  label: string;
  labelPl: string;
  targetStatus: InitiativeStatus;
  variant: 'primary' | 'secondary' | 'danger';
  requiresReason?: boolean;
}

/**
 * Get action buttons for a given status
 * Flow: DRAFT -> REVIEW -> APPROVED -> PLANNING -> EXECUTING -> DONE
 */
export function getStatusActions(status: InitiativeStatus): StatusAction[] {
  const actions: StatusAction[] = [];
  const validNext = getValidNextStatuses(status);

  // Primary actions (forward progress) - in workflow order
  // DRAFT -> Submit for Review
  if (validNext.includes(InitiativeStatus.PENDING_REVIEW)) {
    actions.push({
      label: 'Submit for Review',
      labelPl: 'Wyślij do przeglądu',
      targetStatus: InitiativeStatus.PENDING_REVIEW,
      variant: 'primary',
    });
  }
  // PENDING_REVIEW -> Approve to Initiatives
  if (validNext.includes(InitiativeStatus.REVIEW)) {
    actions.push({
      label: 'Approve to Initiatives',
      labelPl: 'Przekaż do inicjatyw',
      targetStatus: InitiativeStatus.REVIEW,
      variant: 'primary',
    });
  }
  // REVIEW -> Accept (Promote)
  if (validNext.includes(InitiativeStatus.PROMOTED)) {
    actions.push({
      label: 'Accept (Promote)',
      labelPl: 'Zaakceptuj (promuj)',
      targetStatus: InitiativeStatus.PROMOTED,
      variant: 'primary',
    });
  }
  // PROMOTED -> Start Planning
  if (validNext.includes(InitiativeStatus.PLANNING)) {
    actions.push({
      label: 'Start Planning',
      labelPl: 'Rozpocznij planowanie',
      targetStatus: InitiativeStatus.PLANNING,
      variant: 'primary',
    });
  }
  // PLANNING -> Approve
  if (validNext.includes(InitiativeStatus.APPROVED)) {
    actions.push({
      label: 'Approve',
      labelPl: 'Zatwierdź',
      targetStatus: InitiativeStatus.APPROVED,
      variant: 'primary',
    });
  }
  // APPROVED -> Schedule
  if (validNext.includes(InitiativeStatus.SCHEDULED)) {
    actions.push({
      label: 'Schedule',
      labelPl: 'Zaplanuj w harmonogramie',
      targetStatus: InitiativeStatus.SCHEDULED,
      variant: 'primary',
    });
  }
  // SCHEDULED -> Start Execution
  if (validNext.includes(InitiativeStatus.EXECUTING)) {
    actions.push({
      label: 'Start Execution',
      labelPl: 'Rozpocznij realizację',
      targetStatus: InitiativeStatus.EXECUTING,
      variant: 'primary',
    });
  }
  // EXECUTING -> Mark Complete
  if (validNext.includes(InitiativeStatus.DONE)) {
    actions.push({
      label: 'Mark Complete',
      labelPl: 'Oznacz jako ukończone',
      targetStatus: InitiativeStatus.DONE,
      variant: 'primary',
    });
  }
  // DONE -> Start Tracking
  if (validNext.includes(InitiativeStatus.TRACKING)) {
    actions.push({
      label: 'Start Tracking',
      labelPl: 'Rozpocznij śledzenie korzyści',
      targetStatus: InitiativeStatus.TRACKING,
      variant: 'primary',
    });
  }
  // TRACKING/CANCELLED -> Archive
  if (validNext.includes(InitiativeStatus.ARCHIVED)) {
    actions.push({
      label: 'Archive',
      labelPl: 'Zarchiwizuj',
      targetStatus: InitiativeStatus.ARCHIVED,
      variant: 'secondary',
    });
  }

  // Secondary actions (backward or alternative)
  // PENDING_REVIEW -> Send Back
  if (status === InitiativeStatus.PENDING_REVIEW && validNext.includes(InitiativeStatus.DRAFT)) {
    actions.push({
      label: 'Send Back',
      labelPl: 'Zwróć do edycji',
      targetStatus: InitiativeStatus.DRAFT,
      variant: 'secondary',
    });
  }
  // REVIEW -> Reject (before generic Return to Draft to maintain order)
  if (status === InitiativeStatus.REVIEW && validNext.includes(InitiativeStatus.DRAFT)) {
    actions.push({
      label: 'Reject',
      labelPl: 'Odrzuć',
      targetStatus: InitiativeStatus.DRAFT,
      variant: 'danger',
      requiresReason: true,
    });
  }
  // Mark as blocked (in EXECUTING)
  if (validNext.includes(InitiativeStatus.BLOCKED)) {
    actions.push({
      label: 'Mark Blocked',
      labelPl: 'Oznacz jako zablokowane',
      targetStatus: InitiativeStatus.BLOCKED,
      variant: 'danger',
      requiresReason: true,
    });
  }
  // BLOCKED -> Unblock (back to executing)
  if (status === InitiativeStatus.BLOCKED && validNext.includes(InitiativeStatus.EXECUTING)) {
    actions.push({
      label: 'Unblock',
      labelPl: 'Odblokuj',
      targetStatus: InitiativeStatus.EXECUTING,
      variant: 'primary',
    });
  }
  // Cancel
  if (validNext.includes(InitiativeStatus.CANCELLED)) {
    actions.push({
      label: 'Cancel',
      labelPl: 'Anuluj',
      targetStatus: InitiativeStatus.CANCELLED,
      variant: 'danger',
      requiresReason: true,
    });
  }

  return actions;
}

/**
 * Context actions (create buttons) available per status.
 * Returns which quick-create actions should be visible in the action bar.
 *
 * Logic:
 * - DRAFT, PROMOTED: task + raid (early planning, no decisions yet)
 * - PLANNING, APPROVED, SCHEDULED, EXECUTING: task + decision + raid (full operational)
 * - BLOCKED: decision + raid (need unblock decision, can log risks)
 * - All others (PENDING_REVIEW, REVIEW, DONE, TRACKING, CANCELLED, ARCHIVED): none
 */
export type ContextActionId = 'task' | 'decision' | 'raid';

export function getContextActions(status: InitiativeStatus): ContextActionId[] {
  switch (status) {
    case InitiativeStatus.DRAFT:
    case InitiativeStatus.PROMOTED:
      return ['task', 'raid'];

    case InitiativeStatus.PLANNING:
    case InitiativeStatus.APPROVED:
    case InitiativeStatus.SCHEDULED:
    case InitiativeStatus.EXECUTING:
      return ['task', 'decision', 'raid'];

    case InitiativeStatus.BLOCKED:
      return ['decision', 'raid'];

    default:
      return [];
  }
}

// ============================================
// GATE ROLE CONSTANTS (mirrored from server/src/constants/initiativeStatuses.ts)
// ============================================

/**
 * Gate types for status transitions
 */
export const GateType = {
  SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW',
  SEND_BACK: 'SEND_BACK',
  APPROVE_TO_INITIATIVE: 'APPROVE_TO_INITIATIVE',
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  START_PLANNING: 'START_PLANNING',
  APPROVE: 'APPROVE',
  SCHEDULE: 'SCHEDULE',
  START: 'START',
  BLOCK: 'BLOCK',
  UNBLOCK: 'UNBLOCK',
  COMPLETE: 'COMPLETE',
  START_TRACKING: 'START_TRACKING',
  CANCEL: 'CANCEL',
} as const;

export type GateTypeValue = (typeof GateType)[keyof typeof GateType];

/**
 * Role identifiers for gate permissions
 */
export const GateRole = {
  ADMIN: 'ADMIN',
  CONSULTANT: 'CONSULTANT',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  PROJECT_LEAD: 'PROJECT_LEAD',
  INITIATIVE_OWNER: 'INITIATIVE_OWNER',
  PROJECT_SPONSOR: 'PROJECT_SPONSOR',
  PMO: 'PMO',
  STEERING_COMMITTEE: 'STEERING_COMMITTEE',
  TEAM_MEMBER: 'TEAM_MEMBER',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
} as const;

export type GateRoleValue = (typeof GateRole)[keyof typeof GateRole];

/**
 * Gate permissions — which roles can execute which gates.
 * Mirrors server-side GATE_PERMISSIONS.
 */
export const GATE_PERMISSIONS: Record<GateTypeValue, GateRoleValue[]> = {
  [GateType.SUBMIT_FOR_REVIEW]: [GateRole.CONSULTANT, GateRole.INITIATIVE_OWNER],
  [GateType.SEND_BACK]: [GateRole.PROJECT_MANAGER, GateRole.PROJECT_LEAD, GateRole.PMO],
  [GateType.APPROVE_TO_INITIATIVE]: [GateRole.PROJECT_MANAGER, GateRole.PROJECT_LEAD, GateRole.PMO],
  [GateType.ACCEPT]: [GateRole.PROJECT_SPONSOR, GateRole.STEERING_COMMITTEE],
  [GateType.REJECT]: [GateRole.PROJECT_SPONSOR, GateRole.STEERING_COMMITTEE],
  [GateType.START_PLANNING]: [GateRole.PMO],
  [GateType.APPROVE]: [GateRole.STEERING_COMMITTEE],
  [GateType.SCHEDULE]: [GateRole.PMO],
  [GateType.START]: [GateRole.PMO],
  [GateType.BLOCK]: [GateRole.INITIATIVE_OWNER, GateRole.PMO],
  [GateType.UNBLOCK]: [GateRole.PROJECT_SPONSOR, GateRole.STEERING_COMMITTEE],
  [GateType.COMPLETE]: [GateRole.INITIATIVE_OWNER, GateRole.PMO],
  [GateType.START_TRACKING]: [GateRole.BUSINESS_OWNER],
  [GateType.CANCEL]: [GateRole.PMO, GateRole.STEERING_COMMITTEE],
};

/**
 * Gate to transition mapping
 */
export const GATE_TRANSITIONS: Record<
  GateTypeValue,
  { from: InitiativeStatus[]; to: InitiativeStatus }
> = {
  [GateType.SUBMIT_FOR_REVIEW]: {
    from: [InitiativeStatus.DRAFT],
    to: InitiativeStatus.PENDING_REVIEW,
  },
  [GateType.SEND_BACK]: { from: [InitiativeStatus.PENDING_REVIEW], to: InitiativeStatus.DRAFT },
  [GateType.APPROVE_TO_INITIATIVE]: {
    from: [InitiativeStatus.PENDING_REVIEW],
    to: InitiativeStatus.REVIEW,
  },
  [GateType.ACCEPT]: { from: [InitiativeStatus.REVIEW], to: InitiativeStatus.PROMOTED },
  [GateType.REJECT]: { from: [InitiativeStatus.REVIEW], to: InitiativeStatus.DRAFT },
  [GateType.START_PLANNING]: { from: [InitiativeStatus.PROMOTED], to: InitiativeStatus.PLANNING },
  [GateType.APPROVE]: { from: [InitiativeStatus.PLANNING], to: InitiativeStatus.APPROVED },
  [GateType.SCHEDULE]: { from: [InitiativeStatus.APPROVED], to: InitiativeStatus.SCHEDULED },
  [GateType.START]: { from: [InitiativeStatus.SCHEDULED], to: InitiativeStatus.EXECUTING },
  [GateType.BLOCK]: { from: [InitiativeStatus.EXECUTING], to: InitiativeStatus.BLOCKED },
  [GateType.UNBLOCK]: { from: [InitiativeStatus.BLOCKED], to: InitiativeStatus.EXECUTING },
  [GateType.COMPLETE]: { from: [InitiativeStatus.EXECUTING], to: InitiativeStatus.DONE },
  [GateType.START_TRACKING]: { from: [InitiativeStatus.DONE], to: InitiativeStatus.TRACKING },
  [GateType.CANCEL]: {
    from: [
      InitiativeStatus.DRAFT,
      InitiativeStatus.PENDING_REVIEW,
      InitiativeStatus.REVIEW,
      InitiativeStatus.PROMOTED,
      InitiativeStatus.PLANNING,
      InitiativeStatus.APPROVED,
      InitiativeStatus.SCHEDULED,
      InitiativeStatus.EXECUTING,
      InitiativeStatus.BLOCKED,
    ],
    to: InitiativeStatus.CANCELLED,
  },
};

/**
 * Get the gate required for a status transition
 */
export function getGateForTransition(
  from: InitiativeStatus,
  to: InitiativeStatus
): GateTypeValue | null {
  for (const [gate, config] of Object.entries(GATE_TRANSITIONS)) {
    if (config.from.includes(from) && config.to === to) {
      return gate as GateTypeValue;
    }
  }
  return null;
}

/**
 * Check if a user with given gate roles can execute a specific gate.
 */
export function canUserExecuteGate(userGateRoles: string[], gate: GateTypeValue): boolean {
  if (userGateRoles.includes('ADMIN') || userGateRoles.includes('SUPERADMIN')) return true;
  const requiredRoles = GATE_PERMISSIONS[gate] || [];
  return requiredRoles.some((role) => userGateRoles.includes(role));
}

/**
 * Filter status actions based on the current user's gate roles.
 * Returns only actions the user is authorized to perform.
 *
 * @param status - Current initiative status
 * @param userGateRoles - Gate roles assigned to the current user on this initiative
 * @returns Filtered StatusAction[] with an additional `gate` and `requiredRoles` field
 */
export function getFilteredStatusActions(
  status: InitiativeStatus,
  userGateRoles: string[]
): (StatusAction & { gate?: GateTypeValue | null; requiredRoles?: string[] })[] {
  const allActions = getStatusActions(status);
  const isAdmin = userGateRoles.includes('ADMIN') || userGateRoles.includes('SUPERADMIN');

  return allActions.map((action) => {
    const gate = getGateForTransition(status, action.targetStatus);
    const requiredRoles = gate ? GATE_PERMISSIONS[gate] || [] : [];
    const canExecute =
      isAdmin || !gate || requiredRoles.some((role) => userGateRoles.includes(role));

    return {
      ...action,
      gate,
      requiredRoles: requiredRoles as string[],
      // Override variant to disable if user can't execute
      variant: canExecute ? action.variant : ('disabled' as any),
    };
  });
}

/**
 * Get the required gate roles for the next transition from a given status.
 * Useful for showing "who needs to approve" in the Gates table.
 */
export function getRequiredRolesForNextGate(
  currentStatus: InitiativeStatus
): { gate: GateTypeValue; requiredRoles: GateRoleValue[]; targetStatus: InitiativeStatus }[] {
  const validNext = getValidNextStatuses(currentStatus);
  const result: {
    gate: GateTypeValue;
    requiredRoles: GateRoleValue[];
    targetStatus: InitiativeStatus;
  }[] = [];

  for (const nextStatus of validNext) {
    const gate = getGateForTransition(currentStatus, nextStatus);
    if (gate) {
      result.push({
        gate,
        requiredRoles: GATE_PERMISSIONS[gate] || [],
        targetStatus: nextStatus,
      });
    }
  }

  return result;
}

export default {
  VALID_TRANSITIONS,
  MODULES,
  STATUS_METADATA,
  GateType,
  GateRole,
  GATE_PERMISSIONS,
  GATE_TRANSITIONS,
  getModuleForStatus,
  getModuleConfigForStatus,
  isValidTransition,
  getValidNextStatuses,
  willChangeModule,
  getTargetModule,
  getStatusMeta,
  getStatusesForModule,
  isStatusInModule,
  getLifecycleProgress,
  getLifecycleOrder,
  isTerminalStatus,
  isActiveStatus,
  needsAttention,
  getStatusActions,
  getFilteredStatusActions,
  getContextActions,
  getGateForTransition,
  canUserExecuteGate,
  getRequiredRolesForNextGate,
};
