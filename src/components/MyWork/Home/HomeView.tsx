import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useV8MyWorkRoofSummary } from '@/hooks/useV8MyWorkRoof';
import { cn } from '@/lib/utils';

import { AIPulseCore } from './AIPulseCore';
import { CommandDock } from './CommandDock';
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
  const { screen, blocks, layout, loading, error } = useHomeData(refreshTrigger);
  const roofSummary = useV8MyWorkRoofSummary();

  const roofTruthStrip = useMemo(() => {
    if (roofSummary.isLoading) {
      return pl ? 'Roof truth: sprawdzanie...' : 'Roof truth: checking...';
    }
    if (roofSummary.isError || !roofSummary.data) {
      return null;
    }

    const counts = roofSummary.data.counts;
    const surfaceMode = getSurfaceModeLabel(roofSummary.data.surfaceMode, pl);

    return `Roof truth: ${surfaceMode} · ${counts.backed_by_real_service} real · ${counts.partial_stitched} partial · ${counts.placeholder_non_canonical} non-canonical`;
  }, [pl, roofSummary.data, roofSummary.isError, roofSummary.isLoading]);

  const roofTruthTone = roofSummary.data?.overallStatus ?? 'mixed_truth';
  const alignedHomeBlocks = useMemo(() => {
    const homeBlocks = roofSummary.data?.homeBlocks;
    if (!homeBlocks) return [];
    return homeBlocks.filter((block) => block.maturityLevel !== 'placeholder_non_canonical');
  }, [roofSummary.data?.homeBlocks]);

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
        <p className="text-base text-red-600 dark:text-red-400">
          {error || (pl ? 'Home V2 niedostepny' : 'Home V2 unavailable')}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-[#060B18]">
      <BgCanvas timeMode={screen.timeMode} ambientMotion={layout.ambientMotion} />

      <div className="relative z-10 flex items-center justify-between px-7 pt-4 pb-2">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-slate-500 dark:text-slate-500">
            {screen.pulseLabel ||
              (pl ? 'Home V2 · ekran transformacji' : 'Home V2 · transformation screen')}
            {userName ? ` · ${userName}` : ''}
          </span>
          {roofTruthStrip ? (
            <div
              className={cn(
                'mt-1 inline-flex max-w-full items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                roofTruthTone === 'coherent'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : roofTruthTone === 'partially_coherent'
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-400/20 dark:bg-slate-500/10 dark:text-slate-300'
              )}
            >
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{roofTruthStrip}</span>
            </div>
          ) : null}
          {alignedHomeBlocks.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {alignedHomeBlocks.map((block) => (
                <span
                  key={block.blockName}
                  className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400"
                >
                  {getHomeBlockLabel(block.blockName)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="text-[12px] text-slate-400 dark:text-slate-500">
          {new Date(screen.updatedAt).toLocaleTimeString(pl ? 'pl-PL' : 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="relative z-10 flex-1 overflow-auto px-7 pb-6">
        <div className="grid grid-cols-12 gap-4">
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
    case 'commandDock':
      return <CommandDock block={block} onAction={onAction} />;
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
    case 'commandDock':
      return 'Command Dock';
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
