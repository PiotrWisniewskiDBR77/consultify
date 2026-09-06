// PMO Status State Machine - Validates status transitions
// Step 3: PMO Objects, Statuses & Stage Gates
// Updated 2026-09-06 (DEC-424 / P12): słownik inicjatywy = 7 statusów kanonicznych.
// Graf przejść i reguły merytoryczne inicjatywy mieszkają WYŁĄCZNIE w
// ../constants/initiativeStatuses.ts. Ten moduł jest cienkim adapterem dla
// zastanych wołaczy (walidatory, middleware PMO) — nie jest drugim silnikiem.
// Wejścia w starym słowniku 13 (EXECUTING/BLOCKED/DONE/…) są normalizowane
// przez `normalizeInitiativeStatus` (granica zgodności danych zastanych).

import {
  getModuleForStatus as getModule,
  InitiativeStatus,
  normalizeInitiativeStatus,
  VALID_TRANSITIONS,
  type InitiativeStatusType,
} from '../constants/initiativeStatuses.js';

// Re-export for backward compatibility
export const INITIATIVE_STATUSES = InitiativeStatus;

export const TASK_STATUSES = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',
} as const;

export const DECISION_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const EXECUTION_STAGES = {
  KICKOFF: 'KICKOFF',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW: 'REVIEW',
  DELIVERY: 'DELIVERY',
} as const;

type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];
type ExecutionStage = (typeof EXECUTION_STAGES)[keyof typeof EXECUTION_STAGES];

type InitiativeContext = {
  /** Powód wymagany przy przejściu do REJECTED (warunek REASON_REQUIRED). */
  reason?: string;
  blockedReason?: string;
  pendingTasks?: number;
  hasBlockingDecisions?: boolean;
  requiresApproval?: boolean;
  isApproved?: boolean;
  pendingReviews?: number;
};

type TaskContext = {
  blockedReason?: string;
  blockerType?: string;
};

type StageContext = {
  pendingReviews?: number;
};

const EXECUTION_STAGE_TRANSITIONS: Record<ExecutionStage, ExecutionStage[]> = {
  [EXECUTION_STAGES.KICKOFF]: [EXECUTION_STAGES.IN_PROGRESS],
  [EXECUTION_STAGES.IN_PROGRESS]: [EXECUTION_STAGES.REVIEW, EXECUTION_STAGES.KICKOFF],
  [EXECUTION_STAGES.REVIEW]: [EXECUTION_STAGES.IN_PROGRESS, EXECUTION_STAGES.DELIVERY],
  [EXECUTION_STAGES.DELIVERY]: [EXECUTION_STAGES.REVIEW],
};

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TASK_STATUSES.TODO]: [TASK_STATUSES.IN_PROGRESS, TASK_STATUSES.BLOCKED],
  [TASK_STATUSES.IN_PROGRESS]: [TASK_STATUSES.BLOCKED, TASK_STATUSES.DONE, TASK_STATUSES.TODO],
  [TASK_STATUSES.BLOCKED]: [TASK_STATUSES.TODO, TASK_STATUSES.IN_PROGRESS],
  [TASK_STATUSES.DONE]: [TASK_STATUSES.IN_PROGRESS],
};

/** Etykiety wyświetlane dla 7 statusów kanonicznych (i18n key: STATUS_METADATA). */
const INITIATIVE_STATUS_LABELS: Record<InitiativeStatusType, string> = {
  [InitiativeStatus.PROPOSED]: 'Proposed',
  [InitiativeStatus.DRAFT]: 'Draft',
  [InitiativeStatus.PENDING_APPROVAL]: 'Pending Approval',
  [InitiativeStatus.APPROVED]: 'Approved',
  [InitiativeStatus.IN_EXECUTION]: 'In Execution',
  [InitiativeStatus.CLOSED]: 'Closed',
  [InitiativeStatus.REJECTED]: 'Rejected',
};

const nonEmpty = (value: unknown): boolean => String(value ?? '').trim().length > 0;

