/**
 * executiveData — pure, testable helpers for the Manager (Executive) dashboard.
 *
 * These functions exist so the credibility-critical logic (capacity guard,
 * Action Required de-duplication) is unit-testable without mounting React.
 *
 * Data-credibility doctrine (VEGAS FALA 3):
 *  - Never surface an absurd metric (e.g. "512% utilized") as if it were real.
 *    Team capacity utilization is computed backend-side as
 *      allocatedHours (SUM of estimated_hours over ALL open tasks, lifetime)
 *      ÷ capacityHours (a single WEEKLY 40h budget).
 *    That is a units mismatch: an unbounded backlog is divided by one week of
 *    capacity, so a large backlog trivially yields hundreds of percent. Until
 *    the backend allocates hours into time windows, any value far above 100%
 *    is not "overload", it is "the team/estimates are not configured for
 *    capacity planning". We detect that and show a degraded, honest state
 *    instead of a fake red number.
 *  - Action Required must never show the same card three times. We de-duplicate
 *    by a stable identity (title + initiative/project).
 */

export type CapacityState = 'ok' | 'needs-config' | 'no-data';

export interface TeamCapacityInput {
  /** Average utilization percent as computed by the backend. */
  avgCapacity: number;
  /** Members flagged as overloaded (>110% of their weekly budget). */
  overloaded: number;
  /** Members with head-room (<50% utilized). */
  available: number;
  trend?: 'up' | 'down' | 'stable';
  /** Optional member count; when 0/undefined we cannot compute a real average. */
  memberCount?: number;
}

export interface CapacityInterpretation {
  state: CapacityState;
  /** Value safe to render as the KPI headline ("87%" or "—"). */
  displayValue: string;
  /** Raw (unclamped) percent, for tooltips / debugging. */
  rawPercent: number | null;
  /** Human hint key explaining a degraded state, or null when state === 'ok'. */
  hint: string | null;
  overloaded: number;
  available: number;
}

/**
 * Utilization above this is treated as "not a real reading" — it means hours
 * are not time-windowed, not that the team is literally 4× over capacity.
 * 130% leaves genuine short-term overload ("crunch week") visible while
 * catching the lifetime-backlog artifact.
 */
export const CAPACITY_ABSURD_THRESHOLD = 130;

/**
 * Interpret raw team-capacity KPI data into a credible display state.
 * Pure — no i18n, no React. Callers map `state`/`hint` to localized copy.
 */
export function interpretCapacity(
  team: TeamCapacityInput | null | undefined
): CapacityInterpretation {
  if (!team) {
    return {
      state: 'no-data',
      displayValue: '—',
      rawPercent: null,
      hint: null,
      overloaded: 0,
      available: 0,
    };
  }

  const raw = Number(team.avgCapacity);
  const memberCount = team.memberCount;

  // No members → the average was divided by zero (or defaulted to 0). We cannot
  // claim any utilization. Show a configuration state, never "0% utilized".
  if (memberCount != null && memberCount <= 0) {
    return {
      state: 'needs-config',
      displayValue: '—',
      rawPercent: null,
      hint: 'no-members',
      overloaded: 0,
      available: 0,
    };
  }

  // Non-finite / negative → treat as missing rather than rendering NaN%.
  if (!Number.isFinite(raw) || raw < 0) {
    return {
      state: 'no-data',
      displayValue: '—',
      rawPercent: null,
      hint: null,
      overloaded: Math.max(0, Number(team.overloaded) || 0),
      available: Math.max(0, Number(team.available) || 0),
    };
  }

  // Absurdly high → units mismatch (lifetime backlog ÷ weekly budget).
  // Don't render a fake red "512%"; flag that capacity planning isn't set up.
  if (raw > CAPACITY_ABSURD_THRESHOLD) {
    return {
      state: 'needs-config',
      displayValue: '—',
      rawPercent: Math.round(raw),
      hint: 'unbounded-estimates',
      overloaded: Math.max(0, Number(team.overloaded) || 0),
      available: Math.max(0, Number(team.available) || 0),
    };
  }

  return {
    state: 'ok',
    displayValue: `${Math.round(raw)}%`,
    rawPercent: Math.round(raw),
    hint: null,
    overloaded: Math.max(0, Number(team.overloaded) || 0),
    available: Math.max(0, Number(team.available) || 0),
  };
}

export interface DedupableActionItem {
  id: string;
  type: 'decision' | 'task' | 'escalation' | 'blocker';
  title: string;
  projectName?: string;
  initiativeName?: string;
  [key: string]: unknown;
}

/**
 * Normalize a string for identity comparison: trim, collapse whitespace,
 * lowercase. Keeps "Submit  Compliance Documentation " === "submit compliance documentation".
 */
function normalizeKeyPart(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * De-duplicate Action Required items by (title + initiative/project + type).
 *
 * The dashboard aggregates urgent decisions and overdue tasks from several
 * sources; the same "Submit Compliance Documentation" can arrive three times
 * (e.g. one per initiative task instance). We collapse to the first occurrence
 * so the strip shows each distinct action once. Identity intentionally includes
 * the initiative/project so the *same* title across *different* initiatives
 * stays separate — those are genuinely distinct actions.
 */
export function dedupeActionItems<T extends DedupableActionItem>(
  items: T[] | null | undefined
): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item) continue;
    const scope = normalizeKeyPart(item.initiativeName ?? item.projectName ?? '');
    const key = `${item.type}::${normalizeKeyPart(item.title)}::${scope}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
