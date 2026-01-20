/**
 * Initiative Statuses - Central Source of Truth
 *
 * This file defines all initiative statuses, their transitions, module mappings,
 * and visibility rules for the entire system.
 *
 * Flow: Interview -> Tools/Assessment -> Initiatives -> Execution -> Benefits
 *
 * Status-Module Visibility:
 * | Module          | Visible Statuses                    |
 * |-----------------|-------------------------------------|
 * | Tools           | DRAFT (own)                         |
 * | Assessment      | DRAFT (own)                         |
 * | Initiatives     | REVIEW, APPROVED, PLANNING          |
 * | Execution       | EXECUTING, BLOCKED, DONE, CANCELLED |
 * | Benefits        | DONE                                |
 *
 * @module constants/initiativeStatuses
 */

// ============================================
// INITIATIVE STATUS ENUM
// ============================================

/**
 * Initiative Status Enum - Canonical Status Values
 * Used across the entire application (frontend and backend)
 */
export const InitiativeStatus = {
  // Assessment Module (Module 2) - Draft phase
  DRAFT: 'DRAFT',

  // Initiative Management Module (Module 3) - Planning phase
  PLANNING: 'PLANNING',
  REVIEW: 'REVIEW',
  APPROVED: 'APPROVED',

  // Execution Module (Module 4/5) - Active work
  EXECUTING: 'EXECUTING',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',

  // Terminal States
  CANCELLED: 'CANCELLED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type InitiativeStatusType = (typeof InitiativeStatus)[keyof typeof InitiativeStatus];

// ============================================
// MODULE DEFINITIONS
// ============================================

/**
 * Module identifiers for routing
 */
export type ModuleId = 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits';

/**
 * Module configuration interface
 */
export interface ModuleConfig {
  id: ModuleId;
  name: string;
  route: string;
  statuses: InitiativeStatusType[];
  color: string;
  description: string;
}

/**
 * Module definitions with their associated statuses
 */
export const MODULES: Record<ModuleId, ModuleConfig> = {
  tools: {
    id: 'tools',
    name: 'Tools',
    route: '/tools',
    statuses: [InitiativeStatus.DRAFT],
    color: 'slate',
    description: 'Discovery tools generating draft initiatives',
  },
  assessment: {
    id: 'assessment',
    name: 'Assessment',
    route: '/assessment',
    statuses: [InitiativeStatus.DRAFT],
    color: 'slate',
    description: 'Assessment module generating draft initiatives',
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
    description: 'Initiative management and planning',
  },
  execution: {
    id: 'execution',
    name: 'Execution',
    route: '/execution',
    statuses: [
      InitiativeStatus.EXECUTING,
      InitiativeStatus.BLOCKED,
      InitiativeStatus.DONE,
      InitiativeStatus.CANCELLED,
    ],
    color: 'cyan',
    description: 'Execution center for active initiatives',
  },
  benefits: {
    id: 'benefits',
    name: 'Benefits',
    route: '/benefits',
    statuses: [InitiativeStatus.DONE],
    color: 'green',
    description: 'Benefits tracking for completed initiatives',
  },
};

// ============================================
// STATUS TRANSITIONS
// ============================================

/**
 * Valid status transitions map
 * Defines which statuses can transition to which other statuses
 */
export const VALID_TRANSITIONS: Record<InitiativeStatusType, InitiativeStatusType[]> = {
  [InitiativeStatus.DRAFT]: [InitiativeStatus.PLANNING, InitiativeStatus.CANCELLED],
  [InitiativeStatus.PLANNING]: [
    InitiativeStatus.REVIEW,
    InitiativeStatus.DRAFT,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.REVIEW]: [
    InitiativeStatus.APPROVED,
    InitiativeStatus.PLANNING,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.APPROVED]: [
    InitiativeStatus.EXECUTING,
    InitiativeStatus.PLANNING,
    InitiativeStatus.CANCELLED,
  ],
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

// ============================================
// STATUS METADATA
// ============================================

/**
 * Status metadata for UI display
 */
export interface StatusMeta {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  description: string;
  icon?: string;
}

export const STATUS_METADATA: Record<InitiativeStatusType, StatusMeta> = {
  [InitiativeStatus.DRAFT]: {
    label: 'Draft',
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    dotColor: 'bg-slate-400',
    description: 'Initial draft, needs review',
    icon: 'FileText',
  },
  [InitiativeStatus.PLANNING]: {
    label: 'Planning',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
    description: 'Being planned and scoped',
    icon: 'ClipboardList',
  },
  [InitiativeStatus.REVIEW]: {
    label: 'In Review',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    dotColor: 'bg-amber-400',
    description: 'Awaiting approval',
    icon: 'Eye',
  },
  [InitiativeStatus.APPROVED]: {
    label: 'Approved',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    dotColor: 'bg-emerald-400',
    description: 'Approved, ready for execution',
    icon: 'CheckCircle',
  },
  [InitiativeStatus.EXECUTING]: {
    label: 'Executing',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    dotColor: 'bg-cyan-400',
    description: 'Currently being implemented',
    icon: 'Play',
  },
  [InitiativeStatus.BLOCKED]: {
    label: 'Blocked',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    dotColor: 'bg-red-400',
    description: 'Blocked by an issue',
    icon: 'AlertTriangle',
  },
  [InitiativeStatus.DONE]: {
    label: 'Done',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-400',
    description: 'Successfully completed',
    icon: 'CheckCircle2',
  },
  [InitiativeStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    dotColor: 'bg-gray-400',
    description: 'Initiative was cancelled',
    icon: 'XCircle',
  },
  [InitiativeStatus.ARCHIVED]: {
    label: 'Archived',
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    dotColor: 'bg-slate-500',
    description: 'Archived for reference',
    icon: 'Archive',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the module for a given status
 */
export function getModuleForStatus(status: InitiativeStatusType): ModuleId {
  // Handle ARCHIVED and CANCELLED as historical in initiatives
  if (status === InitiativeStatus.ARCHIVED || status === InitiativeStatus.CANCELLED) {
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
export function getModuleConfigForStatus(status: InitiativeStatusType): ModuleConfig {
  const moduleId = getModuleForStatus(status);
  return MODULES[moduleId];
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  from: InitiativeStatusType,
  to: InitiativeStatusType
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next statuses from current status
 */
export function getValidNextStatuses(
  currentStatus: InitiativeStatusType
): InitiativeStatusType[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if transitioning to a new status will change the module
 */
export function willChangeModule(
  from: InitiativeStatusType,
  to: InitiativeStatusType
): boolean {
  return getModuleForStatus(from) !== getModuleForStatus(to);
}

/**
 * Get all statuses for a module
 */
export function getStatusesForModule(moduleId: ModuleId): InitiativeStatusType[] {
  return MODULES[moduleId]?.statuses || [];
}

/**
 * Check if a status belongs to a specific module
 */
export function isStatusInModule(status: InitiativeStatusType, moduleId: ModuleId): boolean {
  return MODULES[moduleId]?.statuses.includes(status) ?? false;
}

/**
 * Get the progress percentage through the lifecycle
 */
export function getLifecycleProgress(status: InitiativeStatusType): number {
  const progressMap: Record<InitiativeStatusType, number> = {
    [InitiativeStatus.DRAFT]: 10,
    [InitiativeStatus.PLANNING]: 25,
    [InitiativeStatus.REVIEW]: 40,
    [InitiativeStatus.APPROVED]: 50,
    [InitiativeStatus.EXECUTING]: 70,
    [InitiativeStatus.BLOCKED]: 60,
    [InitiativeStatus.DONE]: 100,
    [InitiativeStatus.CANCELLED]: 0,
    [InitiativeStatus.ARCHIVED]: 100,
  };
  return progressMap[status] ?? 0;
}

/**
 * Check if an initiative is in a terminal state
 */
export function isTerminalStatus(status: InitiativeStatusType): boolean {
  return status === InitiativeStatus.ARCHIVED || status === InitiativeStatus.CANCELLED;
}

/**
 * Check if an initiative is active (not terminal)
 */
export function isActiveStatus(status: InitiativeStatusType): boolean {
  return !isTerminalStatus(status);
}

/**
 * Check if an initiative needs attention (blocked or in review)
 */
export function needsAttention(status: InitiativeStatusType): boolean {
  return status === InitiativeStatus.BLOCKED || status === InitiativeStatus.REVIEW;
}

/**
 * Validate transition with context and return result
 */
export interface TransitionValidationContext {
  blockedReason?: string;
  pendingTasks?: number;
  hasBlockingDecisions?: boolean;
  charterCompleteness?: number;
  requiresApproval?: boolean;
  isApproved?: boolean;
  pendingReviews?: number;
  requiresScheduling?: boolean;
  isScheduled?: boolean;
}

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateTransition(
  from: InitiativeStatusType,
  to: InitiativeStatusType,
  context: TransitionValidationContext = {}
): TransitionValidationResult {
  // Check if transition is allowed
  if (!isValidTransition(from, to)) {
    return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
  }

  // BLOCKED status requires a reason
  if (to === InitiativeStatus.BLOCKED && !context.blockedReason) {
    return { valid: false, reason: 'Blocked status requires a reason' };
  }

  // DONE status validation
  if (to === InitiativeStatus.DONE) {
    if (context.pendingTasks && context.pendingTasks > 0) {
      return {
        valid: false,
        reason: `Cannot complete: ${context.pendingTasks} tasks still pending`,
      };
    }
    if (context.hasBlockingDecisions) {
      return { valid: false, reason: 'Cannot complete: Open blocking decisions exist' };
    }
  }

  // PLANNING -> REVIEW requires charter completeness
  if (from === InitiativeStatus.PLANNING && to === InitiativeStatus.REVIEW) {
    if (context.charterCompleteness !== undefined && context.charterCompleteness < 60) {
      return {
        valid: false,
        reason: `Charter completeness too low (${context.charterCompleteness}%). Minimum 60% required.`,
      };
    }
  }

  // REVIEW -> APPROVED requires approval
  if (from === InitiativeStatus.REVIEW && to === InitiativeStatus.APPROVED) {
    if (context.requiresApproval && !context.isApproved) {
      return { valid: false, reason: 'Governance approval required for this transition' };
    }
    if (context.pendingReviews && context.pendingReviews > 0) {
      return {
        valid: false,
        reason: `Cannot approve: ${context.pendingReviews} reviews still pending`,
      };
    }
  }

  // APPROVED -> EXECUTING requires scheduling
  if (from === InitiativeStatus.APPROVED && to === InitiativeStatus.EXECUTING) {
    if (context.requiresScheduling && !context.isScheduled) {
      return {
        valid: false,
        reason: 'Initiative must be scheduled in roadmap before execution',
      };
    }
  }

  return { valid: true };
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: InitiativeStatusType): string {
  return STATUS_METADATA[status]?.label || status;
}

/**
 * Get the ordered list of statuses in the lifecycle
 */
export function getLifecycleOrder(): InitiativeStatusType[] {
  return [
    InitiativeStatus.DRAFT,
    InitiativeStatus.PLANNING,
    InitiativeStatus.REVIEW,
    InitiativeStatus.APPROVED,
    InitiativeStatus.EXECUTING,
    InitiativeStatus.DONE,
    InitiativeStatus.ARCHIVED,
  ];
}

// ============================================
// MODULE VISIBILITY HELPERS
// ============================================

/**
 * Get statuses visible in Tools module
 * Only shows DRAFT initiatives created by tools
 */
export function getToolsVisibleStatuses(): InitiativeStatusType[] {
  return [InitiativeStatus.DRAFT];
}

/**
 * Get statuses visible in Assessment module
 * Only shows DRAFT initiatives created by assessments
 */
export function getAssessmentVisibleStatuses(): InitiativeStatusType[] {
  return [InitiativeStatus.DRAFT];
}

/**
 * Get statuses visible in Initiatives module
 * Shows PLANNING, REVIEW, APPROVED (plus historical CANCELLED, ARCHIVED)
 */
export function getInitiativesVisibleStatuses(): InitiativeStatusType[] {
  return [
    InitiativeStatus.PLANNING,
    InitiativeStatus.REVIEW,
    InitiativeStatus.APPROVED,
    InitiativeStatus.CANCELLED,
    InitiativeStatus.ARCHIVED,
  ];
}

/**
 * Get statuses visible in Execution module
 * Shows EXECUTING, BLOCKED, DONE, CANCELLED
 */
export function getExecutionVisibleStatuses(): InitiativeStatusType[] {
  return [
    InitiativeStatus.EXECUTING,
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.CANCELLED,
  ];
}

/**
 * Get statuses visible in Benefits module
 * Shows DONE initiatives for benefits tracking
 */
export function getBenefitsVisibleStatuses(): InitiativeStatusType[] {
  return [InitiativeStatus.DONE];
}

/**
 * Build SQL WHERE clause for status filtering by module
 */
export function buildStatusFilterSQL(
  moduleId: ModuleId,
  statusColumn: string = 'status'
): { clause: string; params: string[] } {
  let statuses: InitiativeStatusType[];

  switch (moduleId) {
    case 'tools':
      statuses = getToolsVisibleStatuses();
      break;
    case 'assessment':
      statuses = getAssessmentVisibleStatuses();
      break;
    case 'initiatives':
      statuses = getInitiativesVisibleStatuses();
      break;
    case 'execution':
      statuses = getExecutionVisibleStatuses();
      break;
    case 'benefits':
      statuses = getBenefitsVisibleStatuses();
      break;
    default:
      statuses = Object.values(InitiativeStatus);
  }

  const placeholders = statuses.map(() => '?').join(', ');
  return {
    clause: `UPPER(${statusColumn}) IN (${placeholders})`,
    params: statuses,
  };
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  InitiativeStatus,
  MODULES,
  VALID_TRANSITIONS,
  STATUS_METADATA,
  getModuleForStatus,
  getModuleConfigForStatus,
  isValidTransition,
  getValidNextStatuses,
  willChangeModule,
  getStatusesForModule,
  isStatusInModule,
  getLifecycleProgress,
  isTerminalStatus,
  isActiveStatus,
  needsAttention,
  validateTransition,
  getStatusLabel,
  getLifecycleOrder,
  getToolsVisibleStatuses,
  getAssessmentVisibleStatuses,
  getInitiativesVisibleStatuses,
  getExecutionVisibleStatuses,
  getBenefitsVisibleStatuses,
  buildStatusFilterSQL,
};
