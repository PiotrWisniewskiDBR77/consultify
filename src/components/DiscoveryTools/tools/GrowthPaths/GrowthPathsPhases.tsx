import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  GrowthPathsData,
  GrowthQuadrantId,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { CreateInitiativeFromMoveButton } from '../../shared/createInitiativeFromMove';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { AnsoffMatrixVisual } from '../../shared/StrategicCanvasVisuals';

type PhaseProps = {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
};

const QUADRANTS: GrowthQuadrantId[] = [
  'marketPenetration',
  'marketDevelopment',
  'productDevelopment',
  'diversification',
];

const QUADRANT_META: Record<GrowthQuadrantId, { en: string; pl: string; hint: string }> = {
  marketPenetration: {
    en: 'Market Penetration',
    pl: 'Penetracja rynku',
    hint: 'Current products in current markets',
  },
  marketDevelopment: {
    en: 'Market Development',
    pl: 'Rozwój rynku',
    hint: 'Current products in new markets',
  },
  productDevelopment: {
    en: 'Product Development',
    pl: 'Rozwój produktu',
    hint: 'New products for current markets',
  },
  diversification: {
    en: 'Diversification',
    pl: 'Dywersyfikacja',
    hint: 'New products in new markets',
  },
};

const proposalBadge = (proposalStatus?: string, isPolish?: boolean) => {
  if (proposalStatus === 'ai-proposed') return isPolish ? 'Propozycja AI' : 'AI proposal';
  if (proposalStatus === 'rejected') return isPolish ? 'Odrzucone' : 'Rejected';
  if (proposalStatus === 'rethinking') return isPolish ? 'Przemyślenie' : 'Rethinking';
  return isPolish ? 'Zaakceptowane' : 'Accepted';
};

export function GrowthPathsInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as GrowthPathsData;
  const [draft, setDraft] = useState('');

  const addSignal = () => {
    if (!draft.trim()) return;
    updateInputData({
      signals: [
        ...(data.signals || []),
        {
          id: `growth-signal-${Date.now()}`,
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
    } as Partial<GrowthPathsData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<GrowthPathsData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Sygnały wzrostu i evidence' : 'Growth Signals & Evidence'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zbierz obserwacje z wywiadu, rynku i organizacji zanim AI zaproponuje opcje Ansoffa.'
            : 'Capture interview, market, and organization signals before AI proposes Ansoff options.'}
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
          placeholder={isPolish ? 'Dodaj sygnał wzrostu...' : 'Add a growth signal...'}
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
            <div className="mb-2 flex items-start justify-between gap-3">
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

export function GrowthPathsOptionsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as GrowthPathsData;

  const updateOption = (
    quadrant: GrowthQuadrantId,
    optionId: string,
    updates: Partial<GrowthPathsData['quadrants'][GrowthQuadrantId][number]>
  ) => {
    updateInputData({
      quadrants: {
        ...data.quadrants,
        [quadrant]: data.quadrants[quadrant].map((option) =>
          option.id === optionId ? { ...option, ...updates } : option
        ),
      },
    } as Partial<GrowthPathsData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Macierz opcji wzrostu Ansoffa' : 'Ansoff Growth Option Matrix'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Każda karta powinna mieć hipotezę wzrostu, uzasadnienie, ryzyko i pierwszy krok.'
            : 'Each card should carry a growth hypothesis, rationale, risk, and first step.'}
        </p>
      </div>

      <AnsoffMatrixVisual data={data} isPolish={isPolish} />

      <div className="grid gap-4 xl:grid-cols-2">
        {QUADRANTS.map((quadrant) => (
          <div
            key={quadrant}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? QUADRANT_META[quadrant].pl : QUADRANT_META[quadrant].en}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {QUADRANT_META[quadrant].hint}
              </p>
            </div>

            <div className="space-y-3">
              {(data.quadrants[quadrant] || []).map((option) => (
                <div key={option.id} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                        {proposalBadge(option.proposalStatus, isPolish)}
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {option.title}
                      </h4>
                    </div>
                    {option.proposalStatus === 'ai-proposed' && (
                      <CardActions
                        cardType="item"
                        cardId={option.id}
                        isPolish={isPolish}
                        onAcceptCard={onAcceptCard}
                        onRejectCard={onRejectCard}
                        onRethinkCard={onRethinkCard}
                      />
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {option.description}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(['impact', 'effort', 'riskLevel'] as const).map((field) => (
                      <label key={field} className="text-xs font-medium text-slate-500">
                        {field === 'riskLevel'
                          ? isPolish
                            ? 'Ryzyko'
                            : 'Risk'
                          : field === 'impact'
                            ? isPolish
                              ? 'Wpływ'
                              : 'Impact'
                            : isPolish
                              ? 'Wysiłek'
                              : 'Effort'}
                        <select
                          value={option[field] || 'medium'}
                          onChange={(event) =>
                            updateOption(quadrant, option.id, {
                              [field]: event.target.value,
                            } as Partial<typeof option>)
                          }
                          className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"
                        >
                          <option value="high">{isPolish ? 'Wysoki' : 'High'}</option>
                          <option value="medium">{isPolish ? 'Średni' : 'Medium'}</option>
                          <option value="low">{isPolish ? 'Niski' : 'Low'}</option>
                        </select>
                      </label>
                    ))}
                  </div>
                  {option.firstStep && (
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Pierwszy krok: ' : 'First step: '}
                      {option.firstStep}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GrowthPathsInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as GrowthPathsData;

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Porównanie strategiczne' : 'Strategic Comparison'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Tu opcje wzrostu zamieniają się w trade-offy, priorytety i rekomendowane ruchy.'
            : 'This is where growth options become trade-offs, priorities, and recommended moves.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(data.comparisons || []).map((comparison) => (
          <div
            key={comparison.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                  {proposalBadge(comparison.proposalStatus, isPolish)}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {comparison.title}
                </h3>
              </div>
              {comparison.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="tension"
                  cardId={comparison.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {comparison.insight}
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-navy-900/60 dark:text-slate-300">
              {comparison.recommendation}
            </div>
          </div>
        ))}
      </div>

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

export function GrowthPathsOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as GrowthPathsData;
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
            ? 'Final source summary i kandydaci outputów powstają z zaakceptowanych opcji wzrostu.'
            : 'The final source summary and output candidates are based on approved growth options.'}
        </p>
      </div>

      {summary?.executiveSummary && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Final source summary
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {summary.executiveSummary}
              </p>
            </div>
            {summary.proposalStatus === 'ai-proposed' && (
              <CardActions
                cardType="conclusion"
                cardId={summary.proposalId || 'growth-summary'}
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
