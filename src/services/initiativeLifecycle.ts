/**
 * Initiative Lifecycle Service
 * 
 * Centralized logic for initiative status transitions and module routing.
 * Defines valid transitions between states and maps statuses to their owning modules.
 * 
 * Module Flow:
 * Assessment → Initiatives → Execution → Benefits
 */

import { InitiativeStatus } from '../types';

// ============================================
// MODULE DEFINITIONS
// ============================================

export type InitiativeModule = 
  | 'assessment'    // DRAFT status
  | 'initiatives'   // PLANNING, REVIEW, APPROVED
  | 'execution'     // EXECUTING, BLOCKED (active)
  | 'benefits';     // DONE, CANCELLED, ARCHIVED

// ============================================
// VALID STATUS TRANSITIONS
// ============================================

/**
 * Defines all valid transitions from each status.
 * The transition graph enforces the initiative lifecycle.
 */
export const VALID_TRANSITIONS: Record<InitiativeStatus, InitiativeStatus[]> = {
  // Assessment Module
  [InitiativeStatus.DRAFT]: [
    InitiativeStatus.PLANNING,
    InitiativeStatus.CANCELLED,
  ],
  
  // Initiatives Module
  [InitiativeStatus.PLANNING]: [
    InitiativeStatus.REVIEW,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.REVIEW]: [
    InitiativeStatus.APPROVED,
    InitiativeStatus.PLANNING, // Send back for revision
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.APPROVED]: [
    InitiativeStatus.EXECUTING,
    InitiativeStatus.CANCELLED,
  ],
  
  // Execution Module
  [InitiativeStatus.EXECUTING]: [
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.BLOCKED]: [
    InitiativeStatus.EXECUTING, // Unblock
    InitiativeStatus.CANCELLED,
  ],
  
  // Benefits Module (Terminal states)
  [InitiativeStatus.DONE]: [
    InitiativeStatus.ARCHIVED,
  ],
  [InitiativeStatus.CANCELLED]: [
    InitiativeStatus.ARCHIVED,
  ],
  [InitiativeStatus.ARCHIVED]: [], // Terminal - no further transitions
};

// ============================================
// STATUS TO MODULE MAPPING
// ============================================

/**
 * Maps each initiative status to its owning module.
 * Used for navigation and filtering.
 */
export const getModuleForStatus = (status: InitiativeStatus): InitiativeModule => {
  switch (status) {
    case InitiativeStatus.DRAFT:
      return 'assessment';
      
    case InitiativeStatus.PLANNING:
    case InitiativeStatus.REVIEW:
    case InitiativeStatus.APPROVED:
      return 'initiatives';
      
    case InitiativeStatus.EXECUTING:
    case InitiativeStatus.BLOCKED:
      return 'execution';
      
    case InitiativeStatus.DONE:
    case InitiativeStatus.CANCELLED:
    case InitiativeStatus.ARCHIVED:
      return 'benefits';
      
    default:
      return 'assessment';
  }
};

/**
 * Returns all statuses belonging to a specific module.
 */
export const getStatusesForModule = (module: InitiativeModule): InitiativeStatus[] => {
  switch (module) {
    case 'assessment':
      return [InitiativeStatus.DRAFT];
      
    case 'initiatives':
      return [
        InitiativeStatus.PLANNING,
        InitiativeStatus.REVIEW,
        InitiativeStatus.APPROVED,
      ];
      
    case 'execution':
      return [
        InitiativeStatus.EXECUTING,
        InitiativeStatus.BLOCKED,
      ];
      
    case 'benefits':
      return [
        InitiativeStatus.DONE,
        InitiativeStatus.CANCELLED,
        InitiativeStatus.ARCHIVED,
      ];
      
    default:
      return [];
  }
};

// ============================================
// TRANSITION VALIDATION
// ============================================

/**
 * Checks if a status transition is valid.
 */
export const isValidTransition = (
  fromStatus: InitiativeStatus,
  toStatus: InitiativeStatus
): boolean => {
  const validTargets = VALID_TRANSITIONS[fromStatus];
  return validTargets?.includes(toStatus) ?? false;
};

