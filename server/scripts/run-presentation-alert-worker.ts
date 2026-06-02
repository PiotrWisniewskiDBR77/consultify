/**
 * Presentation Governance Alert Worker
 *
 * Periodic dispatcher that closes the loop on Sprint 9 governance alerts:
 * for every active organization it builds the current Governance Watchlist,
 * diffs it against the previously-persisted snapshot, and fires
 * `dispatchAlertsForTransition` for every deck that newly entered (or
 * escalated within) `BLOCKED_P0` / `BLOCKED_P1`.
 *
 * Per-cycle algorithm — see `docs/operations/PRESENTATION_GOVERNANCE_ALERT_WORKER.md`:
 *   1. Resolve target orgs (CLI arg OR `SELECT DISTINCT organization_id …`).
 *   2. For each org:
 *      a. Skip if `presentation_governance_alert_worker_state.paused = TRUE`.
 *      b. Load up to 200 recently-updated decks scoped to the org.
 *      c. Build a per-deck Governance Card (best-effort, mirrors the
 *         watchlist endpoint).
 *      d. Build watchlist entries via `buildPresentationGovernanceWatchlist`.
 *      e. Read worker_state row (or treat snapshot as null on first run).
 *      f. Run `runAlertWorkerCycle` → list of transitions + next snapshot.
 *      g. For each transition (unless `--dry-run`):
 *         `dispatchAlertsForTransition(transition)`. Aggregate counters.
 *      h. UPSERT worker_state with the next snapshot, run timestamp, and a
 *         compact JSON summary.
 *      i. On exception → bump `failures_in_a_row`. At 5 → auto-pause.
 *   3. Sleep `--interval-ms` between cycles unless `--once`.
 *
 * Schema-tolerance: missing tables → log warning, skip gracefully. The
 * worker NEVER throws out of the cycle.
 *
 * Usage:
 *   # Single cycle (cron-friendly):
 *   npx tsx server/scripts/run-presentation-alert-worker.ts --once
 *
 *   # Single org, single cycle, dry-run (no outbound POSTs):
 *   npx tsx server/scripts/run-presentation-alert-worker.ts \
 *     --organization-id org_acme --once --dry-run
 *
 *   # Loop forever, 60s cadence:
 *   npx tsx server/scripts/run-presentation-alert-worker.ts --interval-ms 60000
 *
 *   # Reset persisted snapshot (drop bookkeeping & resume after a pause):
 *   npx tsx server/scripts/run-presentation-alert-worker.ts \
 *     --organization-id org_acme --reset-state
 */

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

import { all as dbAll, get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';
import logger from '../src/utils/Logger.js';
import {
  type AlertSeverity,
  dispatchAlertsForTransition,
} from '../src/services/presentationGovernanceAlertService.js';
import { buildPresentationGovernanceCard } from '../src/services/presentationGovernanceCardService.js';
import {
  buildPresentationGovernanceWatchlist,
  type WatchlistEntryInput,
} from '../src/services/presentationGovernanceWatchlistService.js';
import { resolvePresentationDeckConfidentiality } from '../src/services/presentationConfidentialityPolicyService.js';
import {
  buildPresentationRuntimeRollup,
  type PresentationRuntimeEventRow,
} from '../src/services/presentationRuntimeRollupService.js';
import {
  parseStoredSnapshot,
  runAlertWorkerCycle,
  type WorkerTransition,
} from '../src/services/presentationGovernanceAlertWorkerService.js';

// ---------------------------------------------------------------------------
// CLI types & parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  organizationIds: string[]; // empty array → "all active orgs"
  once: boolean;
  intervalMs: number;
  dryRun: boolean;
  maxCycles: number; // 0 → unlimited
  reportFile: string | null;
  quiet: boolean;
  resetState: boolean;
}

// ---------------------------------------------------------------------------
// Test-only hooks
// ---------------------------------------------------------------------------

/**
 * Runtime hooks consumed exclusively by the integration test harness in
 * `tests/integration/presentations/_helpers/alert-worker-pg-harness.ts`. The
 * map lets tests substitute a deterministic watchlist for a given org so the
 * cycle's transition logic can be exercised without driving the full quality
 * gate / governance-card pipeline through hand-crafted `deck_json`. Always
 * empty in production — the worker's CLI path never reads or writes here.
 */
