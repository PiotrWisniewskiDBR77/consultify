import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import {
  PortfolioItem,
  PortfolioPriorityData,
  ProposalCardType,
  ToolSession,
  useToolStore,
} from '@/store/useToolStore';

import { CreateInitiativeFromMoveButton } from '../../shared/createInitiativeFromMove';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { PortfolioBcgVisual } from '../../shared/StrategicCanvasVisuals';

type PhaseProps = {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
};

const CATEGORIES: PortfolioItem['category'][] = ['star', 'question-mark', 'cash-cow', 'dog'];

const CATEGORY_META: Record<PortfolioItem['category'], { en: string; pl: string; hint: string }> = {
  star: { en: 'Stars', pl: 'Gwiazdy', hint: 'High growth, high relative share' },
  'question-mark': {
    en: 'Question Marks',
    pl: 'Znaki zapytania',
    hint: 'High growth, low relative share',
  },
  'cash-cow': { en: 'Cash Cows', pl: 'Dojne krowy', hint: 'Low growth, high relative share' },
  dog: { en: 'Dogs', pl: 'Psy', hint: 'Low growth, low relative share' },
};

const getCategory = (growth: number, share: number): PortfolioItem['category'] => {
  if (growth >= 4 && share >= 4) return 'star';
  if (growth >= 4 && share < 4) return 'question-mark';
  if (growth < 4 && share >= 4) return 'cash-cow';
  return 'dog';
};

const proposalBadge = (proposalStatus?: string) => {
  const b = 'discoveryToolsTools.common.badge';
  if (proposalStatus === 'ai-proposed') return i18n.t(`${b}.aiProposal`);
  if (proposalStatus === 'rejected') return i18n.t(`${b}.rejected`);
  if (proposalStatus === 'rethinking') return i18n.t(`${b}.rethinking`);
  return i18n.t(`${b}.accepted`);
};

