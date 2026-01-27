/**
 * Initiative Types - Frontend (Canonical)
 *
 * Central definitions for initiative statuses, roles, gate decisions, and lifecycle.
 * Re-exports from core.ts for backward compatibility.
 *
 * Documentation: wdrozenia/standards/03-STATUS-WORKFLOW.md
 *
 * Lifecycle Flow (11 statuses):
 * DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
 *                                                        ↓
 *                                                    BLOCKED
 *
 * Status-Module Visibility:
 * | Module          | Visible Statuses                                    |
 * |-----------------|-----------------------------------------------------|
 * | Tools           | DRAFT (own)                                         |
 * | Assessment      | DRAFT (own)                                         |
 * | Initiatives     | REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED     |
 * | Execution       | SCHEDULED, EXECUTING, BLOCKED, DONE                 |
 * | Benefits        | TRACKING                                            |
 *
 * @module types/initiative
 */

// Re-export InitiativeStatus from core.ts
export { InitiativeStatus } from './core';

// Re-export lifecycle utilities
export {
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
} from '../services/initiativeLifecycle';

// Re-export types from core
export type { PortfolioInitiative, PortfolioFilters, PortfolioStats } from './core';

// ============================================
// ROLE DEFINITIONS
// ============================================

/**
 * Role identifiers for gate permissions
 * Key rule: CONSULTANT can NEVER execute any gate
 */
export enum Role {
  ADMIN = 'ADMIN',
  CONSULTANT = 'CONSULTANT',
  INITIATIVE_OWNER = 'INITIATIVE_OWNER',
  PROJECT_SPONSOR = 'PROJECT_SPONSOR',
  PMO = 'PMO',
  STEERING_COMMITTEE = 'STEERING_COMMITTEE',
  TEAM_MEMBER = 'TEAM_MEMBER',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
}

// ============================================
// GATE DEFINITIONS
// ============================================

/**
 * Gate decision types for status transitions
 */
export enum GateType {
  PROMOTE = 'PROMOTE',
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  START_PLANNING = 'START_PLANNING',
  APPROVE = 'APPROVE',
  SCHEDULE = 'SCHEDULE',
  START = 'START',
  BLOCK = 'BLOCK',
  UNBLOCK = 'UNBLOCK',
  COMPLETE = 'COMPLETE',
  START_TRACKING = 'START_TRACKING',
  CANCEL = 'CANCEL',
}

/**
 * Gate permissions - which roles can execute which gates
 */
export const GATE_PERMISSIONS: Record<GateType, Role[]> = {
  [GateType.PROMOTE]: [Role.PROJECT_SPONSOR],
  [GateType.ACCEPT]: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE],
  [GateType.REJECT]: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE],
  [GateType.START_PLANNING]: [Role.PMO],
  [GateType.APPROVE]: [Role.STEERING_COMMITTEE],
  [GateType.SCHEDULE]: [Role.PMO],
  [GateType.START]: [Role.PMO],
  [GateType.BLOCK]: [Role.INITIATIVE_OWNER, Role.PMO],
  [GateType.UNBLOCK]: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE],
  [GateType.COMPLETE]: [Role.INITIATIVE_OWNER, Role.PMO],
  [GateType.START_TRACKING]: [Role.BUSINESS_OWNER],
  [GateType.CANCEL]: [Role.PMO, Role.STEERING_COMMITTEE],
};

/**
 * Check if user role can execute a gate
 */
export function canExecuteGate(role: Role, gate: GateType): boolean {
  // Admin can technically do anything but should not execute business gates
  if (role === Role.ADMIN) {
    return true; // Technical override - should be logged
  }
  // Consultant can NEVER execute any gate
  if (role === Role.CONSULTANT) {
    return false;
  }
  return GATE_PERMISSIONS[gate]?.includes(role) ?? false;
}

// ============================================
// MODULE VISIBILITY HELPERS
// ============================================

import { InitiativeStatus } from './core';

export type ModuleId = 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits' | 'reporting';

/**
 * Get statuses visible in Tools module
 */
export function getToolsVisibleStatuses(): InitiativeStatus[] {
  return [InitiativeStatus.DRAFT];
}

/**
 * Get statuses visible in Assessment module
 */
export function getAssessmentVisibleStatuses(): InitiativeStatus[] {
  return [InitiativeStatus.DRAFT];
}

/**
 * Get statuses visible in Initiatives module
 */
export function getInitiativesVisibleStatuses(): InitiativeStatus[] {
  return [
    InitiativeStatus.REVIEW,
    InitiativeStatus.PROMOTED,
    InitiativeStatus.PLANNING,
    InitiativeStatus.APPROVED,
    InitiativeStatus.SCHEDULED,
    InitiativeStatus.CANCELLED,
  ];
}

/**
 * Get statuses visible in Execution module
 */
export function getExecutionVisibleStatuses(): InitiativeStatus[] {
  return [
    InitiativeStatus.SCHEDULED,
    InitiativeStatus.EXECUTING,
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
  ];
}

/**
 * Get statuses visible in Benefits module
 */
export function getBenefitsVisibleStatuses(): InitiativeStatus[] {
  return [InitiativeStatus.TRACKING];
}

/**
 * Check if a status is visible in a given module
 */
export function isStatusVisibleInModule(status: InitiativeStatus, module: ModuleId): boolean {
  switch (module) {
    case 'tools':
      return getToolsVisibleStatuses().includes(status);
    case 'assessment':
      return getAssessmentVisibleStatuses().includes(status);
    case 'initiatives':
      return getInitiativesVisibleStatuses().includes(status);
    case 'execution':
      return getExecutionVisibleStatuses().includes(status);
    case 'benefits':
      return getBenefitsVisibleStatuses().includes(status);
    case 'reporting':
      return true; // Reporting sees all statuses
    default:
      return false;
  }
}

