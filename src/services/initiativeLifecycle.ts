/**
 * Initiative Lifecycle Service
 *
 * Centralized logic for initiative status transitions and module routing.
 * Implements the status-driven architecture where InitiativeStatus determines
 * which module displays the initiative.
 *
 * Flow: Assessment → Initiatives → Execution → Benefits
 */

import { InitiativeStatus } from '../types';

/**
 * Valid status transitions map
 * Defines which statuses can transition to which other statuses
 */
/**
 * Valid status transitions map
 * 
 * Flow in Initiatives module: REVIEW -> APPROVED -> PLANNING
 * Then: PLANNING -> EXECUTING (moves to Execution module)
 */
export const VALID_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  // DRAFT is created in Tools/Assessment, then submitted for REVIEW
  [InitiativeStatus.DRAFT]: [InitiativeStatus.REVIEW, InitiativeStatus.CANCELLED],
  // REVIEW: awaiting Go/No-Go decision, can be approved or sent back to draft
  [InitiativeStatus.REVIEW]: [
    InitiativeStatus.APPROVED,
    InitiativeStatus.DRAFT,
    InitiativeStatus.CANCELLED,
  ],
  // APPROVED: awaiting Resources Commit and Schedule Lock, then moves to PLANNING
  [InitiativeStatus.APPROVED]: [
    InitiativeStatus.PLANNING,
    InitiativeStatus.REVIEW, // Can be sent back for re-review
    InitiativeStatus.CANCELLED,
  ],
  // PLANNING: detailed planning, then moves to EXECUTING
  [InitiativeStatus.PLANNING]: [InitiativeStatus.EXECUTING, InitiativeStatus.APPROVED],
  [InitiativeStatus.EXECUTING]: [
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.BLOCKED]: [InitiativeStatus.EXECUTING, InitiativeStatus.CANCELLED],
  [InitiativeStatus.DONE]: [InitiativeStatus.ARCHIVED],
  [InitiativeStatus.CANCELLED]: [InitiativeStatus.ARCHIVED],
  [InitiativeStatus.ARCHIVED]: [],
};

/**
 * Module identifiers for routing
 */
export type ModuleId = 'assessment' | 'initiatives' | 'execution' | 'benefits';

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
  assessment: {
    id: 'assessment',
    name: 'Assessment',
    route: '/assessment',
    statuses: [InitiativeStatus.DRAFT],
    color: 'slate',
  },
  initiatives: {
    id: 'initiatives',
    name: 'Initiatives',
    route: '/initiatives',
    statuses: [
      InitiativeStatus.DRAFT,
      InitiativeStatus.PLANNING,
      InitiativeStatus.REVIEW,
      InitiativeStatus.APPROVED,
      InitiativeStatus.EXECUTING,
      InitiativeStatus.BLOCKED,
    ],
    color: 'purple',
  },
  execution: {
    id: 'execution',
    name: 'Execution',
    route: '/execution',
    statuses: [InitiativeStatus.EXECUTING, InitiativeStatus.BLOCKED],
    color: 'cyan',
  },
  benefits: {
    id: 'benefits',
    name: 'Benefits',
    route: '/benefits',
    statuses: [InitiativeStatus.DONE],
    color: 'green',
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
  [InitiativeStatus.PLANNING]: {
    label: 'Planning',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
    description: 'Being planned and scoped',
  },
  [InitiativeStatus.REVIEW]: {
    label: 'In Review',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    dotColor: 'bg-amber-400',
    description: 'Awaiting approval',
  },
  [InitiativeStatus.APPROVED]: {
    label: 'Approved',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    dotColor: 'bg-emerald-400',
    description: 'Approved, ready for execution',
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
    [InitiativeStatus.DRAFT]: 10,
    [InitiativeStatus.REVIEW]: 25,
    [InitiativeStatus.APPROVED]: 40,
    [InitiativeStatus.PLANNING]: 55,
    [InitiativeStatus.EXECUTING]: 70,
    [InitiativeStatus.BLOCKED]: 65, // Same as executing but blocked
    [InitiativeStatus.DONE]: 100,
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
    InitiativeStatus.REVIEW,
    InitiativeStatus.APPROVED,
    InitiativeStatus.PLANNING,
    InitiativeStatus.EXECUTING,
    InitiativeStatus.DONE,
    InitiativeStatus.ARCHIVED,
  ];
}

