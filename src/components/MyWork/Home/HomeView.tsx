import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  Lightbulb,
  Newspaper,
  Sparkles,
} from 'lucide-react';
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
                (pl
                  ? 'Radar · kontekst, pomysły i spokojny kierunek'
                  : 'Radar · context, ideas, and a gentle steer')}
              {userName ? ` · ${userName}` : ''}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-gradient-to-r from-rose-500/12 to-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-rose-100/90">
              <Newspaper className="h-3 w-3 opacity-90" />
              {pl ? 'Sygnały' : 'Signals'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-gradient-to-r from-violet-500/12 to-fuchsia-500/10 px-2.5 py-0.5 text-[10px] font-medium text-violet-100/90">
              <Sparkles className="h-3 w-3 opacity-90" />
              {pl ? 'Porady' : 'Guidance'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-gradient-to-r from-amber-500/12 to-cyan-500/8 px-2.5 py-0.5 text-[10px] font-medium text-amber-100/90">
              <Lightbulb className="h-3 w-3 opacity-90" />
              {pl ? 'Iskry' : 'Sparks'}
            </span>
          </div>
          <p className="mt-1.5 max-w-[52ch] text-[11px] leading-relaxed text-slate-500 dark:text-slate-500">
            {pl
              ? 'Najpierw kontekst z rynku i lekkie inspiracje — głębsze tempo pracy i decyzje schodzą niżej, bez presji kokpitu.'
              : 'Lead with market context and light inspiration — deeper execution and decisions sit lower, without an ops-cockpit pressure.'}
          </p>
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
        <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-2">
          <span className="h-1 w-8 rounded-full bg-gradient-to-r from-cyan-400/60 via-violet-400/50 to-rose-400/50" />
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
            {pl ? 'Dziś na Radarze' : 'On the Radar today'}
          </span>
        </div>
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
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-rose-500/[0.08] via-violet-500/[0.06] to-cyan-500/[0.09] px-3 py-2.5 shadow-[0_0_28px_-8px_rgba(139,92,246,0.35)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <div className="mt-0.5 rounded-lg border border-white/12 bg-gradient-to-br from-rose-500/15 to-violet-500/15 p-1.5 text-rose-100">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-200/85">
            {pl ? 'Porada na dziś' : 'Today’s angle'}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-white">{lead}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {pl ? 'Puls' : 'Pulse'}{' '}
            <span className="tabular-nums text-slate-200">
              {typeof payload.pulseScore === 'number' ? payload.pulseScore : '—'}
            </span>
            {top ? (
              <span className="text-slate-500">
                {pl ? ' · możesz to odkryć spokojniej niżej' : ' · you can explore further below'}
              </span>
            ) : null}
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
                intent: 'gentle_explain',
                title: pl ? 'Spokojne wyjaśnienie' : 'Gentle explanation',
                starterPrompt: pl
                  ? 'Wyjaśnij ten skrót prosto i bez presji — daj mi 3 punkty: co to znaczy, dlaczego teraz, co mogę zrobić małym krokiem.'
                  : 'Explain this briefing in plain language, no pressure — 3 bullets: what it means, why now, and one small step I can take.',
                entityType: 'home',
                entityId: 'pulse-core',
                contextData: { headline: lead, insight: payload.insight },
              },
            })
          }
          className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-50 transition hover:bg-cyan-500/15"
        >
          {pl ? 'Wyjaśnij spokojnie' : 'Explain gently'}
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
                starterPrompt: pl
                  ? 'Pomóż mi poukładać ten materiał na spokojny plan — bez pogoni, krok po kroku.'
                  : 'Help me turn this into a calm, step-by-step plan — no rush.',
                entityType: 'home',
                entityId: 'pulse-core',
                contextData: { headline: lead, insight: payload.insight },
              },
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-950/35 transition hover:brightness-110"
        >
          {pl ? 'Rozmowa z AI' : 'Chat with AI'}
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
            {pl ? 'Zajrzyj do tematu' : 'Peek at topic'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAction({ type: 'navigate', target: 'ideas' })}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
          >
            {pl ? 'Pomysły' : 'Ideas'}
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
      className="pointer-events-none absolute left-[30%] top-[55%] h-[22rem] w-[22rem] rounded-full bg-gradient-to-br from-fuchsia-400/12 to-rose-400/10 blur-[120px] dark:from-fuchsia-600/14 dark:to-rose-500/12"
      animate={
        ambientMotion === 'soft'
          ? { x: [0, 10, 0], y: [0, -6, 0], opacity: [0.7, 1, 0.7] }
          : { x: [0, 18, -10, 0], y: [0, -14, 10, 0], opacity: [0.6, 1, 0.75, 0.6] }
      }
      transition={{
        duration: ambientMotion === 'soft' ? 38 : 32,
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
