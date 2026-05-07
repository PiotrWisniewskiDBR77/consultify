/**
 * PresentationBenchmarkTrendView (Sprint 15 Epic H2)
 *
 * Read-only SuperAdmin dashboard that visualizes the monthly DBR77/VTS
 * benchmark trend per dimension against the Gamma target (default 4.0).
 * Mirrors the visual pattern of `PresentationOperationsHealthView` and
 * `OperationsHealthDrilldownPanel` (dependency-free SVG sparkline, status
 * pills, honest error banners).
 *
 * Source: GET /api/presentations/benchmark/trend?windowMonths=N&referenceSet=...
 * via `fetchBenchmarkTrend`. The pure builder lives server-side
 * (`presentationBenchmarkTrendService`) and never throws — when migration
 * 768 has not shipped or no runs exist yet, the response is an
 * `INCONCLUSIVE` verdict with empty per-dimension series. The UI surfaces
 * this honestly with an empty state instead of fabricating zeros.
 *
 * SVG-only rendering: a 12-point (or windowed) `<polyline>` per dimension
 * with a dashed reference line at `y = gammaTarget`. Color-coded by status
 * (improving/stable/regressing/inconclusive). Hollow circles for missing
 * points, filled circle for the latest finite point. Hover surfaces the
 * per-point value + delta via `<title>` tooltips.
 */

import { AlertTriangle, Loader2, RefreshCcw, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type BenchmarkTrendFetchStatus,
  CLIENT_BENCHMARK_DIMENSIONS,
  type ClientBenchmarkDimension,
  type ClientBenchmarkTrendReport,
  type ClientDimensionTrend,
  type ClientDimensionTrendStatus,
  type ClientOverallTrendVerdict,
  fetchBenchmarkTrend,
} from '../../services/presentationBenchmarkTrend';

const WINDOW_OPTIONS: number[] = [3, 6, 12, 24, 36];
const DEFAULT_WINDOW_MONTHS = 12;

// Reference sets that the H1 cadence has historically emitted. Keeping
// this list small and explicit avoids inviting operators to type random
// strings the backend doesn't recognize. The text input fallback honors
// arbitrary values when the spec evolves.
const REFERENCE_SET_OPTIONS: { value: string; label: string }[] = [
  { value: 'dbr77', label: 'dbr77' },
  { value: 'DBR77+VTS', label: 'DBR77+VTS' },
];
const DEFAULT_REFERENCE_SET = 'dbr77';

const DIMENSION_LABELS: Record<ClientBenchmarkDimension, string> = {
  content_quality: 'Content Quality',
  visual_design: 'Visual Design',
  long_context_processing: 'Long-Context Processing',
  api_automation: 'API & Automation',
  conversational_editing: 'Conversational Editing',
};

const STATUS_LABEL: Record<ClientDimensionTrendStatus, string> = {
  improving: 'Improving',
  stable: 'Stable',
  regressing: 'Regressing',
  inconclusive: 'Inconclusive',
};

const STATUS_TONE: Record<ClientDimensionTrendStatus, string> = {
  improving: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  stable: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  regressing: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  inconclusive: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

// Sparkline stroke colors per status. Picked to match the SLO drill-down
// palette so operators get a consistent visual vocabulary across the
// SuperAdmin views.
const STATUS_STROKE: Record<ClientDimensionTrendStatus, string> = {
  improving: '#10b981',
  stable: '#3b82f6',
  regressing: '#f43f5e',
  inconclusive: '#94a3b8',
};

const VERDICT_LABEL: Record<ClientOverallTrendVerdict, string> = {
  AHEAD_OF_TARGET: 'Ahead of Gamma target',
  TRACKING: 'Tracking toward Gamma',
  AT_RISK: 'At risk vs Gamma',
  INCONCLUSIVE: 'Inconclusive — insufficient history',
};

const VERDICT_TONE: Record<ClientOverallTrendVerdict, string> = {
  AHEAD_OF_TARGET:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
  TRACKING:
    'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  AT_RISK:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  INCONCLUSIVE:
    'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
};

function statusReason(status: BenchmarkTrendFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') {
    return 'Insufficient permission to load the benchmark trend dashboard.';
  }
  if (status === 'not_found') {
    return 'Benchmark trend endpoint not found. The backend may need to be redeployed.';
  }
  if (status === 'unavailable') {
    return 'Benchmark trend is unavailable. The backend may be offline.';
  }
  return 'Could not load the benchmark trend report.';
}

