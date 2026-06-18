/**
 * PresentationOperationsHealthView
 *
 * Read-only SuperAdmin scoreboard that aggregates:
 *
 *   - 5 SLO indicators (generation/export success, p95 latency,
 *     agent edit acceptance, export blocked rate),
 *   - last-run snapshots for the four scheduled jobs (retention purge,
 *     weekly digest, governance CI gate, alert dispatch worker),
 *   - alert dispatch volume over the selected window.
 *
 * Source: GET /api/presentations/operations/health?windowDays=N via
 * {@link fetchPresentationOperationsHealth}. Mirrors the layout and
 * polling discipline of `PresentationGovernanceWatchlistView`:
 *
 *   - auto-refresh every 60s while the tab is visible AND the previous
 *     load was successful (toggleable, paused on hidden tab),
 *   - permission loss (`forbidden`) auto-pauses the polling loop honestly,
 *   - banners for forbidden / not_found / unavailable / error so users
 *     never see fabricated zero-counters,
 *   - "Last refreshed" wall-clock and warnings strip surfaced verbatim.
 *
 * Note: SLO classification is INTENTIONALLY computed server-side. This
 * component renders only the status pills returned by the backend so the
 * "source of truth" stays in `presentationOperationsHealthService`.
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  FileText,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
  Shield,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import IncidentRunbooksCard from '../../components/SuperAdmin/IncidentRunbooksCard';
import OperationsHealthDrilldownPanel from '../../components/SuperAdmin/OperationsHealthDrilldownPanel';
import type { DashboardDeepLink } from '../../services/presentationGovernanceDeepLinks';
import {
  downloadOperationsHealthPdf,
  fetchPresentationOperationsHealth,
  type JobRunSnapshot,
  type OperationsHealthAnomaly,
  type OperationsHealthFetchStatus,
  type OperationsHealthReport,
  type SloIndicator,
  type SloStatus,
} from '../../services/presentationOperationsHealth';
import type { DrilldownSloId } from '../../services/presentationOperationsHealthDrilldown';

const WINDOW_OPTIONS: number[] = [1, 7, 14, 30];
const DEFAULT_WINDOW_DAYS = 7;
const AUTO_REFRESH_INTERVAL_MS = 60_000;

const SLO_TONE: Record<SloStatus, string> = {
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  breach: 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300',
  inconclusive: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

const SLO_LABEL: Record<SloStatus, string> = {
  pass: 'Pass',
  at_risk: 'At risk',
  breach: 'Breach',
  inconclusive: 'Inconclusive',
};

const JOB_STATUS_TONE: Record<JobRunSnapshot['lastRunStatus'], string> = {
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  fail: 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300',
  unknown: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

const JOB_STATUS_LABEL: Record<JobRunSnapshot['lastRunStatus'], string> = {
  pass: 'Pass',
  fail: 'Fail',
  unknown: 'Unknown',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'never';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return new Date(ts).toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatClockTime(date: Date | null): string {
  if (!date) return '—';
  try {
    return date.toLocaleTimeString();
  } catch {
    return date.toISOString();
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function statusReason(status: OperationsHealthFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') {
    return 'Insufficient permission to load the operations health scoreboard.';
  }
  if (status === 'not_found') {
    return 'Operations health endpoint not found. The backend may need to be redeployed.';
  }
  if (status === 'unavailable') {
    return 'Operations health is unavailable. The backend may be offline.';
  }
  return 'Could not load the operations health scoreboard.';
}

function isPageVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

interface PresentationOperationsHealthViewProps {
  deepLink?: DashboardDeepLink;
}

const PresentationOperationsHealthView: React.FC<PresentationOperationsHealthViewProps> = ({
  deepLink,
}) => {
  // The deep-link windowDays (when present and valid) becomes the seed
  // for the window selector. We snapshot it once on mount so a stale
  // re-render with the same prop does not stomp the user's later choice.
  const initialDeepLinkRef = useRef<DashboardDeepLink | null>(deepLink ?? null);
  const initialWindowDays =
    initialDeepLinkRef.current?.windowDays != null
      ? initialDeepLinkRef.current.windowDays
      : DEFAULT_WINDOW_DAYS;

  const [windowDays, setWindowDays] = useState<number>(initialWindowDays);
  const [data, setData] = useState<OperationsHealthReport | null>(null);
  const [status, setStatus] = useState<OperationsHealthFetchStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [pageVisible, setPageVisible] = useState<boolean>(() => isPageVisible());
  // The drill-down panel is controlled at the view level so the parent's
  // 60s auto-refresh of the SLO scoreboard does NOT close it. Selecting an
  // SLO on the grid sets this id; the panel resets to null on close/Escape.
  const [activeSloId, setActiveSloId] = useState<DrilldownSloId | null>(null);
  const sloAutoOpenedRef = useRef<boolean>(false);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setHasAttempted(true);
    try {
      const result = await fetchPresentationOperationsHealth({ windowDays });
      setStatus(result.status);
      const ok = result.status === 'ok' && !!result.data;
      setData(ok && result.data ? result.data : null);
      if (ok) {
        setLastRefreshAt(new Date());
      } else if (result.status === 'forbidden') {
        // Permission revoked mid-session — stop polling honestly instead of
        // hammering a 403 every 60 seconds.
        setAutoRefresh(false);
      }
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    void handleLoad();
  }, [handleLoad]);

  // Export PDF action. The backend currently serves a print-ready HTML
  // document (the existing server-side PDF utility is deck-card-specific
  // and not reusable for arbitrary HTML). The browser handles the actual
  // download via `Content-Disposition`, so the click handler simply
  // initiates the navigation. Disabled while no successful payload is
  // present so users don't download an empty/forbidden response.
  const exportDisabled = status !== 'ok' || data === null;
  const handleExportPdf = useCallback(() => {
    if (exportDisabled) return;
    void downloadOperationsHealthPdf({ windowDays, format: 'html' });
  }, [exportDisabled, windowDays]);

  // Deep-link slo: auto-open the drill-down panel once the SLO grid has
  // arrived AND the deep-linked id is actually present in the response.
  // We never open a drill-down for an SLO that the backend isn't
  // currently rendering (would surface a stale panel for nothing).
  useEffect(() => {
    if (sloAutoOpenedRef.current) return;
    const desiredSlo = initialDeepLinkRef.current?.slo ?? null;
    if (!desiredSlo) return;
    if (!data) return;
    const hasSlo = data.slos.some((s) => s.id === desiredSlo);
    if (!hasSlo) return;
    setActiveSloId(desiredSlo as DrilldownSloId);
    sloAutoOpenedRef.current = true;
  }, [data]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => setPageVisible(isPageVisible());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Auto-refresh ticker. Restart the timer on every successful load so a
  // manual Reload also resets the 60s window. Suppressed when the tab is
  // hidden, the user paused the toggle, or the previous load did not succeed.
  useEffect(() => {
    if (!autoRefresh) return;
    if (status !== 'ok') return;
    if (!pageVisible) return;
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => {
      void handleLoad();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, status, pageVisible, lastRefreshAt, handleLoad]);

  const reasonBanner = useMemo(() => statusReason(status), [status]);
  const handleToggleAutoRefresh = useCallback(() => {
    setAutoRefresh((v) => !v);
  }, []);

  const autoRefreshPaused = autoRefresh && (status !== 'ok' || !pageVisible);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Operations Health
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Live snapshot: SLOs, scheduled jobs, alert dispatch volume.
          </p>
          {data && (
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500">
              Generated {new Date(data.generatedAt).toLocaleString()} · last {data.windowDays} day
              {data.windowDays === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3" aria-label="Operations Health controls">
          <div className="flex flex-col">
            <label
              htmlFor="presentation-ops-health-window"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Window
            </label>
            <select
              id="presentation-ops-health-window"
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {WINDOW_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? '1 day' : `${d} days`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="presentation-ops-health-autorefresh"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Auto-refresh
            </label>
            <button
              id="presentation-ops-health-autorefresh"
              type="button"
              onClick={handleToggleAutoRefresh}
              aria-pressed={autoRefresh}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                autoRefresh
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
              {autoRefresh ? 'On' : 'Paused'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportDisabled}
            aria-label="Export Operations Health as PDF"
            title={
              exportDisabled
                ? 'Export available once the report has loaded successfully'
                : 'Download a print-ready PDF view (use ⌘P / Ctrl+P to save as PDF)'
            }
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FileText size={12} />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        {autoRefresh ? (
          <span>
            Auto · refreshing every {Math.round(AUTO_REFRESH_INTERVAL_MS / 1000)}s
            {autoRefreshPaused && status !== 'ok' && hasAttempted
              ? ' · paused (backend issue)'
              : ''}
            {autoRefreshPaused && !pageVisible ? ' · paused (tab hidden)' : ''}
          </span>
        ) : (
          <span>Auto-refresh paused</span>
        )}
        <span>·</span>
        <span>Last refreshed: {formatClockTime(lastRefreshAt)}</span>
      </div>

      {renderBody({
        loading,
        hasAttempted,
        reasonBanner,
        data,
        activeSloId,
        onSelectSlo: setActiveSloId,
      })}

      <OperationsHealthDrilldownPanel sloId={activeSloId} onClose={() => setActiveSloId(null)} />
    </div>
  );
};

interface BodyProps {
  loading: boolean;
  hasAttempted: boolean;
  reasonBanner: string | null;
  data: OperationsHealthReport | null;
  activeSloId: DrilldownSloId | null;
  onSelectSlo: (id: DrilldownSloId | null) => void;
}

function renderBody(props: BodyProps): React.ReactElement {
  const { loading, hasAttempted, reasonBanner, data, activeSloId, onSelectSlo } = props;

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Loader2 size={16} className="animate-spin text-indigo-500" />
        Loading operations health…
      </div>
    );
  }

  if (reasonBanner) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
      >
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Operations Health unavailable</div>
          <div className="mt-1 text-xs opacity-80">{reasonBanner}</div>
        </div>
      </div>
    );
  }

  if (!hasAttempted || !data) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Waiting for operations data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.warnings.length > 0 && <WarningsPanel warnings={data.warnings} />}
      <SloGrid
        slos={data.slos}
        anomalies={data.anomalies}
        activeSloId={activeSloId}
        onSelectSlo={onSelectSlo}
      />
      <JobsStrip jobs={data.jobs} />
      <AlertsPanel activity={data.alerts} />
      <IncidentRunbooksCard report={data} />

      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        Read-only view. SLO classification is computed server-side and not recalculated in this UI.
        Refresh by pressing <span className="font-semibold">Reload</span>.
      </p>
    </div>
  );
}

interface WarningsPanelProps {
  warnings: string[];
}

const WarningsPanel: React.FC<WarningsPanelProps> = ({ warnings }) => {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">Some inputs were degraded</div>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 opacity-80">
          {warnings.slice(0, 6).map((w) => (
            <li key={w} className="font-mono">
              {w}
            </li>
          ))}
          {warnings.length > 6 && <li className="opacity-70">… and {warnings.length - 6} more</li>}
        </ul>
      </div>
    </div>
  );
};

interface SloGridProps {
  slos: SloIndicator[];
  anomalies: OperationsHealthAnomaly[];
  activeSloId: DrilldownSloId | null;
  onSelectSlo: (id: DrilldownSloId | null) => void;
}

// Sprint 13: orange "Anomaly" chip displayed in the corner of an SLO card
// when the server-side detector flags `status === 'detected'`. The chip
// coexists with the existing PASS/AT_RISK/BREACH status pill — they answer
// different questions (steady-state SLO vs. short-term deviation).
const ANOMALY_CHIP_TONE: Record<NonNullable<OperationsHealthAnomaly['severity']>, string> = {
  major: 'bg-orange-500 text-white',
  minor: 'bg-orange-100 text-orange-800',
};

const SloGrid: React.FC<SloGridProps> = ({ slos, anomalies, activeSloId, onSelectSlo }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">SLO indicators</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {slos.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            No SLO indicators returned.
          </div>
        ) : (
          slos.map((slo) => {
            const isActive = activeSloId === (slo.id as DrilldownSloId);
            const anomaly = anomalies.find((a) => a.sloId === slo.id);
            const showAnomaly = !!anomaly && anomaly.status === 'detected' && !!anomaly.severity;
            return (
              <button
                key={slo.id}
                type="button"
                aria-label={`Open drill-down for ${slo.label}`}
                aria-pressed={isActive}
                onClick={() => onSelectSlo(slo.id as DrilldownSloId)}
                className={`text-left rounded-lg border bg-white p-4 shadow-sm transition-colors hover:border-indigo-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 ${
                  isActive
                    ? 'border-indigo-500 ring-2 ring-indigo-500/40 dark:border-indigo-400'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {slo.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {showAnomaly && anomaly?.severity && (
                      <span
                        // The chip lives inside the same <button> as the
                        // card so a click anywhere on it opens the
                        // drill-down — `slo` deep link from Sprint 11/12.
                        // We pin the role to "status" so screen readers
                        // announce the anomaly text alongside the SLO label.
                        role="status"
                        aria-label={anomaly.reason || 'Anomaly detected'}
                        title={anomaly.reason || 'Anomaly detected'}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ANOMALY_CHIP_TONE[anomaly.severity]}`}
                      >
                        Anomaly
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${SLO_TONE[slo.status]}`}
                      title={`Status: ${SLO_LABEL[slo.status]}`}
                    >
                      {SLO_LABEL[slo.status]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {slo.observed || '—'}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Target {slo.target || '—'}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

interface JobsStripProps {
  jobs: JobRunSnapshot[];
}

const JobsStrip: React.FC<JobsStripProps> = ({ jobs }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield size={14} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Scheduled jobs</h3>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {jobs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            No scheduled jobs reported.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {jobs.map((job) => (
              <li key={job.jobId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {job.label}
                  </div>
                  {job.lastRunSummary && (
                    <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {job.lastRunSummary}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span title={job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : ''}>
                    Last run: {formatRelativeTime(job.lastRunAt)}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${JOB_STATUS_TONE[job.lastRunStatus]}`}
                >
                  {JOB_STATUS_LABEL[job.lastRunStatus]}
                </span>
                {job.isStale && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300"
                    title={
                      job.staleDays !== null
                        ? `Stale by ${job.staleDays.toFixed(2)} day(s)`
                        : 'Job has never run'
                    }
                  >
                    <AlertTriangle size={10} />
                    Stale
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

interface AlertsPanelProps {
  activity: OperationsHealthReport['alerts'];
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ activity }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle size={14} className="text-slate-500 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Alert dispatch volume
        </h3>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-700 dark:text-slate-300">
          <span>
            Sent:{' '}
            <strong className="text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatNumber(activity.sent)}
            </strong>
          </span>
          <span>·</span>
          <span>
            Failed:{' '}
            <strong className="text-danger-700 dark:text-danger-300 tabular-nums">
              {formatNumber(activity.failed)}
            </strong>
          </span>
          <span>·</span>
          <span>
            Suppressed:{' '}
            <strong className="text-amber-700 dark:text-amber-300 tabular-nums">
              {formatNumber(activity.suppressed)}
            </strong>
          </span>
          <span>·</span>
          <span>
            Dry-run:{' '}
            <strong className="text-slate-700 dark:text-slate-200 tabular-nums">
              {formatNumber(activity.dryRun)}
            </strong>
          </span>
          <span>·</span>
          <span>
            Unique decks:{' '}
            <strong className="text-slate-900 dark:text-slate-100 tabular-nums">
              {formatNumber(activity.uniqueDecks)}
            </strong>
          </span>
          <span>·</span>
          <span>
            Paused subs:{' '}
            <strong className="text-slate-900 dark:text-slate-100 tabular-nums">
              {formatNumber(activity.pausedSubscriptions)}
            </strong>
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Counters cover the last {activity.windowDays} day
          {activity.windowDays === 1 ? '' : 's'} of governance alert dispatches. Suppressed and
          dry-run rows reflect intentional throttling, not failures.
        </p>
      </div>
    </div>
  );
};

export default PresentationOperationsHealthView;
