import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import {
  ProposalCardType,
  RiskAssumption,
  RiskItem,
  RiskUncertaintyData,
  ScenarioItem,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { CreateInitiativeFromMoveButton } from '../../shared/createInitiativeFromMove';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { RiskMatrixVisual } from '../../shared/StrategicCanvasVisuals';

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

export function RiskInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as RiskUncertaintyData;
  const [draft, setDraft] = useState('');

  const addSignal = () => {
    if (!draft.trim()) return;
    updateInputData({
      signals: [
        ...(data.signals || []),
        {
          id: `risk-signal-${Date.now()}`,
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
    } as Partial<RiskUncertaintyData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<RiskUncertaintyData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Sygnały ryzyka i niepewności' : 'Risk & Uncertainty Signals'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zbierz sygnały z wywiadu, rynku, danych i organizacji zanim AI zbuduje mapę ryzyka.'
            : 'Capture interview, market, data, and organization signals before AI builds the risk map.'}
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
          placeholder={isPolish ? 'Dodaj sygnał ryzyka...' : 'Add a risk signal...'}
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

export function RiskMapPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { updateInputData } = useToolStore();
  const data = session.inputData as RiskUncertaintyData;
  const [assumption, setAssumption] = useState('');
  const [risk, setRisk] = useState('');
  const [scenario, setScenario] = useState('');

  const addAssumption = () => {
    if (!assumption.trim()) return;
    updateInputData({
      assumptions: [
        ...(data.assumptions || []),
        {
          id: `risk-assumption-${Date.now()}`,
          text: assumption.trim(),
          confidence: 3,
          evidence: [],
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<RiskUncertaintyData>);
    setAssumption('');
  };

  const addRisk = () => {
    if (!risk.trim()) return;
    updateInputData({
      risks: [
        ...(data.risks || []),
        {
          id: `risk-item-${Date.now()}`,
          description: risk.trim(),
          probability: 3,
          impact: 3,
          mitigation: '',
          evidence: [],
          confidence: 3,
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<RiskUncertaintyData>);
    setRisk('');
  };

  const addScenario = () => {
    if (!scenario.trim()) return;
    updateInputData({
      scenarios: [
        ...(data.scenarios || []),
        {
          id: `risk-scenario-${Date.now()}`,
          title: scenario.trim(),
          likelihood: 3,
          notes: '',
          posture: 'base',
          signalsToWatch: [],
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<RiskUncertaintyData>);
    setScenario('');
  };

  const removeFrom = (key: 'assumptions' | 'risks' | 'scenarios', id: string) => {
    updateInputData({
      [key]: (data[key] || []).filter((item) => item.id !== id),
    } as Partial<RiskUncertaintyData>);
  };

  const updateAssumption = (id: string, updates: Partial<RiskAssumption>) => {
    updateInputData({
      assumptions: data.assumptions.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    } as Partial<RiskUncertaintyData>);
  };

  const updateRisk = (id: string, updates: Partial<RiskItem>) => {
    updateInputData({
      risks: data.risks.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    } as Partial<RiskUncertaintyData>);
  };

  const updateScenario = (id: string, updates: Partial<ScenarioItem>) => {
    updateInputData({
      scenarios: data.scenarios.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    } as Partial<RiskUncertaintyData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Mapa założeń, ryzyk i scenariuszy' : 'Assumption, Risk & Scenario Map'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Karty AI są propozycjami. Akceptowane elementy przechodzą dalej do syntezy.'
            : 'AI cards are proposals. Accepted elements feed the synthesis.'}
        </p>
      </div>

      <RiskMatrixVisual data={data} isPolish={isPolish} />

      <div className="grid gap-4 xl:grid-cols-3">
        <RiskColumn
          title={isPolish ? 'Założenia' : 'Assumptions'}
          value={assumption}
          setValue={setAssumption}
          onAdd={addAssumption}
          placeholder={isPolish ? 'Dodaj założenie...' : 'Add assumption...'}
        >
          {(data.assumptions || []).map((item) => (
            <RiskCard
              key={item.id}
              title={item.text}
              badge={`${proposalBadge(item.proposalStatus, isPolish)} · C${item.confidence}/5`}
              isAi={item.proposalStatus === 'ai-proposed'}
              onRemove={() => removeFrom('assumptions', item.id)}
              cardId={item.id}
              cardType="item"
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            >
              <select
                value={item.confidence}
                onChange={(event) =>
                  updateAssumption(item.id, { confidence: Number(event.target.value) })
                }
                className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"
              >
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {isPolish ? 'Pewność' : 'Confidence'} {score}/5
                  </option>
                ))}
              </select>
            </RiskCard>
          ))}
        </RiskColumn>

        <RiskColumn
          title={isPolish ? 'Ryzyka' : 'Risks'}
          value={risk}
          setValue={setRisk}
          onAdd={addRisk}
          placeholder={isPolish ? 'Dodaj ryzyko...' : 'Add risk...'}
        >
          {(data.risks || []).map((item) => (
            <RiskCard
              key={item.id}
              title={item.title || item.description}
              text={item.description}
              badge={`${proposalBadge(item.proposalStatus, isPolish)} · P${item.probability}/I${item.impact}`}
              isAi={item.proposalStatus === 'ai-proposed'}
              onRemove={() => removeFrom('risks', item.id)}
              cardId={item.id}
              cardType="item"
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            >
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['probability', 'impact'] as const).map((field) => (
                  <select
                    key={field}
                    value={item[field]}
                    onChange={(event) =>
                      updateRisk(item.id, { [field]: Number(event.target.value) })
                    }
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"
                  >
                    {[1, 2, 3, 4, 5].map((score) => (
                      <option key={score} value={score}>
                        {field === 'probability' ? 'P' : 'I'}
                        {score}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </RiskCard>
          ))}
        </RiskColumn>

        <RiskColumn
          title={isPolish ? 'Scenariusze' : 'Scenarios'}
          value={scenario}
          setValue={setScenario}
          onAdd={addScenario}
          placeholder={isPolish ? 'Dodaj scenariusz...' : 'Add scenario...'}
        >
          {(data.scenarios || []).map((item) => (
            <RiskCard
              key={item.id}
              title={item.title}
              text={item.notes}
              badge={`${proposalBadge(item.proposalStatus, isPolish)} · ${item.posture || 'base'}`}
              isAi={item.proposalStatus === 'ai-proposed'}
              onRemove={() => removeFrom('scenarios', item.id)}
              cardId={item.id}
              cardType="item"
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            >
              <select
                value={item.likelihood}
                onChange={(event) =>
                  updateScenario(item.id, { likelihood: Number(event.target.value) })
                }
                className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"
              >
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {isPolish ? 'Prawdopodobieństwo' : 'Likelihood'} {score}/5
                  </option>
                ))}
              </select>
            </RiskCard>
          ))}
        </RiskColumn>
      </div>
    </div>
  );
}

function RiskColumn({
  title,
  value,
  setValue,
  onAdd,
  placeholder,
  children,
}: {
  title: string;
  value: string;
  setValue: (value: string) => void;
  onAdd: () => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!value.trim()}
          className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-2 text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function RiskCard({
  title,
  text,
  badge,
  isAi,
  onRemove,
  cardType,
  cardId,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
  children,
}: {
  title: string;
  text?: string;
  badge: string;
  isAi: boolean;
  onRemove: () => void;
  cardType: ProposalCardType;
  cardId: string;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-amber-500">
            {badge}
          </div>
          <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
        </div>
        {isAi ? (
          <CardActions
            cardType={cardType}
            cardId={cardId}
            isPolish={isPolish}
            onAcceptCard={onAcceptCard}
            onRejectCard={onRejectCard}
            onRethinkCard={onRethinkCard}
          />
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {text && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>}
      {children}
    </div>
  );
}

export function RiskInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as RiskUncertaintyData;

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Synteza ryzyka i rekomendowane ruchy' : 'Risk Synthesis & Recommended Moves'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'AI zamienia zaakceptowaną mapę w ruchy walidacji, mitygacji, monitoringu i eskalacji.'
            : 'AI turns the approved map into validation, mitigation, monitoring, and escalation moves.'}
        </p>
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

export function RiskOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const data = session.inputData as RiskUncertaintyData;
  const summary = data.summary;
  const initiatives = [
    ...(summary?.recommendedInitiatives || []),
    ...(session.generatedInitiatives || []),
  ];

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isPolish ? 'Outputy i inicjatywy odporności' : 'Outputs & Resilience Initiatives'}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Final source summary i output candidates bazują na zaakceptowanych ryzykach i scenariuszach.'
            : 'The final source summary and output candidates are based on approved risks and scenarios.'}
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
                cardId={summary.proposalId || 'risk-summary'}
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
