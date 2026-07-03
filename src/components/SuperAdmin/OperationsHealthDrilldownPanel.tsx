/**
 * OperationsHealthDrilldownPanel
 *
 * Right-side drawer that opens when a SuperAdmin clicks an SLO card on the
 * Operations Health view. Shows:
 *
 *   - SVG sparkline of bucketed observed values (no chart library — plain
 *     <polyline> + <circle> tags, scaled to the panel width),
 *   - the 5 most recent buckets in a tiny trend table,
 *   - up to 5 "most problematic decks" for the SLO,
 *   - up to 8 most-recent event samples with allow-listed excerpts,
 *   - manual refresh + window/bucket selectors,
 *   - honest forbidden / unavailable / error / not_found banners.
 *
 * Accessibility: focus is trapped inside the drawer while it is open,
 * Escape closes it, and the heading is wired to `aria-labelledby`.
 *
 * Auto-refresh of the parent Operations Health view does NOT close this
 * panel (the parent owns `activeSloId`, this component owns its own
 * loading state and refetches on user action).
 */

import { AlertTriangle, Loader2, RefreshCcw, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SloStatus } from '../../services/presentationOperationsHealth';
import {
  type DrilldownEventSample,
  type DrilldownFetchStatus,
  type DrilldownSloId,
  fetchSloDrilldown,
  type SloDrilldownReport,
  type TopProblematicDeck,
  type TrendPoint,
} from '../../services/presentationOperationsHealthDrilldown';

const SLO_LABEL: Record<DrilldownSloId, string> = {
  generation_success_rate: 'Generation success rate',
  export_success_rate: 'Export success rate',
  p95_generation_latency_ms: 'P95 generation latency',
  agent_edit_success_rate: 'Agent edit acceptance rate',
  export_blocked_rate: 'Export blocked rate',
};

const STATUS_TONE: Record<SloStatus, string> = {
  pass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  breach: 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300',
  inconclusive: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

const STATUS_LABEL: Record<SloStatus, string> = {
  pass: 'Pass',
  at_risk: 'At risk',
  breach: 'Breach',
  inconclusive: 'Inconclusive',
};

const STATUS_STROKE: Record<SloStatus, string> = {
  pass: '#10b981',
  at_risk: '#f59e0b',
  breach: '#f43f5e',
  inconclusive: '#94a3b8',
};

const STATUS_DOT_BG: Record<SloStatus, string> = {
  pass: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  breach: 'bg-danger-500',
  inconclusive: 'bg-slate-400',
};

const WINDOW_OPTIONS = [7, 14, 30] as const;
const BUCKET_OPTIONS = [1, 3, 7] as const;

const PANEL_WIDTH_PX = 380;
const SVG_WIDTH = 280;
const SVG_HEIGHT = 60;
const SVG_PADDING_X = 6;
const SVG_PADDING_Y = 8;

function isUnitSlo(sloId: DrilldownSloId): 'percent' | 'ms' {
  return sloId === 'p95_generation_latency_ms' ? 'ms' : 'percent';
}

function formatObserved(sloId: DrilldownSloId, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (isUnitSlo(sloId) === 'ms') {
    return `${Math.round(value).toLocaleString()} ms`;
  }
  return `${value.toFixed(1)}%`;
}

function formatBucketLabel(point: TrendPoint): string {
  try {
    const start = new Date(point.bucketStart);
    return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return point.bucketStart;
  }
}

function formatClock(date: Date | null): string {
  if (!date) return '—';
  try {
    return date.toLocaleTimeString();
  } catch {
    return date.toISOString();
  }
}

function statusReason(status: DrilldownFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') {
    return 'Insufficient permission to load SLO drill-down.';
  }
  if (status === 'not_found') {
    return 'Drill-down endpoint not found. The backend may need to be redeployed.';
  }
  if (status === 'unavailable') {
    return 'Drill-down is unavailable. The backend may be offline.';
  }
  return 'Could not load the drill-down report.';
}

