/**
 * NarrativeEnginePhases - the four canvas phases for the Narrative Engine tool.
 *
 * Faithful analog of CapabilityMapperPhases:
 *  - NarrativeEngineInputPhase    -> capture / curate signals
 *  - NarrativeEngineBuildPhase    -> shape the dynamic list of narrative pillars
 *                                    (message + proof + audience resonance)
 *  - NarrativeEngineInsightsPhase -> narrative threads (tensions) + recommended moves
 *  - NarrativeEngineOutputsPhase  -> final summary, output candidates, initiative drafts
 *
 * Like Capability Mapper, `pillars` is a DYNAMIC ARRAY (not a fixed Record).
 * The Build phase therefore renders data.pillars.map(...) as a list of
 * PillarCards with an "add pillar" affordance.
 *
 * Prop signatures match the CapabilityMapper phases 1:1 so they slot into
 * ToolCanvas identically.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  NarrativeEngineData,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { CreateInitiativeFromMoveButton } from '../../shared/createInitiativeFromMove';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { NarrativeArcVisual } from '../../shared/StrategicCanvasVisuals';
import { PillarCard } from './PillarCard';

type PhaseProps = {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
};

const proposalBadge = (proposalStatus?: string, isPolish?: boolean) => {
  if (proposalStatus === 'ai-proposed') return isPolish ? 'Propozycja AI' : 'AI proposal';
  if (proposalStatus === 'rejected') return isPolish ? 'Odrzucone' : 'Rejected';
  if (proposalStatus === 'rethinking') return isPolish ? 'Przemyślenie' : 'Rethinking';
  return isPolish ? 'Zaakceptowane' : 'Accepted';
};

const resonanceBadge = (
  resonance: 'high' | 'medium' | 'low' | undefined,
  isPolish: boolean
) => {
  switch (resonance) {
    case 'high':
      return isPolish ? 'Wysoki' : 'High';
    case 'low':
      return isPolish ? 'Niski' : 'Low';
    case 'medium':
    default:
      return isPolish ? 'Średni' : 'Medium';
  }
};

// ==================== INPUT PHASE ====================

export function NarrativeEngineInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as NarrativeEngineData;
  const [draft, setDraft] = useState('');

  const addSignal = () => {
    if (!draft.trim()) return;
    updateInputData({
      signals: [
        ...(data.signals || []),
        {
          id: `signal-${Date.now()}`,
          type: 'interview',
          content: draft.trim(),
          sourceLabel: isPolish ? 'Wpis użytkownika' : 'User input',
          confidence: 4,
          tags: [],
          evidenceType: 'observation',
          state: 'accepted',
          provenance: isPolish ? 'Wpis ręczny' : 'Manual entry',
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<NarrativeEngineData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<NarrativeEngineData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Sygnały i dowody narracji' : 'Narrative Signals & Evidence'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zbierz fakty, cytaty i dane o odbiorcy zanim AI zbuduje filary narracji.'
            : 'Capture facts, quotes, and audience insights before building the narrative pillars.'}
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addSignal();
            }
          }}
          placeholder={isPolish ? 'Dodaj sygnał...' : 'Add a narrative signal...'}
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"
        />
        <button
          type="button"
          onClick={addSignal}
          disabled={!draft.trim()}
          className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-3 text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(data.signals || []).map((signal) => (
          <div
            key={signal.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-navy-800 dark:text-slate-300">
                {proposalBadge(signal.proposalStatus, isPolish)}
              </span>
              {signal.proposalStatus === 'ai-proposed' ? (
                <CardActions
                  cardType="signal"
                  cardId={signal.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => removeSignal(signal.id)}
                  className="rounded-lg p-1.5 text-slate-600 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm font-medium leading-relaxed text-slate-900 dark:text-slate-100">
              {signal.content}
            </p>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              {signal.sourceLabel} · {signal.evidenceType || 'observation'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== BUILD PHASE ====================

export function NarrativeEngineBuildPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as NarrativeEngineData;
  const pillars = data.pillars || [];

  const addPillar = () => {
    updateInputData({
      pillars: [
        ...pillars,
        {
          id: `pillar-${Date.now()}`,
          title: '',
          message: '',
          proofPoints: [],
          audienceResonance: 'medium',
          drivers: [],
          evidence: [],
          implication: '',
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<NarrativeEngineData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isPolish ? 'Filary narracji' : 'Narrative Pillars'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Każdy filar powinien mieć przekaz, dowody, poziom rezonansu z odbiorcą, czynniki i implikację.'
              : 'Each pillar should have a message, proof points, audience resonance, drivers, and an implication.'}
          </p>
        </div>
        <button
          type="button"
          onClick={addPillar}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus className="h-4 w-4" />
          {isPolish ? 'Dodaj filar' : 'Add pillar'}
        </button>
      </div>

      {/* Signature visual: message house (core message + pillars) */}
      <NarrativeArcVisual
        pillars={pillars}
        coreMessage={data.context?.coreMessage}
        isPolish={isPolish}
      />

      {pillars.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-navy-700 dark:bg-navy-900/40">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Brak filarów. Dodaj pierwszy lub poczekaj na propozycje AI.'
              : 'No pillars yet. Add the first one or wait for AI proposals.'}
          </p>
          <button
            type="button"
            onClick={addPillar}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" />
            {isPolish ? 'Dodaj filar' : 'Add pillar'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pillars.map((pillar) => (
            <PillarCard
              key={pillar.id}
              pillarId={pillar.id}
              session={session}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== INSIGHTS PHASE ====================

export function NarrativeEngineInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as NarrativeEngineData;
  const acceptedPillars = useMemo(
    () => (data.pillars || []).filter((p) => p.proposalStatus !== 'rejected'),
    [data.pillars]
  );

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Wątki narracji i ruchy' : 'Narrative Threads & Moves'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Tu filary narracji zamieniają się w wątki (napięcia) i ruchy retoryczne (otwarcie/dowód/CTA).'
            : 'This is where the pillars turn into threads (tensions) and rhetorical moves (open/prove/CTA).'}
        </p>
      </div>

      {/* Accepted pillars snapshot */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
          {isPolish ? 'Zaakceptowane filary' : 'Accepted pillars'}
        </div>
        {acceptedPillars.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak zaakceptowanych filarów.' : 'No accepted pillars.'}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            {acceptedPillars.map((pillar) => (
              <div key={pillar.id} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
                <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {pillar.title || (isPolish ? 'Bez nazwy' : 'Untitled')}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {(pillar.proofPoints || []).length} ·{' '}
                  {resonanceBadge(pillar.audienceResonance, isPolish)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Threads (tension) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data.threads || []).map((thread) => (
          <div
            key={thread.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                  {proposalBadge(thread.proposalStatus, isPolish)} · {thread.priority}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {thread.title}
                </h3>
              </div>
              {thread.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="tension"
                  cardId={thread.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {thread.insight}
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-navy-900/60 dark:text-slate-300">
              {thread.recommendation}
            </div>
          </div>
        ))}
      </div>

      {/* Recommended moves */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data.recommendedMoves || []).map((move) => (
          <div
            key={move.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                  {move.category}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {move.title}
                </h3>
              </div>
              {move.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="move"
                  cardId={move.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {move.rationale}
            </p>
            {move.firstStep && (
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {isPolish ? 'Pierwszy krok: ' : 'First step: '}
                {move.firstStep}
              </div>
            )}
            <div className="flex justify-end">
              <CreateInitiativeFromMoveButton session={session} move={move} isPolish={isPolish} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== OUTPUTS PHASE ====================

export function NarrativeEngineOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as NarrativeEngineData;
  const summary = data.summary;
  const initiatives = [
    ...(summary?.recommendedInitiatives || []),
    ...(session.generatedInitiatives || []),
  ];

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Outputy i inicjatywy' : 'Outputs & Initiatives'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Final source summary i kandydaci outputów powstają z zatwierdzonej narracji.'
            : 'The final source summary and output candidates are based on the approved narrative.'}
        </p>
      </div>

      {summary?.executiveSummary && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {isPolish ? 'Final source summary' : 'Final source summary'}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {summary.executiveSummary}
              </p>
            </div>
            {summary.proposalStatus === 'ai-proposed' && (
              <CardActions
                cardType="conclusion"
                cardId={summary.proposalId || 'narrative-engine-summary'}
                isPolish={isPolish}
                onAcceptCard={onAcceptCard}
                onRejectCard={onRejectCard}
                onRethinkCard={onRethinkCard}
              />
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(data.outputCandidates || []).map((candidate) => (
          <div
            key={candidate.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-sky-500">
                  {candidate.outputType} · {candidate.readiness || 'keep-as-idea'}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {candidate.title}
                </h3>
              </div>
              {candidate.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="output-candidate"
                  cardId={candidate.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {candidate.description}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
          {isPolish ? 'Drafty inicjatyw' : 'Initiative drafts'}
        </div>
        {initiatives.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak inicjatyw.' : 'No initiatives yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {initiatives.map((initiative) => (
              <div
                key={initiative.id || initiative.title}
                className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60"
              >
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {initiative.title}
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {initiative.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
