/**
 * presentationOperationsHealth
 *
 * Read-only client for the SuperAdmin "Operations Health" scoreboard. Wraps:
 *   GET /api/presentations/operations/health?windowDays=N
 *
 * Mirrors the Api/fetch fallback pattern of `presentationGovernance.ts` /
 * `presentationGovernanceWatchlist.ts` and always resolves with a
 * `{ status, data?, error? }` envelope so the view can surface honest
 * forbidden / unavailable banners without crashing.
 */

import { Api } from '@/services/api';

export type OperationsHealthFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable';

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

export type AnomalyStatus =
  | 'detected'
  | 'no_anomaly'
  | 'insufficient_data'
  | 'invalid_input';

export type AnomalyDirection = 'above' | 'below';
export type AnomalySeverity = 'minor' | 'major';

/**
 * Sprint 13 anomaly summary attached per-SLO. The server runs z-score-based
 * detection against the prior 24h baseline; the UI surfaces an orange chip
 * only when `status === 'detected'`.
 */
export interface OperationsHealthAnomaly {
  sloId: string;
  status: AnomalyStatus;
  direction?: AnomalyDirection;
  severity?: AnomalySeverity;
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
  anomalies: OperationsHealthAnomaly[];
}

export interface OperationsHealthFetchResult {
  status: OperationsHealthFetchStatus;
  data?: OperationsHealthReport;
  error?: string;
}

export interface FetchOperationsHealthOptions {
  windowDays?: number;
}

const ALLOWED_SLO_IDS = new Set<SloIndicatorId>([
  'generation_success_rate',
  'export_success_rate',
  'p95_generation_latency_ms',
  'agent_edit_success_rate',
  'export_blocked_rate',
]);

const ALLOWED_SLO_STATUS = new Set<SloStatus>([
  'pass',
  'at_risk',
  'breach',
  'inconclusive',
]);

const ALLOWED_JOB_IDS = new Set<JobId>([
  'retention_telemetry',
  'weekly_digest',
  'governance_ci_gate',
  'alert_worker',
]);

const ALLOWED_JOB_STATUS = new Set<JobRunSnapshot['lastRunStatus']>([
  'pass',
  'fail',
  'unknown',
]);

const ALLOWED_ANOMALY_STATUS = new Set<AnomalyStatus>([
  'detected',
  'no_anomaly',
  'insufficient_data',
  'invalid_input',
]);

const ALLOWED_ANOMALY_DIRECTION = new Set<AnomalyDirection>(['above', 'below']);
const ALLOWED_ANOMALY_SEVERITY = new Set<AnomalySeverity>(['minor', 'major']);