function shortDeckId(id: string): string {
  if (!id) return '—';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-3)}`;
}

interface SparklineProps {
  trend: TrendPoint[];
  sloId: DrilldownSloId;
}

const Sparkline: React.FC<SparklineProps> = ({ trend, sloId }) => {
  const usable = trend.filter(
    (p) => p.observedNumeric !== null && Number.isFinite(p.observedNumeric)
  );
  if (trend.length === 0) {
    return (
      <div className="flex h-[60px] w-full items-center justify-center text-[11px] text-slate-600 dark:text-slate-500">
        No trend data.
      </div>
    );
  }

  const numerics = usable.map((p) => p.observedNumeric as number);
  const minV = numerics.length > 0 ? Math.min(...numerics) : 0;
  const maxV = numerics.length > 0 ? Math.max(...numerics) : 1;
  const span = Math.max(1e-6, maxV - minV);

  const innerW = SVG_WIDTH - 2 * SVG_PADDING_X;
  const innerH = SVG_HEIGHT - 2 * SVG_PADDING_Y;

  const xFor = (i: number): number => {
    if (trend.length === 1) return SVG_PADDING_X + innerW / 2;
    return SVG_PADDING_X + (i * innerW) / (trend.length - 1);
  };

  const yFor = (value: number | null): number => {
    if (value === null || !Number.isFinite(value)) {
      return SVG_PADDING_Y + innerH / 2;
    }
    if (numerics.length === 0) return SVG_PADDING_Y + innerH / 2;
    const norm = (value - minV) / span;
    // Higher value = higher position (smaller y) for percent SLOs;
    // for "lower is better" SLOs (latency, blocked-rate) we still draw
    // value→y the same way — the COLOR encodes good/bad, not the slope.
    return SVG_PADDING_Y + innerH - norm * innerH;
  };

  const segments: Array<Array<{ i: number; point: TrendPoint }>> = [];
  let current: Array<{ i: number; point: TrendPoint }> = [];
  trend.forEach((point, i) => {
    if (point.observedNumeric === null || point.status === 'inconclusive') {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }
    current.push({ i, point });
  });
  if (current.length > 0) segments.push(current);

  const lastNonInc = [...trend]
    .reverse()
    .find((p) => p.observedNumeric !== null && p.status !== 'inconclusive');
  const stroke = STATUS_STROKE[lastNonInc?.status ?? 'inconclusive'];

  return (
    <svg
      role="img"
      aria-label={`Sparkline of ${SLO_LABEL[sloId]} over the last ${trend.length} buckets`}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width={SVG_WIDTH}
      height={SVG_HEIGHT}
      className="block max-w-full"
    >
      <rect x={0} y={0} width={SVG_WIDTH} height={SVG_HEIGHT} rx={4} ry={4} fill="transparent" />
      <line
        x1={SVG_PADDING_X}
        y1={SVG_HEIGHT - SVG_PADDING_Y}
        x2={SVG_WIDTH - SVG_PADDING_X}
        y2={SVG_HEIGHT - SVG_PADDING_Y}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      {segments.map((seg, sIdx) => {
        if (seg.length < 2) return null;
        const points = seg
          .map((s) => `${xFor(s.i).toFixed(1)},${yFor(s.point.observedNumeric).toFixed(1)}`)
          .join(' ');
        return (
          <polyline
            key={`seg-${sIdx}`}
            points={points}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
      {trend.map((point, i) => {
        const x = xFor(i);
        const y = yFor(point.observedNumeric);
        const isInconclusive = point.status === 'inconclusive' || point.observedNumeric === null;
        return (
          <g key={`pt-${i}`}>
            <title>
              {`${formatBucketLabel(point)} · ${formatObserved(sloId, point.observedNumeric)} · n=${point.sampleSize} · ${STATUS_LABEL[point.status]}`}
            </title>
            <circle
              cx={x}
              cy={y}
              r={isInconclusive ? 2.5 : 2}
              fill={isInconclusive ? 'transparent' : STATUS_STROKE[point.status]}
              stroke={STATUS_STROKE[point.status]}
              strokeWidth={isInconclusive ? 1 : 0.5}
            />
          </g>
        );
      })}
    </svg>
  );
};

interface TrendTableProps {
  trend: TrendPoint[];
  sloId: DrilldownSloId;
}

const TrendTable: React.FC<TrendTableProps> = ({ trend, sloId }) => {
  const recent = useMemo(() => trend.slice(-5).reverse(), [trend]);
  if (recent.length === 0) {
    return <p className="text-[11px] text-slate-500 dark:text-slate-400">No recent buckets.</p>;
  }
  return (
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {recent.map((point) => (
        <li
          key={`${point.bucketStart}-${point.bucketEnd}`}
          className="flex items-center justify-between gap-2 px-1 py-1.5 text-[11px]"
        >
          <span className="text-slate-600 dark:text-slate-300 tabular-nums">
            {formatBucketLabel(point)}
          </span>
          <span className="text-slate-700 dark:text-slate-200 tabular-nums">
            {formatObserved(sloId, point.observedNumeric)}{' '}
            <span className="text-slate-600 dark:text-slate-500">(n={point.sampleSize})</span>
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_TONE[point.status]}`}
          >
            {STATUS_LABEL[point.status]}
          </span>
        </li>
      ))}
    </ul>
  );
};