function formatClock(date: Date | null): string {
  if (!date) return '—';
  try {
    return date.toLocaleTimeString();
  } catch {
    return date.toISOString();
  }
}

function formatValue(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function formatSignedDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// SVG sparkline (dependency-free, mirrors the Sprint 11 drill-down pattern)
// ---------------------------------------------------------------------------

const SVG_WIDTH = 100;
const SVG_HEIGHT = 30;
const SVG_PAD_X = 3;
const SVG_PAD_Y = 4;

interface SparklineProps {
  trend: ClientDimensionTrend;
  gammaTarget: number;
}

const DimensionSparkline: React.FC<SparklineProps> = ({ trend, gammaTarget }) => {
  const points = trend.points;
  const stroke = STATUS_STROKE[trend.status];

  // Establish a stable y-domain that always includes the gamma target so
  // the dashed reference line is meaningful even when the data clusters
  // far below it. We pad slightly so the polyline isn't pinned to the
  // top/bottom edges of the viewBox.
  const numerics: number[] = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const domainMin = Math.min(0, gammaTarget - 1, ...(numerics.length > 0 ? numerics : [0]));
  const domainMax = Math.max(5, gammaTarget + 0.5, ...(numerics.length > 0 ? numerics : [5]));
  const span = Math.max(1e-6, domainMax - domainMin);

  const innerW = SVG_WIDTH - 2 * SVG_PAD_X;
  const innerH = SVG_HEIGHT - 2 * SVG_PAD_Y;

  const xFor = (i: number): number => {
    if (points.length <= 1) return SVG_PAD_X + innerW / 2;
    return SVG_PAD_X + (i * innerW) / (points.length - 1);
  };

  const yFor = (value: number | null): number => {
    if (value === null || !Number.isFinite(value)) {
      return SVG_PAD_Y + innerH / 2;
    }
    const norm = (value - domainMin) / span;
    return SVG_PAD_Y + innerH - norm * innerH;
  };

  const gammaY = yFor(gammaTarget);

  // Split the polyline at gaps (null values) so missing samples don't
  // visually imply a value. Each segment is rendered as its own polyline.
  const segments: { idx: number; value: number }[][] = [];
  let current: { idx: number; value: number }[] = [];
  points.forEach((p, i) => {
    if (p.value === null || !Number.isFinite(p.value)) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      return;
    }
    current.push({ idx: i, value: p.value });
  });
  if (current.length > 0) segments.push(current);

  // Index of the latest finite point — used to render a filled circle.
  let latestFiniteIndex: number | null = null;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p && p.value !== null && Number.isFinite(p.value)) {
      latestFiniteIndex = i;
      break;
    }
  }

  const ariaLabel =
    points.length === 0
      ? `No benchmark history for ${DIMENSION_LABELS[trend.dimension]}`
      : `Sparkline of ${DIMENSION_LABELS[trend.dimension]} over the last ${points.length} runs (Gamma target ${gammaTarget.toFixed(1)})`;

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      width="100%"
      height={SVG_HEIGHT * 2}
      preserveAspectRatio="none"
      className="block"
    >
      {/* Gamma reference line — always rendered, even when the trend is empty. */}
      <line
        x1={SVG_PAD_X}
        y1={gammaY}
        x2={SVG_WIDTH - SVG_PAD_X}
        y2={gammaY}
        stroke="#0ea5e9"
        strokeOpacity={0.55}
        strokeWidth={0.5}
        strokeDasharray="2,1.5"
      >
        <title>{`Gamma target ${gammaTarget.toFixed(2)}`}</title>
      </line>

      {/* Trend polyline(s). Skipped when the dimension has fewer than 2
          finite points — the per-point circles still tell the story. */}
      {segments.map((seg, sIdx) => {
        if (seg.length < 2) return null;
        const polyPoints = seg
          .map((s) => `${xFor(s.idx).toFixed(2)},${yFor(s.value).toFixed(2)}`)
          .join(' ');
        return (
          <polyline
            key={`seg-${sIdx}`}
            points={polyPoints}
            fill="none"
            stroke={stroke}
            strokeWidth={1.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}

      {/* Per-point circles. Hollow for null/inconclusive, solid for finite. */}
      {points.map((p, i) => {
        const x = xFor(i);
        const y = yFor(p.value);
        const isMissing = p.value === null || !Number.isFinite(p.value);
        const isLatest = !isMissing && i === latestFiniteIndex;
        const radius = isLatest ? 1.6 : isMissing ? 1.4 : 1.2;
        const tooltipValue = isMissing ? '—' : (p.value as number).toFixed(2);
        const tooltipDelta =
          p.delta !== null && Number.isFinite(p.delta)
            ? ` (${p.delta > 0 ? '+' : ''}${p.delta.toFixed(2)})`
            : '';
        return (
          <g key={`pt-${i}`}>
            <title>{`${p.runLabel || `#${i + 1}`} · ${tooltipValue}${tooltipDelta}`}</title>
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={isMissing ? 'transparent' : stroke}
              stroke={stroke}
              strokeWidth={isMissing ? 0.5 : isLatest ? 0.5 : 0.3}
            />
          </g>
        );
      })}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Dimension card
// ---------------------------------------------------------------------------

interface DimensionCardProps {
  dim: ClientDimensionTrend;
  gammaTarget: number;
}

const DimensionCard: React.FC<DimensionCardProps> = ({ dim, gammaTarget }) => {
  const label = DIMENSION_LABELS[dim.dimension];
  const status = dim.status;
  const distance =
    dim.distanceToGamma !== null && Number.isFinite(dim.distanceToGamma)
      ? dim.distanceToGamma
      : null;
  const distanceLabel =
    distance === null
      ? '—'
      : distance <= 0
        ? `at or past target (${formatSignedDelta(-distance)})`
        : `${distance.toFixed(2)} below target`;

  const estLabel = (() => {
    if (dim.estimatedRunsToGamma === null) return '—';
    if (dim.estimatedRunsToGamma === 0) return 'Met';
    return `${dim.estimatedRunsToGamma} run${dim.estimatedRunsToGamma === 1 ? '' : 's'}`;
  })();

  return (
    <article
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      aria-label={`Benchmark dimension ${label}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </h3>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatValue(dim.latestValue)}
          </div>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_TONE[status]}`}
          title={`Status: ${STATUS_LABEL[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-slate-500 dark:text-slate-400">Distance to Gamma</dt>
        <dd className="text-right text-slate-700 dark:text-slate-200 tabular-nums">
          {distanceLabel}
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Est. runs to Gamma</dt>
        <dd className="text-right text-slate-700 dark:text-slate-200 tabular-nums">{estLabel}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Avg last 3 / 6</dt>
        <dd className="text-right text-slate-700 dark:text-slate-200 tabular-nums">
          {formatValue(dim.averageLast3)} / {formatValue(dim.averageLast6)}
        </dd>
      </dl>

      <div
        className="mt-3 rounded border border-slate-100 bg-slate-50/50 p-1 dark:border-slate-800 dark:bg-slate-900/40"
        aria-hidden={dim.points.length === 0 ? 'true' : 'false'}
      >
        <DimensionSparkline trend={dim} gammaTarget={gammaTarget} />
      </div>

      {dim.points.length === 0 && (
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          No history yet — only the Gamma reference line is rendered.
        </p>
      )}
    </article>
  );
};

// ---------------------------------------------------------------------------
// Verdict banner
// ---------------------------------------------------------------------------

interface VerdictBannerProps {
  verdict: ClientOverallTrendVerdict;
  summary: string;
  gammaTarget: number;
  warningThreshold: number;
}

const VerdictBanner: React.FC<VerdictBannerProps> = ({
  verdict,
  summary,
  gammaTarget,
  warningThreshold,
}) => {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${VERDICT_TONE[verdict]}`}
    >
      <TrendingUp size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{VERDICT_LABEL[verdict]}</div>
        <div className="mt-0.5 text-xs opacity-80">{summary}</div>
        <div className="mt-1 text-[10px] opacity-70">
          Gamma target {gammaTarget.toFixed(2)} · warning floor {warningThreshold.toFixed(2)}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

const PresentationBenchmarkTrendView: React.FC = () => {
  const [windowMonths, setWindowMonths] = useState<number>(DEFAULT_WINDOW_MONTHS);
  const [referenceSet, setReferenceSet] = useState<string>(DEFAULT_REFERENCE_SET);
  const [data, setData] = useState<ClientBenchmarkTrendReport | null>(null);
  const [status, setStatus] = useState<BenchmarkTrendFetchStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setHasAttempted(true);
    try {
      const result = await fetchBenchmarkTrend({ windowMonths, referenceSet });
      setStatus(result.status);
      const ok = result.status === 'ok' && !!result.data;
      setData(ok && result.data ? result.data : null);
      if (ok) setLastRefreshAt(new Date());
    } finally {
      setLoading(false);
    }
  }, [windowMonths, referenceSet]);

  useEffect(() => {
    void handleLoad();
  }, [handleLoad]);

  const reasonBanner = useMemo(() => statusReason(status), [status]);

  // Index dimensions by id so the rendered grid is order-stable
  // (CLIENT_BENCHMARK_DIMENSIONS) regardless of server response order.
  const dimensionsById = useMemo<Map<ClientBenchmarkDimension, ClientDimensionTrend>>(() => {
    const map = new Map<ClientBenchmarkDimension, ClientDimensionTrend>();
    if (data) for (const d of data.dimensions) map.set(d.dimension, d);
    return map;
  }, [data]);

  const isEmpty =
    !!data &&
    data.dimensions.every((d) => d.points.length === 0) &&
    data.overallVerdict === 'INCONCLUSIVE';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Benchmark Trend (vs Gamma target)
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Monthly DBR77/VTS regression trend — visible movement toward Gamma-level by dimension.
          </p>
          {data && (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Generated {new Date(data.generatedAt).toLocaleString()} · spanning {data.windowMonths}{' '}
              month
              {data.windowMonths === 1 ? '' : 's'} of history
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3" aria-label="Benchmark Trend controls">
          <div className="flex flex-col">
            <label
              htmlFor="presentation-benchmark-trend-window"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Window
            </label>
            <select
              id="presentation-benchmark-trend-window"
              value={windowMonths}
              onChange={(e) => setWindowMonths(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {WINDOW_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} months
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="presentation-benchmark-trend-refset"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Reference set
            </label>
            <select
              id="presentation-benchmark-trend-refset"
              value={referenceSet}
              onChange={(e) => setReferenceSet(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {REFERENCE_SET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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

      <div className="text-[11px] text-slate-500 dark:text-slate-400">
        Last refreshed: {formatClock(lastRefreshAt)}
      </div>

      {loading && !data ? (
        <SkeletonGrid />
      ) : reasonBanner ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Benchmark Trend unavailable</div>
            <div className="mt-1 text-xs opacity-80">{reasonBanner}</div>
          </div>
        </div>
      ) : !hasAttempted || !data ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          Waiting for benchmark trend…
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <VerdictBanner
            verdict={data.overallVerdict}
            summary={data.summary || '—'}
            gammaTarget={data.gammaTarget}
            warningThreshold={data.warningThreshold}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {CLIENT_BENCHMARK_DIMENSIONS.map((id) => {
              const dim = dimensionsById.get(id);
              if (!dim) {
                // Server omitted the dimension — render a placeholder card
                // so the operator sees the gap instead of a phantom row.
                return (
                  <article
                    key={id}
                    className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400"
                    aria-label={`Missing dimension ${DIMENSION_LABELS[id]}`}
                  >
                    <div className="font-semibold text-slate-700 dark:text-slate-300">
                      {DIMENSION_LABELS[id]}
                    </div>
                    <div className="mt-1 opacity-80">Dimension missing from server response.</div>
                  </article>
                );
              }
              return <DimensionCard key={id} dim={dim} gammaTarget={data.gammaTarget} />;
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            Read-only view. Trend status is computed server-side
            (`presentationBenchmarkTrendService`); this UI only renders the response. Run a new
            monthly scorecard with{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-mono dark:bg-slate-800">
              npm run benchmark:monthly
            </code>{' '}
            to refresh.
          </p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Skeleton + empty states
// ---------------------------------------------------------------------------

const SkeletonGrid: React.FC = () => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
    {CLIENT_BENCHMARK_DIMENSIONS.map((id) => (
      <div
        key={id}
        className="animate-pulse rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        aria-hidden="true"
      >
        <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-2 h-7 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-2 w-full rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-2 h-2 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
        <div className="mt-3 h-12 w-full rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC = () => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
    <div className="font-semibold text-slate-700 dark:text-slate-200">No benchmark history yet</div>
    <p className="mt-1 text-xs opacity-80">
      Run a monthly benchmark first (see{' '}
      <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono dark:bg-slate-800">
        npm run benchmark:monthly
      </code>
      ) — once at least one run lands the dashboard will populate per dimension.
    </p>
  </div>
);

export default PresentationBenchmarkTrendView;
