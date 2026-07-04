/**
 * InitiativeProposalBoard — the main creation screen of the Initiative Generator
 * (Formula §4c). Instead of an empty form, the "Propose" pass returns a SET of
 * proposals, each tagged with its RELATION to the living initiative grid; the human
 * triages here.
 *
 * Props-decoupled & additive: takes already-classified proposals (from
 * services/initiatives/proposalReconciliation) + callbacks. Knows nothing about hubs
 * or the rebuilt initiative model — so it composes anywhere without collision.
 *
 *  - relation 'new' / 'contributes_to_goal'  → onAcceptNew  (→ charter-lite → DRAFT)
 *  - every other relation                     → onAcceptChange (→ suggested change, mini-gate)
 *  - always                                   → onDismiss
 */
import { ArrowRight, FileText, Inbox, ShieldCheck, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  ClassifiedProposal,
  CoverageReport,
  ProposalRelation,
} from '@/services/initiatives/proposalReconciliation';

export interface ProposalSource {
  label: string;
  /** Raw evidence shown in the drawer (insight text, gap, etc.). */
  content?: string;
}

export interface InitiativeProposalBoardProps {
  proposals: ClassifiedProposal[];
  coverage?: CoverageReport;
  source?: ProposalSource;
  onAcceptNew?: (p: ClassifiedProposal) => void;
  onAcceptChange?: (p: ClassifiedProposal) => void;
  onDismiss?: (p: ClassifiedProposal) => void;
  isPolish?: boolean;
}

type RelationMeta = {
  pl: string;
  en: string;
  dot: string;
  chip: string;
  kind: 'new' | 'change';
};

const RELATION_META: Record<ProposalRelation, RelationMeta> = {
  new: {
    pl: 'Nowa',
    en: 'New',
    dot: 'bg-emerald-500',
    chip: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15',
    kind: 'new',
  },
  contributes_to_goal: {
    pl: 'Wkład w cel',
    en: 'Contributes to goal',
    dot: 'bg-emerald-400',
    chip: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15',
    kind: 'new',
  },
  duplicate: {
    pl: 'Duplikat',
    en: 'Duplicate',
    dot: 'bg-slate-400',
    chip: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-navy-800',
    kind: 'change',
  },
  extend: {
    pl: 'Rozszerzenie',
    en: 'Extend',
    dot: 'bg-blue-500',
    chip: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
    kind: 'change',
  },
  evidence_only: {
    pl: 'Dowód',
    en: 'Evidence',
    dot: 'bg-slate-300',
    chip: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-navy-800',
    kind: 'change',
  },
  conflict: {
    pl: 'Konflikt',
    en: 'Conflict',
    dot: 'bg-danger-500',
    chip: 'text-danger-700 bg-danger-50 dark:text-danger-300 dark:bg-danger-500/15',
    kind: 'change',
  },
  depends_on: {
    pl: 'Zależność',
    en: 'Depends on',
    dot: 'bg-violet-500',
    chip: 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/15',
    kind: 'change',
  },
  re_prioritize: {
    pl: 'Re-priorytet',
    en: 'Re-prioritize',
    dot: 'bg-amber-500',
    chip: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15',
    kind: 'change',
  },
};

const CHANGE_ACTION: Partial<Record<ProposalRelation, { pl: string; en: string }>> = {
  duplicate: { pl: 'Scal', en: 'Merge' },
  extend: { pl: 'Zaproponuj rozszerzenie', en: 'Propose extension' },
  evidence_only: { pl: 'Dodaj dowód', en: 'Add evidence' },
  conflict: { pl: 'Zgłoś do re-review', en: 'Flag for re-review' },
  depends_on: { pl: 'Powiąż zależność', en: 'Link dependency' },
  re_prioritize: { pl: 'Zaproponuj re-priorytet', en: 'Propose re-prioritize' },
};