const StatusMachine = {
  INITIATIVE_STATUSES,
  TASK_STATUSES,
  DECISION_STATUSES,
  EXECUTION_STAGES,

  canTransitionInitiative: (from: string, to: string): boolean => {
    const fromStatus = normalizeInitiativeStatus(from);
    const toStatus = normalizeInitiativeStatus(to);
    if (!fromStatus || !toStatus) return false;
    return VALID_TRANSITIONS[fromStatus].includes(toStatus);
  },

  canTransitionTask: (from: string, to: string): boolean => {
    const allowed = TASK_TRANSITIONS[from as TaskStatus] || [];
    return allowed.includes(to as TaskStatus);
  },

  validateInitiativeTransition: (
    from: string,
    to: string,
    context: InitiativeContext = {}
  ): { valid: boolean; reason?: string } => {
    if (!StatusMachine.canTransitionInitiative(from, to)) {
      return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
    }

    const fromStatus = normalizeInitiativeStatus(from) as InitiativeStatusType;
    const toStatus = normalizeInitiativeStatus(to) as InitiativeStatusType;

    // REASON_REQUIRED — każde wejście w REJECTED wymaga uzasadnienia.
    if (toStatus === InitiativeStatus.REJECTED && !nonEmpty(context.reason ?? context.blockedReason)) {
      return { valid: false, reason: 'Rejection requires a reason' };
    }

    // NO_OPEN_WORK — zamknięcie inicjatywy.
    if (toStatus === InitiativeStatus.CLOSED) {
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

    // Bramka zatwierdzenia (CURRENT_GO_DECISION po stronie silnika kanonicznego).
    if (
      fromStatus === InitiativeStatus.PENDING_APPROVAL &&
      toStatus === InitiativeStatus.APPROVED
    ) {
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

    return { valid: true };
  },

  validateTaskTransition: (
    from: string,
    to: string,
    context: TaskContext = {}
  ): { valid: boolean; reason?: string } => {
    if (!StatusMachine.canTransitionTask(from, to)) {
      return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
    }

    if (to === TASK_STATUSES.BLOCKED) {
      if (!context.blockedReason) {
        return { valid: false, reason: 'Blocked status requires a reason' };
      }
      if (!context.blockerType) {
        return { valid: false, reason: 'Blocked status requires a blocker type' };
      }
    }

    return { valid: true };
  },

  getAllowedInitiativeTransitions: (currentStatus: string): InitiativeStatusType[] => {
    const status = normalizeInitiativeStatus(currentStatus);
    return status ? [...VALID_TRANSITIONS[status]] : [];
  },

  getAllowedTaskTransitions: (currentStatus: string): TaskStatus[] => {
    return TASK_TRANSITIONS[currentStatus as TaskStatus] || [];
  },

  canTransitionExecutionStage: (from: string, to: string): boolean => {
    const allowed = EXECUTION_STAGE_TRANSITIONS[from as ExecutionStage] || [];
    return allowed.includes(to as ExecutionStage);
  },

  getAllowedStageTransitions: (currentStage: string): ExecutionStage[] => {
    return EXECUTION_STAGE_TRANSITIONS[currentStage as ExecutionStage] || [];
  },

  validateStageTransition: (
    from: string,
    to: string,
    context: StageContext = {}
  ): { valid: boolean; reason?: string } => {
    if (!StatusMachine.canTransitionExecutionStage(from, to)) {
      return { valid: false, reason: `Cannot transition stage from ${from} to ${to}` };
    }

    if (to === EXECUTION_STAGES.DELIVERY) {
      if (context.pendingReviews && context.pendingReviews > 0) {
        return {
          valid: false,
          reason: `Cannot deliver: ${context.pendingReviews} reviews still pending`,
        };
      }
    }

    return { valid: true };
  },

  getStageLabel: (stage: string): string => {
    const labels: Record<ExecutionStage, string> = {
      [EXECUTION_STAGES.KICKOFF]: 'Kickoff',
      [EXECUTION_STAGES.IN_PROGRESS]: 'In Progress',
      [EXECUTION_STAGES.REVIEW]: 'Review',
      [EXECUTION_STAGES.DELIVERY]: 'Delivery',
    };
    return labels[stage as ExecutionStage] || stage;
  },

  getInitiativeModule: (
    status: string
  ): 'ASSESSMENT' | 'INITIATIVE_MANAGEMENT' | 'EXECUTION' | 'BENEFITS' | 'UNKNOWN' => {
    const normalized = normalizeInitiativeStatus(status);
    if (!normalized) return 'UNKNOWN';
    // Map canonical module ids to legacy labels used by this service.
    switch (getModule(normalized)) {
      case 'tools':
      case 'assessment':
        return 'ASSESSMENT';
      case 'initiatives':
      case 'reporting':
        return 'INITIATIVE_MANAGEMENT';
      case 'execution':
        return 'EXECUTION';
      case 'benefits':
        return 'BENEFITS';
      default:
        return 'UNKNOWN';
    }
  },

  isModuleTransition: (
    from: string,
    to: string
  ): { crossesModule: boolean; fromModule: string; toModule: string } => {
    const fromModule = StatusMachine.getInitiativeModule(from);
    const toModule = StatusMachine.getInitiativeModule(to);
    return {
      crossesModule: fromModule !== toModule,
      fromModule,
      toModule,
    };
  },

  getStatusLabel: (status: string): string => {
    const normalized = normalizeInitiativeStatus(status);
    return normalized ? INITIATIVE_STATUS_LABELS[normalized] : status;
  },
};

export default StatusMachine;
