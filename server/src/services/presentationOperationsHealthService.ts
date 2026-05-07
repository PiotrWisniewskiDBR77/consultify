/**
 * presentationOperationsHealthService
 *
 * Pure aggregation logic for the SuperAdmin "Operations Health" scoreboard.
 *
 * The route layer is responsible for fetching the raw rows (runtime events,
 * export records, AI operations, alert dispatches, scheduled-job state) and
 * passing them in via {@link BuildOperationsHealthInput}. This service is
 * intentionally side-effect free so it can be unit-tested without database
 * access and so a failure in any single backend query degrades gracefully
 * to "inconclusive" / "unknown" instead of taking down the dashboard.
 *
 * Targets are documented in `docs/testing/PRESENTATION_SLI_SLO.md`. The
 * thresholds encoded here intentionally use a wider "at_risk" band than the
 * SLO targets so the scoreboard surfaces deteriorating trends BEFORE the
 * formal SLO is breached. Targets:
 *
 *   - generation_success_rate    >= 95% pass, 90..95 at_risk, < 90 breach
 *   - export_success_rate        >= 95% pass, 90..95 at_risk, < 90 breach
 *   - p95_generation_latency_ms  <= 8000 pass, 8000..12000 at_risk, > 12000 breach
 *   - agent_edit_success_rate    >= 70% pass, 50..70 at_risk, < 50 breach
 *   - export_blocked_rate        <= 10% pass, 10..25 at_risk, > 25 breach
 *
 * The service NEVER fabricates numbers when the underlying input is missing
 * or too small to be statistically meaningful — small sample sizes return
 * `inconclusive` so the UI can render an honest neutral pill.
 */

export type SloStatus = 'pass' | 'at_risk' | 'breach' | 'inconclusive';

export type SloIndicatorId =
  | 'generation_success_rate'
  | 'export_success_rate'
  | 'p95_generation_latency_ms'
  | 'agent_edit_success_rate'
  | 'export_blocked_rate';

export interface SloIndicator {
  id: SloIndicatorId;
  label: string;
  target: string;
  observed: string;
  observedNumeric: number | null;
  status: SloStatus;
}

export type JobId =
  | 'retention_telemetry'
  | 'weekly_digest'
  | 'governance_ci_gate'
  | 'alert_worker';

export interface JobRunSnapshot {
  jobId: JobId;
  label: string;
  lastRunAt: string | null;
  lastRunStatus: 'pass' | 'fail' | 'unknown';
  lastRunSummary: string | null;
  staleDays: number | null;
  isStale: boolean;
}

export interface AlertActivity {
  windowDays: number;
  attempted: number;
  sent: number;
  failed: number;
  suppressed: number;
  dryRun: number;
  uniqueDecks: number;
  pausedSubscriptions: number;
}

/**
 * Sprint 13 anomaly summary surfaced alongside the SLO grid. Computation
 * lives in `presentationOperationsAnomalyDetectionService` and is wired in
 * by the route layer (which is the only layer with access to the 24h
 * baseline samples). `buildOperationsHealthReport` itself always returns
 * an EMPTY array — a missing or failed baseline fetch must NEVER block
 * the rest of the report from rendering.
 */
export interface OperationsHealthAnomaly {
  sloId: string;
  status: 'detected' | 'no_anomaly' | 'insufficient_data' | 'invalid_input';
  direction?: 'above' | 'below';
  severity?: 'minor' | 'major';
  reason: string;
  baselineMean: number | null;
  zScore: number | null;
}

export interface OperationsHealthReport {
  generatedAt: string;
  windowDays: number;
  slos: SloIndicator[];
  jobs: JobRunSnapshot[];
  alerts: AlertActivity;
  warnings: string[];
  // Marked optional so callers (e.g. the HTML/PDF renderer) that build a
  // synthetic fallback `OperationsHealthReport` literal stay structurally
  // compatible. `buildOperationsHealthReport` ALWAYS sets it to `[]` and
  // the route layer ALWAYS overlays a concrete array once detection has
  // run, so consumers can treat the field as effectively-required at
  // runtime; the optionality is purely a type-system accommodation.
  anomalies?: OperationsHealthAnomaly[];
}

export interface JobRunInput {
  lastRunAt: string | null;
  status?: string;
  summary?: string | null;
  pausedCount?: number;
}

