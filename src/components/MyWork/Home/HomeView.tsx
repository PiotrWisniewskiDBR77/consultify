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

    return `Roof truth: ${surfaceMode} \u00b7 ${realShown} real \u00b7 ${counts.partial_stitched} partial \u00b7 ${counts.placeholder_non_canonical} non-canonical`;
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

      <div className="relative z-10 flex items-center justify-between gap-4 px-4 md:px-5 pt-2.5 pb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {screen.pulseLabel ||
              (pl
                ? 'Radar \u00b7 kontekst, pomys\u0142y i spokojny kierunek'
                : 'Radar \u00b7 context, ideas, and a gentle steer')}
            {userName ? ` \u00b7 ${userName}` : ''}
          </span>
          {alignedHomeBlocks.length ? (
            <button
              type="button"
              onClick={() => setRoofMetaOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300"
              title={
                pl
                  ? 'Rozwi\u0144 lub zwi\u0144 list\u0119 modu\u0142\u00f3w roof i audyt sp\u00f3jno\u015bci danych.'
                  : 'Expand or collapse roof module list and data-coherence audit.'
              }
            >
              {roofMetaOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {pl
                ? `Roof \u00b7 ${alignedHomeBlocks.length} modu\u0142\u00f3w`
                : `Roof \u00b7 ${alignedHomeBlocks.length} modules`}
            </button>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-500">
          {new Date(screen.updatedAt).toLocaleTimeString(pl ? 'pl-PL' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
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
                  title={getHomeBlockChipHint(block.blockName, pl)}
                  className="cursor-default rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8px] font-medium uppercase tracking-wider text-slate-500"
                >
                  {getHomeBlockLabel(block.blockName)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {pulseBlock ? (
        <div className="relative z-10 px-4 md:px-5 pb-2">
          <RadarExecutiveBrief block={pulseBlock} pl={pl} onAction={onAction} />
        </div>
      ) : null}

      <div className="relative z-10 flex-1 overflow-auto px-4 md:px-5 pb-4">
        <div className="grid grid-cols-12 gap-2.5">
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
        ? 'Skr\u00f3t pulsu: headline dnia, fokus i pulse score.'
        : 'Pulse summary: headline, focus, and pulse score.';
    case 'momentum':
      return pl ? 'Tempo programu: statystyki i sygna\u0142y post\u0119pu.' : 'Program momentum: stats and progress signals.';
    case 'sparkField':
      return pl ? 'Pomys\u0142y i notatki: runtime notes oraz outputy.' : 'Ideas & notes: runtime and recent outputs.';
    case 'decisionTemperature':
      return pl ? 'Decyzje: kolejka, blokery, najgor\u0119tszy temat.' : 'Decisions: queue, blockers, hottest item.';
    case 'industryLens':
      return pl ? 'Kontekst bran\u017cowy: rynek, tech, benchmark, peer case.' : 'Industry context: market, tech, benchmark, peer case.';
    case 'executionCurrent':
      return pl ? 'Wykonanie: strumienie pracy i artefakty.' : 'Execution: work streams and artifacts.';
    case 'teamSignal':
      return pl ? 'Zesp\u00f3\u0142: alignment i sygna\u0142y organizacyjne.' : 'Team: alignment and org signals.';
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
    <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-300/70" />
      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-200">{lead}</p>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500">
        {pl ? 'Puls' : 'Pulse'}{' '}
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
              title: pl ? 'Spokojne wyja\u015bnienie' : 'Gentle explanation',
              starterPrompt: pl
                ? 'Wyja\u015bnij ten skr\u00f3t prosto i bez presji \u2014 daj mi 3 punkty: co to znaczy, dlaczego teraz, co mog\u0119 zrobi\u0107 ma\u0142ym krokiem.'
                : 'Explain this briefing in plain language, no pressure \u2014 3 bullets: what it means, why now, and one small step I can take.',
              entityType: 'home',
              entityId: 'pulse-core',
              contextData: { headline: lead, insight: payload.insight },
            },
          })
        }
        className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:bg-white/[0.08]"
      >
        {pl ? 'Wyja\u015bnij' : 'Explain'}
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
                ? 'Pom\u00f3\u017c mi pouk\u0142ada\u0107 ten materia\u0142 na spokojny plan \u2014 bez pogoni, krok po kroku.'
                : 'Help me turn this into a calm, step-by-step plan \u2014 no rush.',
              entityType: 'home',
              entityId: 'pulse-core',
              contextData: { headline: lead, insight: payload.insight },
            },
          })
        }
        className="shrink-0 rounded bg-violet-500/80 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-violet-500"
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