export const __testHooks: {
  watchlistOverrides: Map<string, WatchlistEntryInput[]>;
} = {
  watchlistOverrides: new Map<string, WatchlistEntryInput[]>(),
};

interface ParseOk {
  ok: true;
  args: CliArgs;
}

interface ParseErr {
  ok: false;
  error: string;
}

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 5_000;
const DECK_QUERY_LIMIT = 200;
const TELEMETRY_WINDOW_DAYS = 7;
const MAX_CONSECUTIVE_FAILURES = 5;

const EXIT_OK = 0;
const EXIT_RUNTIME = 1;
const EXIT_ARG_ERROR = 2;

function collectFlagValues(name: string, argv: string[]): string[] {
  const eq = `--${name}=`;
  const bare = `--${name}`;
  const values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const entry = argv[i];
    if (entry === undefined) continue;
    if (entry.startsWith(eq)) {
      values.push(entry.slice(eq.length));
    } else if (entry === bare) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        values.push(next);
        i++;
      }
    }
  }
  return values;
}

function findArgValue(name: string, argv: string[]): string | null {
  const values = collectFlagValues(name, argv);
  return values.length > 0 ? (values[values.length - 1] ?? null) : null;
}

function hasBareFlag(name: string, argv: string[]): boolean {
  return argv.includes(`--${name}`);
}

function parseArgs(argv: string[]): ParseOk | ParseErr {
  const orgRawValues = collectFlagValues('organization-id', argv);
  const organizationIds = orgRawValues
    .flatMap((raw) => raw.split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const once = hasBareFlag('once', argv) || findArgValue('once', argv) === 'true';
  const dryRun = hasBareFlag('dry-run', argv) || findArgValue('dry-run', argv) === 'true';
  const quiet = hasBareFlag('quiet', argv) || findArgValue('quiet', argv) === 'true';
  const resetState =
    hasBareFlag('reset-state', argv) || findArgValue('reset-state', argv) === 'true';

  let intervalMs = DEFAULT_INTERVAL_MS;
  const intervalRaw = findArgValue('interval-ms', argv);
  if (intervalRaw !== null && intervalRaw !== '') {
    const parsed = Number(intervalRaw);
    if (!Number.isFinite(parsed) || parsed < MIN_INTERVAL_MS) {
      return {
        ok: false,
        error: `--interval-ms must be a finite number >= ${MIN_INTERVAL_MS} (got "${intervalRaw}")`,
      };
    }
    intervalMs = Math.round(parsed);
  }

  let maxCycles = 0;
  const maxCyclesRaw = findArgValue('max-cycles', argv);
  if (maxCyclesRaw !== null && maxCyclesRaw !== '') {
    const parsed = Number(maxCyclesRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return {
        ok: false,
        error: `--max-cycles must be a non-negative number (got "${maxCyclesRaw}")`,
      };
    }
    maxCycles = Math.round(parsed);
  }

  const reportFileRaw = findArgValue('report-file', argv);
  const reportFile =
    reportFileRaw !== null && reportFileRaw !== '' ? reportFileRaw : null;

  return {
    ok: true,
    args: {
      organizationIds,
      once,
      intervalMs,
      dryRun,
      maxCycles,
      reportFile,
      quiet,
      resetState,
    },
  };
}

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

function logLine(quiet: boolean, message: string): void {
  if (quiet) return;
  // eslint-disable-next-line no-console
  console.log(message);
}

function logError(message: string): void {
  // eslint-disable-next-line no-console
  console.error(message);
}

// ---------------------------------------------------------------------------
// Schema-missing detection
// ---------------------------------------------------------------------------

function isSchemaMissingError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('no such table') ||
    message.includes('no such column') ||
    message.includes('relation') ||
    message.includes('database not initialized')
  );
}

// ---------------------------------------------------------------------------
// Org resolution
// ---------------------------------------------------------------------------

