/**
 * Initiative due-date breach scan (M13 Depth · Seria R · R4 / E3).
 *
 * Pure selection + fail-safe orchestration for the due-breach notifier. The
 * DB-backed dependencies live in `cron/InitiativeDueBreachCron.ts`; this module
 * holds only the deterministic logic so it can be unit-tested with a mock clock
 * (see tests/integration/initiatives/due-breach.test.ts, which is the contract).
 *
 * A breach fires AT MOST ONCE per (item, dueDate): once notified for a given due
 * date we record it (`lastNotifiedDueDate`) and skip — but if the due date later
 * moves, that is a NEW breach and re-notifies. The scan never throws: a failing
 * fetch yields a zeroed result and a failing notify for one item is counted and
 * skipped without aborting the run.
 */

/** A candidate task that may be in breach of its due date. */
export interface DueBreachCandidate {
  itemId: string;
  initiativeId: string;
  organizationId: string;
  itemTitle: string;
  /** ISO timestamp, or null when the task has no due date. */
  dueDate: string | null;
  /** Free-form task status; terminal statuses are never breaches. */
  status: string | null;
  /** Notification targets; a breach with no real recipient is not actionable. */
  recipients: Array<string | null | undefined>;
  /** The dueDate we last notified for (idempotency key), or null. */
  lastNotifiedDueDate: string | null;
}

/** Injected side-effects for the scan (DB-backed in production, mocked in tests). */
export interface DueBreachDeps {
  fetchCandidates(now: Date): Promise<DueBreachCandidate[]>;
  notify(candidate: DueBreachCandidate): Promise<void>;
  /** Optional: persist the idempotency marker after a successful notify. */
  markNotified?(candidate: DueBreachCandidate): Promise<void>;
}

/** Aggregate outcome of one scan pass. */
export interface DueBreachResult {
  scanned: number;
  notified: number;
  skipped: number;
  errors: number;
}

/** Statuses that mean the task is finished/abandoned → never a breach. */
const TERMINAL_STATUSES = new Set([
  'DONE',
  'COMPLETED',
  'CANCELLED',
  'CANCELED',
  'ARCHIVED',
  'CLOSED',
]);

function parseMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function hasRealRecipient(recipients: Array<string | null | undefined>): boolean {
  return recipients.some((r) => typeof r === 'string' && r.trim().length > 0);
}

/**
 * True when `candidate` is a genuine, actionable, not-yet-notified breach as of `now`.
 * Pure — no I/O, deterministic given the clock.
 */
export function isDueBreach(candidate: DueBreachCandidate, now: Date): boolean {
  const dueMs = parseMs(candidate.dueDate);
  if (dueMs === null) return false; // no/invalid due date
  if (dueMs >= now.getTime()) return false; // not yet overdue

  const status = (candidate.status ?? '').toUpperCase();
  if (TERMINAL_STATUSES.has(status)) return false; // finished/abandoned

  if (!hasRealRecipient(candidate.recipients)) return false; // nobody to tell

  // Idempotency: already notified for THIS exact due date → skip; a moved due
  // date is a new breach and re-notifies.
  const lastMs = parseMs(candidate.lastNotifiedDueDate);
  if (lastMs !== null && lastMs === dueMs) return false;

  return true;
}

/** The actionable subset of `candidates` as of `now`. */
export function selectDueBreaches(
  candidates: DueBreachCandidate[],
  now: Date,
): DueBreachCandidate[] {
  return candidates.filter((c) => isDueBreach(c, now));
}

/**
 * Fetch candidates, notify each genuine breach exactly once, and report counts.
 * Fail-safe: a fetch failure returns a zeroed result; a per-item notify failure
 * is counted in `errors` and does not abort the remaining items.
 */
export async function scanAndNotifyDueBreaches(
  now: Date,
  deps: DueBreachDeps,
): Promise<DueBreachResult> {
  let candidates: DueBreachCandidate[];
  try {
    candidates = await deps.fetchCandidates(now);
  } catch {
    return { scanned: 0, notified: 0, skipped: 0, errors: 0 };
  }

  const result: DueBreachResult = {
    scanned: candidates.length,
    notified: 0,
    skipped: 0,
    errors: 0,
  };

  for (const candidate of candidates) {
    if (!isDueBreach(candidate, now)) {
      result.skipped += 1;
      continue;
    }
    try {
      await deps.notify(candidate);
      if (deps.markNotified) await deps.markNotified(candidate);
      result.notified += 1;
    } catch {
      result.errors += 1;
    }
  }

  return result;
}
