import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronRight, Info, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { useV8MyWorkRoofSummary } from '@/hooks/useV8MyWorkRoof';
import { cn } from '@/lib/utils';

import { AIPulseCore } from './AIPulseCore';
import { DecisionTemperatureBlock } from './DecisionTemperatureBlock';
import { ExecutionCurrentBlock } from './ExecutionCurrentBlock';
import type { HomeBlock, HomeScreenAction, HomeTimeMode } from './homeV2Types';
import { IndustryLensBlock } from './IndustryLensBlock';
import { MomentumBlock } from './MomentumBlock';
import { SparkField } from './SparkField';
import { TeamSignalBlock } from './TeamSignalBlock';
import { useHomeData } from './useHomeData';

interface HomeViewProps {
  userName?: string;
  refreshTrigger?: number;
  onAction: (action: HomeScreenAction) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ userName, refreshTrigger, onAction }) => {
  const { i18n } = useTranslation();
  const lang = String(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
  const pl = lang.startsWith('pl');
  const { screen, blocks, layout, loading, error, refresh } = useHomeData(refreshTrigger);
  const roofSummary = useV8MyWorkRoofSummary();
  const [roofMetaOpen, setRoofMetaOpen] = useState(false);

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
      return pl ? 'Roof truth: sprawdzanie...' : 'Roof truth: checking...';
    }
    if (roofSummary.isError || !roofSummary.data) {
      return null;
    }

    const counts = roofSummary.data.counts;
    const surfaceMode = getSurfaceModeLabel(roofSummary.data.surfaceMode, pl);
    const realShown =
      alignedHomeBlocks.length > 0 ? alignedRealCount : counts.backed_by_real_service;

    return `Roof truth: ${surfaceMode} · ${realShown} real · ${counts.partial_stitched} partial · ${counts.placeholder_non_canonical} non-canonical`;
  }, [
    alignedHomeBlocks.length,
    alignedRealCount,
    pl,
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
          className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent dark:border-violet-400"
        />
      </div>
    );
  }

  if (!blocks.length) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#060B18]">
        <div className="w-full max-w-xl px-6">
          <EmptyStateInline
            message={
              pl ? 'Radar jest chwilowo niedostepny.' : 'Radar is temporarily unavailable.'
            }
            hint={
              pl
                ? 'To nie oznacza pustego dnia. Sprobuj ponownie wczytac ekran glowny.'
                : 'This does not mean the day is empty. Retry loading the home screen.'
            }
            action={{
              label: pl ? 'Ponow' : 'Retry',
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

      <div className="relative z-10 flex items-start justify-between gap-4 px-5 md:px-6 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {screen.pulseLabel ||
                (pl ? 'Home V2 · ekran transformacji' : 'Home V2 · transformation screen')}
              {userName ? ` · ${userName}` : ''}
            </span>
          </div>
          {alignedHomeBlocks.length ? (
            <button
              type="button"
              onClick={() => setRoofMetaOpen((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-300"
              title={
                pl
                  ? 'Rozwiń lub zwiń listę modułów roof i audyt spójności danych.'
                  : 'Expand or collapse roof module list and data-coherence audit.'
              }
            >
              {roofMetaOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {pl
                ? `Roof · ${alignedHomeBlocks.length} modułów`
                : `Roof · ${alignedHomeBlocks.length} modules`}
            </button>
          ) : null}
          {roofMetaOpen && roofTruthStrip ? (
            <div
              className={cn(
                'mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-[10px] font-medium leading-snug',
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
          ) : null}
          {roofMetaOpen && alignedHomeBlocks.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {alignedHomeBlocks.map((block) => (
                <span
                  key={block.blockName}
                  title={getHomeBlockChipHint(block.blockName, pl)}
                  className="cursor-default rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-slate-400"
                >
                  {getHomeBlockLabel(block.blockName)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-500">
          {new Date(screen.updatedAt).toLocaleTimeString(pl ? 'pl-PL' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {pulseBlock ? (
        <div className="relative z-10 px-5 md:px-6 pb-3">
          <RadarExecutiveBrief block={pulseBlock} pl={pl} onAction={onAction} />
        </div>
      ) : null}

      <div className="relative z-10 flex-1 overflow-auto px-5 md:px-6 pb-5">
        <div className="grid grid-cols-12 gap-3">
          {blocks.map((block) => (
            <React.Fragment key={block.id}>{renderHomeBlock(block, onAction)}</React.Fragment>
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

function getSurfaceModeLabel(surfaceMode: string, pl: boolean): string {
  switch (surfaceMode) {
    case 'home_v2_aggregated_with_outputs_bridge':
      return pl ? 'Home V2 aggregated + outputs bridge' : 'Home V2 aggregated + outputs bridge';
    case 'radar_overlay_with_outputs_bridge':
      return pl ? 'Radar overlay + outputs bridge' : 'Radar overlay + outputs bridge';
    default:
      return surfaceMode;
  }
}

function getHomeBlockLabel(blockName: string): string {
  switch (blockName) {
    case 'aiPulseCore':
      return 'AI Pulse Core';
    case 'industryLens':
      return 'Industry Lens';
    case 'executionCurrent':
      return 'Execution Current';
    case 'sparkField':
      return 'Spark Field';
    case 'decisionTemperature':
      return 'Decision Temperature';
    case 'teamSignal':
      return 'Team Signal';
    case 'momentum':
      return 'Momentum';
    default:
      return blockName;
  }
}

function getHomeBlockChipHint(blockName: string, pl: boolean): string {
  switch (blockName) {
    case 'aiPulseCore':
      return pl
        ? 'Skrót pulsu: headline dnia, fokus i pulse score.'
        : 'Pulse summary: headline, focus, and pulse score.';
    case 'momentum':
      return pl ? 'Tempo programu: statystyki i sygnały postępu.' : 'Program momentum: stats and progress signals.';
    case 'sparkField':
      return pl ? 'Pomysły i notatki: runtime notes oraz outputy.' : 'Ideas & notes: runtime and recent outputs.';
    case 'decisionTemperature':
      return pl ? 'Decyzje: kolejka, blokery, najgorętszy temat.' : 'Decisions: queue, blockers, hottest item.';
    case 'industryLens':
      return pl ? 'Kontekst branżowy: rynek, tech, benchmark, peer case.' : 'Industry context: market, tech, benchmark, peer case.';
    case 'executionCurrent':
      return pl ? 'Wykonanie: strumienie pracy i artefakty.' : 'Execution: work streams and artifacts.';
    case 'teamSignal':
      return pl ? 'Zespół: alignment i sygnały organizacyjne.' : 'Team: alignment and org signals.';
    default:
      return '';
  }
}

function RadarExecutiveBrief({
  block,
  pl,
  onAction,
}: {
  block: Extract<HomeBlock, { id: 'aiPulseCore' }>;
  pl: boolean;
  onAction: (action: HomeScreenAction) => void;
}) {
  const payload = block.payload;
  const top = payload.focusItems?.[0];
  const headline = typeof payload.headline === 'string' ? payload.headline : '';
  const lead = headline.trim() || top?.title || '';
  if (!lead) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-cyan-500/15 bg-gradient-to-r from-cyan-500/[0.06] via-violet-500/[0.04] to-transparent px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="mt-0.5 rounded-md border border-white/10 bg-white/[0.06] p-1.5 text-cyan-200">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/80">
            {pl ? '// Radar · następny krok' : '// Radar · next move'}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-white">{lead}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
            {pl ? 'Pulse' : 'Pulse'}{' '}
            <span className="tabular-nums text-slate-200">
              {typeof payload.pulseScore === 'number' ? payload.pulseScore : '—'}
            </span>
            {top
              ? pl
                ? ` · priorytet: ${top.title}`
                : ` · priority: ${top.title}`
              : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() =>
            onAction({
              type: 'chat',
              packet: {
                sourceBlock: 'aiPulseCore',
                intent: 'prioritize_transformation',
                title: block.title,
                starterPrompt: pl
                  ? 'Przełóż ten pulse na konkretny plan działania na dziś i ten tydzień.'
                  : 'Turn this pulse into a concrete plan for today and this week.',
                entityType: 'home',
                entityId: 'pulse-core',
                contextData: { headline: lead, insight: payload.insight },
              },
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-950/40 transition hover:brightness-110"
        >
          {pl ? 'Porozmawiaj z AI' : 'Talk to AI'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        {top ? (
          <button
            type="button"
            onClick={() =>
              onAction({
                type: 'open',
                target: top.type === 'idea' ? 'idea' : top.type,
                id: top.id,
              })
            }
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
          >
            {pl ? 'Otwórz priorytet' : 'Open priority'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAction({ type: 'navigate', target: 'tasks' })}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
          >
            {pl ? 'Wykonanie' : 'Execution'}
          </button>
        )}
      </div>
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
          'bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(250,204,21,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(245,158,11,0.14),transparent)]',
        timeMode === 'liveDay' &&
          'bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(139,92,246,0.10),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(120,119,198,0.12),transparent)]',
        timeMode === 'eveningWrap' &&
          'bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(244,114,182,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(168,85,247,0.16),transparent)]'
      )}
    />
    <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:44px_44px] dark:opacity-20 dark:[background-image:linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)]" />
    <div className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay [background:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(6,182,212,0.12)_2px,rgba(6,182,212,0.12)_3px)] dark:opacity-[0.06]" />
    <motion.div
      className="pointer-events-none absolute -left-44 -top-44 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br from-violet-400/25 to-cyan-300/20 blur-[170px] dark:from-violet-600/25 dark:to-cyan-500/20"
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
      className="pointer-events-none absolute -right-36 top-[20%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-amber-300/20 to-rose-300/15 blur-[170px] dark:from-amber-500/20 dark:to-rose-400/15"
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