/**
 * Check if an initiative is in a terminal state
 */
export function isTerminalStatus(status: InitiativeStatus): boolean {
  return status === InitiativeStatus.ARCHIVED || status === InitiativeStatus.CANCELLED;
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
  return status === InitiativeStatus.BLOCKED || status === InitiativeStatus.REVIEW;
}

/**
 * Get action buttons for a given status
 */
export interface StatusAction {
  label: string;
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
  if (validNext.includes(InitiativeStatus.REVIEW)) {
    actions.push({
      label: 'Submit for Review',
      targetStatus: InitiativeStatus.REVIEW,
      variant: 'primary',
    });
  }
  // REVIEW -> Approve (Go/No-Go gate)
  if (validNext.includes(InitiativeStatus.APPROVED)) {
    actions.push({
      label: 'Approve',
      targetStatus: InitiativeStatus.APPROVED,
      variant: 'primary',
    });
  }
  // APPROVED -> Start Planning (Resources Commit + Schedule Lock gates)
  if (validNext.includes(InitiativeStatus.PLANNING)) {
    actions.push({
      label: 'Start Planning',
      targetStatus: InitiativeStatus.PLANNING,
      variant: 'primary',
    });
  }
  // PLANNING -> Start Execution
  if (validNext.includes(InitiativeStatus.EXECUTING)) {
    actions.push({
      label: 'Start Execution',
      targetStatus: InitiativeStatus.EXECUTING,
      variant: 'primary',
    });
  }
  // EXECUTING -> Mark Complete
  if (validNext.includes(InitiativeStatus.DONE)) {
    actions.push({
      label: 'Mark Complete',
      targetStatus: InitiativeStatus.DONE,
      variant: 'primary',
    });
  }
  // DONE/CANCELLED -> Archive
  if (validNext.includes(InitiativeStatus.ARCHIVED)) {
    actions.push({
      label: 'Archive',
      targetStatus: InitiativeStatus.ARCHIVED,
      variant: 'secondary',
    });
  }

  // Secondary actions (backward or alternative)
  // Can return to DRAFT from REVIEW
  if (validNext.includes(InitiativeStatus.DRAFT) && status !== InitiativeStatus.DRAFT) {
    actions.push({
      label: 'Return to Draft',
      targetStatus: InitiativeStatus.DRAFT,
      variant: 'secondary',
    });
  }
  // Can return to REVIEW from APPROVED
  if (validNext.includes(InitiativeStatus.REVIEW) && status === InitiativeStatus.APPROVED) {
    actions.push({
      label: 'Send Back to Review',
      targetStatus: InitiativeStatus.REVIEW,
      variant: 'secondary',
    });
  }
  // Can return to APPROVED from PLANNING
  if (validNext.includes(InitiativeStatus.APPROVED) && status === InitiativeStatus.PLANNING) {
    actions.push({
      label: 'Return to Approved',
      targetStatus: InitiativeStatus.APPROVED,
      variant: 'secondary',
    });
  }
  // Mark as blocked (in EXECUTING)
  if (validNext.includes(InitiativeStatus.BLOCKED)) {
    actions.push({
      label: 'Mark Blocked',
      targetStatus: InitiativeStatus.BLOCKED,
      variant: 'danger',
      requiresReason: true,
    });
  }
  // Cancel
  if (validNext.includes(InitiativeStatus.CANCELLED)) {
    actions.push({
      label: 'Cancel',
      targetStatus: InitiativeStatus.CANCELLED,
      variant: 'danger',
      requiresReason: true,
    });
  }

  return actions;
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
};
