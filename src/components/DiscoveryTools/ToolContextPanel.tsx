/**
 * ToolContextPanel
 * Active AI collaboration panel for tool sessions.
 */

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  MessageSquareText,
  Sparkles,
  Target,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  computeDynamicSwotOverallReadiness,
  computeDynamicSwotPhaseSummaries,
  computeDynamicSwotSessionSignals,
} from '@/components/DiscoveryTools/toolCompletion';
import { PorterData, SWOTData, ToolSession, ToolType } from '@/store/useToolStore';

interface ToolContextPanelProps {
  toolType: ToolType;
  session: ToolSession;
  currentStepId?: string;
  isPolish: boolean;
  orgName?: string | null;
  aiContent?: string;
  onOpenChat: () => void;
  onGenerateFullSession?: () => void;
  onOpenInitiatives?: () => void;
  generatedInitiatives?: { id: string; title: string; status?: string }[];
  recentInitiatives?: { id: string; title: string; status?: string }[];
  chatSnippets?: { role: string; content: string }[];
  embedded?: boolean;
}

const getReadinessTone = (readiness: 'blocked' | 'needs-work' | 'ready') =>
  readiness === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
    : readiness === 'needs-work'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      : 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300';

const getDynamicSwotCoach = (currentStepId: string | undefined, t: (key: string) => string) => {
  const ns = 'discoveryToolsMain.toolContextPanel.coach';
  const map = {
    mission: { nextQuestion: t(`${ns}.mission.nextQuestion`), whyNow: t(`${ns}.mission.whyNow`) },
    input: { nextQuestion: t(`${ns}.input.nextQuestion`), whyNow: t(`${ns}.input.whyNow`) },
    swot: { nextQuestion: t(`${ns}.swot.nextQuestion`), whyNow: t(`${ns}.swot.whyNow`) },
    insights: {
      nextQuestion: t(`${ns}.insights.nextQuestion`),
      whyNow: t(`${ns}.insights.whyNow`),
    },
    outputs: { nextQuestion: t(`${ns}.outputs.nextQuestion`), whyNow: t(`${ns}.outputs.whyNow`) },
  } as const;

  return (
    map[currentStepId as keyof typeof map] || {
      nextQuestion: t(`${ns}.fallback.nextQuestion`),
      whyNow: t(`${ns}.fallback.whyNow`),
    }
  );
};