export const InitiativeProposalBoard: React.FC<InitiativeProposalBoardProps> = ({
  proposals,
  coverage,
  source,
  onAcceptNew,
  onAcceptChange,
  onDismiss,
  isPolish: isPolishProp,
}) => {
  const { i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const tr = (pl: string, en: string) => (isPolish ? pl : en);

  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const visible = proposals.map((p, i) => ({ p, i })).filter(({ i }) => !dismissed.has(i));

  const counts = useMemo(() => {
    const newCount = proposals.filter((p) => RELATION_META[p.relation].kind === 'new').length;
    const changeCount = proposals.length - newCount;
    return { newCount, changeCount };
  }, [proposals]);

  const dismiss = (i: number, p: ClassifiedProposal) => {
    setDismissed((s) => new Set(s).add(i));
    onDismiss?.(p);
  };

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Proposals column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-primary-500" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {tr('Tablica propozycji', 'Proposal board')}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {tr(
              `${counts.newCount} nowych · ${counts.changeCount} zmian`,
              `${counts.newCount} new · ${counts.changeCount} changes`
            )}
          </span>
        </div>

        {counts.newCount === 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-300/50 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-slate-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-slate-300">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-500" />
            <span>
              {tr(
                '0 nowych inicjatyw to nie porażka — ten przebieg porządkuje siatkę (wzmacnia, łączy, sygnalizuje).',
                '0 new initiatives is not a failure — this run tidies the grid (reinforces, links, flags).'
              )}
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
          {visible.length === 0 ? (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 dark:border-navy-700">
              <Inbox size={28} className="mb-2 opacity-60" />
              <p className="text-sm">
                {tr('Brak propozycji do rozpatrzenia', 'No proposals to review')}
              </p>
            </div>
          ) : (
            visible.map(({ p, i }) => {
              const meta = RELATION_META[p.relation];
              const changeAction = CHANGE_ACTION[p.relation];
              return (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-navy-700/60 dark:bg-navy-800/40"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {isPolish ? meta.pl : meta.en}
                    </span>
                    {p.matchedInitiativeId && meta.kind === 'change' && (
                      <span className="truncate text-[11px] text-slate-400">
                        → {p.matchedInitiativeId}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {p.candidate.title}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.rationale}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    {meta.kind === 'new' ? (
                      <button
                        type="button"
                        onClick={() => onAcceptNew?.(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-3 py-1.5 text-xs font-semibold text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF]"
                      >
                        {tr('Utwórz draft', 'Create draft')}
                        <ArrowRight size={13} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAcceptChange?.(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/40 px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10"
                      >
                        {changeAction
                          ? isPolish
                            ? changeAction.pl
                            : changeAction.en
                          : tr('Zaproponuj zmianę', 'Propose change')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => dismiss(i, p)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
                    >
                      {tr('Odrzuć', 'Dismiss')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Coverage strip (MECE) */}
        {coverage && (coverage.gaps.length > 0 || coverage.overlaps.length > 0) && (
          <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-navy-700/60 dark:bg-navy-950/30">
            {coverage.gaps.length > 0 && (
              <div className="text-amber-700 dark:text-amber-300">
                {tr(
                  'Luki pokrycia (cele bez inicjatyw):',
                  'Coverage gaps (goals with no initiative):'
                )}{' '}
                <span className="font-medium">{coverage.gaps.join(', ')}</span>
              </div>
            )}
            {coverage.overlaps.length > 0 && (
              <div className="text-danger-700 dark:text-danger-300">
                {tr('Nakładania (MECE):', 'Overlaps (MECE):')}{' '}
                <span className="font-medium">{coverage.overlaps.length}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evidence drawer */}
      <aside className="hidden w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-navy-700/60 dark:bg-navy-950/30 lg:flex">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <FileText size={13} />
          {tr('Dowód źródłowy', 'Source evidence')}
        </div>
        {source ? (
          <>
            <div className="mb-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              {source.label}
            </div>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {source.content || tr('Brak treści źródła.', 'No source content.')}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">{tr('Brak źródła.', 'No source.')}</p>
        )}
      </aside>
    </div>
  );
};

export default InitiativeProposalBoard;
