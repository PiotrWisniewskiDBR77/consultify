import { Check, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { evaluateSwotAcceptGate, stampAcceptedSwotItem } from '@/config/swot/swotAcceptGate';
import {
  ProposalCardType,
  SWOTData,
  SWOTEvidenceType,
  SWOTItem,
  SWOTSignal,
  SWOTStrengthClassification,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { SwotMatrixVisual } from '../../shared/StrategicCanvasVisuals';
import { EvidenceEditor } from './EvidenceEditor';

type QuadrantId = SWOTItem['quadrant'];

type BuildPhaseProps = {
  session: ToolSession;
  isPolish: boolean;
  isGeneratingAI?: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
};

const QUADRANT_META: Record<
  QuadrantId,
  {
    title: { en: string; pl: string };
    subtitle: { en: string; pl: string };
    accent: string;
    surface: string;
  }
> = {
  strengths: {
    title: { en: 'Strengths', pl: 'Mocne strony' },
    subtitle: { en: 'Internal advantages', pl: 'Wewnętrzne przewagi' },
    accent: 'text-emerald-700 dark:text-emerald-300',
    surface:
      'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20',
  },
  weaknesses: {
    title: { en: 'Weaknesses', pl: 'Słabe strony' },
    subtitle: { en: 'Internal constraints', pl: 'Wewnętrzne ograniczenia' },
    accent: 'text-amber-700 dark:text-amber-300',
    surface: 'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20',
  },
  opportunities: {
    title: { en: 'Opportunities', pl: 'Szanse' },
    subtitle: { en: 'External upside', pl: 'Zewnętrzny upside' },
    accent: 'text-sky-700 dark:text-sky-300',
    surface: 'border-sky-200 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-950/20',
  },
  threats: {
    title: { en: 'Threats', pl: 'Zagrożenia' },
    subtitle: { en: 'External risk', pl: 'Zewnętrzne ryzyko' },
    accent: 'text-danger-700 dark:text-danger-300',
    surface: 'border-danger-200 bg-danger-50/80 dark:border-danger-900/40 dark:bg-danger-900/20',
  },
};

const ALL_QUADRANTS: QuadrantId[] = ['strengths', 'weaknesses', 'opportunities', 'threats'];

const normalizeKey = (quadrant: QuadrantId, text: string) =>
  `${quadrant}:${String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()}`;

const getSignalQuadrant = (signal: SWOTSignal): QuadrantId | null =>
  ALL_QUADRANTS.find((quadrant) => signal.tags?.includes(quadrant)) || null;

function QuadrantCard({
  quadrant,
  items,
  proposals,
  replaceTargetByProposalId,
  setReplaceTargetByProposalId,
  onAcceptProposal,
  onRejectProposal,
  acceptErrorByProposalId,
  isPolish,
}: {
  quadrant: QuadrantId;
  items: SWOTItem[];
  proposals: SWOTItem[];
  replaceTargetByProposalId: Record<string, string>;
  setReplaceTargetByProposalId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAcceptProposal: (proposalId: string) => void;
  onRejectProposal: (proposalId: string) => void;
  acceptErrorByProposalId: Record<string, string>;
  isPolish: boolean;
}) {
  const { t } = useTranslation();
  const { addSWOTItem, updateSWOTItem } = useToolStore();
  const [draft, setDraft] = useState('');
  const meta = QUADRANT_META[quadrant];

  // STREAM G1: a user directly typing a new item is also routed through the
  // canonical gate — it always passes structurally here (non-empty text,
  // valid quadrant, no classification yet), but now consistently stamps
  // `evidenceStatus: 'declared'` instead of leaving it undefined forever, so
  // the Output/Live Artifact never have to guess what an un-stamped item means.
  const addItem = () => {
    const candidate: Omit<SWOTItem, 'id'> = {
      text: draft.trim(),
      quadrant,
      impact: 'medium',
      source: 'user',
      confidence: 4,
    };
    const gate = evaluateSwotAcceptGate(candidate);
    if (!gate.ok) return;
    addSWOTItem(stampAcceptedSwotItem(candidate, gate));
    setDraft('');
  };

  return (
    <div className={`rounded-[26px] border p-4 ${meta.surface}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-semibold ${meta.accent}`}>
            {isPolish ? meta.title.pl : meta.title.en}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? meta.subtitle.pl : meta.subtitle.en}
          </div>
        </div>
        <div className="rounded-full border border-white/70 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
          {items.length}
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={t('discoveryToolsTools.dynamicSwot.buildPhase.addPointPlaceholder')}
          className="h-10 flex-1 rounded-lg border border-white/70 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-3 text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {proposals.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-white/60 pt-4 dark:border-white/10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            {t('discoveryToolsTools.dynamicSwot.buildPhase.aiProposals')}
          </div>
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="rounded-2xl border border-primary-200/70 bg-white/90 p-3 shadow-[0_8px_24px_-18px_rgba(76,29,149,0.35)] dark:border-primary-900/40 dark:bg-primary-950/20"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-500 dark:text-primary-300">
                  {t('discoveryToolsTools.dynamicSwot.buildPhase.aiProposal')}
                </div>
                <div className="rounded-full border border-primary-200/70 bg-primary-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300">
                  AI
                </div>
              </div>
              <div className="text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                {proposal.text}
              </div>
              <div className="mt-2">
                <select
                  value={replaceTargetByProposalId[proposal.id] || ''}
                  onChange={(e) =>
                    setReplaceTargetByProposalId((current) => ({
                      ...current,
                      [proposal.id]: e.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
                >
                  <option value="">
                    {t('discoveryToolsTools.dynamicSwot.buildPhase.acceptAsNewOrReplace')}
                  </option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.text}
                    </option>
                  ))}
                </select>
              </div>
              <EvidenceEditor
                item={proposal}
                isPolish={isPolish}
                onChange={(patch) => updateSWOTItem(proposal.id, patch)}
              />
              {acceptErrorByProposalId[proposal.id] ? (
                <div
                  role="alert"
                  className="mt-2 rounded-lg bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:bg-danger-900/20 dark:text-danger-300"
                >
                  {acceptErrorByProposalId[proposal.id]}
                </div>
              ) : null}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onAcceptProposal(proposal.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/50 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t('discoveryToolsTools.dynamicSwot.buildPhase.accept')}
                </button>
                <button
                  type="button"
                  onClick={() => onRejectProposal(proposal.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                  {t('discoveryToolsTools.dynamicSwot.buildPhase.reject')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SWOTBuildPhase({ session, isPolish, isGeneratingAI = false }: BuildPhaseProps) {
  const { t } = useTranslation();
  const { addSWOTItem, removeSWOTItem, updateSWOTItem } = useToolStore();
  const swotData = session.inputData as SWOTData;
  const signals = swotData.signals || [];
  const items = swotData.items || [];
  const importingSignalIdsRef = useRef(new Set<string>());
  const [replaceTargetByProposalId, setReplaceTargetByProposalId] = useState<
    Record<string, string>
  >({});
  // STREAM G1: inline, actionable rejection message from the canonical
  // accept gate (config/swot/swotAcceptGate.ts), keyed by proposal id.
  const [acceptErrorByProposalId, setAcceptErrorByProposalId] = useState<Record<string, string>>(
    {}
  );
  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantId>(
    () => items[0]?.quadrant || 'strengths'
  );

  const groupedItems = useMemo(
    () =>
      ALL_QUADRANTS.reduce<Record<QuadrantId, SWOTItem[]>>(
        (acc, quadrant) => {
          acc[quadrant] = items.filter(
            (item) =>
              item.quadrant === quadrant &&
              item.status !== 'proposed' &&
              item.proposalStatus !== 'ai-proposed' &&
              item.proposalStatus !== 'rethinking'
          );
          return acc;
        },
        {} as Record<QuadrantId, SWOTItem[]>
      ),
    [items]
  );

  const groupedProposals = useMemo(
    () =>
      ALL_QUADRANTS.reduce<Record<QuadrantId, SWOTItem[]>>(
        (acc, quadrant) => {
          acc[quadrant] = items.filter(
            (item) =>
              item.quadrant === quadrant &&
              (item.status === 'proposed' ||
                item.proposalStatus === 'ai-proposed' ||
                item.proposalStatus === 'rethinking')
          );
          return acc;
        },
        {} as Record<QuadrantId, SWOTItem[]>
      ),
    [items]
  );

  const groupedAcceptedSignals = useMemo(
    () =>
      ALL_QUADRANTS.reduce<Record<QuadrantId, SWOTSignal[]>>(
        (acc, quadrant) => {
          acc[quadrant] = signals.filter((signal) => {
            const signalQuadrant = getSignalQuadrant(signal);
            return (
              signalQuadrant === quadrant &&
              signal.tags?.includes('input-proposal') &&
              signal.state === 'accepted'
            );
          });
          return acc;
        },
        {} as Record<QuadrantId, SWOTSignal[]>
      ),
    [signals]
  );

  const existingItemKeys = useMemo(
    () => new Set(items.map((item) => normalizeKey(item.quadrant, item.text))),
    [items]
  );

  const importSignalsIntoMatrix = (signalsToImport: SWOTSignal[]) => {
    signalsToImport.forEach((signal) => {
      const quadrant = getSignalQuadrant(signal);
      if (!quadrant) return;
      const key = normalizeKey(quadrant, signal.sourceLabel);
      if (existingItemKeys.has(key)) return;

      addSWOTItem({
        text: signal.sourceLabel,
        quadrant,
        impact: 'medium',
        source: signal.type === 'ai' || signal.type === 'benchmark' ? 'ai' : 'user',
        confidence: signal.confidence || 4,
        status: 'accepted',
        proposalStatus: 'accepted',
        linkedSignalIds: [signal.id],
        userComment: signal.content,
      });
    });
  };

  useEffect(() => {
    const acceptedSignals = Object.values(groupedAcceptedSignals).flat();
    const storedSignalIds = new Set(items.flatMap((item) => item.linkedSignalIds || []));
    const signalsToImport = acceptedSignals.filter(
      (signal) => !storedSignalIds.has(signal.id) && !importingSignalIdsRef.current.has(signal.id)
    );
    if (signalsToImport.length === 0) return;

    // Zustand writes synchronously, but React StrictMode replays this effect
    // with the same pre-write render snapshot. Fence each stable signal id
    // before the first write so the replay cannot materialize it twice. A
    // genuinely new signal still has a new id and is imported exactly once.
    signalsToImport.forEach((signal) => importingSignalIdsRef.current.add(signal.id));
    importSignalsIntoMatrix(signalsToImport);
  }, [items, groupedAcceptedSignals]);

  // STREAM G1 (2026-08-13): previously this called `updateSWOTItem(...,
  // {status:'accepted', proposalStatus:'accepted'})` directly — bypassing the
  // store's evidence gate entirely. Whatever `evidenceStatus`/`classification`
  // an AI proposal carried (hooks/discovery/toolAi/dynamicSwot.ts's
  // `normalizeItemConclusionFields` copies these straight from the model's
  // JSON) sailed through to `accepted` completely unverified. Now routed
  // through the ONE canonical gate (config/swot/swotAcceptGate.ts) — the same
  // function `useToolStore.ts`'s `acceptCard` and the server's
  // `acceptSwotProposal` use — which ALWAYS recomputes evidenceStatus from
  // real linked evidence and blocks an externally-claimed classification
  // (core-competency/niche-strength) that carries none.
  const acceptProposal = (proposalId: string) => {
    const targetId = replaceTargetByProposalId[proposalId];
    const proposal = items.find((item) => item.id === proposalId);
    if (!proposal) return;

    if (targetId) {
      const target = items.find((item) => item.id === targetId);
      if (!target) return;
      const merged: SWOTItem = {
        ...target,
        text: proposal.text,
        impact: proposal.impact,
        confidence: proposal.confidence,
        source: proposal.source,
        userComment: proposal.userComment || target.userComment,
        linkedSignalIds: Array.from(
          new Set([...(target.linkedSignalIds || []), ...(proposal.linkedSignalIds || [])])
        ),
        // Carry the AI's conclusion-layer fields into the merge instead of
        // silently discarding them (the pre-fix code dropped classification/
        // staircase/decomposition/evidence entirely on merge).
        evidenceNote: proposal.evidenceNote || target.evidenceNote,
        evidenceType: proposal.evidenceType || target.evidenceType,
        evidenceSource: proposal.evidenceSource || target.evidenceSource,
        classification: proposal.classification || target.classification,
        staircase: proposal.staircase || target.staircase,
        decomposition: proposal.decomposition || target.decomposition,
        ladderAnswers: proposal.ladderAnswers || target.ladderAnswers,
      };
      const gate = evaluateSwotAcceptGate(merged);
      if (!gate.ok) {
        setAcceptErrorByProposalId((current) => ({
          ...current,
          [proposalId]: isPolish ? gate.message.pl : gate.message.en,
        }));
        return;
      }
      updateSWOTItem(target.id, stampAcceptedSwotItem(merged, gate));
      removeSWOTItem(proposal.id);
      setReplaceTargetByProposalId((current) => {
        const next = { ...current };
        delete next[proposalId];
        return next;
      });
      setAcceptErrorByProposalId((current) => {
        const next = { ...current };
        delete next[proposalId];
        return next;
      });
      return;
    }

    const gate = evaluateSwotAcceptGate(proposal);
    if (!gate.ok) {
      setAcceptErrorByProposalId((current) => ({
        ...current,
        [proposalId]: isPolish ? gate.message.pl : gate.message.en,
      }));
      return;
    }
    updateSWOTItem(proposal.id, stampAcceptedSwotItem(proposal, gate));
    setAcceptErrorByProposalId((current) => {
      const next = { ...current };
      delete next[proposalId];
      return next;
    });
  };

  const rejectProposal = (proposalId: string) => {
    removeSWOTItem(proposalId);
    setReplaceTargetByProposalId((current) => {
      const next = { ...current };
      delete next[proposalId];
      return next;
    });
    setAcceptErrorByProposalId((current) => {
      const next = { ...current };
      delete next[proposalId];
      return next;
    });
  };

  return (
    <div className="space-y-6 p-1">
      {isGeneratingAI ? (
        <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-sky-300/50 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {t('discoveryToolsTools.dynamicSwot.buildPhase.aiPreparing')}
        </div>
      ) : null}

      <div className="max-h-72 overflow-hidden rounded-2xl border border-navy-700/70 bg-navy-950/50 p-3">
        <SwotMatrixVisual data={swotData} isPolish={isPolish} />
      </div>

      <nav
        role="tablist"
        aria-label={isPolish ? 'Kategorie macierzy SWOT' : 'SWOT matrix categories'}
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
      >
        {ALL_QUADRANTS.map((quadrant) => (
          <button
            key={quadrant}
            type="button"
            onClick={() => setActiveQuadrant(quadrant)}
            role="tab"
            aria-selected={activeQuadrant === quadrant}
            aria-controls={`swot-build-panel-${quadrant}`}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${activeQuadrant === quadrant ? 'border-c-focus bg-c-focus/10 text-c-text' : 'border-c-border text-c-text-secondary'}`}
          >
            {isPolish ? QUADRANT_META[quadrant].title.pl : QUADRANT_META[quadrant].title.en} (
            {groupedItems[quadrant].length})
          </button>
        ))}
      </nav>

      <div id={`swot-build-panel-${activeQuadrant}`} role="tabpanel" className="grid gap-4">
        {ALL_QUADRANTS.filter((quadrant) => quadrant === activeQuadrant).map((quadrant) => (
          <QuadrantCard
            key={quadrant}
            quadrant={quadrant}
            items={groupedItems[quadrant]}
            proposals={groupedProposals[quadrant]}
            replaceTargetByProposalId={replaceTargetByProposalId}
            setReplaceTargetByProposalId={setReplaceTargetByProposalId}
            onAcceptProposal={acceptProposal}
            onRejectProposal={rejectProposal}
            acceptErrorByProposalId={acceptErrorByProposalId}
            isPolish={isPolish}
          />
        ))}
      </div>
    </div>
  );
}

export default SWOTBuildPhase;