export const ToolContextPanel: React.FC<ToolContextPanelProps> = ({
  toolType,
  session,
  currentStepId,
  isPolish,
  orgName,
  aiContent,
  onOpenChat,
  onGenerateFullSession,
  onOpenInitiatives,
  generatedInitiatives = [],
  recentInitiatives = [],
  chatSnippets = [],
  embedded = false,
}) => {
  const { t } = useTranslation();
  const [missionComment, setMissionComment] = React.useState('');
  const generationStatus = session.sessionGenerationStatus || 'idle';
  const swotData = toolType === 'dynamic-swot' ? (session.inputData as SWOTData) : null;
  const readiness = swotData ? computeDynamicSwotOverallReadiness(swotData, isPolish) : null;

  const proposalCounts = swotData
    ? {
        signals: swotData.signals.filter((s) => s.proposalStatus === 'ai-proposed').length,
        items: swotData.items.filter((i) => i.proposalStatus === 'ai-proposed').length,
        tensions: swotData.tensions.filter((t) => t.proposalStatus === 'ai-proposed').length,
        moves: swotData.recommendedMoves.filter((m) => m.proposalStatus === 'ai-proposed').length,
        outputs: swotData.outputCandidates.filter((o) => o.proposalStatus === 'ai-proposed').length,
        total: 0,
      }
    : null;
  if (proposalCounts) {
    proposalCounts.total =
      proposalCounts.signals +
      proposalCounts.items +
      proposalCounts.tensions +
      proposalCounts.moves +
      proposalCounts.outputs;
  }

  const acceptedCounts = swotData
    ? {
        signals: swotData.signals.filter((s) => s.proposalStatus === 'accepted').length,
        items: swotData.items.filter((i) => i.proposalStatus === 'accepted').length,
        tensions: swotData.tensions.filter((t) => t.proposalStatus === 'accepted').length,
        moves: swotData.recommendedMoves.filter((m) => m.proposalStatus === 'accepted').length,
        outputs: swotData.outputCandidates.filter((o) => o.proposalStatus === 'accepted').length,
        total: 0,
      }
    : null;
  if (acceptedCounts) {
    acceptedCounts.total =
      acceptedCounts.signals +
      acceptedCounts.items +
      acceptedCounts.tensions +
      acceptedCounts.moves +
      acceptedCounts.outputs;
  }
  const phaseSummaries = swotData ? computeDynamicSwotPhaseSummaries(swotData, isPolish) : [];
  const swotSignals = swotData ? computeDynamicSwotSessionSignals(swotData, isPolish) : null;
  const coach = toolType === 'dynamic-swot' ? getDynamicSwotCoach(currentStepId, t) : null;
  const proposalQueue = swotData
    ? [
        ...swotData.signals
          .filter((signal) => signal.state === 'proposed')
          .slice(0, 3)
          .map((signal) => signal.content),
        ...swotData.items
          .filter((item) => item.status === 'proposed')
          .slice(0, 3)
          .map((item) => item.text),
      ].slice(0, 5)
    : [];
  const porterData = toolType === 'market-forces' ? (session.inputData as PorterData) : null;
  const isDynamicSwotMission = toolType === 'dynamic-swot' && currentStepId === 'mission';

  if (embedded) {
    const insightText =
      aiContent ||
      coach?.whyNow ||
      (readiness ? readiness.label : t('discoveryToolsMain.toolContextPanel.aiReviewingPhase'));
    const recommendations = [
      coach?.nextQuestion,
      swotSignals?.missingEvidence?.[0],
      generatedInitiatives.length > 0
        ? t('discoveryToolsMain.toolContextPanel.reviewGeneratedInitiatives')
        : null,
    ].filter(Boolean) as string[];

    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-primary-200/70 bg-primary-500/5 p-5 dark:border-primary-900/40 dark:bg-primary-950/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                AI Collaboration Panel
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                {t('discoveryToolsMain.toolContextPanel.aiWorkspaceTitle')}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t('discoveryToolsMain.toolContextPanel.aiWorkspaceSubtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center gap-2 rounded-full border border-primary-300/50 bg-white/70 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-white dark:border-primary-800/50 dark:bg-white/[0.04] dark:text-primary-200"
            >
              <MessageSquareText className="h-4 w-4" />
              {t('discoveryToolsMain.toolContextPanel.openChat')}
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <span>AI insights</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {insightText}
            </p>
            {readiness && (
              <div
                className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${getReadinessTone(readiness.readiness)}`}
              >
                {readiness.label}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>AI recommendations</span>
            </div>
            <div className="mt-3 space-y-2">
              {(recommendations.length > 0
                ? recommendations
                : [t('discoveryToolsMain.toolContextPanel.clarifyMissingInputs')]
              ).map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <BookOpen className="h-4 w-4 text-slate-500" />
              <span>{t('discoveryToolsMain.toolContextPanel.organizationContext')}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {orgName || t('discoveryToolsMain.toolContextPanel.noOrganizationProfile')}
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:border-navy-700/70 dark:bg-navy-950/50 dark:text-slate-400">
              {t('discoveryToolsMain.toolContextPanel.aiRationale')}
            </div>
          </div>
        </div>

        {swotData && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>{t('discoveryToolsMain.toolContextPanel.aiProposalQueue')}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  [t('discoveryToolsMain.toolContextPanel.signals'), proposalCounts?.signals || 0],
                  [t('discoveryToolsMain.toolContextPanel.cards'), proposalCounts?.items || 0],
                  [
                    t('discoveryToolsMain.toolContextPanel.tensions'),
                    proposalCounts?.tensions || 0,
                  ],
                  [t('discoveryToolsMain.toolContextPanel.outputs'), proposalCounts?.outputs || 0],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl bg-slate-50/80 px-3 py-2 dark:bg-navy-950/50"
                  >
                    <div className="text-[11px] text-slate-600">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{t('discoveryToolsMain.toolContextPanel.qualityGaps')}</span>
              </div>
              <div className="mt-3 space-y-2">
                {(swotSignals?.missingEvidence || []).slice(0, 4).length > 0 ? (
                  (swotSignals?.missingEvidence || []).slice(0, 4).map((gap, index) => (
                    <div
                      key={`${gap}-${index}`}
                      className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300"
                    >
                      {gap}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('discoveryToolsMain.toolContextPanel.noCriticalInputGaps')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {porterData && (
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <ArrowRight className="h-4 w-4 text-slate-500" />
              <span>{t('discoveryToolsMain.toolContextPanel.sessionState')}</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300">
                {porterData.context.industry ||
                  t('discoveryToolsMain.toolContextPanel.missingIndustry')}
              </div>
              <div className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300">
                {porterData.context.geographicScope ||
                  t('discoveryToolsMain.toolContextPanel.missingGeographicScope')}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isDynamicSwotMission) {
    return (
      <div className="space-y-4">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-navy-700">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {t('discoveryToolsMain.toolContextPanel.workWithAi')}
            </h3>
            <span className="inline-flex rounded-full border border-primary-300/40 bg-primary-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:border-primary-800/50 dark:text-primary-300">
              AI
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-[26px] border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {t('discoveryToolsMain.toolContextPanel.workingMode')}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {t('discoveryToolsMain.toolContextPanel.workingModeDescription')}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {t('discoveryToolsMain.toolContextPanel.workingNoteForAi')}
            </div>
            <textarea
              value={missionComment}
              onChange={(e) => setMissionComment(e.target.value)}
              rows={6}
              placeholder={t('discoveryToolsMain.toolContextPanel.workingNotePlaceholder')}
              className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
            />
            <button
              onClick={onOpenChat}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200"
            >
              <MessageSquareText className="h-4 w-4 text-primary-500" />
              {t('discoveryToolsMain.toolContextPanel.takeToAiChat')}
            </button>
          </div>

          <div className="rounded-[26px] border border-sky-200/70 bg-sky-500/5 p-4 dark:border-sky-900/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
              {t('discoveryToolsMain.toolContextPanel.quickRefinementAngles')}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                t('discoveryToolsMain.toolContextPanel.refinementAngleOptions', {
                  returnObjects: true,
                }) as string[]
              ).map((label) => (
                <button
                  key={label}
                  onClick={onOpenChat}
                  className="inline-flex rounded-full border border-sky-200/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm transition-colors hover:bg-sky-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                {t('discoveryToolsMain.toolContextPanel.moveToFullSession')}
              </div>
              <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
                Output
              </span>
            </div>
            <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {t('discoveryToolsMain.toolContextPanel.moveToFullSessionDescription')}
            </div>
            <button
              onClick={onGenerateFullSession}
              disabled={!onGenerateFullSession || generationStatus === 'generating'}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-navy-900 dark:bg-[#F4F7FB] px-5 py-3 text-sm font-semibold text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generationStatus === 'generating' ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  {t('discoveryToolsMain.toolContextPanel.aiBuildingSession')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('discoveryToolsMain.toolContextPanel.acceptFramingGenerate')}
                </>
              )}
            </button>
          </div>

          {orgName && (
            <div className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {t('discoveryToolsMain.toolContextPanel.organizationContext')}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {orgName}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 p-4 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white">
          {t('discoveryToolsMain.toolContextPanel.aiCollaborationPanel')}
        </h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {generationStatus === 'generating' && (
          <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-800/40 dark:bg-primary-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-300">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>{t('discoveryToolsMain.toolContextPanel.aiPreparingSession')}</span>
            </div>
            <p className="mt-2 text-xs text-primary-600 dark:text-primary-400">
              {t('discoveryToolsMain.toolContextPanel.aiPreparingSessionDescription')}
            </p>
          </div>
        )}

        {generationStatus === 'ready' && proposalCounts && proposalCounts.total > 0 && (
          <div className="rounded-2xl border border-primary-200 bg-white p-4 dark:border-primary-800/40 dark:bg-navy-900/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <span>{t('discoveryToolsMain.toolContextPanel.aiProposals')}</span>
              <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {proposalCounts.total} {t('discoveryToolsMain.toolContextPanel.toReview')}
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {proposalCounts.signals > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t('discoveryToolsMain.toolContextPanel.signals')}</span>
                  <span className="font-medium">{proposalCounts.signals}</span>
                </div>
              )}
              {proposalCounts.items > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t('discoveryToolsMain.toolContextPanel.swotCards')}</span>
                  <span className="font-medium">{proposalCounts.items}</span>
                </div>
              )}
              {proposalCounts.tensions > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t('discoveryToolsMain.toolContextPanel.tensions')}</span>
                  <span className="font-medium">{proposalCounts.tensions}</span>
                </div>
              )}
              {proposalCounts.moves > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t('discoveryToolsMain.toolContextPanel.moves')}</span>
                  <span className="font-medium">{proposalCounts.moves}</span>
                </div>
              )}
              {proposalCounts.outputs > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t('discoveryToolsMain.toolContextPanel.outputs')}</span>
                  <span className="font-medium">{proposalCounts.outputs}</span>
                </div>
              )}
            </div>
            {acceptedCounts && acceptedCounts.total > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {acceptedCounts.total} {t('discoveryToolsMain.toolContextPanel.accepted')}
              </div>
            )}
          </div>
        )}

        {swotData && readiness && (
          <div className={`rounded-2xl border p-4 ${getReadinessTone(readiness.readiness)}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4" />
              <span>{t('discoveryToolsMain.toolContextPanel.readiness')}</span>
            </div>
            <div className="mt-2 text-sm">{readiness.label}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {phaseSummaries.map((phase) => (
                <div
                  key={phase.id}
                  className="rounded-xl border border-white/50 bg-white/60 px-3 py-2 text-xs dark:border-navy-700/50 dark:bg-navy-950/30"
                >
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    {phase.label}
                  </div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">
                    {phase.done
                      ? t('discoveryToolsMain.toolContextPanel.ready')
                      : phase.primaryGap || t('discoveryToolsMain.toolContextPanel.needsWork')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('discoveryToolsMain.toolContextPanel.aiCoachBrief')}
              </span>
            </div>
            <button
              onClick={onOpenChat}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              {t('discoveryToolsMain.toolContextPanel.openChat')}
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {aiContent ||
              coach?.whyNow ||
              t('discoveryToolsMain.toolContextPanel.panelShowsNextMove')}
          </p>
          {chatSnippets.length > 0 && (
            <div className="mt-2 space-y-1 text-[11px] text-slate-500">
              {chatSnippets.map((snippet, idx) => (
                <div key={idx}>
                  {snippet.role}: {snippet.content.slice(0, 80)}
                  {snippet.content.length > 80 ? '...' : ''}
                </div>
              ))}
            </div>
          )}
        </div>

        {swotData && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span>{t('discoveryToolsMain.toolContextPanel.nextQuestion')}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{coach?.nextQuestion}</p>
              <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs text-slate-500 dark:border-navy-700/70 dark:bg-navy-950/40 dark:text-slate-400">
                {t('discoveryToolsMain.toolContextPanel.whyNow')} {coach?.whyNow}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>{t('discoveryToolsMain.toolContextPanel.proposalQueue')}</span>
              </div>
              {proposalQueue.length > 0 ? (
                <div className="space-y-2">
                  {proposalQueue.map((proposal, index) => (
                    <div
                      key={`${proposal}-${index}`}
                      className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/40 dark:text-slate-300"
                    >
                      {proposal}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {t('discoveryToolsMain.toolContextPanel.noUnacceptedProposals')}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{t('discoveryToolsMain.toolContextPanel.missingEvidence')}</span>
              </div>
              {swotSignals && swotSignals.missingEvidence.length > 0 ? (
                <div className="space-y-2">
                  {swotSignals.missingEvidence.slice(0, 4).map((gap, index) => (
                    <div
                      key={`${gap}-${index}`}
                      className="text-xs text-slate-600 dark:text-slate-400"
                    >
                      {gap}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {t('discoveryToolsMain.toolContextPanel.noCriticalInputGaps')}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <BookOpen className="h-4 w-4 text-slate-500" />
                <span>{t('discoveryToolsMain.toolContextPanel.sessionCounters')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">
                    {t('discoveryToolsMain.toolContextPanel.acceptedCards')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.acceptedItems || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">
                    {t('discoveryToolsMain.toolContextPanel.proposals')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {(swotSignals?.proposedItems || 0) + (swotSignals?.proposedSignals || 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">
                    {t('discoveryToolsMain.toolContextPanel.tensions')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.tensions || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">
                    {t('discoveryToolsMain.toolContextPanel.readyOutputs')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.readyOutputs || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span>{t('discoveryToolsMain.toolContextPanel.outputRoutes')}</span>
                </div>
                {onOpenInitiatives && (
                  <button
                    onClick={onOpenInitiatives}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    {t('discoveryToolsMain.toolContextPanel.open')}
                  </button>
                )}
              </div>
              {swotData.outputCandidates?.length ? (
                <div className="space-y-2">
                  {swotData.outputCandidates.slice(0, 4).map((candidate) => (
                    <div
                      key={candidate.id}
                      className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs dark:border-navy-700/70 dark:bg-navy-950/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="uppercase text-[10px] text-slate-600">
                          {candidate.outputType}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 ${getReadinessTone(
                            candidate.readiness === 'blocked'
                              ? 'blocked'
                              : candidate.readiness === 'keep-as-idea'
                                ? 'needs-work'
                                : 'ready'
                          )}`}
                        >
                          {candidate.readiness || 'keep-as-idea'}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-700 dark:text-slate-300">
                        {candidate.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {t('discoveryToolsMain.toolContextPanel.noOutputCandidates')}
                </p>
              )}
            </div>
          </>
        )}

        {!swotData && porterData && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <ArrowRight className="h-4 w-4 text-slate-500" />
              <span>{t('discoveryToolsMain.toolContextPanel.sessionState')}</span>
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div>
                {porterData.context.industry ||
                  t('discoveryToolsMain.toolContextPanel.missingIndustry')}
              </div>
              <div>
                {porterData.context.geographicScope ||
                  t('discoveryToolsMain.toolContextPanel.missingGeographicScope')}
              </div>
            </div>
          </div>
        )}

        {generatedInitiatives.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('discoveryToolsMain.toolContextPanel.generatedFromThisTool')}
            </div>
            <div className="space-y-2">
              {generatedInitiatives.slice(0, 4).map((initiative) => (
                <div key={initiative.id} className="text-xs text-slate-600 dark:text-slate-400">
                  {initiative.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {recentInitiatives.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('discoveryToolsMain.toolContextPanel.recentInitiatives')}
            </div>
            <div className="space-y-2">
              {recentInitiatives.slice(0, 4).map((initiative) => (
                <div key={initiative.id} className="text-xs text-slate-600 dark:text-slate-400">
                  {initiative.title}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('discoveryToolsMain.toolContextPanel.organizationContext')}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {orgName || t('discoveryToolsMain.toolContextPanel.noOrganizationProfile')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ToolContextPanel;
