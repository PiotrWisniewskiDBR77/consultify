/**
 * ValueChainPhases - the four canvas phases for the Value Chain Analysis tool.
 *
 * Faithful analog of MarketForcesPhases:
 *  - ValueChainInputPhase    -> capture / curate signals
 *  - ValueChainBuildPhase    -> score the 9 value activities (primary + support)
 *  - ValueChainInsightsPhase -> margin levers, recommended moves, positioning verdict
 *  - ValueChainOutputsPhase  -> final summary, output candidates, initiative drafts
 *
 * Prop signatures match the MarketForces phases 1:1 so they slot into
 * ToolCanvas identically.
 */

import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import {
  ProposalCardType,
  ToolSession,
  useToolStore,
  ValueActivityId,
  ValueChainData,
} from '@/store/useToolStore';

import { CreateInitiativeFromMoveButton } from '../../shared/createInitiativeFromMove';
import { ProposalCardActions as CardActions } from '../../shared/ProposalCardGovernance';
import { ValueChainVisual } from '../../shared/StrategicCanvasVisuals';
import { ActivityCard } from './ActivityCard';

type PhaseProps = {
  session: ToolSession;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
};

const PRIMARY_ORDER: ValueActivityId[] = [
  'inboundLogistics',
  'operations',
  'outboundLogistics',
  'marketingSales',
  'service',
];

const SUPPORT_ORDER: ValueActivityId[] = [
  'infrastructure',
  'hrManagement',
  'technology',
  'procurement',
];

const ACTIVITY_SHORT: Record<ValueActivityId, { en: string; pl: string }> = {
  inboundLogistics: { en: 'Inbound Logistics', pl: 'Logistyka wew.' },
  operations: { en: 'Operations', pl: 'Operacje' },
  outboundLogistics: { en: 'Outbound Logistics', pl: 'Logistyka zew.' },
  marketingSales: { en: 'Marketing & Sales', pl: 'Marketing i sprzedaż' },
  service: { en: 'Service', pl: 'Serwis' },
  infrastructure: { en: 'Infrastructure', pl: 'Infrastruktura' },
  hrManagement: { en: 'HR Management', pl: 'Zarządzanie HR' },
  technology: { en: 'Technology', pl: 'Technologia' },
  procurement: { en: 'Procurement', pl: 'Zaopatrzenie' },
};

const proposalBadge = (proposalStatus?: string) => {
  const b = 'discoveryToolsTools.common.badge';
  if (proposalStatus === 'ai-proposed') return i18n.t(`${b}.aiProposal`);
  if (proposalStatus === 'rejected') return i18n.t(`${b}.rejected`);
  if (proposalStatus === 'rethinking') return i18n.t(`${b}.rethinking`);
  return i18n.t(`${b}.accepted`);
};

const marginBadge = (role: 'creator' | 'neutral' | 'drain') =>
  role === 'creator'
    ? i18n.t('discoveryToolsTools.valueChain.margin.creator')
    : role === 'drain'
      ? i18n.t('discoveryToolsTools.valueChain.margin.drain')
      : i18n.t('discoveryToolsTools.valueChain.margin.neutral');

// ==================== INPUT PHASE ====================

export function ValueChainInputPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();
  const data = session.inputData as ValueChainData;
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
    } as Partial<ValueChainData>);
    setDraft('');
  };

  const removeSignal = (id: string) => {
    updateInputData({
      signals: (data.signals || []).filter((signal) => signal.id !== id),
    } as Partial<ValueChainData>);
  };

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.valueChain.signalsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.valueChain.signalsSubtitle')}
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
          placeholder={t('discoveryToolsTools.valueChain.addSignalPlaceholder')}
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

// ==================== BUILD PHASE ====================

export function ValueChainBuildPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const data = session.inputData as ValueChainData;

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.valueChain.scorecardTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.valueChain.scorecardSubtitle')}
        </p>
      </div>

      {/* Signature visual: classic Porter value-chain diagram (cost/value/margin) */}
      <ValueChainVisual
        activities={data.activities}
        positioningVerdict={data.positioningVerdict}
        isPolish={isPolish}
      />

      {/* Primary activities */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
          {t('discoveryToolsTools.valueChain.primaryActivities')}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {PRIMARY_ORDER.map((activityId) => (
            <ActivityCard
              key={activityId}
              activityId={activityId}
              session={session}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
          ))}
        </div>
      </div>

      {/* Support activities */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
          {t('discoveryToolsTools.valueChain.supportActivities')}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {SUPPORT_ORDER.map((activityId) => (
            <ActivityCard
              key={activityId}
              activityId={activityId}
              session={session}
              isPolish={isPolish}
              onAcceptCard={onAcceptCard}
              onRejectCard={onRejectCard}
              onRethinkCard={onRethinkCard}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== INSIGHTS PHASE ====================

export function ValueChainInsightsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const data = session.inputData as ValueChainData;
  const acceptedActivities = useMemo(
    () =>
      [...PRIMARY_ORDER, ...SUPPORT_ORDER].filter(
        (activityId) => data.activities[activityId]?.proposalStatus !== 'rejected'
      ),
    [data.activities]
  );

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.valueChain.leversTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.valueChain.leversSubtitle')}
        </p>
      </div>

      {/* Positioning verdict */}
      {data.positioningVerdict && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-500">
            {t('discoveryToolsTools.valueChain.positioningVerdict')} ·{' '}
            {data.positioningVerdict.positioning}
          </div>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {data.positioningVerdict.summary}
          </p>
        </div>
      )}

      {/* Accepted activities snapshot */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
          {t('discoveryToolsTools.valueChain.acceptedActivities')}
        </div>
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {acceptedActivities.map((activityId) => (
            <div key={activityId} className="rounded-xl bg-slate-50 p-3 dark:bg-navy-900/60">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {isPolish ? ACTIVITY_SHORT[activityId].pl : ACTIVITY_SHORT[activityId].en}
              </div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {marginBadge(data.activities[activityId].marginRole)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Levers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data.levers || []).map((lever) => (
          <div
            key={lever.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-primary-500">
                  {proposalBadge(lever.proposalStatus)} · {lever.leverType}
                </div>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {lever.title}
                </h3>
              </div>
              {lever.proposalStatus === 'ai-proposed' && (
                <CardActions
                  cardType="tension"
                  cardId={lever.id}
                  isPolish={isPolish}
                  onAcceptCard={onAcceptCard}
                  onRejectCard={onRejectCard}
                  onRethinkCard={onRethinkCard}
                />
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {lever.insight}
            </p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-navy-900/60 dark:text-slate-300">
              {lever.recommendation}
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

// ==================== OUTPUTS PHASE ====================

export function ValueChainOutputsPhase({
  session,
  isPolish,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: PhaseProps) {
  const { t } = useTranslation();
  const data = session.inputData as ValueChainData;
  const summary = data.summary;
  const initiatives = [
    ...(summary?.recommendedInitiatives || []),
    ...(session.generatedInitiatives || []),
  ];

  return (
    <div className="space-y-5 p-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {t('discoveryToolsTools.valueChain.outputsTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsTools.valueChain.outputsSubtitle')}
        </p>
      </div>

      {summary?.executiveSummary && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-navy-700 dark:bg-navy-950/50">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
                {t('discoveryToolsTools.valueChain.finalSourceSummary')}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {summary.executiveSummary}
              </p>
            </div>
            {summary.proposalStatus === 'ai-proposed' && (
              <CardActions
                cardType="conclusion"
                cardId={summary.proposalId || 'value-chain-summary'}
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
