/**
 * presentationIncidentClassificationService
 *
 * Pure-logic helper used by the SuperAdmin Operations Health view to
 * recommend an incident runbook (RB-01..RB-04) based on the current
 * scoreboard signal pattern. Closes Epic J3 in the
 * `PRESENTATION_ARTIFACT_ENGINE_SYSTEM_AND_BACKLOG.md` plan.
 *
 * Determinism contract (CRITICAL):
 *
 *   - The classification is a pure function of its `IncidentSignals`
 *     input. It NEVER reads the wall-clock, NEVER calls a random source,
 *     and NEVER touches I/O. The same input always yields the same
 *     output.
 *   - The function NEVER throws. Any unexpected/garbage value is treated
 *     as "no signal" so the parent dashboard cannot be taken down by a
 *     malformed payload.
 *   - The output is JSON-serializable so it can be embedded in a
 *     runtime event or a `ClassifyIncident` audit row without further
 *     transformation.
 *
 * Priority order (the FIRST rule that matches wins):
 *
 *   1. Template corruption — `blockedP0SharedTemplateId` set AND
 *      `blockedP0DecksCount >= MIN_TEMPLATE_CLUSTER_SIZE` (= 3) →
 *      RB-04, P0. Templates are shared infrastructure, so this is the
 *      most severe runbook even when the percent rates look "OK".
 *   2. Export success rate breach — observed value < 90% OR a `major`
 *      anomaly on `export_success_rate` → RB-02, P1.
 *   3. Latency breach — p95 generation latency > 90000 ms OR a `major`
 *      anomaly on `p95_generation_latency_ms` → RB-03, P1.
 *   4. Blocked rate breach — observed value > 20% OR a `major` anomaly
 *      on `export_blocked_rate` → RB-01, P1.
 *   5. Major anomaly without a specific signal → no runbook, manual
 *      reason returned.
 *   6. No relevant signal → "No incident detected".
 *
 * The thresholds match the steady-state pill thresholds documented in
 * `presentationOperationsHealthService.ts` and the SLO targets in
 * `docs/testing/PRESENTATION_SLI_SLO.md`. Tuning these constants here
 * means tuning the runbook routing — keep them in sync with the SLO
 * service if you ever revise the thresholds upstream.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RunbookId = 'RB-01' | 'RB-02' | 'RB-03' | 'RB-04' | null;

export type IncidentSeverity = 'P0' | 'P1' | 'P2';

export interface IncidentAnomalySignal {
  sloId: string;
  severity: 'minor' | 'major';
}

export interface IncidentSignals {
  /** export_blocked_rate as a fraction in [0, 1]; null when unknown. */
  exportBlockedRate: number | null;
  /** export_success_rate as a fraction in [0, 1]; null when unknown. */
  exportSuccessRate: number | null;
  /** p95 generation latency in milliseconds; null when unknown. */
  p95GenerationLatencyMs: number | null;
  /** Number of decks currently in BLOCKED_P0 verdict. */
  blockedP0DecksCount: number;
  /**
   * `template_id` shared by >= MIN_TEMPLATE_CLUSTER_SIZE blocked decks.
   * Caller derives this by grouping the watchlist by `template_id` and
   * picking the dominant one (or null if no template dominates).
   */
  blockedP0SharedTemplateId: string | null;
  /** Anomaly detector verdicts for the active window. Empty is fine. */
  anomalies: IncidentAnomalySignal[];
}

export interface IncidentClassification {
  runbook: RunbookId;
  reason: string;
  severity: IncidentSeverity | null;
  recommendedActions: string[];
}

// ---------------------------------------------------------------------------
// Tuning constants — keep aligned with `presentationOperationsHealthService`
// ---------------------------------------------------------------------------

/** Templates: at least this many BLOCKED_P0 decks sharing a template_id. */
export const MIN_TEMPLATE_CLUSTER_SIZE = 3;

