/**
 * Initiative Helpers
 *
 * Shared utility functions for the Initiatives module.
 * Provides "next step", "missing blocking", and "health" computations
 * used across Table, Grid, Kanban, and Drawer views.
 */

import {
  GATE_CONFIG,
  getNextGateForStatus,
  getRoleLabel,
} from '@/components/Initiatives/sections/types';
import {
  getStatusMeta,
  getValidNextStatuses,
  isTerminalStatus,
  STATUS_METADATA,
  type StatusMeta,
} from '@/services/initiativeLifecycle';
import { InitiativeStatus as InitiativeStatusCodes } from '../../packages/shared/src/constants/initiativeStatuses.generated';

import type { InitiativeStatus } from '@/types';

// ==========================================
// NEXT STEP
// ==========================================

export interface NextStepInfo {
  /** Human-readable label, e.g. "Approve (Steering Committee)" */
  label: string;
  /** Gate key (e.g. "APPROVE") or null if no gate required */
  gate: string | null;
  /** Required role key */
  role: string | null;
  /** Target status if the gate is passed */
  targetStatus: string;
}

/**
 * Compute the "next step" for an initiative based on its current status.
 * Returns null for terminal statuses (CANCELLED, ARCHIVED).
 */
export function getNextStep(status: string, isPolish = false): NextStepInfo | null {
  if (isTerminalStatus(status as InitiativeStatus)) return null;

  const gate = getNextGateForStatus(status);
  if (gate && GATE_CONFIG[gate]) {
    const config = GATE_CONFIG[gate];
    const roleName = getRoleLabel(config.requiredRole, isPolish);
    return {
      label: isPolish ? config.namePl : config.name,
      gate,
      role: roleName,
      targetStatus: config.toStatus,
    };
  }

  // Fallback: use lifecycle valid transitions
  const validNext = getValidNextStatuses(status as InitiativeStatus);
  const forward = validNext.filter((s) => s !== 'CANCELLED' && s !== 'ARCHIVED');
  if (forward.length === 0) return null;

  const target = forward[0];
  const meta = STATUS_METADATA[target as InitiativeStatus];
  return {
    label: meta?.label || target,
    gate: null,
    role: null,
    targetStatus: target,
  };
}

// ==========================================
// MISSING / BLOCKING
// ==========================================

export interface MissingInfo {
  /** Number of blocking items missing */
  blockingCount: number;
  /** Number of warning items missing */
  warningCount: number;
  /** Total missing */
  totalCount: number;
  /** Top blocking labels (max 3) */
  topBlocking: string[];
  /** Severity level for display */
  severity: 'ready' | 'warning' | 'blocking';
}

/**
 * Compute "missing blocking" info from backend gate readiness data.
 * If no readiness data, returns a "ready" default.
 */
export function getMissingInfo(
  readiness?: Array<{ key: string; label: string; pass: boolean; severity: string }>
): MissingInfo {
  if (!readiness || readiness.length === 0) {
    return {
      blockingCount: 0,
      warningCount: 0,
      totalCount: 0,
      topBlocking: [],
      severity: 'ready',
    };
  }

  const blocking = readiness.filter((r) => r.severity === 'blocking' && !r.pass);
  const warnings = readiness.filter((r) => r.severity === 'warning' && !r.pass);

  const severity: MissingInfo['severity'] =
    blocking.length > 0 ? 'blocking' : warnings.length > 0 ? 'warning' : 'ready';

  return {
    blockingCount: blocking.length,
    warningCount: warnings.length,
    totalCount: blocking.length + warnings.length,
    topBlocking: blocking.slice(0, 3).map((r) => r.label || r.key),
    severity,
  };
}

// ==========================================
// HEALTH / RAG
// ==========================================

export type HealthLevel = 'green' | 'amber' | 'red' | 'grey';

export interface HealthInfo {
  level: HealthLevel;
  label: string;
  dotClass: string;
}

/**
 * Compute a simple RAG health indicator from available signals.
 */
