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
  | 'tools'
  | 'assessment'
  | 'initiatives'
  | 'execution'
  | 'benefits'
  | 'reporting';

/**
 * Module configuration
 */
export interface ModuleConfig {
  id: ModuleId;
  name: string;
  route: string;
  statuses: InitiativeStatus[];
  color: string;
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
    route: '/benefits',
    statuses: [InitiativeStatus.TRACKING],
    color: 'teal',
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
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    dotColor: 'bg-orange-400',
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
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    dotColor: 'bg-purple-400',
    description: 'Scheduled in roadmap',
  },
  [InitiativeStatus.EXECUTING]: {
    label: 'Executing',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    dotColor: 'bg-cyan-400',
    description: 'Currently being implemented',
  },
  [InitiativeStatus.BLOCKED]: {
    label: 'Blocked',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    dotColor: 'bg-red-400',
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
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    dotColor: 'bg-teal-400',
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
    color: 'text-slate-400',
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
 * Get status metadata
 */
export function getStatusMeta(status: InitiativeStatus): StatusMeta {
  return STATUS_METADATA[status];
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

export default {
  VALID_TRANSITIONS,
  MODULES,
  STATUS_METADATA,
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
  getContextActions,
};