interface TopDecksListProps {
  decks: TopProblematicDeck[];
  sloId: DrilldownSloId;
}

const TopDecksList: React.FC<TopDecksListProps> = ({ decks, sloId }) => {
  if (decks.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        No problematic decks in this window.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {decks.map((deck) => (
        <li
          key={deck.deckId}
          className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50/60 px-2 py-1.5 text-[11px] dark:border-slate-800 dark:bg-slate-900/40"
        >
          <span
            className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200"
            title={deck.title}
          >
            {deck.title}
          </span>
          <span className="text-slate-500 dark:text-slate-400 tabular-nums">
            {formatObserved(sloId, deck.observedNumeric)}
          </span>
          <span className="text-danger-600 dark:text-danger-300 tabular-nums">
            {deck.failureCount}/{deck.totalCount}
          </span>
        </li>
      ))}
    </ul>
  );
};

interface RecentSamplesListProps {
  samples: DrilldownEventSample[];
}

const RecentSamplesList: React.FC<RecentSamplesListProps> = ({ samples }) => {
  if (samples.length === 0) {
    return <p className="text-[11px] text-slate-500 dark:text-slate-400">No recent samples.</p>;
  }
  return (
    <ul className="space-y-1">
      {samples.map((sample, i) => {
        const dotStatus: SloStatus =
          sample.status === 'failed' || sample.status === 'blocked'
            ? 'breach'
            : sample.status === 'completed' ||
                sample.status === 'applied' ||
                sample.status === 'accepted'
              ? 'pass'
              : 'inconclusive';
        let when = sample.occurredAt;
        try {
          when = new Date(sample.occurredAt).toLocaleString();
        } catch {
          // keep ISO fallback
        }
        return (
          <li
            key={`${sample.occurredAt}-${i}`}
            className="flex items-start gap-2 px-1 py-1 text-[11px] text-slate-700 dark:text-slate-300"
          >
            <span
              className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_BG[dotStatus]}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                {when} · <span className="font-mono">{shortDeckId(sample.deckId)}</span>
              </div>
              <div
                className="truncate text-slate-700 dark:text-slate-200"
                title={sample.excerpt ?? undefined}
              >
                {sample.excerpt ?? '—'}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export interface OperationsHealthDrilldownPanelProps {
  sloId: DrilldownSloId | null;
  onClose: () => void;
}

const OperationsHealthDrilldownPanel: React.FC<OperationsHealthDrilldownPanelProps> = ({
  sloId,
  onClose,
}) => {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [bucketDays, setBucketDays] = useState<number>(1);
  const [data, setData] = useState<SloDrilldownReport | null>(null);
  const [status, setStatus] = useState<DrilldownFetchStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleLoad = useCallback(async () => {
    if (!sloId) return;
    setLoading(true);
    setHasAttempted(true);
    try {
      const result = await fetchSloDrilldown(sloId, { windowDays, bucketDays });
      setStatus(result.status);
      const ok = result.status === 'ok' && !!result.data;
      setData(ok && result.data ? result.data : null);
      if (ok) setLastRefreshAt(new Date());
    } finally {
      setLoading(false);
    }
  }, [sloId, windowDays, bucketDays]);

  useEffect(() => {
    if (sloId) void handleLoad();
    else {
      setData(null);
      setStatus(null);
      setHasAttempted(false);
      setLastRefreshAt(null);
    }
  }, [sloId, handleLoad]);

  useEffect(() => {
    if (!sloId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        const root = panelRef.current;
        if (!root) return;
        const focusable = root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sloId, onClose]);

  useEffect(() => {
    if (sloId && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [sloId]);

  const reasonBanner = useMemo(() => statusReason(status), [status]);

  if (!sloId) return null;

  const headingId = 'operations-health-drilldown-heading';

  return (
    <div className="pointer-events-none fixed inset-0 z-dropdown">
      <div
        className="pointer-events-auto absolute inset-0 bg-slate-900/20 dark:bg-slate-950/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="pointer-events-auto absolute right-0 top-0 flex h-full flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        style={{ width: PANEL_WIDTH_PX }}
      >
        <header className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3
                id={headingId}
                className="text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {SLO_LABEL[sloId]}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Drill-down · last {windowDays}d · {bucketDays}d buckets
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close drill-down panel"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col">
              <label
                htmlFor="ops-drilldown-window"
                className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Window
              </label>
              <select
                id="ops-drilldown-window"
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value))}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {WINDOW_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}d
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label
                htmlFor="ops-drilldown-bucket"
                className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Bucket
              </label>
              <select
                id="ops-drilldown-bucket"
                value={bucketDays}
                onChange={(e) => setBucketDays(Number(e.target.value))}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {BUCKET_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}d
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void handleLoad()}
              disabled={loading}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-500">
            Last refreshed: {formatClock(lastRefreshAt)}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && !data && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
              <Loader2 size={14} className="animate-spin text-indigo-500" />
              Loading drill-down…
            </div>
          )}
          {!loading && reasonBanner && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Drill-down unavailable</div>
                <div className="mt-0.5 opacity-80">{reasonBanner}</div>
              </div>
            </div>
          )}
          {!loading && !reasonBanner && hasAttempted && data && (
            <div className="space-y-4">
              {data.warnings.length > 0 && (
                <div
                  role="status"
                  className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                >
                  <div className="font-semibold">Some inputs were degraded</div>
                  <ul className="mt-0.5 list-disc pl-4 opacity-80">
                    {data.warnings.slice(0, 4).map((w) => (
                      <li key={w} className="font-mono">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <section className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Trend
                </h4>
                <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <Sparkline trend={data.trend} sloId={data.sloId} />
                </div>
                <TrendTable trend={data.trend} sloId={data.sloId} />
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Top problematic decks
                </h4>
                <TopDecksList decks={data.topProblematicDecks} sloId={data.sloId} />
              </section>

              <section className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Recent samples
                </h4>
                <RecentSamplesList samples={data.recentSamples} />
              </section>
            </div>
          )}
          {!loading && !reasonBanner && hasAttempted && !data && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              No drill-down data returned.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default OperationsHealthDrilldownPanel;