export function getHealthInfo(initiative: {
  status: string;
  riskScore?: number;
  plannedEndDate?: string;
}): HealthInfo {
  // Terminal → grey
  if (isTerminalStatus(initiative.status as InitiativeStatus)) {
    return { level: 'grey', label: '—', dotClass: 'bg-slate-400' };
  }

  // Blocked → red
  if (initiative.status === 'BLOCKED') {
    return { level: 'red', label: 'Blocked', dotClass: 'bg-danger-500' };
  }

  // Overdue → red
  if (initiative.plannedEndDate) {
    const end = new Date(initiative.plannedEndDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (end < now) {
      return { level: 'red', label: 'Overdue', dotClass: 'bg-danger-500' };
    }
    // Within 7 days → amber
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) {
      return { level: 'amber', label: 'At risk', dotClass: 'bg-amber-500' };
    }
  }

  // High risk score → amber
  if (initiative.riskScore && initiative.riskScore >= 7) {
    return { level: 'amber', label: 'At risk', dotClass: 'bg-amber-500' };
  }

  // Default → green
  return { level: 'green', label: 'On track', dotClass: 'bg-emerald-500' };
}

// ==========================================
// ACTIVE / ALL STATUS SETS
// ==========================================

/** Statuses shown in "Active" (Initiatives module core flow).
 *
 * DRAFT + PENDING_REVIEW lead the pipeline: without them a freshly-created
 * initiative (status DRAFT) had NO Kanban column and was excluded from the
 * active data fetch, so it vanished from the default board right after
 * creation ("ALL 10 → every column 0"). They are the visible left-most
 * "Szkice / W przeglądzie" columns now. (M13 P1 fix, 2026-06-21)
 *
 * EXECUTING + BLOCKED + TRACKING close the same class of defect a second
 * time (2026-08-29). The Initiatives data feed for scope 'active' filters
 * out ONLY the terminal statuses below, so an initiative in execution
 * *reached* the board but had no column and was silently dropped by the
 * grouping step — the module filter chip read "W realizacji 1" over a board
 * whose every column showed 0. Owner decision 2026-08-29: the initiative
 * lifecycle is the truth, the Kanban columns must mirror it.
 *
 * DEC-424 (P12): listy pochodzą teraz WYŁĄCZNIE ze słownika 7 (SSOT
 * `packages/shared/.../initiativeStatuses.generated`). Poprzednia wersja
 * rzutowała 13 nieistniejących kodów przez `as InitiativeStatus` — kolumny
 * Kanbanu nazywały się PENDING_REVIEW/SCHEDULED/TRACKING, a wiersze przychodzą
 * z bazy jako PENDING_APPROVAL/APPROVED/CLOSED, więc KAŻDY był „bezdomny".
 * Order follows ALL_STATUSES. */
export const ACTIVE_STATUSES: InitiativeStatus[] = [
  InitiativeStatusCodes.PROPOSED,
  InitiativeStatusCodes.DRAFT,
  InitiativeStatusCodes.PENDING_APPROVAL,
  InitiativeStatusCodes.APPROVED,
  InitiativeStatusCodes.IN_EXECUTION,
];

/** The only statuses deliberately absent from the "Active" board.
 *
 * Mirrors the terminal-status exclusion applied to the Initiatives data feed
 * in scope 'active' (`InitiativesHub.tsx` L526-535). Kept next to
 * ACTIVE_STATUSES so the invariant
 *   ACTIVE_STATUSES ∪ ACTIVE_HIDDEN_STATUSES === every InitiativeStatus
 * (no overlap, no gap) can be asserted by a test instead of rediscovered by
 * a user staring at an empty board. */
export const ACTIVE_HIDDEN_STATUSES: InitiativeStatus[] = [
  InitiativeStatusCodes.CLOSED,
  InitiativeStatusCodes.REJECTED,
];

/** Full lifecycle order for "All" mode — DEC-424: cały słownik 7 z SSOT,
 * w kolejności deklaracji (PROPOSED → … → REJECTED). */
export const ALL_STATUSES: InitiativeStatus[] = Object.values(InitiativeStatusCodes);

// ==========================================
// FORMAT HELPERS
// ==========================================

/** Format a date string to "Feb 16" or "—" */
export function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** Format relative "updated" time, e.g. "2h ago", "3d ago", "Just now" */
export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
