/**
 * FocusTradeoffPhases - the four canvas phases for the Focus & Trade-offs tool.
 *
 * Faithful analog of CapabilityMapperPhases:
 *  - FocusTradeoffInputPhase    -> capture / curate signals
 *  - FocusTradeoffBuildPhase    -> score the dynamic list of competing priorities
 *                                  (value, effort, strategic fit, recommendation)
 *  - FocusTradeoffInsightsPhase -> trade-offs (tensions) + recommended moves
 *  - FocusTradeoffOutputsPhase  -> final summary, output candidates, initiative drafts
 *
 * Like Capability Mapper, `priorities` is a DYNAMIC ARRAY (not a fixed Record).
 * The Build phase renders data.priorities.map(...) as a list of PriorityCards
 * with an "add priority" affordance.
 *
 * Prop signatures match the Capability Mapper phases 1:1 so they slot into
 * ToolCanvas identically.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  FocusPriority,
  FocusTradeoffData,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { FocusTradeoffVisual } from '../../shared/StrategicCanvasVisuals';
import { PriorityCard } from './PriorityCard';

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

const recommendationBadge = (
  recommendation: FocusPriority['recommendation'] | undefined,
  isPolish: boolean
) => {
  switch (recommendation) {
    case 'defer':
      return isPolish ? 'Odłóż' : 'Defer';
    case 'drop':
      return isPolish ? 'Porzuć' : 'Drop';
    case 'pursue':
    default:
      return isPolish ? 'Realizuj' : 'Pursue';
  }
};

// ==================== INPUT PHASE ====================

export function FocusTradeoffInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as FocusTradeoffData;
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
    } as Partial<FocusTradeoffData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<FocusTradeoffData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Sygnały i dowody priorytetów' : 'Priority Signals & Evidence'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zbierz fakty o konkurujących priorytetach i kryteriach decyzji zanim AI je oceni.'
            : 'Capture facts about competing priorities and decision criteria before AI scores them.'}
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
          placeholder={isPolish ? 'Dodaj sygnał...' : 'Add a priority signal...'}
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

export function FocusTradeoffBuildPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as FocusTradeoffData;
  const priorities = data.priorities || [];

  const addPriority = () => {
    updateInputData({
      priorities: [
        ...priorities,
        {
          id: `priority-${Date.now()}`,
          title: '',
          description: '',
          valueScore: 3,
          effortScore: 3,
          strategicFit: 3,
          recommendation: 'pursue',
          drivers: [],
          evidence: [],
          implication: '',
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<FocusTradeoffData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isPolish ? 'Priorytety i scoring' : 'Priorities & Scoring'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Każdy priorytet powinien mieć ocenę wartości, wysiłku i dopasowania, rekomendację, drivery i implikację.'
              : 'Each priority should have value, effort, and fit scores, a recommendation, drivers, and an implication.'}
          </p>
        </div>
        <button
          type="button"
          onClick={addPriority}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus className="h-4 w-4" />
          {isPolish ? 'Dodaj priorytet' : 'Add priority'}
        </button>
      </div>

      {/* Signature visual: value × effort prioritization matrix */}
      <FocusTradeoffVisual priorities={priorities} isPolish={isPolish} />

      {priorities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-navy-700 dark:bg-navy-900/40">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Brak priorytetów. Dodaj pierwszy lub poczekaj na propozycje AI.'
              : 'No priorities yet. Add the first one or wait for AI proposals.'}
          </p>
          <button
            type="button"
            onClick={addPriority}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" />
            {isPolish ? 'Dodaj priorytet' : 'Add priority'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {priorities.map((priority) => (
            <PriorityCard
              key={priority.id}
              priorityId={priority.id}
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

export function FocusTradeoffInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as FocusTradeoffData;
  const acceptedPriorities = useMemo(
    () => (data.priorities || []).filter((p) => p.proposalStatus !== 'rejected'),
    [data.priorities]
  );

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Trade-offy i ruchy' : 'Trade-offs & Moves'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Tu scoring priorytetów zamienia się w napięcia decyzyjne i ruchy fokusu (commit/sequence/cut).'
            : 'This is where priority scoring turns into decision tensions and focus moves (commit/sequence/cut).'}
        </p>
      </div>

      {/* Accepted priorities snapshot */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
          {isPolish ? 'Zaakceptowane priorytety' : 'Accepted priorities'}
        </div>
        {acceptedPriorities.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak zaakceptowanych priorytetów.' : 'No accepted priorities.'}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            {acceptedPriorities.map((priority) => (
              <div key={priority.id} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
                <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {priority.title || (isPolish ? 'Bez nazwy' : 'Untitled')}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  V{priority.valueScore} · E{priority.effortScore} · F{priority.strategicFit} ·{' '}
                  {recommendationBadge(priority.recommendation, isPolish)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade-offs (tension) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data.tradeoffs || []).map((tradeoff) => (
          <div
            key={tradeoff.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                  {proposalBadge(tradeoff.proposalStatus, isPolish)} · {tradeoff.priority}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {tradeoff.title}
                </h3>
              </div>
              {tradeoff.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="tension"
                  cardId={tradeoff.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {tradeoff.insight}
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-navy-900/60 dark:text-slate-300">
              {tradeoff.recommendation}
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
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== OUTPUTS PHASE ====================

export function FocusTradeoffOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as FocusTradeoffData;
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
            ? 'Final source summary i kandydaci outputów powstają z zatwierdzonej diagnozy.'
            : 'The final source summary and output candidates are based on the approved diagnosis.'}
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
                cardId={summary.proposalId || 'focus-tradeoff-summary'}
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
