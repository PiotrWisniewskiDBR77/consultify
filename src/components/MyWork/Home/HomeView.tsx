import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Lightbulb,
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
import type {
  HomeBlock,
  HomeScreenAction,
  HomeTimeMode,
  RadarMapSignal,
  RadarSignalCard,
} from './homeV2Types';
import { IndustryLensBlock } from './IndustryLensBlock';
import { MomentumBlock } from './MomentumBlock';
import { RadarTriageCard } from './RadarTriageCard';
import { SparkField } from './SparkField';
import { TeamSignalBlock } from './TeamSignalBlock';
import { useHomeData } from './useHomeData';
import { useRadarData } from './useRadarData';
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
  const radarData = useRadarData(refreshTrigger);
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

  const radarSignals = useMemo(
    () => deriveRadarSignals(radarData.data?.radarMap?.signals, radarData.data?.whatChanged),
    [radarData.data?.radarMap?.signals, radarData.data?.whatChanged]
  );
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  useEffect(() => {
    if (!radarSignals.length) {
      setSelectedSignalId(null);
      return;
    }
    if (!selectedSignalId || !radarSignals.some((signal) => signal.id === selectedSignalId)) {
      setSelectedSignalId(radarSignals[0]?.id ?? null);
    }
  }, [radarSignals, selectedSignalId]);

  const selectedSignal = useMemo(
    () => radarSignals.find((signal) => signal.id === selectedSignalId) ?? null,
    [radarSignals, selectedSignalId]
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

      <div className="relative z-10 px-4 md:px-5 pb-3">
        <div className="mb-2">
          <h2 className="text-sm font-semibold text-white">
            {t('myWork.radar.title', 'Radar')}
          </h2>
          <p className="text-[11px] text-slate-400">
            {t(
              'myWork.radar.previewSubtitle',
              'Personalized signals worth noticing — for your development, projects, industry and role.'
            )}
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.9fr_1fr] gap-3">
          <RadarCanvas
            signals={radarSignals}
            selectedSignalId={selectedSignalId}
            onSelectSignal={setSelectedSignalId}
          />
          <RadarPreviewPanel
            signal={selectedSignal}
            onAction={onAction}
          />
        </div>
      </div>

      {triageData.signals.length > 0 && (
        <div className="relative z-10 px-4 md:px-5 pb-3">
          <div className="mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t('myWork.radar.triage.title')}
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {triageData.signals.slice(0, 4).map((signal) => (
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
      className="pointer-events-none absolute -left-44 -top-44 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-primary-400/15 to-blue-300/12 blur-[160px]"
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

function deriveRadarSignals(
  mapSignals: RadarMapSignal[] | undefined,
  changedSignals: RadarSignalCard[] | undefined
): RadarMapSignal[] {
  if (Array.isArray(mapSignals) && mapSignals.length > 0) {
    return mapSignals.slice(0, 20);
  }

  const fallback = (changedSignals || []).slice(0, 16).map((signal, index) => {
    const rings: RadarMapSignal['ring'][] = ['NOW', 'PREPARE', 'LEARN', 'OBSERVE'];
    const quadrants: RadarMapSignal['quadrant'][] = [
      'MY_DEVELOPMENT',
      'MY_PROJECTS',
      'MY_INDUSTRY',
      'MY_ROLE',
    ];
    return {
      id: signal.signalId,
      name: signal.title,
      icon: signal.tags.domains[0] || 'signal',
      ring: rings[index % rings.length],
      quadrant: quadrants[index % quadrants.length],
      status: index < 3 ? 'new' : signal.finalScore > 50 ? 'updated' : 'saved',
      signalType: 'TREND',
      importanceLevel: signal.businessImpact === 'high' ? 'large' : 'medium',
      fitLevel: signal.actionability === 'high' ? 'high' : 'medium',
      preview: {
        shortDescription: signal.summary,
        whyItMatters: signal.whyItMatters,
        whyItMattersForYou: signal.whyYouSeeThis,
        howToThinkAboutIt: signal.insightSummary || signal.summary,
        goodFirstQuestion: `How does "${signal.title}" change your current project decisions?`,
        suggestedNextStep: signal.suggestedNextStep,
      },
    } satisfies RadarMapSignal;
  });

  return fallback;
}

const ringWeight: Record<RadarMapSignal['ring'], number> = {
  NOW: 0.2,
  PREPARE: 0.4,
  LEARN: 0.62,
  OBSERVE: 0.82,
};

const quadrantStart: Record<RadarMapSignal['quadrant'], number> = {
  MY_DEVELOPMENT: -Math.PI,
  MY_PROJECTS: -Math.PI / 2,
  MY_INDUSTRY: 0,
  MY_ROLE: Math.PI / 2,
};

function getSignalPosition(signal: RadarMapSignal, index: number, total: number) {
  const baseRadius = ringWeight[signal.ring];
  const quadAngle = quadrantStart[signal.quadrant];
  const spread = Math.PI / 2;
  const slot = (index % Math.max(1, total)) / Math.max(1, total);
  const angle = quadAngle + spread * (0.08 + slot * 0.84);
  const jitter = ((index % 3) - 1) * 0.02;
  const radius = Math.max(0.12, Math.min(0.9, baseRadius + jitter));
  return {
    x: 50 + Math.cos(angle) * radius * 44,
    y: 50 + Math.sin(angle) * radius * 44,
  };
}

function RadarCanvas({
  signals,
  selectedSignalId,
  onSelectSignal,
}: {
  signals: RadarMapSignal[];
  selectedSignalId: string | null;
  onSelectSignal: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="relative w-full aspect-square max-h-[620px] mx-auto overflow-hidden">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="14" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="0.5" />
          <line x1="50" y1="6" x2="50" y2="94" stroke="rgba(148,163,184,0.18)" strokeWidth="0.4" />
          <line x1="6" y1="50" x2="94" y2="50" stroke="rgba(148,163,184,0.18)" strokeWidth="0.4" />
          <text x="50" y="10" textAnchor="middle" className="fill-slate-400 text-[2.7px]">
            {t('myWork.radar.ring.observe', 'OBSERVE')}
          </text>
        </svg>
        {signals.map((signal, index) => {
          const pos = getSignalPosition(signal, index, signals.length);
          const selected = signal.id === selectedSignalId;
          return (
            <button
              key={signal.id}
              type="button"
              title={signal.name}
              onClick={() => onSelectSignal(signal.id)}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all',
                selected
                  ? 'z-20 h-4 w-4 border-primary-200 bg-primary-400 shadow-[0_0_0_4px_rgba(96,165,250,0.28)]'
                  : 'z-10 h-3 w-3 border-white/20 bg-slate-300/70 hover:bg-primary-300'
              )}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              data-testid={`radar-signal-${signal.id}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function RadarPreviewPanel({
  signal,
  onAction,
}: {
  signal: RadarMapSignal | null;
  onAction: (action: HomeScreenAction) => void;
}) {
  const { t } = useTranslation();

  if (!signal) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-slate-300">
        {t(
          'myWork.radar.selectSignalPrompt',
          'Select a signal on the radar to see why it may matter to you.'
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold text-white">{signal.name}</h3>
        <p className="text-xs text-slate-400">
          {signal.ring} · {signal.quadrant.replaceAll('_', ' ')} · {signal.status}
        </p>
      </div>
      <p className="text-xs text-slate-300">{signal.preview.shortDescription}</p>
      <div className="space-y-2">
        <SectionLabel title={t('myWork.radar.whyMatters', 'Why it matters')} body={signal.preview.whyItMatters} />
        <SectionLabel
          title={t('myWork.radar.whyForYou', 'Why it matters for you')}
          body={signal.preview.whyItMattersForYou}
        />
        <SectionLabel title={t('myWork.radar.howThink', 'How to think about it')} body={signal.preview.howToThinkAboutIt} />
        <SectionLabel title={t('myWork.radar.firstQuestion', 'Good first question')} body={signal.preview.goodFirstQuestion} />
        <SectionLabel title={t('myWork.radar.nextStep', 'Suggested next step')} body={signal.preview.suggestedNextStep} />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() =>
            onAction({
              type: 'chat',
              packet: {
                sourceBlock: 'aiPulseCore',
                intent: 'radar_signal_consult',
                title: signal.name,
                starterPrompt: `Help me analyze ${signal.name} for my current work context.`,
                entityType: 'transformation_signal',
                entityId: signal.id,
                contextData: { signal },
              },
            })
          }
          className="rounded-lg bg-primary-500/80 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-500"
        >
          {t('myWork.radar.actionTalkToTeresa', 'Talk to Teresa')}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: 'create', target: 'note' })}
          className="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.1]"
        >
          {t('myWork.radar.actionSaveNotebook', 'Save to Notebook')}
        </button>
        <button
          type="button"
          onClick={() => onAction({ type: 'create', target: 'idea' })}
          className="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.1]"
        >
          {t('myWork.radar.actionTurnIdea', 'Turn into Idea')}
        </button>
        <button
          type="button"
          onClick={() =>
            onAction({
              type: 'chat',
              packet: {
                sourceBlock: 'aiPulseCore',
                intent: 'radar_develop_thought',
                title: signal.name,
                starterPrompt: `Develop this signal into a structured thought brief: ${signal.name}.`,
                entityType: 'transformation_signal',
                entityId: signal.id,
                contextData: { signal },
              },
            })
          }
          className="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/[0.1]"
        >
          {t('myWork.radar.actionDevelopThought', 'Develop Thought')}
        </button>
        <button
          type="button"
          onClick={() =>
            onAction({
              type: 'radar_feedback',
              signalId: signal.id,
              feedback: 'watch',
              topic: signal.name,
            })
          }
          className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20"
        >
          {t('myWork.radar.actionWatch', 'Watch')}
        </button>
        <button
          type="button"
          onClick={() =>
            onAction({
              type: 'radar_feedback',
              signalId: signal.id,
              feedback: 'forget',
              topic: signal.name,
            })
          }
          className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/20"
        >
          {t('myWork.radar.actionForget', 'Forget')}
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <p className="text-xs text-slate-200 leading-relaxed">{body}</p>
    </div>
  );
}

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