/** Export success rate breach threshold (fraction in [0,1]). */
export const EXPORT_SUCCESS_RATE_BREACH = 0.9;

/** Latency breach threshold for the runbook trigger (milliseconds). */
export const LATENCY_BREACH_MS = 90_000;

/** Export blocked rate breach threshold (fraction in [0,1]). */
export const EXPORT_BLOCKED_RATE_BREACH = 0.2;

// ---------------------------------------------------------------------------
// Recommended-action starter lists (mirror the first 3 containment steps of
// each runbook). Frozen so callers cannot mutate the shared arrays.
// ---------------------------------------------------------------------------

const RB01_ACTIONS: readonly string[] = Object.freeze([
  'Pause auto-publish / auto-export jobs (run-presentation-alert-worker.ts --pause-once).',
  'Suppress further alerts: UPDATE presentation_governance_alert_subscriptions SET active = FALSE for the affected org.',
  'Snapshot affected decks via npm run drive:snapshot before any recovery action.',
]);

const RB02_ACTIONS: readonly string[] = Object.freeze([
  'Group last-hour failures by error_reason in presentation_export_records.',
  'Health-check the Playwright PDF renderer endpoint (/api/presentations/health/pdf-renderer).',
  'Roll back the most recent export-pipeline deploy if a regression is suspected.',
]);

const RB03_ACTIONS: readonly string[] = Object.freeze([
  "Find stuck jobs: SELECT id, deck_id FROM presentation_ai_operations WHERE status='in_progress' AND started_at < NOW() - INTERVAL '5 minutes'.",
  "Mark them failed with error_reason='timed_out_by_runbook' to free the queue.",
  'Pause new generation submissions if the queue depth exceeds 200.',
]);

