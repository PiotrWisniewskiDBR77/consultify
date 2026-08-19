import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import {
  PorterData,
  PorterForceId,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { CreateInitiativeFromMoveButton } from '../../shared/createInitiativeFromMove';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { PorterPentagonVisual } from '../../shared/StrategicCanvasVisuals';
import {
  normalizeUniversalSynthesis,
  ToolSynthesisSections,
} from '../../shared/ToolSynthesisSections';

type PhaseProps = {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
};

const FORCE_ORDER: PorterForceId[] = [
  'rivalry',
  'newEntrants',
  'substitutes',
  'buyerPower',
  'supplierPower',
];

const FORCE_LABELS: Record<PorterForceId, { en: string; pl: string; hint: string }> = {
  rivalry: {
    en: 'Competitive Rivalry',
    pl: 'Rywalizacja konkurencyjna',
    hint: 'Intensity of competition between existing players',
  },
  newEntrants: {
    en: 'Threat of New Entrants',
    pl: 'Zagrożenie nowych graczy',
    hint: 'Entry barriers, capital requirements, brand loyalty',
  },
  substitutes: {
    en: 'Threat of Substitutes',
    pl: 'Zagrożenie substytutów',
    hint: 'Alternative solutions and switching logic',
  },
  buyerPower: {
    en: 'Buyer Power',
    pl: 'Siła nabywców',
    hint: 'Customer concentration, price sensitivity, switching cost',
  },
  supplierPower: {
    en: 'Supplier Power',
    pl: 'Siła dostawców',
    hint: 'Supplier concentration and input substitutability',
  },
};

const proposalBadge = (proposalStatus?: string) => {
  const b = 'discoveryToolsTools.common.badge';
  if (proposalStatus === 'ai-proposed') return i18n.t(`${b}.aiProposal`);
  if (proposalStatus === 'rejected') return i18n.t(`${b}.rejected`);
  if (proposalStatus === 'rethinking') return i18n.t(`${b}.rethinking`);
  return i18n.t(`${b}.accepted`);
};

export function MarketForcesInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const data = session.inputData as PorterData;
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
          sourceLabel: t('discoveryToolsTools.common.userInput'),
          confidence: 4,
          tags: [],
          evidenceType: 'observation',
          state: 'accepted',
          provenance: t('discoveryToolsTools.common.manualEntry'),
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<PorterData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<PorterData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.marketForces.signalsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.marketForces.signalsSubtitle')}
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
          placeholder={t('discoveryToolsTools.marketForces.addSignalPlaceholder')}
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
                {proposalBadge(signal.proposalStatus)}
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

export function MarketForcesBuildPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const data = session.inputData as PorterData;

  const updateForce = (
    forceId: PorterForceId,
    updates: Partial<PorterData['forces'][PorterForceId]>
  ) => {
    updateInputData({
      forces: {
        ...data.forces,
        [forceId]: {
          ...data.forces[forceId],
          ...updates,
        },
      },
    } as Partial<PorterData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.marketForces.scorecardTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.marketForces.scorecardSubtitle')}
        </p>
      </div>

      <PorterPentagonVisual data={data} isPolish={isPolish} />

      <div className="grid gap-4 xl:grid-cols-2">
        {FORCE_ORDER.map((forceId) => {
          const force = data.forces[forceId];
          const labels = FORCE_LABELS[forceId];
          return (
            <div
              key={forceId}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {isPolish ? labels.pl : labels.en}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{labels.hint}</p>
                </div>
                {force.proposalStatus === 'ai-proposed' && (
                  <CardActions
                    cardType="item"
                    cardId={force.id}
                    isPolish={isPolish}
                    onAcceptCard={onAcceptCard}
                    onRejectCard={onRejectCard}
                    onRethinkCard={onRethinkCard}
                  />
                )}
              </div>

              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('discoveryToolsTools.marketForces.forceScore')}
                  <select
                    value={force.score}
                    onChange={(event) =>
                      updateForce(forceId, { score: Number(event.target.value) })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
                  >
                    {[1, 2, 3, 4, 5].map((score) => (
                      <option key={score} value={score}>
                        {score}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('discoveryToolsTools.marketForces.trend')}
                  <select
                    value={force.trend}
                    onChange={(event) =>
                      updateForce(forceId, {
                        trend: event.target.value as ForceDataTrend,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-navy-700 dark:bg-navy-900"
                  >
                    <option value="increasing">
                      {t('discoveryToolsTools.marketForces.trendIncreasing')}
                    </option>
                    <option value="stable">
                      {t('discoveryToolsTools.marketForces.trendStable')}
                    </option>
                    <option value="decreasing">
                      {t('discoveryToolsTools.marketForces.trendDecreasing')}
                    </option>
                  </select>
                </label>
              </div>

              <textarea
                value={(force.drivers || []).join('\n')}
                onChange={(event) =>
                  updateForce(forceId, {
                    drivers: event.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
                rows={4}
                placeholder={t('discoveryToolsTools.marketForces.driversPlaceholder')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900/60"
              />

              <textarea
                value={force.implication || ''}
                onChange={(event) => updateForce(forceId, { implication: event.target.value })}
                rows={2}
                placeholder={t('discoveryToolsTools.marketForces.implicationPlaceholder')}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-900"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ForceDataTrend = PorterData['forces'][PorterForceId]['trend'];

export function MarketForcesInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const data = session.inputData as PorterData;
  const acceptedForces = useMemo(
    () => FORCE_ORDER.filter((forceId) => data.forces[forceId]?.proposalStatus !== 'rejected'),
    [data.forces]
  );
  const universalSynthesis = useMemo(
    () =>
      normalizeUniversalSynthesis(
        {
          'executive-answer': data.summary?.executiveSummary || '',
          'key-findings': acceptedForces.map(
            (forceId) =>
              `${isPolish ? FORCE_LABELS[forceId].pl : FORCE_LABELS[forceId].en}: ${data.forces[forceId].score}/5`
          ),
          'key-insights': (data.implications || []).map((implication) => implication.insight),
          'business-implications': (data.implications || []).map(
            (implication) => implication.title
          ),
          conclusions: data.summary?.appliedConclusions || [],
          'decision-options': (data.recommendedMoves || []).map((move) => move.title),
          'consultant-recommendation': (data.recommendedMoves || []).map((move) => move.rationale),
          'risks-assumptions-uncertainties': acceptedForces
            .filter((forceId) => data.forces[forceId].score >= 4)
            .map((forceId) => (isPolish ? FORCE_LABELS[forceId].pl : FORCE_LABELS[forceId].en)),
          'management-questions': (data.outputCandidates || []).map((candidate) => candidate.title),
        },
        isPolish,
        {
          'executive-answer': data.summary?.proposalId ? [data.summary.proposalId] : [],
          'key-findings': acceptedForces,
          'key-insights': (data.implications || []).map((implication) => implication.id),
          'business-implications': (data.implications || []).map((implication) => implication.id),
          conclusions: data.summary?.proposalId ? [data.summary.proposalId] : [],
          'decision-options': (data.recommendedMoves || []).map((move) => move.id),
          'consultant-recommendation': (data.recommendedMoves || []).map((move) => move.id),
          'risks-assumptions-uncertainties': acceptedForces,
          'management-questions': (data.outputCandidates || []).map((candidate) => candidate.id),
        }
      ),
    [
      acceptedForces,
      data.forces,
      data.implications,
      data.outputCandidates,
      data.recommendedMoves,
      data.summary,
      isPolish,
    ]
  );

  return (
    <div className="space-y-5 p-5">
      <ToolSynthesisSections sections={universalSynthesis} isPolish={isPolish} />
      <details className="rounded-2xl border border-c-border bg-c-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-c-text">
          {isPolish ? 'Pokaż analizę źródłową' : 'Show supporting analysis'}
        </summary>
        <div className="space-y-5 border-t border-c-border p-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t('discoveryToolsTools.marketForces.implicationsTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.marketForces.implicationsSubtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
          {t('discoveryToolsTools.marketForces.acceptedForces')}
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          {acceptedForces.map((forceId) => (
            <div key={forceId} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {isPolish ? FORCE_LABELS[forceId].pl : FORCE_LABELS[forceId].en}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                {data.forces[forceId].score}/5
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(data.implications || []).map((implication) => (
          <div
            key={implication.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                  {proposalBadge(implication.proposalStatus)}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {implication.title}
                </h3>
              </div>
              {implication.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="tension"
                  cardId={implication.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {implication.insight}
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-navy-900/60 dark:text-slate-300">
              {implication.recommendation}
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
                    {t('discoveryToolsTools.common.firstStepColonSpace')}
                    {move.firstStep}
                  </div>
                )}
                <div className="flex justify-end">
                  <CreateInitiativeFromMoveButton
                    session={session}
                    move={move}
                    isPolish={isPolish}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

export function MarketForcesOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const data = session.inputData as PorterData;
  const summary = data.summary;
  const initiatives = [
    ...(summary?.recommendedInitiatives || []),
    ...(session.generatedInitiatives || []),
  ];

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.marketForces.outputsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.marketForces.outputsSubtitle')}
        </p>
      </div>

      {summary?.executiveSummary && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {t('discoveryToolsTools.marketForces.finalSourceSummary')}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {summary.executiveSummary}
              </p>
            </div>
            {summary.proposalStatus === 'ai-proposed' && (
              <CardActions
                cardType="conclusion"
                cardId={summary.proposalId || 'porter-summary'}
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
          {t('discoveryToolsTools.common.initiativeDrafts')}
        </div>
        {initiatives.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsTools.common.noInitiatives')}
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
