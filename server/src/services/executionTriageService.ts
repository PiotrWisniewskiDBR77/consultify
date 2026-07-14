/**
 * Execution Triage Service (M14/F7 — 7.2)
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * GROUNDED, deterministic triage of execution signals.
 *
 * Design intent (anti-hallucination):
 * - NO LLM calls. Pure, synchronous functions = fully testable + reproducible.
 * - Every produced `rationale` CITES the concrete signal it was derived from
 *   (its type, severity and title) and NEVER invents facts beyond the signal's
 *   own fields. If a fact is not present on the Signal, it is not asserted.
 * - Ordering, summary counts and suggested actions are all derived purely from
 *   the input array, so the same input always yields the same output.
 */

// ==========================================
// TYPES
// ==========================================

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Signal {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  initiativeId?: string;
  sourceData?: any;
}

export interface PrioritizedSignal {
  signal: Signal;
  rank: number;
  rationale: string;
}

export interface TriageResult {
  summary: string;
  prioritized: PrioritizedSignal[];
  topActions: string[];
}

// ==========================================
// CONSTANTS
// ==========================================

/**
 * Higher number = higher priority. Used for a stable, deterministic sort
 * (CRITICAL > HIGH > MEDIUM > LOW).
 */
const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Mapping of known signal `type` -> suggested next action.
 * Kept deterministic and grounded: the action is a fixed playbook step for the
 * signal type, not an LLM guess. Unknown types fall back to a generic action.
 */
const TYPE_ACTION: Record<string, string> = {
  APPETITE_BREACH: 'escalate to sponsor',
  BLOCKED_LONG: 'unblock',
  UNOWNED_RISK: 'assign owner',
  OVERDUE_TASK: 'replan or reassign',
  STALE_INITIATIVE: 'request status update',
  BUDGET_OVERRUN: 'review budget with sponsor',
  MISSING_OWNER: 'assign owner',
  DEPENDENCY_AT_RISK: 'coordinate dependency owners',
};

const DEFAULT_ACTION = 'review and triage manually';

// ==========================================
// HELPERS
// ==========================================

/** Resolve a suggested action for a signal type (grounded fallback for unknowns). */
export function actionForType(type: string): string {
  return TYPE_ACTION[type] ?? DEFAULT_ACTION;
}

/**
 * Build a rationale that CITES the concrete signal. Only the signal's own
 * fields are referenced — no facts are introduced beyond type / severity /
 * title (and, when present, its initiative association).
 */
function buildRationale(signal: Signal): string {
  const initiativePart = signal.initiativeId ? ` on initiative "${signal.initiativeId}"` : '';
  return (
    `Signal "${signal.id}" of type ${signal.type} ` +
    `flagged ${signal.severity}${initiativePart}: "${signal.title}". ` +
    `Suggested action: ${actionForType(signal.type)}.`
  );
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Triage a set of signals into a prioritized, grounded list.
 *
 * - `prioritized` is sorted by severity (CRITICAL > HIGH > MEDIUM > LOW). Ties
 *   preserve the original input order (stable) so output is deterministic.
 * - each entry's `rationale` cites the concrete signal (type + severity + title).
 * - `summary` is a per-severity count of the input.
 * - `topActions` is the de-duplicated set of suggested actions, in priority order.
 */
export function triageSignals(signals: Signal[]): TriageResult {
  const safe = Array.isArray(signals) ? signals : [];

  // Stable sort by descending severity rank. Map to {signal, idx} to keep a
  // deterministic tiebreaker on the original index across all engines.
  const sorted = safe
    .map((signal, idx) => ({ signal, idx }))
    .sort((a, b) => {
      const sevDiff = SEVERITY_RANK[b.signal.severity] - SEVERITY_RANK[a.signal.severity];
      if (sevDiff !== 0) return sevDiff;
      return a.idx - b.idx;
    });

  const prioritized: PrioritizedSignal[] = sorted.map((entry, i) => ({
    signal: entry.signal,
    rank: i + 1,
    rationale: buildRationale(entry.signal),
  }));

  // Per-severity counts for the summary.
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const { signal } of sorted) {
    counts[signal.severity] += 1;
  }
  const summary =
    `${safe.length} signal(s): ` +
    `${counts.CRITICAL} critical, ${counts.HIGH} high, ` +
    `${counts.MEDIUM} medium, ${counts.LOW} low.`;

  // Suggested actions per type, de-duplicated, in priority (rank) order.
  const seen = new Set<string>();
  const topActions: string[] = [];
  for (const { signal } of prioritized) {
    const action = actionForType(signal.type);
    if (!seen.has(action)) {
      seen.add(action);
      topActions.push(action);
    }
  }

  return { summary, prioritized, topActions };
}

/**
 * Group signals by their `initiativeId`. Signals without an `initiativeId` are
 * collected under the `__unassigned__` key. Insertion order is preserved.
 */
export function groupByInitiative(signals: Signal[]): Map<string, Signal[]> {
  const map = new Map<string, Signal[]>();
  const safe = Array.isArray(signals) ? signals : [];
  for (const signal of safe) {
    const key = signal.initiativeId ?? '__unassigned__';
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(signal);
    } else {
      map.set(key, [signal]);
    }
  }
  return map;
}
