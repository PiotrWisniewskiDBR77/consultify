/**
 * Initiative Types - Frontend
 *
 * Central definitions for initiative statuses, module mappings, and lifecycle.
 * Re-exports from core.ts for backward compatibility.
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
// MODULE VISIBILITY HELPERS (Frontend-specific)
// ============================================

import { InitiativeStatus } from './core';

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
    InitiativeStatus.PLANNING,
    InitiativeStatus.REVIEW,
    InitiativeStatus.APPROVED,
    InitiativeStatus.CANCELLED,
    InitiativeStatus.ARCHIVED,
  ];
}

/**
 * Get statuses visible in Execution module
 */
export function getExecutionVisibleStatuses(): InitiativeStatus[] {
  return [
    InitiativeStatus.EXECUTING,
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.CANCELLED,
  ];
}

/**
 * Get statuses visible in Benefits module
 */
export function getBenefitsVisibleStatuses(): InitiativeStatus[] {
  return [InitiativeStatus.DONE];
}

/**
 * Check if a status is visible in a given module
 */
export function isStatusVisibleInModule(
  status: InitiativeStatus,
  module: 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits'
): boolean {
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
    default:
      return false;
  }
}

/**
 * Get the module that should display an initiative with given status
 */
export function getDisplayModule(
  status: InitiativeStatus
): 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits' {
  switch (status) {
    case InitiativeStatus.DRAFT:
      return 'assessment'; // or 'tools' depending on source
    case InitiativeStatus.PLANNING:
    case InitiativeStatus.REVIEW:
    case InitiativeStatus.APPROVED:
    case InitiativeStatus.CANCELLED:
    case InitiativeStatus.ARCHIVED:
      return 'initiatives';
    case InitiativeStatus.EXECUTING:
    case InitiativeStatus.BLOCKED:
      return 'execution';
    case InitiativeStatus.DONE:
      return 'benefits'; // or 'execution' if still showing there
    default:
      return 'initiatives';
  }
}
