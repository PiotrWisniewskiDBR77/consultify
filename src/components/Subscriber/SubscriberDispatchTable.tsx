/**
 * SubscriberDispatchTable
 *
 * Compact "recent dispatches" table for the subscriber dashboard.
 * Renders up to 5 server-supplied rows with deterministic, color-coded
 * status pills and lucide icons. The table is purely presentational —
 * status / verdict / deck masking are produced server-side; we never
 * re-derive sensitive values here.
 *
 * Column model:
 *   - Time     (ISO timestamp formatted to local clock + relative)
 *   - Status   (icon + colored pill)
 *   - HTTP     (numeric or em-dash)
 *   - Verdict  (alert verdict that triggered the dispatch)
 *   - Deck     (already masked, e.g. `deck****`)
 *   - Sig      (small chip; expand details via title attr)
 *
 * Empty state ("No recent dispatches") is honest: we never paint zero
 * rows as a fake checkmark. If the server returns an empty array we
 * say so out loud.
 */

import { CheckCircle, FlaskConical, Info, MinusCircle, XCircle } from 'lucide-react';
import React from 'react';

import type {
  ClientSubscriberSnapshot,
  SubscriberDispatchStatus,
} from '../../services/subscriberDashboardClient';

const COPY = {
  heading: 'Recent dispatches',
  empty: 'No recent dispatches yet.',
  columns: {
    time: 'Time',
    status: 'Status',
    http: 'HTTP',
    verdict: 'Verdict',
    deck: 'Deck',
    signature: 'Signature',
  },
  signaturePresent: 'Signed',
  signatureMissing: 'Unsigned',
  helpSignature: 'Show signature details',
} as const;

const STATUS_LABEL: Record<SubscriberDispatchStatus, string> = {
  sent: 'Sent',
  failed: 'Failed',
  suppressed: 'Suppressed',
  dry_run: 'Dry-run',
};

const STATUS_TONE: Record<SubscriberDispatchStatus, string> = {
  sent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  failed: 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300',
  suppressed: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  dry_run: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
};

const STATUS_ICON: Record<
  SubscriberDispatchStatus,
  React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
> = {
  sent: CheckCircle,
  failed: XCircle,
  suppressed: MinusCircle,
  dry_run: FlaskConical,
};

function formatTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return new Date(ts).toISOString();
  }
}

export interface SubscriberDispatchTableProps {
  dispatches: ClientSubscriberSnapshot['recentDispatches'];
  className?: string;
  /** Cap the visible rows; defaults to 5 (matches the server contract). */
  maxRows?: number;
}

const SubscriberDispatchTable: React.FC<SubscriberDispatchTableProps> = ({
  dispatches,
  className = '',
  maxRows = 5,
}) => {
  const rows = (Array.isArray(dispatches) ? dispatches : []).slice(0, maxRows);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`.trim()}
    >
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{COPY.heading}</h3>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          Last {maxRows} dispatches in chronological order.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border-t border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {COPY.empty}
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
          <table
            /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="min-w-full text-left text-xs"
          >
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2">
                  {COPY.columns.time}
                </th>
                <th scope="col" className="px-4 py-2">
                  {COPY.columns.status}
                </th>
                <th scope="col" className="px-4 py-2">
                  {COPY.columns.http}
                </th>
                <th scope="col" className="px-4 py-2">
                  {COPY.columns.verdict}
                </th>
                <th scope="col" className="px-4 py-2">
                  {COPY.columns.deck}
                </th>
                <th scope="col" className="px-4 py-2">
                  {COPY.columns.signature}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((row) => {
                const Icon = STATUS_ICON[row.status];
                const tone = STATUS_TONE[row.status];
                const sigTitle = row.signaturePresent
                  ? `Signed with ${row.signatureAlgorithm ?? 'HMAC-SHA256'}`
                  : 'No signature recorded';
                return (
                  <tr
                    key={row.id || row.dispatchedAt}
                    className="text-slate-700 dark:text-slate-300"
                  >
                    <td className="px-4 py-2 tabular-nums">
                      <span title={row.dispatchedAt}>{formatTime(row.dispatchedAt)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                      >
                        <Icon size={11} aria-hidden className="shrink-0" />
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {typeof row.httpStatus === 'number' ? row.httpStatus : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px]">{row.toVerdict || '—'}</td>
                    <td className="px-4 py-2 font-mono text-[11px]">
                      {row.deckIdMasked || '****'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          row.signaturePresent
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300'
                        }`}
                        title={sigTitle}
                        aria-label={sigTitle}
                      >
                        <Info size={10} aria-hidden className="shrink-0" />
                        {row.signaturePresent ? COPY.signaturePresent : COPY.signatureMissing}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubscriberDispatchTable;
