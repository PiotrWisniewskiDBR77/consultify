/**
 * PresentationTelemetryView
 *
 * Read-only SuperAdmin inspector for per-deck presentation runtime telemetry:
 * agent edit proposals, applied/rejected edits, blocked exports, and no-ops
 * over a configurable time window.
 *
 * Source: GET /api/presentations/decks/:deckId/runtime-events/summary?windowDays=N
 * via {@link fetchPresentationTelemetryRollup}. The view never mutates state
 * locally without a backend response and surfaces an honest "degraded" banner
 * when the backend is unavailable instead of pretending counters are zero.
 */

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  CircleSlash,
  FileEdit,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPresentationGovernanceCard,
  type GovernanceFetchStatus,
  type GovernanceVerdict,
  type PresentationGovernanceCard,
} from '../../services/presentationGovernance';
import type { DashboardDeepLink } from '../../services/presentationGovernanceDeepLinks';
import {
  fetchPresentationTelemetryRollup,
  type PresentationTelemetryRollup,
} from '../../services/presentationTelemetry';

const WINDOW_OPTIONS: number[] = [1, 7, 14, 30, 90];
const DEFAULT_WINDOW_DAYS = 7;

type SortKey = 'eventType' | 'count' | 'lastAt';
type SortDir = 'asc' | 'desc';

type KpiTone = 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';

interface KpiCard {
  label: string;
  value: number;
  hint?: string;
  icon: React.ReactElement;
  tone: KpiTone;
}

const TONE_MAP: Record<KpiTone, string> = {
  indigo:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  emerald:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  rose: 'bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-900/30 dark:text-danger-300 dark:border-danger-800',
  amber:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  slate:
    'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700',
};

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
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

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString();
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function compareDates(a: string | null, b: string | null): number {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  const va = Number.isNaN(ta) ? -Infinity : ta;
  const vb = Number.isNaN(tb) ? -Infinity : tb;
  return va - vb;
}

interface PresentationTelemetryViewProps {
  deepLink?: DashboardDeepLink;
}