async function resolveTargetOrganizationIds(args: CliArgs): Promise<string[]> {
  if (args.organizationIds.length > 0) {
    // De-dup while preserving order.
    return Array.from(new Set(args.organizationIds));
  }
  try {
    const rows = (await dbAll(
      `SELECT DISTINCT organization_id
         FROM presentation_governance_alert_subscriptions
        WHERE active = TRUE`,
      [],
      { fallback: false }
    )) as Array<{ organization_id: string | null }>;
    return rows
      .map((row) => String(row.organization_id ?? ''))
      .filter((id) => id.length > 0);
  } catch (error) {
    if (isSchemaMissingError(error)) {
      logger.warn(
        '[PresentationAlertWorker] subscriptions table missing — no orgs to process'
      );
      return [];
    }
    logger.warn(
      '[PresentationAlertWorker] Failed to resolve target organizations',
      error
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Worker-state I/O (presentation_governance_alert_worker_state)
// ---------------------------------------------------------------------------

interface WorkerStateRow {
  organization_id: string;
  last_snapshot_json: string | null;
  failures_in_a_row: number | null;
  paused: boolean | number | null;
  paused_reason: string | null;
}

async function loadWorkerState(orgId: string): Promise<WorkerStateRow | null> {
  try {
    const row = await dbGet<WorkerStateRow>(
      `SELECT organization_id, last_snapshot_json, failures_in_a_row, paused, paused_reason
         FROM presentation_governance_alert_worker_state
        WHERE organization_id = ?`,
      [orgId],
      { fallback: false }
    );
    return row ?? null;
  } catch (error) {
    if (isSchemaMissingError(error)) return null;
    logger.warn('[PresentationAlertWorker] loadWorkerState failed', error);
    return null;
  }
}

interface UpsertWorkerStateInput {
  organizationId: string;
  lastSnapshotJson: string | null;
  lastRunSummary: string;
  failuresInARow: number;
  paused: boolean;
  pausedReason: string | null;
}

async function upsertWorkerState(input: UpsertWorkerStateInput): Promise<void> {
  try {
    // Try Postgres-style ON CONFLICT first.
    const result = await dbRun(
      `INSERT INTO presentation_governance_alert_worker_state (
         organization_id, last_snapshot_json, last_run_at, last_run_summary,
         failures_in_a_row, paused, paused_reason, paused_at
       ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)
       ON CONFLICT (organization_id) DO UPDATE SET
         last_snapshot_json = EXCLUDED.last_snapshot_json,
         last_run_at = CURRENT_TIMESTAMP,
         last_run_summary = EXCLUDED.last_run_summary,
         failures_in_a_row = EXCLUDED.failures_in_a_row,
         paused = EXCLUDED.paused,
         paused_reason = EXCLUDED.paused_reason,
         paused_at = EXCLUDED.paused_at`,
      [
        input.organizationId,
        input.lastSnapshotJson,
        input.lastRunSummary,
        input.failuresInARow,
        input.paused,
        input.pausedReason,
        input.paused ? new Date().toISOString() : null,
      ],
      { fallback: false }
    );
    if (!result?.success) {
      throw new Error(result?.error || 'worker_state_upsert_failed');
    }
  } catch (error) {
    if (isSchemaMissingError(error)) {
      logger.warn(
        '[PresentationAlertWorker] worker_state table missing — bookkeeping disabled until migration 763 runs'
      );
      return;
    }
    // Fall back to a manual UPDATE / INSERT if ON CONFLICT is not supported
    // (e.g. older sqlite without UPSERT semantics).
    try {
      const existing = await dbGet<{ organization_id: string }>(
        `SELECT organization_id
           FROM presentation_governance_alert_worker_state
          WHERE organization_id = ?`,
        [input.organizationId],
        { fallback: false }
      );
      if (existing) {
        await dbRun(
          `UPDATE presentation_governance_alert_worker_state
              SET last_snapshot_json = ?,
                  last_run_at = CURRENT_TIMESTAMP,
                  last_run_summary = ?,
                  failures_in_a_row = ?,
                  paused = ?,
                  paused_reason = ?,
                  paused_at = ?
            WHERE organization_id = ?`,
          [
            input.lastSnapshotJson,
            input.lastRunSummary,
            input.failuresInARow,
            input.paused,
            input.pausedReason,
            input.paused ? new Date().toISOString() : null,
            input.organizationId,
          ],
          { fallback: false }
        );
      } else {
        await dbRun(
          `INSERT INTO presentation_governance_alert_worker_state (
             organization_id, last_snapshot_json, last_run_at, last_run_summary,
             failures_in_a_row, paused, paused_reason, paused_at
           ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`,
          [
            input.organizationId,
            input.lastSnapshotJson,
            input.lastRunSummary,
            input.failuresInARow,
            input.paused,
            input.pausedReason,
            input.paused ? new Date().toISOString() : null,
          ],
          { fallback: false }
        );
      }
    } catch (fallbackError) {
      logger.warn(
        '[PresentationAlertWorker] upsertWorkerState fallback failed',
        fallbackError
      );
    }
  }
}

async function resetWorkerState(orgId: string): Promise<boolean> {
  try {
    const existing = await dbGet<{ organization_id: string }>(
      `SELECT organization_id
         FROM presentation_governance_alert_worker_state
        WHERE organization_id = ?`,
      [orgId],
      { fallback: false }
    );
    if (existing) {
      await dbRun(
        `UPDATE presentation_governance_alert_worker_state
            SET last_snapshot_json = NULL,
                failures_in_a_row = 0,
                paused = FALSE,
                paused_reason = NULL,
                paused_at = NULL
          WHERE organization_id = ?`,
        [orgId],
        { fallback: false }
      );
    } else {
      await dbRun(
        `INSERT INTO presentation_governance_alert_worker_state (
           organization_id, last_snapshot_json, failures_in_a_row, paused
         ) VALUES (?, NULL, 0, FALSE)`,
        [orgId],
        { fallback: false }
      );
    }
    return true;
  } catch (error) {
    if (isSchemaMissingError(error)) {
      logger.warn(
        '[PresentationAlertWorker] worker_state table missing — reset is a no-op'
      );
      return false;
    }
    logger.warn('[PresentationAlertWorker] resetWorkerState failed', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Watchlist build (mirror of the watchlist GET, but server-only & best-effort)
// ---------------------------------------------------------------------------

interface DeckRow {
  id: string | null;
  title: string | null;
  deck_json?: string | null;
  confidentiality?: string | null;
  updated_at?: string | null;
}

async function loadDeckRows(orgId: string): Promise<DeckRow[]> {
  try {
    return (await dbAll(
      `SELECT id, title, deck_json, confidentiality, updated_at
         FROM presentation_decks
        WHERE organization_id = ?
        ORDER BY updated_at DESC
        LIMIT ${DECK_QUERY_LIMIT}`,
      [orgId],
      { fallback: false }
    )) as DeckRow[];
  } catch (error) {
    if (isSchemaMissingError(error)) {
      // Try the legacy column set (without `confidentiality`).
      try {
        return (await dbAll(
          `SELECT id, title, deck_json, updated_at
             FROM presentation_decks
            WHERE organization_id = ?
            ORDER BY updated_at DESC
            LIMIT ${DECK_QUERY_LIMIT}`,
          [orgId],
          { fallback: false }
        )) as DeckRow[];
      } catch (innerError) {
        if (isSchemaMissingError(innerError)) return [];
        logger.warn(
          '[PresentationAlertWorker] loadDeckRows fallback failed',
          innerError
        );
        return [];
      }
    }
    logger.warn('[PresentationAlertWorker] loadDeckRows failed', error);
    return [];
  }
}

async function loadTelemetryRollupForDeck(
  orgId: string,
  deckId: string,
  cutoffIso: string
): Promise<ReturnType<typeof buildPresentationRuntimeRollup> | null> {
  try {
    const rows = (await dbAll(
      `SELECT id, organization_id, deck_id, user_id, event_type, status, scope, metadata_json, created_at
         FROM presentation_runtime_events
        WHERE organization_id = ? AND deck_id = ? AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 1000`,
      [orgId, deckId, cutoffIso],
      { fallback: false }
    )) as PresentationRuntimeEventRow[];
    return buildPresentationRuntimeRollup({
      rows: rows || [],
      windowDays: TELEMETRY_WINDOW_DAYS,
    });
  } catch (error) {
    if (!isSchemaMissingError(error)) {
      logger.warn(
        `[PresentationAlertWorker] telemetry load failed for deck ${deckId}`,
        error
      );
    }
    return null;
  }
}

async function buildWatchlistEntriesForOrg(orgId: string): Promise<WatchlistEntryInput[]> {
  const deckRows = await loadDeckRows(orgId);
  if (deckRows.length === 0) return [];

  const cutoffIso = new Date(
    Date.now() - TELEMETRY_WINDOW_DAYS * 86_400_000
  ).toISOString();

  // Lazy import keeps the worker from pulling the gate stack into the test
  // bundle when only the pure cycle is exercised.
  const { checkDeckQualityGates } = await import(
    '../src/services/presentationQualityGatesService.js'
  );

  const inputs: WatchlistEntryInput[] = [];
  for (const deckRow of deckRows) {
    const deckId = String(deckRow?.id ?? '');
    if (!deckId) continue;
    const title =
      typeof deckRow?.title === 'string' && deckRow.title.length > 0
        ? deckRow.title
        : 'Untitled deck';
    const updatedAt =
      typeof deckRow?.updated_at === 'string' ? deckRow.updated_at : null;
    const confidentialityLevel = resolvePresentationDeckConfidentiality(deckRow);

    let qualityReport: any = null;
    try {
      qualityReport = await checkDeckQualityGates(orgId, deckId);
    } catch (error) {
      logger.warn(
        `[PresentationAlertWorker] quality gates failed for deck ${deckId}`,
        error
      );
    }

    const telemetryRollup = await loadTelemetryRollupForDeck(orgId, deckId, cutoffIso);

    try {
      const card = buildPresentationGovernanceCard({
        deckId,
        qualityReport,
        confidentialityLevel,
        callerRole: 'SUPERADMIN',
        telemetryRollup: telemetryRollup
          ? {
              windowDays: telemetryRollup.windowDays,
              totals: telemetryRollup.totals,
              lastActivityAt: telemetryRollup.lastActivityAt,
            }
          : null,
      });

      inputs.push({
        deckId,
        title,
        confidentialityLevel,
        updatedAt,
        card: {
          overallVerdict: card.overallVerdict,
          quality: {
            p0: card.quality.p0,
            p1: card.quality.p1,
            p2: card.quality.p2,
            gateCount: card.quality.gateCount,
          },
          telemetry: {
            exportsBlocked: card.telemetry.exportsBlocked,
            lastActivityAt: card.telemetry.lastActivityAt,
          },
        },
      });
    } catch (error) {
      logger.warn(
        `[PresentationAlertWorker] governance card build failed for deck ${deckId}`,
        error
      );
      inputs.push({
        deckId,
        title,
        confidentialityLevel,
        updatedAt,
        card: {
          overallVerdict: 'INCONCLUSIVE',
          quality: { p0: 0, p1: 0, p2: 0, gateCount: 0 },
          telemetry: { exportsBlocked: 0, lastActivityAt: null },
        },
      });
    }
  }
  return inputs;
}

// ---------------------------------------------------------------------------
// Per-org cycle
// ---------------------------------------------------------------------------

interface DispatchAggregate {
  sent: number;
  failed: number;
  suppressed: number;
  dryRun: number;
  attempted: number;
}

interface OrgCycleResult {
  organizationId: string;
  skipped: boolean;
  skippedReason?: string;
  durationMs: number;
  transitions: number;
  dispatched: DispatchAggregate;
  paused: boolean;
  failuresInARow: number;
  error?: string;
}

function emptyDispatchAggregate(): DispatchAggregate {
  return { sent: 0, failed: 0, suppressed: 0, dryRun: 0, attempted: 0 };
}

async function dispatchTransitions(
  organizationId: string,
  transitions: WorkerTransition[],
  nowIso: string
): Promise<DispatchAggregate> {
  const agg = emptyDispatchAggregate();
  for (const transition of transitions) {
    try {
      const summary = await dispatchAlertsForTransition({
        deckId: transition.deckId,
        deckTitle: transition.deckTitle,
        fromVerdict: transition.fromVerdict,
        toVerdict: transition.toVerdict as AlertSeverity,
        organizationId,
        generatedAt: nowIso,
      });
      agg.attempted += summary.attempted;
      agg.sent += summary.sent;
      agg.failed += summary.failed;
      agg.suppressed += summary.suppressed;
      agg.dryRun += summary.dryRun;
    } catch (error) {
      // Per-transition failures must NOT bubble out of the cycle.
      agg.failed += 1;
      logger.warn(
        `[PresentationAlertWorker] dispatchAlertsForTransition threw for deck ${transition.deckId}`,
        error
      );
    }
  }
  return agg;
}

interface ProcessOrgInternalOpts {
  /** TEST ONLY — force-throw inside the cycle so failures_in_a_row increments. */
  simulateFailure?: boolean;
}

async function processOrganization(
  args: CliArgs,
  organizationId: string,
  internalOpts?: ProcessOrgInternalOpts
): Promise<OrgCycleResult> {
  const startedAt = Date.now();
  const result: OrgCycleResult = {
    organizationId,
    skipped: false,
    durationMs: 0,
    transitions: 0,
    dispatched: emptyDispatchAggregate(),
    paused: false,
    failuresInARow: 0,
  };

  const stateRow = await loadWorkerState(organizationId);
  const previouslyPaused =
    stateRow?.paused === true || stateRow?.paused === 1 || stateRow?.paused === 't';
  const previousFailures = Math.max(0, Number(stateRow?.failures_in_a_row || 0) || 0);

  if (previouslyPaused) {
    result.skipped = true;
    result.skippedReason = stateRow?.paused_reason || 'paused';
    result.paused = true;
    result.failuresInARow = previousFailures;
    result.durationMs = Date.now() - startedAt;
    return result;
  }

  let nextSnapshotJson: string | null = stateRow?.last_snapshot_json ?? null;
  let nextFailures = previousFailures;
  let paused = false;
  let pausedReason: string | null = null;

  try {
    if (internalOpts?.simulateFailure) {
      // TEST ONLY — exercises the failures_in_a_row + auto-pause path without
      // requiring a real DB outage. Never used in production.
      throw new Error('test_simulated_cycle_failure');
    }

    const override = __testHooks.watchlistOverrides.get(organizationId);
    const current = override ?? (await buildWatchlistEntriesForOrg(organizationId));
    const watchlist = buildPresentationGovernanceWatchlist(current, {
      onlyBlocked: false,
      limit: 500,
    });
    const previous = parseStoredSnapshot(stateRow?.last_snapshot_json ?? null);
    const nowIso = new Date().toISOString();

    const cycleOutput = runAlertWorkerCycle({
      state: {
        organizationId,
        lastSnapshot: previous,
      },
      current: watchlist.entries,
      nowIso,
    });

    nextSnapshotJson = cycleOutput.nextSnapshotJson;
    result.transitions = cycleOutput.transitions.length;

    if (!args.dryRun && cycleOutput.transitions.length > 0) {
      result.dispatched = await dispatchTransitions(
        organizationId,
        cycleOutput.transitions,
        nowIso
      );
    }

    nextFailures = 0;
  } catch (error) {
    nextFailures = previousFailures + 1;
    paused = nextFailures >= MAX_CONSECUTIVE_FAILURES;
    pausedReason = paused ? 'too_many_failures' : null;
    result.error = String((error as { message?: unknown })?.message ?? error);
    logger.warn(
      `[PresentationAlertWorker] cycle failed for org ${organizationId}`,
      error
    );
  }

  const durationMs = Date.now() - startedAt;

  const summaryJson = JSON.stringify({
    transitions: result.transitions,
    dispatched: {
      sent: result.dispatched.sent,
      failed: result.dispatched.failed,
      suppressed: result.dispatched.suppressed,
      dryRun: result.dispatched.dryRun,
      attempted: result.dispatched.attempted,
    },
    durationMs,
    dryRun: args.dryRun,
    error: result.error || null,
  });

  await upsertWorkerState({
    organizationId,
    lastSnapshotJson: nextSnapshotJson,
    lastRunSummary: summaryJson,
    failuresInARow: nextFailures,
    paused,
    pausedReason,
  });

  result.durationMs = durationMs;
  result.paused = paused;
  result.failuresInARow = nextFailures;
  return result;
}

// ---------------------------------------------------------------------------
// Cycle / loop driver
// ---------------------------------------------------------------------------

interface CycleReport {
  cycleIndex: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  organizations: OrgCycleResult[];
  totals: {
    organizations: number;
    skipped: number;
    transitions: number;
    sent: number;
    failed: number;
    suppressed: number;
    dryRun: number;
    paused: number;
    cycleErrors: number;
  };
}

function summarizeCycle(
  cycleIndex: number,
  startedAt: number,
  org: OrgCycleResult[]
): CycleReport {
  const completed = Date.now();
  const totals = {
    organizations: org.length,
    skipped: 0,
    transitions: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    dryRun: 0,
    paused: 0,
    cycleErrors: 0,
  };
  for (const r of org) {
    if (r.skipped) totals.skipped += 1;
    if (r.paused) totals.paused += 1;
    if (r.error) totals.cycleErrors += 1;
    totals.transitions += r.transitions;
    totals.sent += r.dispatched.sent;
    totals.failed += r.dispatched.failed;
    totals.suppressed += r.dispatched.suppressed;
    totals.dryRun += r.dispatched.dryRun;
  }
  return {
    cycleIndex,
    startedAt: new Date(startedAt).toISOString(),
    completedAt: new Date(completed).toISOString(),
    durationMs: completed - startedAt,
    organizations: org,
    totals,
  };
}

function printCycleSummary(quiet: boolean, report: CycleReport): void {
  logLine(quiet, '');
  logLine(
    quiet,
    `Cycle ${report.cycleIndex} (${report.startedAt} -> ${report.completedAt}, ${report.durationMs}ms)`
  );
  logLine(
    quiet,
    `- Organizations: ${report.totals.organizations} (skipped=${report.totals.skipped}, paused=${report.totals.paused}, errors=${report.totals.cycleErrors})`
  );
  logLine(
    quiet,
    `- Transitions: ${report.totals.transitions} (sent=${report.totals.sent}, failed=${report.totals.failed}, suppressed=${report.totals.suppressed}, dry_run=${report.totals.dryRun})`
  );
  for (const org of report.organizations) {
    if (org.skipped) {
      logLine(quiet, `  · ${org.organizationId}: SKIPPED (${org.skippedReason})`);
      continue;
    }
    if (org.error) {
      logLine(
        quiet,
        `  · ${org.organizationId}: ERROR ${org.error} (failures_in_a_row=${org.failuresInARow}${org.paused ? ', PAUSED' : ''})`
      );
      continue;
    }
    logLine(
      quiet,
      `  · ${org.organizationId}: transitions=${org.transitions} sent=${org.dispatched.sent} failed=${org.dispatched.failed} dry_run=${org.dispatched.dryRun} (${org.durationMs}ms)`
    );
  }
}

function appendReportFile(targetPath: string, report: CycleReport): void {
  const abs = path.resolve(process.cwd(), targetPath);
  const dir = path.dirname(abs);
  if (dir && dir !== '.' && dir !== '') {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(abs, `${JSON.stringify(report)}\n`, 'utf8');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runCycle(args: CliArgs, cycleIndex: number): Promise<CycleReport> {
  const orgIds = await resolveTargetOrganizationIds(args);
  const startedAt = Date.now();
  const orgResults: OrgCycleResult[] = [];
  for (const orgId of orgIds) {
    try {
      const result = await processOrganization(args, orgId);
      orgResults.push(result);
    } catch (error) {
      // Defensive: processOrganization itself swallows errors, but the
      // contract says the worker NEVER throws out of a cycle.
      orgResults.push({
        organizationId: orgId,
        skipped: false,
        durationMs: 0,
        transitions: 0,
        dispatched: emptyDispatchAggregate(),
        paused: false,
        failuresInARow: 0,
        error: String((error as { message?: unknown })?.message ?? error),
      });
      logger.warn(
        `[PresentationAlertWorker] processOrganization threw for ${orgId}`,
        error
      );
    }
  }
  return summarizeCycle(cycleIndex, startedAt, orgResults);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runResetMode(args: CliArgs): Promise<number> {
  const orgIds = await resolveTargetOrganizationIds(args);
  if (orgIds.length === 0) {
    logLine(args.quiet, '[PresentationAlertWorker] reset-state: no target organizations.');
    return EXIT_OK;
  }
  let successes = 0;
  for (const orgId of orgIds) {
    const ok = await resetWorkerState(orgId);
    if (ok) successes += 1;
  }
  logLine(
    args.quiet,
    `[PresentationAlertWorker] reset-state: ${successes}/${orgIds.length} orgs cleared.`
  );
  return EXIT_OK;
}

async function run(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    logError(`Argument error: ${parsed.error}`);
    return EXIT_ARG_ERROR;
  }
  const args = parsed.args;

  if (args.resetState) {
    return runResetMode(args);
  }

  let cycleIndex = 0;
  let aggregateSent = 0;
  let aggregateFailed = 0;
  let aggregateTransitions = 0;

  while (true) {
    cycleIndex += 1;
    let report: CycleReport;
    try {
      report = await runCycle(args, cycleIndex);
    } catch (error) {
      // Final safety net — should not be reachable.
      logger.error(
        '[PresentationAlertWorker] runCycle threw — continuing after sleep',
        error
      );
      report = summarizeCycle(cycleIndex, Date.now(), []);
    }

    aggregateSent += report.totals.sent;
    aggregateFailed += report.totals.failed;
    aggregateTransitions += report.totals.transitions;

    printCycleSummary(args.quiet, report);

    if (args.reportFile) {
      try {
        appendReportFile(args.reportFile, report);
      } catch (error) {
        logger.warn('[PresentationAlertWorker] Failed to write cycle report', error);
      }
    }

    if (args.once) break;
    if (args.maxCycles > 0 && cycleIndex >= args.maxCycles) break;

    await sleep(args.intervalMs);
  }

  logLine(
    args.quiet,
    `\nWorker complete. cycles=${cycleIndex} transitions=${aggregateTransitions} sent=${aggregateSent} failed=${aggregateFailed}`
  );

  return EXIT_OK;
}

async function main(): Promise<void> {
  let exitCode = EXIT_RUNTIME;
  try {
    exitCode = await run();
  } catch (error) {
    const message = (error as { message?: unknown })?.message ?? String(error);
    logError(`Runtime error: ${String(message)}`);
    logger.error('[PresentationAlertWorker] Unhandled failure', {
      error: String(message),
    });
    exitCode = EXIT_RUNTIME;
  }
  // eslint-disable-next-line no-console
  console.log(`Exit code: ${exitCode}`);
  process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Test surface
// ---------------------------------------------------------------------------

export interface RunSingleCycleOptions {
  /**
   * When `true`, the worker still runs the full diff + dispatch pipeline but
   * the integration harness is expected to install a fake `globalThis.fetch`
   * so no real outbound POST is made. Kept as an option for parity with the
   * CLI's `--dry-run` flag.
   */
  dryRun?: boolean;
  /** TEST ONLY — force-throw inside the cycle to exercise failures_in_a_row + auto-pause. */
  simulateFailure?: boolean;
}

export interface RunSingleCycleResult {
  organizationId: string;
  transitions: number;
  dispatched: { sent: number; failed: number; suppressed: number; dryRun: number };
  errored: boolean;
  errorMessage?: string;
  durationMs: number;
}

/**
 * Run a single per-org diff cycle and return a compact summary. Intended to
 * be called from the integration test harness; the CLI loop continues to
 * use `processOrganization` directly via `runCycle`.
 */
export async function runSingleCycleForTest(
  organizationId: string,
  opts?: RunSingleCycleOptions
): Promise<RunSingleCycleResult> {
  const args: CliArgs = {
    organizationIds: [organizationId],
    once: true,
    intervalMs: DEFAULT_INTERVAL_MS,
    // Tests rely on a fake fetch; we always run the full pipeline so dispatch
    // audit rows (incl. signature metadata) are persisted.
    dryRun: false,
    maxCycles: 1,
    reportFile: null,
    quiet: true,
    resetState: false,
  };

  const orgResult = await processOrganization(args, organizationId, {
    simulateFailure: opts?.simulateFailure === true,
  });

  return {
    organizationId,
    transitions: orgResult.transitions,
    dispatched: {
      sent: orgResult.dispatched.sent,
      failed: orgResult.dispatched.failed,
      suppressed: orgResult.dispatched.suppressed,
      dryRun: orgResult.dispatched.dryRun,
    },
    errored: typeof orgResult.error === 'string' && orgResult.error.length > 0,
    errorMessage: orgResult.error,
    durationMs: orgResult.durationMs,
  };
}

// ---------------------------------------------------------------------------
// Entry-point guard
// ---------------------------------------------------------------------------

const __cliEntry: boolean = (() => {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return import.meta.url === pathToFileURL(argv1).href;
  } catch {
    return false;
  }
})();

if (__cliEntry) {
  void main();
}
