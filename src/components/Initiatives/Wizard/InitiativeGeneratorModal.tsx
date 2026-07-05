/**
 * InitiativeGeneratorModal — assembles the full "Propose initiative" flow from the
 * three building blocks (Formula §4): reconciliation core → Proposal Board → Charter.
 *
 * One invocation contract: open with a `source` (insight/gap/etc.) + the AI/backend
 * `candidates`. The modal fetches the live initiative grid, reconciles candidates
 * against it (relations + MECE coverage), shows the Proposal Board for triage, and
 * routes:
 *   - accept NEW / contributes-to-goal → Charter (charter-lite → DRAFT),
 *   - accept CHANGE                     → suggested change (Phase 4 — placeholder now),
 *   - dismiss                           → drop.
 *
 * Additive & self-contained: depends only on my own modules + the stable Api service —
 * touches none of the files in the concurrent insights/initiatives rebuild. Wiring a
 * launch button into hubs (Phase 0) is a one-liner the host adds later.
 */
import { X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  type CandidateInput,
  type ClassifiedProposal,
  type ExistingInitiative,
  type ProposalRelation,
  reconcileProposals,
} from '@/services/initiatives/proposalReconciliation';
import { proposeCandidates } from '@/services/initiatives/proposeCandidates';
import {
  submitSuggestedChange,
  type SuggestedChangeKind,
} from '@/services/initiatives/suggestedChanges';

import { type InitiativeCharterSource, InitiativeCharterWizard } from './InitiativeCharterWizard';
import { type AcceptedItem, InitiativeCoverageWaveView } from './InitiativeCoverageWaveView';
import { InitiativeProposalBoard } from './InitiativeProposalBoard';

const RELATION_TO_CHANGE_KIND = (r: ProposalRelation): SuggestedChangeKind =>
  r === 'conflict'
    ? 'conflict'
    : r === 're_prioritize'
      ? 're_prioritize'
      : r === 'evidence_only'
        ? 'evidence'
        : 'extend';

export interface InitiativeGeneratorSource {
  /** Display label + evidence shown in the board drawer. */
  label: string;
  content?: string;
  /** Lineage carried into the created initiative. */
  sourceType?: string;
  sourceId?: string | null;
  evidenceRefs?: string[];
}

export interface InitiativeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What invoked the generator (insight, gap, …). */
  source?: InitiativeGeneratorSource;
  /** Proposed candidates (from the AI/backend "propose" engine — Phase 2b). */
  candidates?: CandidateInput[];
  /** Strategic goals/value-drivers, for MECE gap detection. */
  goalKeys?: string[];
  projectId?: string;
  onCreated?: (result: { createdId: string | null; created: unknown }) => void;
  isPolish?: boolean;
}