export function PortfolioInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const data = session.inputData as PortfolioPriorityData;
  const [draft, setDraft] = useState('');

  const addSignal = () => {
    if (!draft.trim()) return;
    updateInputData({
      signals: [
        ...(data.signals || []),
        {
          id: `portfolio-signal-${Date.now()}`,
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
    } as Partial<PortfolioPriorityData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<PortfolioPriorityData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.portfolioPriority.signalsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.portfolioPriority.signalsSubtitle')}
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
          placeholder={t('discoveryToolsTools.portfolioPriority.addSignalPlaceholder')}
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

export function PortfolioItemsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const data = session.inputData as PortfolioPriorityData;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [marketGrowth, setMarketGrowth] = useState(3);
  const [marketShare, setMarketShare] = useState(3);
  const [investmentLevel, setInvestmentLevel] = useState(3);

  const addItem = () => {
    if (!title.trim()) return;
    updateInputData({
      initiatives: [
        ...(data.initiatives || []),
        {
          id: `portfolio-item-${Date.now()}`,
          title: title.trim(),
          description: description.trim(),
          marketGrowth,
          marketShare,
          investmentLevel,
          category: getCategory(marketGrowth, marketShare),
          evidence: [],
          confidence: 4,
          proposalStatus: 'accepted',
        },
      ],
    } as Partial<PortfolioPriorityData>);
    setTitle('');
    setDescription('');
    setMarketGrowth(3);
    setMarketShare(3);
    setInvestmentLevel(3);
  };

  const updateItem = (id: string, updates: Partial<PortfolioItem>) => {
    updateInputData({
      initiatives: data.initiatives.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...updates };
        return { ...next, category: getCategory(next.marketGrowth, next.marketShare) };
      }),
    } as Partial<PortfolioPriorityData>);
  };

  const removeItem = (id: string) => {
    updateInputData({
      initiatives: data.initiatives.filter((item) => item.id !== id),
    } as Partial<PortfolioPriorityData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.portfolioPriority.matrixTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.portfolioPriority.matrixSubtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('discoveryToolsTools.portfolioPriority.namePlaceholder')}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('discoveryToolsTools.portfolioPriority.descPlaceholder')}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-navy-700 dark:bg-navy-900"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!title.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            {t('discoveryToolsTools.common.add')}
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {[
            [
              'marketGrowth',
              t('discoveryToolsTools.portfolioPriority.marketGrowth'),
              marketGrowth,
              setMarketGrowth,
            ],
            [
              'marketShare',
              t('discoveryToolsTools.portfolioPriority.sharePosition'),
              marketShare,
              setMarketShare,
            ],
            [
              'investmentLevel',
              t('discoveryToolsTools.portfolioPriority.investmentLevel'),
              investmentLevel,
              setInvestmentLevel,
            ],
          ].map(([id, label, value, setter]) => (
            <label key={id as string} className="text-xs font-medium text-slate-500">
              {label as string}
              <select
                value={value as number}
                onChange={(event) =>
                  (setter as (value: number) => void)(Number(event.target.value))
                }
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"
              >
                {[1, 2, 3, 4, 5].map((score) => (
                  <option key={score} value={score}>
                    {score}/5
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <PortfolioBcgVisual data={data} isPolish={isPolish} />

      <div className="grid gap-4 xl:grid-cols-2">
        {CATEGORIES.map((category) => (
          <div
            key={category}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-3">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {isPolish ? CATEGORY_META[category].pl : CATEGORY_META[category].en}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {CATEGORY_META[category].hint}
              </p>
            </div>
            <div className="space-y-3">
              {(data.initiatives || [])
                .filter((item) => item.category === category)
                .map((item) => (
                  <div key={item.id} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-pink-500">
                          {proposalBadge(item.proposalStatus)}
                        </div>
                        <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </h4>
                      </div>
                      {item.proposalStatus === 'ai-proposed' ? (
                        <CardActions
                          cardType="item"
                          cardId={item.id}
                          isPolish={isPolish}
                          onAcceptCard={onAcceptCard}
                          onRejectCard={onRejectCard}
                          onRethinkCard={onRethinkCard}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-lg p-1.5 text-slate-600 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.description}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {(['marketGrowth', 'marketShare', 'investmentLevel'] as const).map(
                        (field) => (
                          <label key={field} className="text-xs font-medium text-slate-500">
                            {field === 'marketGrowth'
                              ? t('discoveryToolsTools.common.growth')
                              : field === 'marketShare'
                                ? t('discoveryToolsTools.common.share')
                                : t('discoveryToolsTools.common.investment')}
                            <select
                              value={item[field]}
                              onChange={(event) =>
                                updateItem(item.id, { [field]: Number(event.target.value) })
                              }
                              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-navy-700 dark:bg-navy-900"
                            >
                              {[1, 2, 3, 4, 5].map((score) => (
                                <option key={score} value={score}>
                                  {score}/5
                                </option>
                              ))}
                            </select>
                          </label>
                        )
                      )}
                    </div>
                    {item.rationale && (
                      <div className="mt-3 rounded-lg bg-white p-2 text-xs text-slate-600 dark:bg-navy-950 dark:text-slate-300">
                        {item.rationale}
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

export function PortfolioInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const data = session.inputData as PortfolioPriorityData;

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.portfolioPriority.tradeoffsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.portfolioPriority.tradeoffsSubtitle')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(data.tradeOffs || []).map((tradeOff) => (
          <div
            key={tradeOff.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                  {proposalBadge(tradeOff.proposalStatus)}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {tradeOff.title}
                </h3>
              </div>
              {tradeOff.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="tension"
                  cardId={tradeOff.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {tradeOff.insight}
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-navy-900/60 dark:text-slate-300">
              {tradeOff.recommendation}
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
              <CreateInitiativeFromMoveButton session={session} move={move} isPolish={isPolish} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const data = session.inputData as PortfolioPriorityData;
  const summary = data.summary;
  const initiatives = [
    ...(summary?.recommendedInitiatives || []),
    ...(session.generatedInitiatives || []),
  ];

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.portfolioPriority.outputsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.portfolioPriority.outputsSubtitle')}
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
                cardId={summary.proposalId || 'portfolio-summary'}
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
