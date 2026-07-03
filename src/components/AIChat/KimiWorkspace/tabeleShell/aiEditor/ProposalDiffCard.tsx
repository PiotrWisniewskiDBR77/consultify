/**
 * ProposalDiffCard — preview of a proposed AI Editor change.
 *
 * Renders the proposal envelope returned from `proposeAiEdit()`:
 *   - level badge + handler status
 *   - soft-warn banner when budget threshold tripped
 *   - operations preview (ops are loaded lazily by the parent and
 *     passed in as `operations`)
 *   - Apply / Reject buttons
 *
 * The card is "presentational" — Apply / Reject behaviour is wired by
 * the parent panel. This keeps the diff card unit-testable without an
 * Express server.
 *
 * Block C · EPIC-T10 · Sprint C-S5.
 */

import { Check, Loader2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { AiEditorLevel } from '@/services/api/tablePlatform.api';

import { getLevelMeta, translateLevelMeta } from './levelMeta';

export interface ProposalDiffCardProps {
  proposalId: string;
  level: AiEditorLevel;
  handlerStatus: 'stub' | 'live';
  softWarn: boolean;
  prompt: string;
  /** Optional operations preview. When omitted, shows "diff not available". */
  operations?: unknown[];
  busyApply?: boolean;
  busyReject?: boolean;
  onApply: () => void;
  onReject: () => void;
}

export const ProposalDiffCard: React.FC<ProposalDiffCardProps> = ({
  proposalId,
  level,
  handlerStatus,
  softWarn,
  prompt,
  operations,
  busyApply,
  busyReject,
  onApply,
  onReject,
}) => {
  const { t } = useTranslation();
  const meta = getLevelMeta(level);
  const { label } = translateLevelMeta(meta, t);
  return (
    <article
      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      data-testid="ai-proposal-diff-card"
      data-proposal-id={proposalId}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {label}
          </span>
          <span className="text-[10px] text-slate-600 dark:text-slate-500">
            {handlerStatus === 'live'
              ? t('kimi.tabeleShell.aiEditor.handlerLive', 'live')
              : t('kimi.tabeleShell.aiEditor.handlerStub', 'stub')}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-600 dark:text-slate-500">
          {proposalId.slice(0, 8)}
        </span>
      </header>

      {softWarn && (
        <div className="mx-3 mt-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          {t(
            'kimi.tabeleShell.aiEditor.softWarnDetail',
            'AI token budget approaching daily limit (soft warn).'
          )}
        </div>
      )}

      <section className="px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('kimi.tabeleShell.aiEditor.promptSection', 'Prompt')}
        </p>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{prompt}</p>
      </section>

      <section className="border-t border-slate-200 dark:border-slate-800 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('kimi.tabeleShell.aiEditor.proposedOperations', 'Proposed operations')}
        </p>
        {!operations || operations.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(
              'kimi.tabeleShell.aiEditor.noOperationsPreview',
              'No operations preview available. Use the workspace audit log for full diff.'
            )}
          </p>
        ) : (
          <ul
            className="mt-1 max-h-44 overflow-auto rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-2 text-[11px] font-mono"
            data-testid="ai-proposal-operations"
          >
            {operations.slice(0, 25).map((op, idx) => {
              const opObj = op as { type?: string };
              return (
                <li
                  key={idx}
                  className="truncate text-slate-600 dark:text-slate-300"
                  title={JSON.stringify(op)}
                >
                  {idx + 1}. {opObj?.type ?? t('kimi.tabeleShell.aiEditor.opFallback', 'op')} —{' '}
                  {shorten(JSON.stringify(op))}
                </li>
              );
            })}
            {operations.length > 25 && (
              <li className="text-slate-600 dark:text-slate-500">
                {t('kimi.tabeleShell.aiEditor.moreOperations', {
                  defaultValue: '+{{count}} more',
                  count: operations.length - 25,
                })}
              </li>
            )}
          </ul>
        )}
      </section>

      <footer className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 px-3 py-2">
        <button
          type="button"
          onClick={onReject}
          disabled={busyApply || busyReject}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          data-testid="ai-proposal-reject"
        >
          {busyReject ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          {t('kimi.tabeleShell.aiEditor.reject', 'Reject')}
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={busyApply || busyReject}
          className="inline-flex items-center gap-1 rounded-md border border-slate-800 dark:border-slate-200 bg-slate-800 dark:bg-slate-100 px-2 py-1 text-xs text-white dark:text-slate-900 hover:bg-slate-900 dark:hover:bg-slate-50 disabled:opacity-50"
          data-testid="ai-proposal-apply"
        >
          {busyApply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {t('kimi.tabeleShell.aiEditor.apply', 'Apply')}
        </button>
      </footer>
    </article>
  );
};

function shorten(s: string): string {
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

export default ProposalDiffCard;