export const InitiativeGeneratorModal: React.FC<InitiativeGeneratorModalProps> = ({
  isOpen,
  onClose,
  source,
  candidates = [],
  goalKeys,
  projectId,
  onCreated,
  isPolish: isPolishProp,
}) => {
  const { i18n } = useTranslation();
  const isPolish = isPolishProp ?? i18n.language === 'pl';
  const tr = (pl: string, en: string) => (isPolish ? pl : en);

  const [view, setView] = useState<'board' | 'charter'>('board');
  const [boardTab, setBoardTab] = useState<'proposals' | 'coverage'>('proposals');
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<ExistingInitiative[]>([]);
  const [autoCandidates, setAutoCandidates] = useState<CandidateInput[]>([]);
  const [chosen, setChosen] = useState<ClassifiedProposal | null>(null);

  // Fetch the live grid on open (the "siatka" to reconcile against).
  useEffect(() => {
    if (!isOpen) return;
    setView('board');
    setBoardTab('proposals');
    setChosen(null);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await Api.get('/initiatives');
        const raw: Array<Record<string, unknown>> = Array.isArray(data)
          ? data
          : Array.isArray((data as { initiatives?: unknown[] })?.initiatives)
            ? ((data as { initiatives: unknown[] }).initiatives as Array<Record<string, unknown>>)
            : [];
        const str = (v: unknown): string => (typeof v === 'string' ? v : '');
        const mapped: ExistingInitiative[] = raw
          .map((i) => ({
            id: str(i.id),
            title: str(i.title),
            description: str(i.description) || undefined,
            goalKey: str(i.goalKey) || str(i.category) || undefined,
            status: str(i.status) || undefined,
            tags: Array.isArray(i.tags) ? (i.tags as string[]) : undefined,
          }))
          .filter((i) => i.id && i.title);
        if (!cancelled) setExisting(mapped);
      } catch {
        if (!cancelled) setExisting([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Phase 2b — when no candidates were injected, auto-propose from the source text
  // (AI-first with deterministic fallback; never throws / never blocks).
  useEffect(() => {
    if (!isOpen) {
      setAutoCandidates([]);
      return;
    }
    if (candidates.length > 0 || !source?.content) return;
    let cancelled = false;
    (async () => {
      const c = await proposeCandidates(
        { text: source.content as string, label: source.label, goalKeys },
        { projectId }
      );
      if (!cancelled) setAutoCandidates(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, candidates.length, source?.content, source?.label, goalKeys, projectId]);

  const effectiveCandidates = candidates.length > 0 ? candidates : autoCandidates;

  const { proposals, coverage } = useMemo(
    () => reconcileProposals(effectiveCandidates, existing, { goalKeys }),
    [effectiveCandidates, existing, goalKeys]
  );

  const acceptedForWave: AcceptedItem[] = useMemo(
    () =>
      proposals
        .filter((p) => p.relation === 'new' || p.relation === 'contributes_to_goal')
        .map((p) => ({ title: p.candidate.title, goalKey: p.candidate.goalKey })),
    [proposals]
  );

  if (!isOpen) return null;

  // Charter view — accept of a NEW proposal opens charter-lite, prefilled + lineage.
  if (view === 'charter') {
    const charterSource: InitiativeCharterSource | undefined = source
      ? {
          label: source.label,
          title: chosen?.candidate.title,
          thesis: chosen?.candidate.description,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          evidenceRefs: source.evidenceRefs,
        }
      : chosen
        ? { title: chosen.candidate.title, thesis: chosen.candidate.description }
        : undefined;
    return (
      <InitiativeCharterWizard
        isOpen
        onClose={() => setView('board')}
        onCreated={(r) => {
          onCreated?.(r);
          onClose();
        }}
        projectId={projectId}
        source={charterSource}
        isPolish={isPolish}
      />
    );
  }

  // Board view — triage.
  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-slate-950/55 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex h-[560px] max-h-[calc(100vh-2rem)] w-[920px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-navy-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-white/[0.08]">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <span aria-hidden className="inline-block h-5 w-1.5 rounded-full bg-navy-900" />
            {tr('Zaproponuj inicjatywę', 'Propose initiative')}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/[0.1]">
              {(['proposals', 'coverage'] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setBoardTab(tabKey)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    boardTab === tabKey
                      ? 'bg-navy-900 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  {tabKey === 'proposals'
                    ? tr('Propozycje', 'Proposals')
                    : tr('Pokrycie i fale', 'Coverage & waves')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tr('Zamknij', 'Close')}
              className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06]"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {tr('Wczytuję siatkę inicjatyw…', 'Loading the initiative grid…')}
            </div>
          ) : boardTab === 'coverage' ? (
            <InitiativeCoverageWaveView
              coverage={coverage}
              accepted={acceptedForWave}
              isPolish={isPolish}
            />
          ) : (
            <InitiativeProposalBoard
              proposals={proposals}
              coverage={coverage}
              source={source ? { label: source.label, content: source.content } : undefined}
              isPolish={isPolish}
              onAcceptNew={(p) => {
                setChosen(p);
                setView('charter');
              }}
              onAcceptChange={(p) => {
                void submitSuggestedChange({
                  initiativeId: p.matchedInitiativeId ?? '',
                  kind: RELATION_TO_CHANGE_KIND(p.relation),
                  title: p.candidate.title,
                  rationale: p.rationale,
                  sourceType: source?.sourceType,
                  sourceId: source?.sourceId ?? undefined,
                }).then((res) =>
                  toast(
                    res.persisted
                      ? tr('Zapisano propozycję zmiany.', 'Suggested change saved.')
                      : tr(
                          'Zarejestrowano lokalnie (backend wkrótce).',
                          'Recorded locally (backend pending).'
                        )
                  )
                );
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default InitiativeGeneratorModal;