/**
 * Get the module that should display an initiative with given status
 */
export function getDisplayModule(status: InitiativeStatus): ModuleId {
  switch (status) {
    case InitiativeStatus.DRAFT:
      return 'assessment'; // or 'tools' depending on source
    case InitiativeStatus.REVIEW:
    case InitiativeStatus.PROMOTED:
    case InitiativeStatus.PLANNING:
    case InitiativeStatus.APPROVED:
    case InitiativeStatus.SCHEDULED:
    case InitiativeStatus.CANCELLED:
      return 'initiatives';
    case InitiativeStatus.EXECUTING:
    case InitiativeStatus.BLOCKED:
    case InitiativeStatus.DONE:
      return 'execution';
    case InitiativeStatus.TRACKING:
      return 'benefits';
    default:
      return 'initiatives';
  }
}

/**
 * Get statuses for a module
 */
export function getStatusesForModuleId(moduleId: ModuleId): InitiativeStatus[] {
  switch (moduleId) {
    case 'tools':
      return getToolsVisibleStatuses();
    case 'assessment':
      return getAssessmentVisibleStatuses();
    case 'initiatives':
      return getInitiativesVisibleStatuses();
    case 'execution':
      return getExecutionVisibleStatuses();
    case 'benefits':
      return getBenefitsVisibleStatuses();
    case 'reporting':
      return Object.values(InitiativeStatus);
    default:
      return [];
  }
}

// ============================================
// STATUS METADATA (for UI)
// ============================================

export interface StatusMeta {
  label: string;
  labelPL: string;
  color: string;
  bgColor: string;
  dotColor: string;
  description: string;
  descriptionPL: string;
  icon: string;
  order: number;
}

export const INITIATIVE_STATUS_METADATA: Record<InitiativeStatus, StatusMeta> = {
  [InitiativeStatus.DRAFT]: {
    label: 'Draft',
    labelPL: 'Szkic',
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    dotColor: 'bg-slate-400',
    description: 'Initial draft, awaiting promotion',
    descriptionPL: 'Początkowy szkic, oczekuje na promocję',
    icon: 'FileText',
    order: 1,
  },
  [InitiativeStatus.REVIEW]: {
    label: 'In Review',
    labelPL: 'W przeglądzie',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    dotColor: 'bg-amber-400',
    description: 'Under business review',
    descriptionPL: 'W przeglądzie biznesowym',
    icon: 'Eye',
    order: 2,
  },
  [InitiativeStatus.PROMOTED]: {
    label: 'Promoted',
    labelPL: 'Promowana',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
    description: 'Accepted for planning',
    descriptionPL: 'Zaakceptowana do planowania',
    icon: 'TrendingUp',
    order: 3,
  },
  [InitiativeStatus.PLANNING]: {
    label: 'Planning',
    labelPL: 'Planowanie',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    dotColor: 'bg-indigo-400',
    description: 'Being planned and scoped',
    descriptionPL: 'W trakcie planowania',
    icon: 'ClipboardList',
    order: 4,
  },
  [InitiativeStatus.APPROVED]: {
    label: 'Approved',
    labelPL: 'Zatwierdzona',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    dotColor: 'bg-emerald-400',
    description: 'Approved, ready for scheduling',
    descriptionPL: 'Zatwierdzona, gotowa do zaplanowania',
    icon: 'CheckCircle',
    order: 5,
  },
  [InitiativeStatus.SCHEDULED]: {
    label: 'Scheduled',
    labelPL: 'Zaplanowana',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    dotColor: 'bg-purple-400',
    description: 'Scheduled in roadmap',
    descriptionPL: 'Zaplanowana w roadmapie',
    icon: 'Calendar',
    order: 6,
  },
  [InitiativeStatus.EXECUTING]: {
    label: 'Executing',
    labelPL: 'W realizacji',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    dotColor: 'bg-cyan-400',
    description: 'Currently being implemented',
    descriptionPL: 'W trakcie realizacji',
    icon: 'Play',
    order: 7,
  },
  [InitiativeStatus.BLOCKED]: {
    label: 'Blocked',
    labelPL: 'Zablokowana',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    dotColor: 'bg-red-400',
    description: 'Blocked, requires decision',
    descriptionPL: 'Zablokowana, wymaga decyzji',
    icon: 'AlertTriangle',
    order: 8,
  },
  [InitiativeStatus.DONE]: {
    label: 'Done',
    labelPL: 'Ukończona',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-400',
    description: 'Delivery completed',
    descriptionPL: 'Realizacja zakończona',
    icon: 'CheckCircle2',
    order: 9,
  },
  [InitiativeStatus.TRACKING]: {
    label: 'Tracking',
    labelPL: 'Śledzenie',
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    dotColor: 'bg-teal-400',
    description: 'Benefits tracking in progress',
    descriptionPL: 'Śledzenie korzyści w toku',
    icon: 'BarChart',
    order: 10,
  },
  [InitiativeStatus.CANCELLED]: {
    label: 'Cancelled',
    labelPL: 'Anulowana',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    dotColor: 'bg-gray-400',
    description: 'Initiative was cancelled',
    descriptionPL: 'Inicjatywa została anulowana',
    icon: 'XCircle',
    order: 11,
  },
};

/**
 * Get status label for display
 */
export function getInitiativeStatusLabel(status: InitiativeStatus, lang: 'en' | 'pl' = 'en'): string {
  const meta = INITIATIVE_STATUS_METADATA[status];
  return lang === 'pl' ? meta?.labelPL : meta?.label || status;
}
