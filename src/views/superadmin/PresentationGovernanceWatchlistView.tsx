/**
 * PresentationGovernanceWatchlistView
 *
 * Read-only SuperAdmin surface that lists decks currently flagged
 * BLOCKED_P0 / BLOCKED_P1 by the org's governance cards, sorted by severity.
 *
 * Source: GET /api/presentations/governance/watchlist via
 * {@link fetchPresentationGovernanceWatchlist}. Mirrors the layout of
 * `PresentationTelemetryView` (header + controls, totals strip, table) and
 * surfaces an honest banner for forbidden / unavailable backends instead of
 * fabricating zero-counters. Never exposes raw deck JSON or raw quality gates,
 * only the aggregated metrics already present in the governance card.
 */

import {
  AlertTriangle,
  Copy,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchPresentationGovernanceWatchlist,
  type WatchlistEntry,
  type WatchlistFetchStatus,
  type WatchlistResponse,
  type WatchlistVerdict,
} from '../../services/presentationGovernanceWatchlist';

const LIMIT_OPTIONS: number[] = [10, 25, 50, 100, 200];
const DEFAULT_LIMIT = 50;

const VERDICT_TONE: Record<WatchlistVerdict, string> = {
  PASS: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  PASS_WITH_P2: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  BLOCKED_P1: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  BLOCKED_P0: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  INCONCLUSIVE: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
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

function statusReason(status: WatchlistFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') {
    return 'Insufficient permission to load the governance watchlist.';
  }
  if (status === 'not_found') {
    return 'Governance watchlist endpoint not found.';
  }
  if (status === 'unavailable') {
    return 'Governance watchlist is unavailable. The backend may be offline.';
  }
  return 'Could not load the governance watchlist.';
}

interface PresentationGovernanceWatchlistViewProps {
  onJumpToDeck?: (deckId: string) => void;
}

const PresentationGovernanceWatchlistView: React.FC<
  PresentationGovernanceWatchlistViewProps
> = ({ onJumpToDeck }) => {
  const [onlyBlocked, setOnlyBlocked] = useState<boolean>(true);
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT);
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [status, setStatus] = useState<WatchlistFetchStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setHasAttempted(true);
    try {
      const result = await fetchPresentationGovernanceWatchlist({ onlyBlocked, limit });
      setStatus(result.status);
      setData(result.status === 'ok' && result.data ? result.data : null);
    } finally {
      setLoading(false);
    }
  }, [onlyBlocked, limit]);

  useEffect(() => {
    void handleLoad();
  }, [handleLoad]);

  const reasonBanner = useMemo(() => statusReason(status), [status]);

  const handleAction = useCallback(
    (entry: WatchlistEntry) => {
      if (typeof onJumpToDeck === 'function') {
        onJumpToDeck(entry.deckId);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(entry.deckId).catch(() => {
          // Clipboard may be blocked in some contexts; failure is non-fatal.
        });
      }
    },
    [onJumpToDeck]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Governance Watchlist
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Decks currently flagged BLOCKED_P0 or BLOCKED_P1, sorted by severity.
          </p>
          {data && (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Generated {new Date(data.generatedAt).toLocaleString()} ·{' '}
              {data.entries.length} of {data.totals.decks} deck
              {data.totals.decks === 1 ? '' : 's'} shown
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3" aria-label="Watchlist filters">
          <label className="inline-flex select-none items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={onlyBlocked}
              onChange={(e) => setOnlyBlocked(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
            Only blocked
          </label>
          <div className="flex flex-col">
            <label
              htmlFor="presentation-watchlist-limit"
              className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Limit
            </label>
            <select
              id="presentation-watchlist-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
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
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCcw size={12} />
            )}
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      {renderBody({
        loading,
        hasAttempted,
        reasonBanner,
        data,
        onlyBlocked,
        warnings: data?.warnings,
        onAction: handleAction,
        canJumpToDeck: typeof onJumpToDeck === 'function',
      })}
    </div>
  );
};

interface BodyProps {
  loading: boolean;
  hasAttempted: boolean;
  reasonBanner: string | null;
  data: WatchlistResponse | null;
  onlyBlocked: boolean;
  warnings?: string[];
  onAction: (entry: WatchlistEntry) => void;
  canJumpToDeck: boolean;
}

function renderBody(props: BodyProps): React.ReactElement {
  const {
    loading,
    hasAttempted,
    reasonBanner,
    data,
    onlyBlocked,
    warnings,
    onAction,
    canJumpToDeck,
  } = props;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Loader2 size={16} className="animate-spin text-indigo-500" />
        Loading watchlist…
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
          <div className="font-semibold">Governance watchlist unavailable</div>
          <div className="mt-1 text-xs opacity-80">{reasonBanner}</div>
        </div>
      </div>
    );
  }

  if (!hasAttempted || !data) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        Waiting for governance data…
      </div>
    );
  }

  const totals = data.totals;
  const isEmpty = data.entries.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
          <span>
            Total decks: <strong className="text-slate-900 dark:text-slate-100">{formatNumber(totals.decks)}</strong>
          </span>
          <span>·</span>
          <span>
            BLOCKED_P0: <strong className="text-rose-700 dark:text-rose-300">{formatNumber(totals.blockedP0)}</strong>
          </span>
          <span>·</span>
          <span>
            BLOCKED_P1: <strong className="text-orange-700 dark:text-orange-300">{formatNumber(totals.blockedP1)}</strong>
          </span>
          <span>·</span>
          <span>
            PASS_WITH_P2: <strong className="text-amber-700 dark:text-amber-300">{formatNumber(totals.passWithP2)}</strong>
          </span>
          <span>·</span>
          <span>
            PASS: <strong className="text-emerald-700 dark:text-emerald-300">{formatNumber(totals.pass)}</strong>
          </span>
          <span>·</span>
          <span>
            INCONCLUSIVE: <strong className="text-slate-700 dark:text-slate-200">{formatNumber(totals.inconclusive)}</strong>
          </span>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Some decks could not be evaluated</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 opacity-80">
              {warnings.slice(0, 5).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {warnings.length > 5 && <li>… and {warnings.length - 5} more</li>}
            </ul>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {onlyBlocked ? 'No blocked decks 🎉' : 'No decks match the current filters.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Watchlist entries
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {data.entries.length} entr{data.entries.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Deck
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Verdict
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    P0 / P1 / P2
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Exports blocked
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Confidentiality
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Updated
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.entries.map((entry) => {
                  const tone = VERDICT_TONE[entry.overallVerdict] || VERDICT_TONE.INCONCLUSIVE;
                  return (
                    <tr
                      key={entry.deckId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2 text-slate-800 dark:text-slate-200">
                        <div className="font-medium">{entry.title}</div>
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-500">
                          {entry.deckId}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone}`}
                        >
                          {entry.overallVerdict}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(entry.p0)} / {formatNumber(entry.p1)} /{' '}
                        {formatNumber(entry.p2)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatNumber(entry.exportsBlocked)}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                        {entry.confidentialityLevel}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                        {entry.updatedAt ? (
                          <span title={new Date(entry.updatedAt).toLocaleString()}>
                            {formatRelativeTime(entry.updatedAt)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onAction(entry)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {canJumpToDeck ? (
                            <>Open telemetry</>
                          ) : (
                            <>
                              <Copy size={11} /> Copy deck ID
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500 dark:text-slate-500">
        Read-only view. Aggregated from per-deck governance cards. Raw deck content
        and individual quality gates are not exposed here.
      </p>
    </div>
  );
}

export default PresentationGovernanceWatchlistView;