const JOB_LABEL_FALLBACK: Record<JobId, string> = {
  retention_telemetry: 'Retention purge job',
  weekly_digest: 'Weekly digest',
  governance_ci_gate: 'Governance CI gate',
  alert_worker: 'Alert dispatch worker',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asSloId(value: unknown): SloIndicatorId | null {
  if (typeof value === 'string' && ALLOWED_SLO_IDS.has(value as SloIndicatorId)) {
    return value as SloIndicatorId;
  }
  return null;
}

function asSloStatus(value: unknown): SloStatus {
  if (typeof value === 'string' && ALLOWED_SLO_STATUS.has(value as SloStatus)) {
    return value as SloStatus;
  }
  return 'inconclusive';
}

function asJobId(value: unknown): JobId | null {
  if (typeof value === 'string' && ALLOWED_JOB_IDS.has(value as JobId)) {
    return value as JobId;
  }
  return null;
}

function asJobStatus(value: unknown): JobRunSnapshot['lastRunStatus'] {
  if (
    typeof value === 'string' &&
    ALLOWED_JOB_STATUS.has(value as JobRunSnapshot['lastRunStatus'])
  ) {
    return value as JobRunSnapshot['lastRunStatus'];
  }
  return 'unknown';
}

function normalizeSlo(raw: unknown): SloIndicator | null {
  if (!isRecord(raw)) return null;
  const id = asSloId(raw.id);
  if (!id) return null;
  return {
    id,
    label: asString(raw.label, id),
    target: asString(raw.target, ''),
    observed: asString(raw.observed, '—'),
    observedNumeric: asNumberOrNull(raw.observedNumeric),
    status: asSloStatus(raw.status),
  };
}

function normalizeJob(raw: unknown): JobRunSnapshot | null {
  if (!isRecord(raw)) return null;
  const jobId = asJobId(raw.jobId);
  if (!jobId) return null;
  return {
    jobId,
    label: asString(raw.label, JOB_LABEL_FALLBACK[jobId]),
    lastRunAt: asStringOrNull(raw.lastRunAt),
    lastRunStatus: asJobStatus(raw.lastRunStatus),
    lastRunSummary: asStringOrNull(raw.lastRunSummary),
    staleDays: asNumberOrNull(raw.staleDays),
    isStale: raw.isStale === true,
  };
}

function normalizeAlerts(raw: unknown, fallbackWindow: number): AlertActivity {
  const r = isRecord(raw) ? raw : {};
  return {
    windowDays: asNumber(r.windowDays, fallbackWindow),
    attempted: asNumber(r.attempted),
    sent: asNumber(r.sent),
    failed: asNumber(r.failed),
    suppressed: asNumber(r.suppressed),
    dryRun: asNumber(r.dryRun),
    uniqueDecks: asNumber(r.uniqueDecks),
    pausedSubscriptions: asNumber(r.pausedSubscriptions),
  };
}

function normalizeAnomaly(raw: unknown): OperationsHealthAnomaly | null {
  if (!isRecord(raw)) return null;
  const sloId = typeof raw.sloId === 'string' ? raw.sloId : '';
  if (!sloId) return null;
  const status =
    typeof raw.status === 'string' && ALLOWED_ANOMALY_STATUS.has(raw.status as AnomalyStatus)
      ? (raw.status as AnomalyStatus)
      : 'invalid_input';
  const direction =
    typeof raw.direction === 'string' &&
    ALLOWED_ANOMALY_DIRECTION.has(raw.direction as AnomalyDirection)
      ? (raw.direction as AnomalyDirection)
      : undefined;
  const severity =
    typeof raw.severity === 'string' &&
    ALLOWED_ANOMALY_SEVERITY.has(raw.severity as AnomalySeverity)
      ? (raw.severity as AnomalySeverity)
      : undefined;
  return {
    sloId,
    status,
    direction,
    severity,
    reason: asString(raw.reason, ''),
    baselineMean: asNumberOrNull(raw.baselineMean),
    zScore: asNumberOrNull(raw.zScore),
  };
}

function normalizeReport(raw: unknown): OperationsHealthReport | null {
  if (!isRecord(raw)) return null;
  const windowDays = asNumber(raw.windowDays, 7);

  const slos = (Array.isArray(raw.slos) ? raw.slos : [])
    .map((s) => normalizeSlo(s))
    .filter((s): s is SloIndicator => s !== null);

  const jobs = (Array.isArray(raw.jobs) ? raw.jobs : [])
    .map((j) => normalizeJob(j))
    .filter((j): j is JobRunSnapshot => j !== null);

  const warnings = (Array.isArray(raw.warnings) ? raw.warnings : [])
    .map((w) => (typeof w === 'string' ? w : null))
    .filter((w): w is string => w !== null);

  const anomalies = (Array.isArray(raw.anomalies) ? raw.anomalies : [])
    .map((a) => normalizeAnomaly(a))
    .filter((a): a is OperationsHealthAnomaly => a !== null);

  return {
    generatedAt: asString(raw.generatedAt, new Date().toISOString()),
    windowDays,
    slos,
    jobs,
    alerts: normalizeAlerts(raw.alerts, windowDays),
    warnings,
    anomalies,
  };
}

function statusFromError(err: unknown): OperationsHealthFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') {
    const code = err.status;
    if (code === 401) return 'error';
    if (code === 403) return 'forbidden';
    if (code === 404) return 'not_found';
    return 'error';
  }
  return 'unavailable';
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
}

function clampWindow(windowDays?: number): number {
  if (typeof windowDays !== 'number' || !Number.isFinite(windowDays)) return 7;
  const rounded = Math.round(windowDays);
  if (rounded < 1) return 1;
  if (rounded > 30) return 30;
  return rounded;
}

function buildPath(opts: FetchOperationsHealthOptions): string {
  const params = new URLSearchParams();
  params.set('windowDays', String(clampWindow(opts.windowDays)));
  return `/presentations/operations/health?${params.toString()}`;
}

export interface DownloadOperationsHealthPdfOptions {
  windowDays?: number;
  format?: 'html' | 'pdf';
}

export interface DownloadOperationsHealthPdfResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Triggers a browser download of the Operations Health "PDF view" via the
 * server-side export endpoint. The browser handles the actual download via
 * `Content-Disposition: attachment`, so this function returns immediately
 * with `{ ok: true }` once navigation is initiated. In non-browser
 * environments (SSR, vitest jsdom-less) it returns `{ ok: false }`.
 */
export async function downloadOperationsHealthPdf(
  opts: DownloadOperationsHealthPdfOptions = {}
): Promise<DownloadOperationsHealthPdfResult> {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return { ok: false, status: 0, error: 'No window' };
  }
  const params = new URLSearchParams();
  params.set('windowDays', String(clampWindow(opts.windowDays)));
  params.set('format', opts.format === 'pdf' ? 'pdf' : 'html');
  const url = `/api/presentations/operations/health/export?${params.toString()}`;
  try {
    window.location.assign(url);
    return { ok: true, status: 200 };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: isRecord(err) && typeof err.message === 'string' ? err.message : 'navigation_failed',
    };
  }
}

export async function fetchPresentationOperationsHealth(
  opts: FetchOperationsHealthOptions = {}
): Promise<OperationsHealthFetchResult> {
  const path = buildPath(opts);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const innerData =
        isRecord(payload) && 'data' in payload
          ? (payload as { data: unknown }).data
          : payload;
      const data = normalizeReport(innerData);
      if (!data) return { status: 'error', error: 'invalid_payload' };
      return { status: 'ok', data };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) return { status: 'error', error: 'unauthorized' };
      if (res.status === 403) return { status: 'forbidden', error: 'forbidden' };
      if (res.status === 404) return { status: 'not_found', error: 'not_found' };
      return { status: 'error', error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const innerData =
      isRecord(json) && 'data' in json ? (json as { data: unknown }).data : json;
    const data = normalizeReport(innerData);
    if (!data) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
