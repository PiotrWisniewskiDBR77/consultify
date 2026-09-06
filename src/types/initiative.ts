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
  getLifecycleOrder,
  getLifecycleProgress,
  getModuleConfigForStatus,
  getModuleForStatus,
  getStatusActions,
  getStatusesForModule,
  getStatusMeta,
  getTargetModule,
  getValidNextStatuses,
  isActiveStatus,
  isStatusInModule,
  isTerminalStatus,
  isValidTransition,
  MODULES,
  needsAttention,
  STATUS_METADATA,
  VALID_TRANSITIONS,
  willChangeModule,
} from '../services/initiativeLifecycle';

// Re-export types from core
export type { PortfolioFilters, PortfolioInitiative, PortfolioStats } from './core';

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
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  PROJECT_LEAD = 'PROJECT_LEAD',
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
  // Phase 1: Tools/Assessment gates
  SUBMIT_FOR_REVIEW = 'SUBMIT_FOR_REVIEW',
  SEND_BACK = 'SEND_BACK',
  APPROVE_TO_INITIATIVE = 'APPROVE_TO_INITIATIVE',

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
  [GateType.SUBMIT_FOR_REVIEW]: [Role.CONSULTANT, Role.INITIATIVE_OWNER],
  [GateType.SEND_BACK]: [Role.PROJECT_MANAGER, Role.PROJECT_LEAD, Role.PMO],
  [GateType.APPROVE_TO_INITIATIVE]: [Role.PROJECT_MANAGER, Role.PROJECT_LEAD, Role.PMO],

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

export type ModuleId =
  | 'tools'
  | 'assessment'
  | 'initiatives'
  | 'execution'
  | 'benefits'
  | 'reporting';

/**
 * Get statuses visible in Tools module
 */
export function getToolsVisibleStatuses(): InitiativeStatus[] {
  return [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL];
}

/**
 * Get statuses visible in Assessment module
 */
export function getAssessmentVisibleStatuses(): InitiativeStatus[] {
  return [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_APPROVAL];
}

/**
 * Get statuses visible in Initiatives module
 */
export function getInitiativesVisibleStatuses(): InitiativeStatus[] {
  return [
    InitiativeStatus.PENDING_APPROVAL,
    InitiativeStatus.PENDING_APPROVAL,
    InitiativeStatus.PENDING_APPROVAL,
    InitiativeStatus.APPROVED,
    InitiativeStatus.APPROVED,
    InitiativeStatus.REJECTED,
    InitiativeStatus.CLOSED,
  ];
}

/**
 * Get statuses visible in Execution module
 */
export function getExecutionVisibleStatuses(): InitiativeStatus[] {
  return [
    InitiativeStatus.APPROVED,
    InitiativeStatus.IN_EXECUTION,
    InitiativeStatus.IN_EXECUTION,
    InitiativeStatus.CLOSED,
  ];
}

/**
 * Get statuses visible in Benefits module
 */
export function getBenefitsVisibleStatuses(): InitiativeStatus[] {
  return [InitiativeStatus.CLOSED];
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
    case InitiativeStatus.PENDING_APPROVAL:
      return 'assessment'; // or 'tools' depending on source
    case InitiativeStatus.PENDING_APPROVAL:
    case InitiativeStatus.PENDING_APPROVAL:
    case InitiativeStatus.PENDING_APPROVAL:
    case InitiativeStatus.APPROVED:
    case InitiativeStatus.APPROVED:
    case InitiativeStatus.REJECTED:
      return 'initiatives';
    case InitiativeStatus.IN_EXECUTION:
    case InitiativeStatus.IN_EXECUTION:
    case InitiativeStatus.CLOSED:
      return 'execution';
    case InitiativeStatus.CLOSED:
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

export { STATUS_METADATA as INITIATIVE_STATUS_METADATA } from "../services/initiativeLifecycle";

/*  UI consumers must call getLocalizedStatusLabel with i18n. */
export function getInitiativeStatusLabel(status: InitiativeStatus): string {
  return status;
}
