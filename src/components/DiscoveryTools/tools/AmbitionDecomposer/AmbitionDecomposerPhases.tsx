/**
 * AmbitionDecomposerPhases - the four canvas phases for the Ambition Decomposer tool.
 *
 * Faithful analog of CapabilityMapperPhases:
 *  - AmbitionDecomposerInputPhase    -> capture / curate signals
 *  - AmbitionDecomposerBuildPhase    -> decompose the ambition into a dynamic
 *                                       list of themes (target metric/value,
 *                                       horizon, importance, drivers)
 *  - AmbitionDecomposerInsightsPhase -> priorities + recommended moves
 *  - AmbitionDecomposerOutputsPhase  -> final summary, output candidates,
 *                                       initiative drafts
 *
 * Like Capability Mapper, `themes` is a DYNAMIC ARRAY. The Build phase
 * therefore renders data.themes.map(...) as a list of ThemeCards with an
 * "add theme" affordance.
 *
 * Prop signatures match the Capability Mapper phases 1:1 so they slot into
 * ToolCanvas identically.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  AmbitionDecomposerData,
  AmbitionTheme,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { CreateInitiativeFromMoveButton } from '../../shared/createInitiativeFromMove';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { AmbitionDecompositionVisual } from '../../shared/StrategicCanvasVisuals';
import { ThemeCard } from './ThemeCard';

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

const horizonBadge = (horizon: AmbitionTheme['horizon'] | undefined, isPolish: boolean) => {
  switch (horizon) {
    case 'medium':
      return isPolish ? 'Średni' : 'Medium';
    case 'long':
      return isPolish ? 'Długi' : 'Long';
    case 'short':
    default:
      return isPolish ? 'Krótki' : 'Short';
  }
};

// ==================== INPUT PHASE ====================

export function AmbitionDecomposerInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as AmbitionDecomposerData;
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
    } as Partial<AmbitionDecomposerData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<AmbitionDecomposerData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Sygnały i dowody ambicji' : 'Ambition Signals & Evidence'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zbierz fakty o celu, zakresie i sygnałach sukcesu zanim AI rozłoży ambicję na tematy.'
            : 'Capture facts about the goal, scope, and success signals before AI decomposes the ambition into themes.'}
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
          placeholder={isPolish ? 'Dodaj sygnał...' : 'Add an ambition signal...'}
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

export function AmbitionDecomposerBuildPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as AmbitionDecomposerData;
  const themes = data.themes || [];

  const addTheme = () => {
    updateInputData({
      themes: [
        ...themes,
        {
          id: `theme-${Date.now()}`,
          title: '',
          description: '',
          targetMetric: '',
          targetValue: '',
          horizon: 'medium',
          importance: 'medium',
          drivers: [],
          evidence: [],
          implication: '',
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<AmbitionDecomposerData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isPolish ? 'Dekompozycja ambicji' : 'Ambition Decomposition'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Każdy temat powinien mieć miarę i wartość docelową, horyzont, znaczenie, drivery i implikację.'
              : 'Each theme should have a target metric and value, time horizon, importance, drivers, and an implication.'}
          </p>
        </div>
        <button
          type="button"
          onClick={addTheme}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plus className="h-4 w-4" />
          {isPolish ? 'Dodaj temat' : 'Add theme'}
        </button>
      </div>

      {/* Signature visual: ambition → themes cascade */}
      <AmbitionDecompositionVisual
        themes={themes}
        ambitionStatement={data.context?.ambitionStatement}
        isPolish={isPolish}
      />

      {themes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-navy-700 dark:bg-navy-900/40">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish
              ? 'Brak tematów. Dodaj pierwszy lub poczekaj na propozycje AI.'
              : 'No themes yet. Add the first one or wait for AI proposals.'}
          </p>
          <button
            type="button"
            onClick={addTheme}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" />
            {isPolish ? 'Dodaj temat' : 'Add theme'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              themeId={theme.id}
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

export function AmbitionDecomposerInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as AmbitionDecomposerData;
  const acceptedThemes = useMemo(
    () => (data.themes || []).filter((t) => t.proposalStatus !== 'rejected'),
    [data.themes]
  );

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Priorytety i ruchy' : 'Priorities & Moves'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Tu dekompozycja ambicji zamienia się w priorytety i rekomendowane ruchy strategiczne.'
            : 'This is where the ambition decomposition turns into prioritized priorities and recommended strategic moves.'}
        </p>
      </div>

      {/* Accepted themes snapshot */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
          {isPolish ? 'Zaakceptowane tematy' : 'Accepted themes'}
        </div>
        {acceptedThemes.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak zaakceptowanych tematów.' : 'No accepted themes.'}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
            {acceptedThemes.map((theme) => (
              <div key={theme.id} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
                <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {theme.title || (isPolish ? 'Bez nazwy' : 'Untitled')}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {theme.targetValue || '—'} · {horizonBadge(theme.horizon, isPolish)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Priorities (tension) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data.priorities || []).map((priority) => (
          <div
            key={priority.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                  {proposalBadge(priority.proposalStatus, isPolish)} · {priority.priority}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {priority.title}
                </h3>
              </div>
              {priority.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="tension"
                  cardId={priority.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {priority.insight}
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-navy-900/60 dark:text-slate-300">
              {priority.recommendation}
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

export function AmbitionDecomposerOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as AmbitionDecomposerData;
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
                cardId={summary.proposalId || 'ambition-decomposer-summary'}
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