const RB04_ACTIONS: readonly string[] = Object.freeze([
  'Deprecate the corrupted template via POST /templates/:id/governance/deprecate.',
  'Identify the last-known-good template version through the lineage_root_id chain.',
  'Block new decks from using the corrupted template (verify picker no longer lists it).',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  return Math.floor(value);
}

function safeAnomalies(input: unknown): IncidentAnomalySignal[] {
  if (!Array.isArray(input)) return [];
  const out: IncidentAnomalySignal[] = [];
  for (const a of input) {
    if (!a || typeof a !== 'object') continue;
    const sloId = (a as { sloId?: unknown }).sloId;
    const severity = (a as { severity?: unknown }).severity;
    if (typeof sloId !== 'string' || sloId.length === 0) continue;
    if (severity !== 'minor' && severity !== 'major') continue;
    out.push({ sloId, severity });
  }
  return out;
}

function hasMajorAnomaly(
  anomalies: IncidentAnomalySignal[],
  sloId: string
): boolean {
  for (const a of anomalies) {
    if (a.sloId === sloId && a.severity === 'major') return true;
  }
  return false;
}

function hasAnyMajorAnomaly(anomalies: IncidentAnomalySignal[]): boolean {
  for (const a of anomalies) {
    if (a.severity === 'major') return true;
  }
  return false;
}

function copyActions(actions: readonly string[]): string[] {
  return actions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

/**
 * Classify the current operations-health signal pattern into a runbook
 * recommendation. NEVER throws; on any malformed input a "no incident
 * detected" envelope is returned. See file-level priority order docs.
 */
export function classifyIncident(
  input: IncidentSignals | null | undefined
): IncidentClassification {
  try {
    if (!input || typeof input !== 'object') {
      return noIncident();
    }

    const exportBlockedRate = isFiniteNumber(input.exportBlockedRate)
      ? input.exportBlockedRate
      : null;
    const exportSuccessRate = isFiniteNumber(input.exportSuccessRate)
      ? input.exportSuccessRate
      : null;
    const p95GenerationLatencyMs = isFiniteNumber(input.p95GenerationLatencyMs)
      ? input.p95GenerationLatencyMs
      : null;
    const blockedP0DecksCount = nonNegativeInt(input.blockedP0DecksCount);
    const blockedP0SharedTemplateId =
      typeof input.blockedP0SharedTemplateId === 'string' &&
      input.blockedP0SharedTemplateId.length > 0
        ? input.blockedP0SharedTemplateId
        : null;
    const anomalies = safeAnomalies(input.anomalies);

    // 1. Template corruption — highest priority. Even if the rates look
    //    OK, a shared-template cluster is a fast-spreading outage.
    if (
      blockedP0SharedTemplateId !== null &&
      blockedP0DecksCount >= MIN_TEMPLATE_CLUSTER_SIZE
    ) {
      return {
        runbook: 'RB-04',
        severity: 'P0',
        reason: `Detected ${blockedP0DecksCount} BLOCKED_P0 decks sharing template_id=${blockedP0SharedTemplateId} (threshold ${MIN_TEMPLATE_CLUSTER_SIZE}). Treat as template corruption.`,
        recommendedActions: copyActions(RB04_ACTIONS),
      };
    }

    // 2. Export success rate breach.
    const exportSuccessBreach =
      exportSuccessRate !== null && exportSuccessRate < EXPORT_SUCCESS_RATE_BREACH;
    if (exportSuccessBreach || hasMajorAnomaly(anomalies, 'export_success_rate')) {
      const reason = exportSuccessBreach
        ? `export_success_rate=${(exportSuccessRate as number).toFixed(3)} is below the ${EXPORT_SUCCESS_RATE_BREACH} runbook threshold.`
        : 'Major anomaly detected on export_success_rate (current << baseline).';
      return {
        runbook: 'RB-02',
        severity: 'P1',
        reason,
        recommendedActions: copyActions(RB02_ACTIONS),
      };
    }

    // 3. Latency breach.
    const latencyBreach =
      p95GenerationLatencyMs !== null &&
      p95GenerationLatencyMs > LATENCY_BREACH_MS;
    if (latencyBreach || hasMajorAnomaly(anomalies, 'p95_generation_latency_ms')) {
      const reason = latencyBreach
        ? `p95_generation_latency_ms=${Math.round(p95GenerationLatencyMs as number)} ms is above the ${LATENCY_BREACH_MS} ms runbook threshold.`
        : 'Major anomaly detected on p95_generation_latency_ms (current >> baseline).';
      return {
        runbook: 'RB-03',
        severity: 'P1',
        reason,
        recommendedActions: copyActions(RB03_ACTIONS),
      };
    }

    // 4. Blocked rate breach (global, not template-clustered).
    const blockedBreach =
      exportBlockedRate !== null && exportBlockedRate > EXPORT_BLOCKED_RATE_BREACH;
    if (blockedBreach || hasMajorAnomaly(anomalies, 'export_blocked_rate')) {
      const reason = blockedBreach
        ? `export_blocked_rate=${(exportBlockedRate as number).toFixed(3)} is above the ${EXPORT_BLOCKED_RATE_BREACH} runbook threshold.`
        : 'Major anomaly detected on export_blocked_rate (current >> baseline).';
      return {
        runbook: 'RB-01',
        severity: 'P1',
        reason,
        recommendedActions: copyActions(RB01_ACTIONS),
      };
    }

    // 5. Major anomaly on a non-mapped SLO — return "manual" envelope so
    //    the operator still gets a hint on the dashboard.
    if (hasAnyMajorAnomaly(anomalies)) {
      const sloIds = anomalies
        .filter((a) => a.severity === 'major')
        .map((a) => a.sloId)
        .join(', ');
      return {
        runbook: null,
        severity: null,
        reason: `Major anomaly without a specific runbook mapping (sloIds: ${sloIds}). Investigate manually.`,
        recommendedActions: [],
      };
    }

    return noIncident();
  } catch {
    return noIncident();
  }
}

function noIncident(): IncidentClassification {
  return {
    runbook: null,
    severity: null,
    reason: 'No incident detected',
    recommendedActions: [],
  };
}
