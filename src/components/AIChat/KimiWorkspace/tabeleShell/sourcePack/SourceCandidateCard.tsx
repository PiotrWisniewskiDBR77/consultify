/**
 * SourceCandidateCard — a single ranked candidate row in
 * `<TabeleSourcePackPanel>`. Displays the title, preview, and a small set
 * of trust signals (verified-source dot, validation status pill) plus a
 * primary "Add"/"Remove" toggle.
 *
 * Block C · EPIC-T12 · Sprint C-S6.
 */

import { Check, Plus, ShieldCheck } from 'lucide-react';
import React from 'react';

import type { SourcePackCandidate } from '@/services/api/tablePlatform.api';

const STATUS_LABEL: Record<string, string> = {
  verified: 'verified',
  in_review: 'in review',
  unverified: 'unverified',
  rejected: 'rejected',
};

export interface SourceCandidateCardProps {
  candidate: SourcePackCandidate;
  selected: boolean;
  onToggle: (recordId: string) => void;
  /** Disables the "Add" button when the pack is at max capacity. */
  disableAdd?: boolean;
}

function formatScore(n: number): string {
  return Math.round(n * 100).toString();
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const days = (Date.now() - t) / (1000 * 60 * 60 * 24);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${Math.floor(days)}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export const SourceCandidateCard: React.FC<SourceCandidateCardProps> = ({
  candidate,
  selected,
  onToggle,
  disableAdd,
}) => {
  const status = candidate.validationStatus.toLowerCase();
  return (
    <li
      className={[
        'rounded-md border p-3 transition-colors',
        selected
          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
      ].join(' ')}
      data-testid="source-candidate-card"
      data-record-id={candidate.recordId}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              score {formatScore(candidate.rankScore)}
            </span>
            {candidate.hasVerifiedSource && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] text-emerald-600 dark:text-emerald-400"
                aria-label="has verified source"
                data-testid="candidate-verified-flag"
              >
                <ShieldCheck className="h-3 w-3" />
                verified
              </span>
            )}
            <span
              className={[
                'inline-flex items-center rounded px-1.5 py-0.5 text-[10px]',
                status === 'verified'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : status === 'rejected'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
              ].join(' ')}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {formatRelative(candidate.updatedAt)}
            </span>
          </div>
          <h4
            className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-100"
            title={candidate.title}
          >
            {candidate.title}
          </h4>
          {candidate.preview && (
            <p
              className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400"
              title={candidate.preview}
            >
              {candidate.preview}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onToggle(candidate.recordId)}
          disabled={!selected && disableAdd}
          className={[
            'shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
            selected
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50',
          ].join(' ')}
          data-testid="candidate-toggle"
          aria-pressed={selected}
          aria-label={selected ? 'Remove from pack' : 'Add to pack'}
        >
          {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {selected ? 'Added' : 'Add'}
        </button>
      </div>
    </li>
  );
};

export default SourceCandidateCard;