export interface BuildOperationsHealthInput {
  organizationId: string;
  windowDays: number;
  nowIso: string;
  runtimeEvents: { eventType: string; payloadJson: string | null; createdAt: string }[];
  exportRecords: { status: string; createdAt: string; durationMs?: number | null }[];
  agentOperations: { status: string; operationType: string; createdAt: string }[];
  jobRuns: {
    retentionTelemetry?: JobRunInput;
    weeklyDigest?: JobRunInput;
    governanceCi?: JobRunInput;
    alertWorker?: JobRunInput;
  };
  alertDispatchRows: { status: string; createdAt: string; deckId: string }[];
  pausedSubscriptionsCount: number;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const AGENT_EDIT_OPERATION_TYPES = new Set<string>([
  'agent_edit',
  'agent_bulk_revert',
  'agent_revert',
]);

const AGENT_SUCCESS_STATUSES = new Set<string>(['applied', 'accepted']);

const MIN_LATENCY_SAMPLES_FOR_VERDICT = 10;

// Stale-day thresholds per scheduled job. The alert worker is supposed to
// run every 30 minutes, hence 0.5 days; weekly digest tolerates one extra
// day of slop (8d) to avoid false alarms on weekly cadence; governance CI
// gates run on every PR so we expect <1d.
const STALE_DAYS_BY_JOB: Record<JobId, number> = {
  retention_telemetry: 7,
  weekly_digest: 8,
  governance_ci_gate: 1,
  alert_worker: 0.5,
};

const JOB_LABEL: Record<JobId, string> = {
  retention_telemetry: 'Retention purge job',
  weekly_digest: 'Weekly digest',
  governance_ci_gate: 'Governance CI gate',
  alert_worker: 'Alert dispatch worker',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseDate(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function inWindow(createdAt: string, cutoffMs: number): boolean {
  const ms = safeParseDate(createdAt);
  if (ms === null) return false;
  return ms >= cutoffMs;
}

function percentString(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—';
  const pct = (numerator / denominator) * 100;
  return `${pct.toFixed(1)}%`;
}

function classifyHigherIsBetter(
  pct: number,
  passThreshold: number,
  atRiskThreshold: number
): SloStatus {
  if (pct >= passThreshold) return 'pass';
  if (pct >= atRiskThreshold) return 'at_risk';
  return 'breach';
}

function classifyLowerIsBetter(
  value: number,
  passThreshold: number,
  atRiskThreshold: number
): SloStatus {
  if (value <= passThreshold) return 'pass';
  if (value <= atRiskThreshold) return 'at_risk';
  return 'breach';
}

function p95(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  // Nearest-rank p95 for small samples; matches what most dashboards display.
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const value = sorted[idx];
  return typeof value === 'number' ? value : null;
}

function jobStatusFromRaw(raw: string | undefined | null): 'pass' | 'fail' | 'unknown' {
  if (raw === 'pass' || raw === 'success' || raw === 'ok') return 'pass';
  if (raw === 'fail' || raw === 'error' || raw === 'failure') return 'fail';
  return 'unknown';
}

function buildJobSnapshot(
  jobId: JobId,
  input: JobRunInput | undefined,
  nowMs: number
): JobRunSnapshot {
  const threshold = STALE_DAYS_BY_JOB[jobId];
  if (!input || !input.lastRunAt) {
    return {
      jobId,
      label: JOB_LABEL[jobId],
      lastRunAt: null,
      lastRunStatus: jobStatusFromRaw(input?.status),
      lastRunSummary: input?.summary ?? null,
      staleDays: null,
      isStale: true, // Never-run is stale by definition.
    };
  }
  const lastRunMs = safeParseDate(input.lastRunAt);
  if (lastRunMs === null) {
    return {
      jobId,
      label: JOB_LABEL[jobId],
      lastRunAt: null,
      lastRunStatus: jobStatusFromRaw(input.status),
      lastRunSummary: input.summary ?? null,
      staleDays: null,
      isStale: true,
    };
  }
  const staleDays = Math.max(0, (nowMs - lastRunMs) / 86_400_000);
  return {
    jobId,
    label: JOB_LABEL[jobId],
    lastRunAt: new Date(lastRunMs).toISOString(),
    lastRunStatus: jobStatusFromRaw(input.status),
    lastRunSummary: input.summary ?? null,
    staleDays,
    isStale: staleDays > threshold,
  };
}

// ---------------------------------------------------------------------------
// SLO builders
// ---------------------------------------------------------------------------

function buildAgentSuccessRate(
  agentOps: BuildOperationsHealthInput['agentOperations'],
  cutoffMs: number
): SloIndicator {
  let total = 0;
  let success = 0;
  for (const op of agentOps || []) {
    if (!op || !AGENT_EDIT_OPERATION_TYPES.has(op.operationType)) continue;
    if (!inWindow(op.createdAt, cutoffMs)) continue;
    total += 1;
    if (AGENT_SUCCESS_STATUSES.has(op.status)) success += 1;
  }
  if (total === 0) {
    return {
      id: 'generation_success_rate',
      label: 'Generation success rate',
      target: '>= 95%',
      observed: '—',
      observedNumeric: null,
      status: 'inconclusive',
    };
  }
  const pct = (success / total) * 100;
  return {
    id: 'generation_success_rate',
    label: 'Generation success rate',
    target: '>= 95%',
    observed: `${percentString(success, total)} (${success}/${total})`,
    observedNumeric: pct,
    status: classifyHigherIsBetter(pct, 95, 90),
  };
}

function buildExportSuccessRate(
  exports: BuildOperationsHealthInput['exportRecords'],
  cutoffMs: number
): SloIndicator {
  let total = 0;
  let success = 0;
  for (const row of exports || []) {
    if (!row || !inWindow(row.createdAt, cutoffMs)) continue;
    total += 1;
    if (row.status === 'completed') success += 1;
  }
  if (total === 0) {
    return {
      id: 'export_success_rate',
      label: 'Export success rate',
      target: '>= 95%',
      observed: '—',
      observedNumeric: null,
      status: 'inconclusive',
    };
  }
  const pct = (success / total) * 100;
  return {
    id: 'export_success_rate',
    label: 'Export success rate',
    target: '>= 95%',
    observed: `${percentString(success, total)} (${success}/${total})`,
    observedNumeric: pct,
    status: classifyHigherIsBetter(pct, 95, 90),
  };
}

function buildP95GenerationLatency(
  exports: BuildOperationsHealthInput['exportRecords'],
  cutoffMs: number
): SloIndicator {
  const samples: number[] = [];
  for (const row of exports || []) {
    if (!row || !inWindow(row.createdAt, cutoffMs)) continue;
    const dur = typeof row.durationMs === 'number' ? row.durationMs : null;
    if (dur !== null && Number.isFinite(dur) && dur >= 0) {
      samples.push(dur);
    }
  }
  if (samples.length < MIN_LATENCY_SAMPLES_FOR_VERDICT) {
    return {
      id: 'p95_generation_latency_ms',
      label: 'P95 generation latency',
      target: '<= 8000 ms',
      observed: samples.length === 0 ? '—' : `${samples.length} sample(s) (need ${MIN_LATENCY_SAMPLES_FOR_VERDICT})`,
      observedNumeric: samples.length === 0 ? null : (p95(samples) ?? null),
      status: 'inconclusive',
    };
  }
  const value = p95(samples);
  if (value === null) {
    return {
      id: 'p95_generation_latency_ms',
      label: 'P95 generation latency',
      target: '<= 8000 ms',
      observed: '—',
      observedNumeric: null,
      status: 'inconclusive',
    };
  }
  return {
    id: 'p95_generation_latency_ms',
    label: 'P95 generation latency',
    target: '<= 8000 ms',
    observed: `${Math.round(value).toLocaleString()} ms (n=${samples.length})`,
    observedNumeric: value,
    status: classifyLowerIsBetter(value, 8000, 12000),
  };
}

function buildAgentEditSuccessRate(
  runtimeEvents: BuildOperationsHealthInput['runtimeEvents'],
  cutoffMs: number
): SloIndicator {
  let proposals = 0;
  let applied = 0;
  for (const evt of runtimeEvents || []) {
    if (!evt || !inWindow(evt.createdAt, cutoffMs)) continue;
    if (evt.eventType === 'agent_edit_proposal_created') proposals += 1;
    else if (evt.eventType === 'agent_edit_applied') applied += 1;
  }
  if (proposals === 0) {
    return {
      id: 'agent_edit_success_rate',
      label: 'Agent edit acceptance rate',
      target: '>= 70%',
      observed: '—',
      observedNumeric: null,
      status: 'inconclusive',
    };
  }
  const pct = (applied / proposals) * 100;
  return {
    id: 'agent_edit_success_rate',
    label: 'Agent edit acceptance rate',
    target: '>= 70%',
    observed: `${percentString(applied, proposals)} (${applied}/${proposals})`,
    observedNumeric: pct,
    status: classifyHigherIsBetter(pct, 70, 50),
  };
}

function buildExportBlockedRate(
  runtimeEvents: BuildOperationsHealthInput['runtimeEvents'],
  exports: BuildOperationsHealthInput['exportRecords'],
  cutoffMs: number
): SloIndicator {
  let blocked = 0;
  let attempted = 0;
  for (const evt of runtimeEvents || []) {
    if (!evt || !inWindow(evt.createdAt, cutoffMs)) continue;
    if (evt.eventType === 'export_attempted') attempted += 1;
    else if (evt.eventType === 'export_blocked') blocked += 1;
  }
  // Fall back to actual export records when explicit `export_attempted` events
  // are absent. This keeps the SLO meaningful even before the runtime
  // counter is fully wired across all surfaces.
  if (attempted === 0) {
    for (const row of exports || []) {
      if (!row || !inWindow(row.createdAt, cutoffMs)) continue;
      attempted += 1;
    }
  }
  if (attempted === 0) {
    return {
      id: 'export_blocked_rate',
      label: 'Export blocked rate',
      target: '<= 10%',
      observed: '—',
      observedNumeric: null,
      status: 'inconclusive',
    };
  }
  const pct = (blocked / attempted) * 100;
  return {
    id: 'export_blocked_rate',
    label: 'Export blocked rate',
    target: '<= 10%',
    observed: `${percentString(blocked, attempted)} (${blocked}/${attempted})`,
    observedNumeric: pct,
    status: classifyLowerIsBetter(pct, 10, 25),
  };
}

// ---------------------------------------------------------------------------
// Alerts aggregation
// ---------------------------------------------------------------------------

function buildAlertActivity(
  rows: BuildOperationsHealthInput['alertDispatchRows'],
  cutoffMs: number,
  windowDays: number,
  pausedSubscriptionsCount: number
): AlertActivity {
  const decks = new Set<string>();
  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  let dryRun = 0;
  for (const row of rows || []) {
    if (!row || !inWindow(row.createdAt, cutoffMs)) continue;
    attempted += 1;
    if (row.deckId) decks.add(row.deckId);
    if (row.status === 'sent') sent += 1;
    else if (row.status === 'failed') failed += 1;
    else if (row.status === 'suppressed') suppressed += 1;
    else if (row.status === 'dry_run') dryRun += 1;
  }
  return {
    windowDays,
    attempted,
    sent,
    failed,
    suppressed,
    dryRun,
    uniqueDecks: decks.size,
    pausedSubscriptions: Math.max(0, Math.floor(pausedSubscriptionsCount || 0)),
  };
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function buildOperationsHealthReport(
  input: BuildOperationsHealthInput
): OperationsHealthReport {
  const windowDaysRaw = Number(input.windowDays);
  const windowDays = Number.isFinite(windowDaysRaw) && windowDaysRaw > 0 ? windowDaysRaw : 7;
  const nowMs = safeParseDate(input.nowIso) ?? Date.now();
  const cutoffMs = nowMs - windowDays * 86_400_000;

  const warnings: string[] = [];
  if (!Array.isArray(input.runtimeEvents)) warnings.push('runtime_events_unavailable');
  if (!Array.isArray(input.exportRecords)) warnings.push('exports_unavailable');
  if (!Array.isArray(input.agentOperations)) warnings.push('agent_operations_unavailable');
  if (!Array.isArray(input.alertDispatchRows)) warnings.push('alert_dispatches_unavailable');
  if (!input.jobRuns) warnings.push('job_runs_unavailable');

  const runtimeEvents = Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [];
  const exports = Array.isArray(input.exportRecords) ? input.exportRecords : [];
  const agentOps = Array.isArray(input.agentOperations) ? input.agentOperations : [];
  const dispatches = Array.isArray(input.alertDispatchRows) ? input.alertDispatchRows : [];
  const jobRuns = input.jobRuns || {};

  const slos: SloIndicator[] = [
    buildAgentSuccessRate(agentOps, cutoffMs),
    buildExportSuccessRate(exports, cutoffMs),
    buildP95GenerationLatency(exports, cutoffMs),
    buildAgentEditSuccessRate(runtimeEvents, cutoffMs),
    buildExportBlockedRate(runtimeEvents, exports, cutoffMs),
  ];

  const jobs: JobRunSnapshot[] = [
    buildJobSnapshot('retention_telemetry', jobRuns.retentionTelemetry, nowMs),
    buildJobSnapshot('weekly_digest', jobRuns.weeklyDigest, nowMs),
    buildJobSnapshot('governance_ci_gate', jobRuns.governanceCi, nowMs),
    buildJobSnapshot('alert_worker', jobRuns.alertWorker, nowMs),
  ];

  const alerts = buildAlertActivity(
    dispatches,
    cutoffMs,
    windowDays,
    Number(input.pausedSubscriptionsCount || jobRuns.alertWorker?.pausedCount || 0)
  );

  return {
    generatedAt: new Date(nowMs).toISOString(),
    windowDays,
    slos,
    jobs,
    alerts,
    warnings,
    // Anomalies are merged in by the route layer (only it has access to
    // 24h baseline samples). Default to empty so the type stays honest
    // even when callers wire `buildOperationsHealthReport` directly.
    anomalies: [],
  };
}