const PresentationTelemetryView: React.FC<PresentationTelemetryViewProps> = ({ deepLink }) => {
  // Snapshot the deep-link inputs once on mount. From then on the user's
  // edits take precedence and deep-link prop changes are ignored, which
  // matches the cross-tab contract documented in
  // presentationGovernanceDeepLinks.ts.
  const initialDeepLinkRef = useRef<DashboardDeepLink | null>(deepLink ?? null);
  const initialDeckId = initialDeepLinkRef.current?.deckId ?? '';
  const initialWindowDays =
    initialDeepLinkRef.current?.windowDays != null
      ? initialDeepLinkRef.current.windowDays
      : DEFAULT_WINDOW_DAYS;

  const [deckIdInput, setDeckIdInput] = useState<string>(initialDeckId);
  const [windowDays, setWindowDays] = useState<number>(initialWindowDays);
  const [rollup, setRollup] = useState<PresentationTelemetryRollup | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [governanceCard, setGovernanceCard] = useState<PresentationGovernanceCard | null>(null);
  const [governanceStatus, setGovernanceStatus] = useState<GovernanceFetchStatus | null>(null);
  const deepLinkLookupRef = useRef<boolean>(false);

  const trimmedDeckId = deckIdInput.trim();

  const handleLoad = useCallback(async () => {
    if (!trimmedDeckId) {
      // Don't fire a request for an empty deck ID; keep the empty-state card.
      setRollup(null);
      setHasAttempted(true);
      return;
    }
    setLoading(true);
    setHasAttempted(true);
    setGovernanceCard(null);
    setGovernanceStatus(null);
    try {
      const result = await fetchPresentationTelemetryRollup(trimmedDeckId, windowDays);
      setRollup(result);
      const govRes = await fetchPresentationGovernanceCard(trimmedDeckId);
      setGovernanceStatus(govRes.status);
      if (govRes.status === 'ok' && govRes.card) {
        setGovernanceCard(govRes.card);
      }
    } finally {
      setLoading(false);
    }
  }, [trimmedDeckId, windowDays]);

  // Deep-link deckId: trigger the lookup exactly once after the input
  // state has settled to the deep-linked value. Subsequent renders or
  // user edits do not re-fire because the ref guards the path.
  useEffect(() => {
    if (deepLinkLookupRef.current) return;
    const wantedDeckId = initialDeepLinkRef.current?.deckId ?? null;
    if (!wantedDeckId) return;
    if (trimmedDeckId !== wantedDeckId) return;
    deepLinkLookupRef.current = true;
    void handleLoad();
  }, [trimmedDeckId, handleLoad]);

  const handleExportGovernance = useCallback(() => {
    if (!governanceCard) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = JSON.stringify(governanceCard, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `governance-${governanceCard.deckId}-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [governanceCard]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void handleLoad();
    },
    [handleLoad]
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'eventType' ? 'asc' : 'desc');
      }
    },
    [sortKey]
  );

  const sortedByEventType = useMemo(() => {
    if (!rollup) return [];
    const rows = [...rollup.byEventType];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'eventType') cmp = compareStrings(a.eventType, b.eventType);
      else if (sortKey === 'count') cmp = a.count - b.count;
      else cmp = compareDates(a.lastAt, b.lastAt);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [rollup, sortKey, sortDir]);

  const kpiCards: KpiCard[] = useMemo(() => {
    const t = rollup?.totals;
    return [
      {
        label: 'Proposals created',
        value: t?.proposalsCreated ?? 0,
        icon: <Sparkles size={16} />,
        tone: 'indigo',
      },
      {
        label: 'Edits applied',
        value: t?.editsApplied ?? 0,
        icon: <CheckCircle2 size={16} />,
        tone: 'emerald',
      },
      {
        label: 'Edits rejected',
        value: t?.editsRejected ?? 0,
        icon: <XCircle size={16} />,
        tone: 'rose',
      },
      {
        label: 'Exports blocked',
        value: t?.exportsBlocked ?? 0,
        icon: <Ban size={16} />,
        tone: 'amber',
      },
      {
        label: 'No-ops',
        value: t?.noops ?? 0,
        hint: t ? `${formatNumber(t.total)} total events` : undefined,
        icon: <CircleSlash size={16} />,
        tone: 'slate',
      },
    ];
  }, [rollup]);

  const subtitle = `Last ${windowDays} days of agent edits and export blockers per deck.`;

  return (
    <div className="space-y-6">
      {/* Header / controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Presentation Telemetry
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          {rollup && (
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-500">
              Generated {new Date(rollup.generatedAt).toLocaleString()} · deck{' '}
              <code className="font-mono">{rollup.deckId || trimmedDeckId}</code>
              {rollup.lastActivityAt && (
                <> · last activity {formatRelativeTime(rollup.lastActivityAt)}</>
              )}
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-2"
          aria-label="Telemetry filters"
        >
          <div className="flex flex-col">
            <label
              htmlFor="presentation-telemetry-deck-id"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Deck ID
            </label>
            <input
              id="presentation-telemetry-deck-id"
              type="text"
              value={deckIdInput}
              onChange={(e) => setDeckIdInput(e.target.value)}
              placeholder="deck_…"
              spellCheck={false}
              autoComplete="off"
              className="w-64 rounded-md border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div className="flex flex-col">
            <label
              htmlFor="presentation-telemetry-window-days"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Window
            </label>
            <select
              id="presentation-telemetry-window-days"
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
          <button
            type="submit"
            disabled={loading || trimmedDeckId.length === 0}
            className="inline-flex items-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : null}
            {loading ? 'Loading…' : 'Load'}
          </button>
        </form>
      </div>

      {/* Governance card snapshot */}
      {hasAttempted && trimmedDeckId && (
        <GovernanceSnapshotCard
          status={governanceStatus}
          card={governanceCard}
          onExport={handleExportGovernance}
        />
      )}

      {/* Body */}
      {renderBody({
        loading,
        hasAttempted,
        trimmedDeckId,
        rollup,
        kpiCards,
        sortedByEventType,
        sortKey,
        sortDir,
        onSort: handleSort,
      })}
    </div>
  );
};

const VERDICT_TONE: Record<GovernanceVerdict, string> = {
  PASS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  PASS_WITH_P2: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  BLOCKED_P1: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  BLOCKED_P0: 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300',
  INCONCLUSIVE: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

interface GovernanceSnapshotCardProps {
  status: GovernanceFetchStatus | null;
  card: PresentationGovernanceCard | null;
  onExport: () => void;
}

const GovernanceSnapshotCard: React.FC<GovernanceSnapshotCardProps> = ({
  status,
  card,
  onExport,
}) => {
  if (!card && (status === null || status === 'ok')) {
    return null;
  }
  if (!card) {
    const reason =
      status === 'forbidden'
        ? 'Insufficient permission to load governance card.'
        : status === 'not_found'
          ? 'No governance data for this deck yet.'
          : 'Governance card unavailable.';
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={14} /> Governance snapshot
        </div>
        <p className="mt-1 text-[12px] opacity-80">{reason}</p>
      </div>
    );
  }
  const tone = VERDICT_TONE[card.overallVerdict] || VERDICT_TONE.INCONCLUSIVE;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Governance snapshot
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone}`}
          >
            {card.overallVerdict}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            P0 {card.quality.p0} · P1 {card.quality.p1} · P2 {card.quality.p2} · gates{' '}
            {card.quality.gateCount}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            · {String(card.confidentiality.level)}
          </span>
        </div>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
          aria-label="Export governance card JSON"
        >
          Export JSON
        </button>
      </div>
    </div>
  );
};

interface BodyProps {
  loading: boolean;
  hasAttempted: boolean;
  trimmedDeckId: string;
  rollup: PresentationTelemetryRollup | null;
  kpiCards: KpiCard[];
  sortedByEventType: PresentationTelemetryRollup['byEventType'];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

function renderBody(props: BodyProps): React.ReactElement {
  const {
    loading,
    hasAttempted,
    trimmedDeckId,
    rollup,
    kpiCards,
    sortedByEventType,
    sortKey,
    sortDir,
    onSort,
  } = props;

  // Loading takes precedence so we don't flash an empty state during refetch.
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Loader2 size={16} className="animate-spin text-indigo-500" />
        Loading telemetry…
      </div>
    );
  }

  // No deckId → either we never tried, or user submitted with empty input.
  if (!trimmedDeckId || (!rollup && !hasAttempted)) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Enter a deck ID to load telemetry.
      </div>
    );
  }

  if (!rollup) {
    // Defensive fallback; shouldn't hit because the service always resolves.
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Enter a deck ID to load telemetry.
      </div>
    );
  }

  const isDegraded = rollup.degraded === true;
  const isEmpty = rollup.totals.total === 0;

  return (
    <div className="space-y-6">
      {isDegraded && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              Telemetry unavailable: {rollup.reason || 'unknown'}. Working in degraded mode.
            </div>
            <div className="mt-1 text-xs opacity-80">
              Counters below default to zero until the backend recovers. No data has been silently
              fabricated.
            </div>
          </div>
        </div>
      )}

      {!isDegraded && isEmpty ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          No telemetry events in the selected window.
        </div>
      ) : (
        <>
          {/* KPI grid (5 cards) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {kpiCards.map((card) => (
              <div key={card.label} className={`rounded-lg border p-4 ${TONE_MAP[card.tone]}`}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
                  {card.icon}
                  {card.label}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatNumber(card.value)}
                </div>
                {card.hint && <div className="mt-1 text-[11px] opacity-80">{card.hint}</div>}
              </div>
            ))}
          </div>

          {/* By-event-type table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileEdit size={14} className="text-slate-500 dark:text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Events by type
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {sortedByEventType.length} type{sortedByEventType.length === 1 ? '' : 's'}
              </span>
            </div>
            {sortedByEventType.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                No event types recorded in this window.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800"
                >
                  <thead className="bg-slate-50 dark:bg-slate-900/60">
                    <tr>
                      <SortableHeader
                        label="Event Type"
                        sortKey="eventType"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={onSort}
                        align="left"
                      />
                      <SortableHeader
                        label="Count"
                        sortKey="count"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={onSort}
                        align="right"
                      />
                      <SortableHeader
                        label="Last Activity"
                        sortKey="lastAt"
                        currentKey={sortKey}
                        currentDir={sortDir}
                        onSort={onSort}
                        align="left"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sortedByEventType.map((row) => (
                      <tr
                        key={row.eventType}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-2 font-mono text-slate-800 dark:text-slate-200">
                          {row.eventType}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {formatNumber(row.count)}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                          {row.lastAt ? (
                            <span title={new Date(row.lastAt).toLocaleString()}>
                              {formatRelativeTime(row.lastAt)}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            Read-only view. No counters are written or modified from this screen — refresh by
            pressing <span className="font-semibold">Load</span>.
          </p>
        </>
      )}
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align: 'left' | 'right';
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align,
}) => {
  const isActive = currentKey === sortKey;
  const Icon = isActive ? (currentDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const ariaSort: 'ascending' | 'descending' | 'none' = isActive
    ? currentDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-4 py-2 ${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''} rounded px-1 py-0.5 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:text-slate-200`}
      >
        <span>{label}</span>
        <Icon size={12} className={isActive ? 'opacity-100' : 'opacity-50'} />
      </button>
    </th>
  );
};

export default PresentationTelemetryView;