/**
 * Gets all valid transition targets for a given status.
 */
export const getValidTransitions = (status: InitiativeStatus): InitiativeStatus[] => {
  return VALID_TRANSITIONS[status] || [];
};

// ============================================
// STATUS METADATA
// ============================================

export interface StatusMetadata {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  module: InitiativeModule;
  isTerminal: boolean;
  requiresReason: boolean;
  description: string;
}

export const STATUS_METADATA: Record<InitiativeStatus, StatusMetadata> = {
  [InitiativeStatus.DRAFT]: {
    label: 'Draft',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-300 dark:border-slate-600',
    module: 'assessment',
    isTerminal: false,
    requiresReason: false,
    description: 'Initiative is being defined in assessment phase',
  },
  [InitiativeStatus.PLANNING]: {
    label: 'Planning',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    borderColor: 'border-blue-300 dark:border-blue-600',
    module: 'initiatives',
    isTerminal: false,
    requiresReason: false,
    description: 'Initiative is being planned with resources and timeline',
  },
  [InitiativeStatus.REVIEW]: {
    label: 'In Review',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    borderColor: 'border-amber-300 dark:border-amber-600',
    module: 'initiatives',
    isTerminal: false,
    requiresReason: false,
    description: 'Initiative is pending approval from stakeholders',
  },
  [InitiativeStatus.APPROVED]: {
    label: 'Approved',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    borderColor: 'border-emerald-300 dark:border-emerald-600',
    module: 'initiatives',
    isTerminal: false,
    requiresReason: false,
    description: 'Initiative is approved and ready for execution',
  },
  [InitiativeStatus.EXECUTING]: {
    label: 'Executing',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    borderColor: 'border-cyan-300 dark:border-cyan-600',
    module: 'execution',
    isTerminal: false,
    requiresReason: false,
    description: 'Initiative is actively being implemented',
  },
  [InitiativeStatus.BLOCKED]: {
    label: 'Blocked',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    borderColor: 'border-red-300 dark:border-red-600',
    module: 'execution',
    isTerminal: false,
    requiresReason: true,
    description: 'Initiative is blocked by an issue or dependency',
  },
  [InitiativeStatus.DONE]: {
    label: 'Done',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    borderColor: 'border-green-300 dark:border-green-600',
    module: 'benefits',
    isTerminal: false,
    requiresReason: false,
    description: 'Initiative has been completed successfully',
  },
  [InitiativeStatus.CANCELLED]: {
    label: 'Cancelled',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    borderColor: 'border-gray-300 dark:border-gray-600',
    module: 'benefits',
    isTerminal: false,
    requiresReason: true,
    description: 'Initiative was cancelled before completion',
  },
  [InitiativeStatus.ARCHIVED]: {
    label: 'Archived',
    color: 'text-slate-500 dark:text-slate-500',
    bgColor: 'bg-slate-50 dark:bg-slate-900',
    borderColor: 'border-slate-200 dark:border-slate-700',
    module: 'benefits',
    isTerminal: true,
    requiresReason: false,
    description: 'Initiative has been archived for historical reference',
  },
};

// ============================================
// NAVIGATION HELPERS
// ============================================

import { AppView } from '../types';

/**
 * Gets the AppView route for a given module.
 */
export const getRouteForModule = (module: InitiativeModule): AppView => {
  switch (module) {
    case 'assessment':
      return AppView.ASSESSMENT_OVERVIEW;
    case 'initiatives':
      return AppView.FULL_STEP2_INITIATIVES;
    case 'execution':
      return AppView.FULL_STEP5_EXECUTION;
    case 'benefits':
      return AppView.BENEFITS_REALIZATION;
    default:
      return AppView.FULL_STEP2_INITIATIVES;
  }
};

/**
 * Gets navigation info when an initiative changes status.
 * Returns the target module and route if the initiative should move to a different module.
 */
