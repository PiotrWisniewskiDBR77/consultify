/**
 * SuggestedChangesPanel — the mini-gate UI for the additive "suggested changes" slice
 * (Formula §5 / Faza 4). Renders pending suggested changes proposed against EXISTING
 * initiatives; the owner accepts (apply) or rejects each one — the change is never
 * applied to the initiative without this explicit gate.
 *
 * Props-decoupled & additive: takes already-loaded SuggestedChange items + callbacks,
 * mirroring the styling and bilingual (PL/EN) pattern of InitiativeProposalBoard.tsx.
 */
import { Check, GitBranch, Inbox, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { SuggestedChange, SuggestedChangeKind } from '@/services/initiatives/suggestedChanges';

export interface SuggestedChangesPanelProps {
  items: SuggestedChange[];
  onAccept?: (c: SuggestedChange) => void;
  onReject?: (c: SuggestedChange) => void;
  isPolish?: boolean;
}

type KindMeta = {
  pl: string;
  en: string;
  dot: string;
  chip: string;
};

const KIND_META: Record<SuggestedChangeKind, KindMeta> = {
  extend: {
    pl: 'Rozszerzenie',
    en: 'Extend',
    dot: 'bg-blue-500',
    chip: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
  },
  evidence: {
    pl: 'Dowód',
    en: 'Evidence',
    dot: 'bg-slate-300',
    chip: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-navy-800',
  },
  conflict: {
    pl: 'Konflikt',
    en: 'Conflict',
    dot: 'bg-danger-500',
    chip: 'text-danger-700 bg-danger-50 dark:text-danger-300 dark:bg-danger-500/15',
  },
  re_prioritize: {
    pl: 'Re-priorytet',
    en: 'Re-prioritize',
    dot: 'bg-amber-500',
    chip: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15',
  },
};

export const SuggestedChangesPanel: React.FC<SuggestedChangesPanelProps> = ({
  items,
  onAccept,
  onReject,
  isPolish: isPolishProp,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';

  const pending = items.filter((c) => (c.status ?? 'pending') === 'pending');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <GitBranch size={16} className="text-c-info" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {t('initiatives.suggestedChangesPanel.title')}
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {t('initiatives.suggestedChangesPanel.toReview', { count: pending.length })}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {pending.length === 0 ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 dark:border-navy-700">
            <Inbox size={28} className="mb-2 opacity-60" />
            <p className="text-sm">{t('initiatives.suggestedChangesPanel.empty')}</p>
          </div>
        ) : (
          pending.map((change, i) => {
            const meta = KIND_META[change.kind];
            return (
              <div
                key={change.id ?? `${change.initiativeId}:${i}`}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-navy-700/60 dark:bg-navy-800/40"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                    {isPolish ? meta.pl : meta.en}
                  </span>
                  <span className="truncate text-[11px] text-slate-400">
                    → {change.initiativeId}
                  </span>
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {change.title}
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {change.rationale}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAccept?.(change)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF]"
                  >
                    <Check size={13} />
                    {t('initiatives.suggestedChangesPanel.accept')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject?.(change)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    <X size={13} />
                    {t('initiatives.suggestedChangesPanel.reject')}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SuggestedChangesPanel;
