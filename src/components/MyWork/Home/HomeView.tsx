import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { useV8MyWorkRoofSummary } from '@/hooks/useV8MyWorkRoof';
import { cn } from '@/lib/utils';
import { useV8 } from '@/providers/V8Provider';
import { V8InterviewApi, type V8InterviewInsight } from '@/services/api/v8/interview';
import { V8ResultsApi } from '@/services/api/v8/results';
import { getArtifactPath } from '@/utils/artifactLinks';

import { AIPulseCore } from './AIPulseCore';
import { DecisionTemperatureBlock } from './DecisionTemperatureBlock';
import { ExecutionCurrentBlock } from './ExecutionCurrentBlock';
import type { HomeBlock, HomeScreenAction, HomeTimeMode } from './homeV2Types';
import { IndustryLensBlock } from './IndustryLensBlock';
import { MomentumBlock } from './MomentumBlock';
import { RadarTriageCard } from './RadarTriageCard';
import { SparkField } from './SparkField';
import { TeamSignalBlock } from './TeamSignalBlock';
import { useHomeData } from './useHomeData';
import { useRadarTriageData } from './useRadarTriageData';

interface HomeViewProps {
  userName?: string;
  refreshTrigger?: number;
  onAction: (action: HomeScreenAction) => void;
}

class HomeBlockErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[MyWorkHome] block render failed', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export const HomeView: React.FC<HomeViewProps> = ({ userName, refreshTrigger, onAction }) => {
  const { t, i18n } = useTranslation();
  const { isV8Enabled } = useV8();
  const isPolish = i18n.language === 'pl';
  const lang = String(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
  const { screen, blocks, layout, loading, error, refresh } = useHomeData(refreshTrigger);
  const triageData = useRadarTriageData(undefined, isV8Enabled);
  const roofSummary = useV8MyWorkRoofSummary(isV8Enabled);
  const [roofMetaOpen, setRoofMetaOpen] = useState(false);
  const lastErrorToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error || error === lastErrorToastRef.current) return;
    lastErrorToastRef.current = error;
    toast.error(t('myWork.radar.loadErrorToast', 'Radar could not load. Showing recovery state.'));
  }, [error, t]);

  const navigate = useNavigate();
  const [recentInsights, setRecentInsights] = useState<V8InterviewInsight[]>([]);
  useEffect(() => {
    if (!isV8Enabled) {
      setRecentInsights([]);
      return;
    }
    V8InterviewApi.listInsights({ limit: 5 })
      .then((res) => setRecentInsights(res?.insights ?? []))
      .catch(() => setRecentInsights([]));
  }, [isV8Enabled, refreshTrigger]);

  const [kpiAlerts, setKpiAlerts] = useState<
    Array<{
      signalId: string;
      kpiId: string;
      severity: string;
      description: string;
      createdAt: string;
      kpiName?: string;
    }>
  >([]);
  useEffect(() => {
    if (!isV8Enabled) {
      setKpiAlerts([]);
      return;
    }
    V8ResultsApi.getWorkflowSignals()
      .then((res) => setKpiAlerts((res?.data ?? []).slice(0, 5)))
      .catch(() => setKpiAlerts([]));
  }, [isV8Enabled, refreshTrigger]);

  const alignedHomeBlocks = useMemo(() => {
    const homeBlocks = roofSummary.data?.homeBlocks;
    if (!homeBlocks) return [];
    return homeBlocks.filter(
      (block) =>
        block.maturityLevel !== 'placeholder_non_canonical' && block.blockName !== 'commandDock'
    );
  }, [roofSummary.data?.homeBlocks]);

  const alignedRealCount = useMemo(
    () => alignedHomeBlocks.filter((b) => b.maturityLevel === 'backed_by_real_service').length,
    [alignedHomeBlocks]
  );

  const roofTruthStrip = useMemo(() => {
    if (roofSummary.isLoading) {
      return t('myWork.radar.roofTruthChecking');
    }
    if (roofSummary.isError || !roofSummary.data) {
      return null;
    }

    const counts = roofSummary.data.counts;
    const surfaceMode = getSurfaceModeLabel(roofSummary.data.surfaceMode);
    const realShown =
      alignedHomeBlocks.length > 0 ? alignedRealCount : counts.backed_by_real_service;

    return `Roof truth: ${surfaceMode} \u00b7 ${realShown} real \u00b7 ${counts.partial_stitched} partial \u00b7 ${counts.placeholder_non_canonical} non-canonical`;
  }, [
    alignedHomeBlocks.length,
    alignedRealCount,
    t,
    roofSummary.data,
    roofSummary.isError,
    roofSummary.isLoading,
  ]);

  const roofTruthTone = roofSummary.data?.overallStatus ?? 'mixed_truth';

  const pulseBlock = useMemo(
    () =>
      blocks.find((b): b is Extract<HomeBlock, { id: 'aiPulseCore' }> => b.id === 'aiPulseCore'),
    [blocks]
  );

  if (loading && !blocks.length) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#060B18]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent dark:border-primary-400"
        />
      </div>
    );
  }

  if (!blocks.length) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#060B18]">
        <div className="w-full max-w-xl px-6">
          <EmptyStateInline
            message={t('myWork.radar.unavailable')}
            hint={t('myWork.radar.unavailableHint')}
            action={{
              label: t('myWork.radar.retry'),
              onClick: () => {
                void refresh();
              },
            }}
            className="border border-slate-200/70 bg-white/80 dark:border-white/[0.06] dark:bg-white/[0.03]"
          />
          {error ? (
            <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">{error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-[#060B18]">
      <BgCanvas timeMode={screen.timeMode} ambientMotion={layout.ambientMotion} />

      <div className="relative z-10 flex items-center justify-between gap-4 px-4 md:px-5 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {screen.pulseLabel || t('myWork.radar.pulseLabel')}
            {userName ? ` \u00b7 ${userName}` : ''}
          </span>
          {alignedHomeBlocks.length ? (
            <button
              type="button"
              onClick={() => setRoofMetaOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
              title={t('myWork.radar.roofExpandHint')}
            >
              {roofMetaOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {t('myWork.radar.roofModules', { count: alignedHomeBlocks.length })}
            </button>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-500">
          {new Date(screen.updatedAt).toLocaleTimeString(
            lang === 'ar' ? 'ar-SA' : `${lang}-${lang.toUpperCase()}`,
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          )}
        </span>
      </div>

      {roofMetaOpen && roofTruthStrip ? (
        <div className="relative z-10 px-4 md:px-5 pb-1">
          <div
            className={cn(
              'inline-flex max-w-full items-center gap-2 rounded border px-2 py-1 text-[9px] font-medium leading-snug',
              roofTruthTone === 'coherent'
                ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                : roofTruthTone === 'partially_coherent'
                  ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-300'
            )}
          >
            <Info className="h-3 w-3 shrink-0 text-slate-400" />
            <span className="break-words">{roofTruthStrip}</span>
          </div>
          {alignedHomeBlocks.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {alignedHomeBlocks.map((block) => (
                <span
                  key={block.blockName}
                  title={t(`myWork.radar.blockHints.${block.blockName}`, { defaultValue: '' })}
                  className="cursor-default rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider text-slate-500"
                >
                  {t(`myWork.radar.blocks.${block.blockName}`, { defaultValue: block.blockName })}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {pulseBlock ? (
        <div className="relative z-10 px-4 md:px-5 pb-2">
          <RadarExecutiveBrief block={pulseBlock} onAction={onAction} />
        </div>
      ) : null}

      {triageData.signals.length > 0 && (
        <div className="relative z-10 px-4 md:px-5 pb-3">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-white">{t('myWork.radar.triage.title')}</h2>
            <p className="text-[11px] text-slate-400">{t('myWork.radar.triage.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {triageData.signals.map((signal) => (
              <RadarTriageCard key={signal.signalId} signal={signal} onAction={onAction} />
            ))}
          </div>
        </div>
      )}

      {kpiAlerts.length > 0 && (
        <div className="relative z-10 px-4 md:px-5 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-400" />
                {t('myWork.radar.kpiAlerts.title', 'KPI Alerts')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t('myWork.radar.kpiAlerts.subtitle', 'Open deviations requiring attention')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/benefits?tab=results_kpi&mode=queue')}
              className="text-[11px] text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
            >
              {t('common.viewAll', 'View all')} <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-1.5">
            {kpiAlerts.map((alert) => (
              <button
                key={alert.signalId}
                type="button"
                onClick={() => navigate('/benefits?tab=results_kpi&mode=queue')}
                className="w-full text-left flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 transition hover:bg-white/[0.06]"
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    alert.severity === 'RED' ? 'bg-rose-500' : 'bg-amber-500'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {alert.kpiName || alert.kpiId}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{alert.description}</p>
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 tabular-nums">
                  {new Date(alert.createdAt).toLocaleDateString(lang)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentInsights.length > 0 && (
        <div className="relative z-10 px-4 md:px-5 pb-3">
          <RecentInsightsCard insights={recentInsights} isPolish={isPolish} />
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-auto px-4 md:px-5 pb-4">
        <div className="grid grid-cols-12 gap-2.5">
          {blocks.map((block) => (
            <HomeBlockErrorBoundary key={block.id}>
              {renderHomeBlock(block, onAction)}
            </HomeBlockErrorBoundary>
          ))}
        </div>
      </div>
    </div>
  );
};

function renderHomeBlock(
  block: HomeBlock,
  onAction: (action: HomeScreenAction) => void
): React.ReactNode {
  switch (block.id) {
    case 'aiPulseCore':
      return <AIPulseCore block={block} onAction={onAction} />;
    case 'momentum':
      return <MomentumBlock block={block} onAction={onAction} />;
    case 'sparkField':
      return <SparkField block={block} onAction={onAction} />;
    case 'decisionTemperature':
      return <DecisionTemperatureBlock block={block} onAction={onAction} />;
    case 'industryLens':
      return <IndustryLensBlock block={block} onAction={onAction} />;
    case 'executionCurrent':
      return <ExecutionCurrentBlock block={block} onAction={onAction} />;
    case 'teamSignal':
      return <TeamSignalBlock block={block} onAction={onAction} />;
    default:
      return null;
  }
}

function getSurfaceModeLabel(surfaceMode: string): string {
  switch (surfaceMode) {
    case 'home_v2_aggregated_with_outputs_bridge':
      return 'Home V2 aggregated + outputs bridge';
    case 'radar_overlay_with_outputs_bridge':
      return 'Radar overlay + outputs bridge';
    default:
      return surfaceMode;
  }
}

function RadarExecutiveBrief({
  block,
  onAction,
}: {
  block: Extract<HomeBlock, { id: 'aiPulseCore' }>;
  onAction: (action: HomeScreenAction) => void;
}) {
  const { t } = useTranslation();
  const payload = block.payload;
  const top = payload.focusItems?.[0];
  const headline = typeof payload.headline === 'string' ? payload.headline : '';
  const lead = headline.trim() || top?.title || '';
  if (!lead) {
    return null;
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary-300/70" />
      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-200">{lead}</p>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">
        {t('myWork.radar.pulse')}{' '}
        {typeof payload.pulseScore === 'number' ? payload.pulseScore : '\u2014'}
      </span>
      <button
        type="button"
        onClick={() =>
          onAction({
            type: 'chat',
            packet: {
              sourceBlock: 'aiPulseCore',
              intent: 'gentle_explain',
              title: t('myWork.radar.gentleExplanation'),
              starterPrompt: t('myWork.radar.explainBriefing'),
              entityType: 'home',
              entityId: 'pulse-core',
              contextData: { headline: lead, insight: payload.insight },
            },
          })
        }
        className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-white/[0.08]"
      >
        {t('myWork.radar.explain')}
      </button>
      <button
        type="button"
        onClick={() =>
          onAction({
            type: 'chat',
            packet: {
              sourceBlock: 'aiPulseCore',
              intent: 'prioritize_transformation',
              title: block.title,
              starterPrompt: t('myWork.radar.calmPlan'),
              entityType: 'home',
              entityId: 'pulse-core',
              contextData: { headline: lead, insight: payload.insight },
            },
          })
        }
        className="shrink-0 rounded bg-primary-500/80 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-primary-500"
      >
        AI
        <ArrowRight className="ml-1 inline h-3 w-3" />
      </button>
    </div>
  );
}

const BgCanvas: React.FC<{ timeMode: HomeTimeMode; ambientMotion: 'soft' | 'full' }> = ({
  timeMode,
  ambientMotion,
}) => (
  <>
    <div
      className={cn(
        'pointer-events-none absolute inset-0',
        timeMode === 'morning' &&
          'bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(250,204,21,0.08),transparent)]',
        timeMode === 'liveDay' &&
          'bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(139,92,246,0.07),transparent)]',
        timeMode === 'eveningWrap' &&
          'bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(168,85,247,0.10),transparent)]'
      )}
    />
    <motion.div
      className="pointer-events-none absolute -left-44 -top-44 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-violet-400/15 to-cyan-300/12 blur-[160px]"
      animate={
        ambientMotion === 'soft'
          ? { x: [0, 12, 0], y: [0, 10, 0], scale: [1, 1.03, 1] }
          : { x: [0, 30, -18, 0], y: [0, 22, -28, 0], scale: [1, 1.08, 0.94, 1] }
      }
      transition={{
        duration: ambientMotion === 'soft' ? 34 : 28,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
    <motion.div
      className="pointer-events-none absolute -right-36 top-[20%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-amber-300/12 to-rose-300/10 blur-[160px]"
      animate={
        ambientMotion === 'soft'
          ? { x: [0, -10, 0], y: [0, -8, 0], scale: [1, 0.98, 1] }
          : { x: [0, -26, 18, 0], y: [0, -20, 22, 0], scale: [1, 0.95, 1.07, 1] }
      }
      transition={{
        duration: ambientMotion === 'soft' ? 40 : 36,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  </>
);

const INSIGHT_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string; labelPl: string }
> = {
  draft: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Draft', labelPl: 'Szkic' },
  in_review: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    label: 'In Review',
    labelPl: 'W przeglądzie',
  },
  published: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    label: 'Published',
    labelPl: 'Opublikowany',
  },
};

const PROMPT_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
  themes: { en: 'Themes', pl: 'Tematy' },
  issues: { en: 'Issues', pl: 'Problemy' },
  opportunities: { en: 'Opportunities', pl: 'Szanse' },
  synthesis: { en: 'Synthesis', pl: 'Synteza' },
};

function RecentInsightsCard({
  insights,
  isPolish,
}: {
  insights: V8InterviewInsight[];
  isPolish: boolean;
}) {
  return (
    <div className="rounded-2xl border border-lime-400/20 bg-white/[0.025] backdrop-blur-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Lightbulb size={14} className="text-lime-400/80" />
        <h3 className="text-sm font-semibold text-white">
          {isPolish ? 'Ostatnie insighty' : 'Recent Insights'}
        </h3>
        <span className="ml-auto font-mono text-[9px] text-slate-500 uppercase tracking-wider">
          INS
        </span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {insights.map((insight) => {
          const statusMeta = INSIGHT_STATUS_STYLES[insight.status] ?? INSIGHT_STATUS_STYLES.draft;
          const promptLabel = PROMPT_TYPE_LABELS[insight.promptType];
          const insightPath = getArtifactPath('insight', insight.id);
          return (
            <a
              key={insight.id}
              href={insightPath}
              className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                  {insight.title || (isPolish ? 'Bez tytułu' : 'Untitled')}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                      statusMeta.bg,
                      statusMeta.text
                    )}
                  >
                    {isPolish ? statusMeta.labelPl : statusMeta.label}
                  </span>
                  {promptLabel && (
                    <span className="text-[9px] text-slate-500">
                      {isPolish ? promptLabel.pl : promptLabel.en}
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-600">
                {new Date(insight.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <ExternalLink
                size={10}
                className="shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors"
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}