export const getNavigationOnStatusChange = (
  oldStatus: InitiativeStatus,
  newStatus: InitiativeStatus
): { shouldNavigate: boolean; targetModule: InitiativeModule; targetRoute: AppView } | null => {
  const oldModule = getModuleForStatus(oldStatus);
  const newModule = getModuleForStatus(newStatus);
  
  if (oldModule !== newModule) {
    return {
      shouldNavigate: true,
      targetModule: newModule,
      targetRoute: getRouteForModule(newModule),
    };
  }
  
  return null;
};

// ============================================
// TRANSITION ACTIONS
// ============================================

export interface TransitionAction {
  fromStatus: InitiativeStatus;
  toStatus: InitiativeStatus;
  label: string;
  icon?: string;
  variant: 'primary' | 'secondary' | 'danger' | 'warning';
  requiresConfirmation: boolean;
  confirmationMessage?: string;
}

/**
 * Gets available transition actions for a given status.
 * These are user-friendly action buttons for status changes.
 */
export const getTransitionActions = (status: InitiativeStatus): TransitionAction[] => {
  const validTransitions = getValidTransitions(status);
  
  return validTransitions.map((toStatus): TransitionAction => {
    const metadata = STATUS_METADATA[toStatus];
    
    // Define action specifics based on transition
    const isCancel = toStatus === InitiativeStatus.CANCELLED;
    const isBlock = toStatus === InitiativeStatus.BLOCKED;
    const isComplete = toStatus === InitiativeStatus.DONE;
    const isUnblock = status === InitiativeStatus.BLOCKED && toStatus === InitiativeStatus.EXECUTING;
    const isApprove = toStatus === InitiativeStatus.APPROVED;
    const isStart = toStatus === InitiativeStatus.EXECUTING;
    
    let label = `Move to ${metadata.label}`;
    let variant: TransitionAction['variant'] = 'secondary';
    let requiresConfirmation = metadata.requiresReason;
    let confirmationMessage: string | undefined;
    
    if (isCancel) {
      label = 'Cancel Initiative';
      variant = 'danger';
      requiresConfirmation = true;
      confirmationMessage = 'Are you sure you want to cancel this initiative? This action cannot be undone.';
    } else if (isBlock) {
      label = 'Mark as Blocked';
      variant = 'warning';
      requiresConfirmation = true;
      confirmationMessage = 'Please provide a reason for blocking this initiative.';
    } else if (isComplete) {
      label = 'Mark Complete';
      variant = 'primary';
      requiresConfirmation = true;
      confirmationMessage = 'Mark this initiative as complete? Benefits tracking will begin.';
    } else if (isUnblock) {
      label = 'Unblock';
      variant = 'primary';
    } else if (isApprove) {
      label = 'Approve';
      variant = 'primary';
    } else if (isStart) {
      label = 'Start Execution';
      variant = 'primary';
    }
    
    return {
      fromStatus: status,
      toStatus,
      label,
      variant,
      requiresConfirmation,
      confirmationMessage,
    };
  });
};

// ============================================
// LIFECYCLE PROGRESS
// ============================================

/**
 * Calculates the lifecycle progress percentage for an initiative.
 * Used for progress indicators across modules.
 */
export const getLifecycleProgress = (status: InitiativeStatus): number => {
  const progressMap: Record<InitiativeStatus, number> = {
    [InitiativeStatus.DRAFT]: 10,
    [InitiativeStatus.PLANNING]: 25,
    [InitiativeStatus.REVIEW]: 40,
    [InitiativeStatus.APPROVED]: 50,
    [InitiativeStatus.EXECUTING]: 70,
    [InitiativeStatus.BLOCKED]: 70, // Same as executing
    [InitiativeStatus.DONE]: 100,
    [InitiativeStatus.CANCELLED]: 0,
    [InitiativeStatus.ARCHIVED]: 100,
  };
  
  return progressMap[status] ?? 0;
};

/**
 * Gets the lifecycle stage name (for display purposes).
 */
export const getLifecycleStage = (status: InitiativeStatus): string => {
  const module = getModuleForStatus(status);
  const stages: Record<InitiativeModule, string> = {
    assessment: 'Discovery & Assessment',
    initiatives: 'Planning & Approval',
    execution: 'Implementation',
    benefits: 'Benefits Realization',
  };
  return stages[module];
};
