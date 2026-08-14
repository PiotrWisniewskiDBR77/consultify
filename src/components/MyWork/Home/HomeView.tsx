import { motion } from 'framer-motion';
import i18n from 'i18next';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Cpu,
  ExternalLink,
  Eye,
  Lightbulb,
  MessageCircle,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Workflow,
  Wrench,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { cn } from '@/lib/utils';

import type {
  HomeScreenAction,
  HomeTimeMode,
  RadarBriefing,
  RadarMapSignal,
  RadarRing,
  RadarSignalCard,
  RadarSignalStatus,
  RadarSignalType,
} from './homeV2Types';
import { useHomeData } from './useHomeData';
import { useRadarBriefing } from './useRadarBriefing';
import { useRadarData } from './useRadarData';

interface HomeViewProps {
  userName?: string;
  refreshTrigger?: number;
  onAction: (action: HomeScreenAction) => void;
}

type StatusFilter = 'all' | RadarSignalStatus;

type QuadrantSpec = {
  key: RadarMapSignal['quadrant'];
  title: string;
  subtitle: string;
  fill: string;
  chip: string;
  accent: string;
  corner: 'tl' | 'tr' | 'br' | 'bl';
  Icon: React.ComponentType<{ className?: string }>;
  x: number;
  y: number;
};

const QUADRANTS: QuadrantSpec[] = [
  {
    key: 'MY_DEVELOPMENT',
    title: i18n.t('myWork.homeView.quadrant.myDevelopment.title', 'My Development'),
    subtitle: i18n.t('myWork.homeView.quadrant.myDevelopment.subtitle', 'what I should learn'),
    fill: 'rgba(56,189,248,0.12)',
    chip: 'text-cyan-700 dark:text-cyan-200',
    accent: '#38BDF8',
    corner: 'tl',
    Icon: UserRound,
    x: 6,
    y: 6,
  },
  {
    key: 'MY_PROJECTS',
    title: i18n.t('myWork.homeView.quadrant.myProjects.title', 'My Projects'),
    subtitle: i18n.t('myWork.homeView.quadrant.myProjects.subtitle', 'what helps current work'),
    fill: 'rgba(45,212,191,0.11)',
    chip: 'text-teal-700 dark:text-teal-200',
    accent: '#2DD4BF',
    corner: 'tr',
    Icon: Target,
    x: 50,
    y: 6,
  },
  {
    key: 'MY_INDUSTRY',
    title: i18n.t('myWork.homeView.quadrant.myIndustry.title', 'My Industry'),
    subtitle: i18n.t('myWork.homeView.quadrant.myIndustry.subtitle', 'what matters around company'),
    fill: 'rgba(217,70,239,0.11)',
    chip: 'text-fuchsia-700 dark:text-fuchsia-200',
    accent: '#D946EF',
    corner: 'br',
    Icon: Briefcase,
    x: 50,
    y: 50,
  },
  {
    key: 'MY_ROLE',
    title: i18n.t('myWork.homeView.quadrant.myRole.title', 'My Role'),
    subtitle: i18n.t('myWork.homeView.quadrant.myRole.subtitle', 'what affects responsibility'),
    fill: 'rgba(251,191,36,0.10)',
    chip: 'text-amber-700 dark:text-amber-200',
    accent: '#FBBF24',
    corner: 'bl',
    Icon: Workflow,
    x: 6,
    y: 50,
  },
];

const RING_INFO: Array<{ ring: RadarMapSignal['ring']; label: string; helper: string; y: number }> =
  [
    {
      ring: 'OBSERVE',
      label: i18n.t('myWork.homeView.ring.observe.label', 'OBSERVE'),
      helper: i18n.t('myWork.homeView.ring.observe.helper', 'keep on radar'),
      y: 10,
    },
    {
      ring: 'LEARN',
      label: i18n.t('myWork.homeView.ring.learn.label', 'LEARN'),
      helper: i18n.t('myWork.homeView.ring.learn.helper', 'build understanding'),
      y: 21.5,
    },
    {
      ring: 'PREPARE',
      label: i18n.t('myWork.homeView.ring.prepare.label', 'PREPARE'),
      helper: i18n.t('myWork.homeView.ring.prepare.helper', 'get ready'),
      y: 33,
    },
    {
      ring: 'NOW',
      label: i18n.t('myWork.homeView.ring.now.label', 'NOW'),
      helper: i18n.t('myWork.homeView.ring.now.helper', 'act or discuss now'),
      y: 44.5,
    },
  ];

const TYPE_META: Record<
  RadarSignalType,
  {
    Icon: React.ComponentType<{ className?: string }>;
    label: string;
    tone: string;
    dot: string;
  }
> = {
  TECHNOLOGY: {
    Icon: Cpu,
    label: i18n.t('myWork.homeView.signalType.technology', 'Technology'),
    tone: 'border-cyan-300/45 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    dot: 'bg-cyan-400',
  },
  SKILL: {
    Icon: Sparkles,
    label: i18n.t('myWork.homeView.signalType.skill', 'Skill'),
    tone: 'border-sky-300/45 bg-sky-50 text-sky-700 hover:bg-sky-100',
    dot: 'bg-sky-400',
  },
  BUSINESS: {
    Icon: Briefcase,
    label: i18n.t('myWork.homeView.signalType.business', 'Business'),
    tone: 'border-teal-300/45 bg-teal-50 text-teal-700 hover:bg-teal-100',
    dot: 'bg-teal-400',
  },
  RISK: {
    Icon: AlertTriangle,
    label: i18n.t('myWork.homeView.signalType.risk', 'Risk'),
    tone: 'border-fuchsia-300/45 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100',
    dot: 'bg-fuchsia-400',
  },
  PROCESS: {
    Icon: Workflow,
    label: i18n.t('myWork.homeView.signalType.process', 'Process'),
    tone: 'border-amber-300/45 bg-amber-50 text-amber-700 hover:bg-amber-100',
    dot: 'bg-amber-400',
  },
  TOOL: {
    Icon: Wrench,
    label: i18n.t('myWork.homeView.signalType.tool', 'Tool'),
    tone: 'border-indigo-300/45 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    dot: 'bg-indigo-400',
  },
  TREND: {
    Icon: TrendingUp,
    label: i18n.t('myWork.homeView.signalType.trend', 'Trend'),
    tone: 'border-violet-300/45 bg-violet-50 text-violet-700 hover:bg-violet-100',
    dot: 'bg-violet-400',
  },
  IDEA: {
    Icon: Lightbulb,
    label: i18n.t('myWork.homeView.signalType.idea', 'Idea'),
    tone: 'border-emerald-300/45 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    dot: 'bg-emerald-400',
  },
};

const TYPE_ACCENT: Record<RadarSignalType, string> = {
  TECHNOLOGY: '#22D3EE',
  SKILL: '#38BDF8',
  BUSINESS: '#2DD4BF',
  RISK: '#E879F9',
  PROCESS: '#FBBF24',
  TOOL: '#818CF8',
  TREND: '#A78BFA',
  IDEA: '#34D399',
};

const STATUS_META: Record<RadarSignalStatus, { label: string; tone: string }> = {
  new: {
    label: i18n.t('myWork.homeView.signalStatus.new', 'New'),
    tone: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-500/14 dark:text-emerald-200',
  },
  updated: {
    label: i18n.t('myWork.homeView.signalStatus.updated', 'Updated'),
    tone: 'border-sky-400/40 bg-sky-500/15 text-sky-700 dark:border-sky-400/35 dark:bg-sky-500/14 dark:text-sky-200',
  },
  saved: {
    label: i18n.t('myWork.homeView.signalStatus.saved', 'Saved'),
    tone: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-700 dark:border-indigo-400/35 dark:bg-indigo-500/14 dark:text-indigo-200',
  },
  watching: {
    label: i18n.t('myWork.homeView.signalStatus.watching', 'Watching'),
    tone: 'border-amber-400/40 bg-amber-500/15 text-amber-700 dark:border-amber-400/35 dark:bg-amber-500/14 dark:text-amber-200',
  },
  ignored: {
    label: i18n.t('myWork.homeView.signalStatus.ignored', 'Ignored'),
    tone: 'border-slate-400/40 bg-slate-500/15 text-slate-600 dark:border-slate-400/30 dark:bg-slate-500/12 dark:text-slate-600',
  },
};

const QUADRANT_START: Record<RadarMapSignal['quadrant'], number> = {
  MY_DEVELOPMENT: -Math.PI,
  MY_PROJECTS: -Math.PI / 2,
  MY_INDUSTRY: 0,
  MY_ROLE: Math.PI / 2,
};

export const HomeView: React.FC<HomeViewProps> = ({ userName, refreshTrigger, onAction }) => {
  const { t, i18n } = useTranslation();
  const { screen, blocks, layout, loading, error, refresh } = useHomeData(refreshTrigger);
  const radarData = useRadarData(refreshTrigger);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all', label: t('myWork.radar.filter.all', 'All') },
    { id: 'new', label: t('myWork.radar.filter.new', 'New') },
    { id: 'updated', label: t('myWork.radar.filter.updated', 'Updated') },
    { id: 'saved', label: t('myWork.radar.filter.saved', 'Saved') },
    { id: 'watching', label: t('myWork.radar.filter.watching', 'Watching') },
  ];
  const lastErrorToastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error || error === lastErrorToastRef.current) return;
    lastErrorToastRef.current = error;
    toast.error(t('myWork.radar.loadErrorToast', 'Radar could not load. Showing recovery state.'));
  }, [error, t]);

  const radarSignalsAll = useMemo(
    () => deriveRadarSignals(radarData.data?.radarMap?.signals, radarData.data?.whatChanged),
    [radarData.data?.radarMap?.signals, radarData.data?.whatChanged]
  );

  const statusCounts = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      all: radarSignalsAll.length,
      new: 0,
      updated: 0,
      saved: 0,
      watching: 0,
      ignored: 0,
    };
    for (const signal of radarSignalsAll) {
      map[signal.status] = (map[signal.status] || 0) + 1;
    }
    return map;
  }, [radarSignalsAll]);

  const radarSignals = useMemo(() => {
    if (statusFilter === 'all') return radarSignalsAll;
    return radarSignalsAll.filter((signal) => signal.status === statusFilter);
  }, [radarSignalsAll, statusFilter]);

  const [selectedSignalId, setSelectedSignalId] = useState<string | null>('sig-ai-agents');

  useEffect(() => {
    if (!radarSignals.length) {
      setSelectedSignalId(null);
      return;
    }
    if (selectedSignalId && radarSignals.some((signal) => signal.id === selectedSignalId)) {
      return;
    }
    const defaultSignal = radarSignals.find((signal) => signal.id === 'sig-ai-agents');
    setSelectedSignalId(defaultSignal?.id ?? radarSignals[0].id);
  }, [radarSignals, selectedSignalId]);

  const selectedSignal = useMemo(
    () => radarSignals.find((signal) => signal.id === selectedSignalId) ?? null,
    [radarSignals, selectedSignalId]
  );

  if (loading && !blocks.length) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#0B1220]">
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
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#0B1220]">
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

  const lang = String(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-[#070B14]">
      <BgCanvas timeMode={screen.timeMode} ambientMotion={layout.ambientMotion} />

      <div className="relative z-10 flex items-center justify-between gap-4 px-4 md:px-5 pt-2.5 pb-1.5">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
          {screen.pulseLabel || t('myWork.radar.pulseLabel')}
          {userName ? ` · ${userName}` : ''}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-500">
          {new Date(screen.updatedAt).toLocaleTimeString(
            lang === 'ar' ? 'ar-SA' : `${lang}-${lang.toUpperCase()}`,
            { hour: '2-digit', minute: '2-digit' }
          )}
        </span>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-4 md:px-5">
        <div className="mb-2.5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('myWork.radar.title', 'Your Radar')}
            </h2>
            <p className="mt-0.5 max-w-3xl text-[12px] text-slate-600 dark:text-slate-400">
              {t(
                'myWork.radar.description',
                'A personal map of signals worth your attention — across your development, projects, industry and role.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((filter) => {
              const active = filter.id === statusFilter;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                    active
                      ? 'border-primary-400/60 bg-primary-500/15 text-primary-700 dark:border-primary-300/60 dark:bg-primary-500/20 dark:text-primary-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/[0.08]'
                  )}
                >
                  {filter.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[10px] tabular-nums',
                      active
                        ? 'bg-primary-500/20 text-primary-700 dark:bg-primary-400/30 dark:text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                    )}
                  >
                    {statusCounts[filter.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {radarSignalsAll.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-2xl border border-slate-200/70 bg-white px-8 py-10 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] dark:shadow-none">
              <Radar className="mx-auto mb-3 h-9 w-9 text-primary-500/70 dark:text-primary-300/70" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {t('myWork.radar.empty')}
              </p>
              <p className="mt-1.5 text-[12px] text-slate-600 dark:text-slate-400">
                {t('myWork.radar.emptyHint')}
              </p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/[0.1]"
              >
                {t('myWork.radar.retry')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[2.2fr_1fr]">
            <RadarCanvas
              signals={radarSignals}
              selectedSignalId={selectedSignalId}
              onSelectSignal={setSelectedSignalId}
              ambientMotion={layout.ambientMotion}
            />
            <RadarPreviewPanel signal={selectedSignal} onAction={onAction} />
          </div>
        )}
      </div>
    </div>
  );
};

const BgCanvas: React.FC<{ timeMode: HomeTimeMode; ambientMotion: 'soft' | 'full' }> = ({
  timeMode,
  ambientMotion,
}) => (
  <>
    <div
      className={cn(
        'pointer-events-none absolute inset-0',
        timeMode === 'morning' &&
          'bg-[radial-gradient(ellipse_80%_55%_at_50%_-8%,rgba(250,204,21,0.08),transparent)]',
        timeMode === 'liveDay' &&
          'bg-[radial-gradient(ellipse_80%_55%_at_50%_-8%,rgba(165,28,48,0.08),transparent)]',
        timeMode === 'eveningWrap' &&
          'bg-[radial-gradient(ellipse_80%_55%_at_50%_-8%,rgba(168,85,247,0.11),transparent)]'
      )}
    />
    <motion.div
      className="pointer-events-none absolute -left-44 -top-44 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-primary-400/14 to-blue-300/10 blur-[160px]"
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
  </>
);

function deriveRadarSignals(
  mapSignals: RadarMapSignal[] | undefined,
  changedSignals: RadarSignalCard[] | undefined
): RadarMapSignal[] {
  if (Array.isArray(mapSignals) && mapSignals.length > 0) {
    return mapSignals.slice(0, 24).map((signal) => {
      const preview = signal.preview ?? ({} as RadarMapSignal['preview']);
      return {
        ...signal,
        name: shortenSignalName(signal.name),
        preview: {
          ...preview,
          shortDescription: clampText(preview.shortDescription, 120),
        },
      };
    });
  }

  if (!changedSignals || changedSignals.length === 0) {
    // No real radar data and nothing changed — return an empty set so the view
    // renders a purposeful empty state (never the prototype sample signals).
    return [];
  }

  const rings: RadarMapSignal['ring'][] = ['NOW', 'PREPARE', 'LEARN', 'OBSERVE'];
  const quadrants: RadarMapSignal['quadrant'][] = [
    'MY_DEVELOPMENT',
    'MY_PROJECTS',
    'MY_INDUSTRY',
    'MY_ROLE',
  ];

  return changedSignals.slice(0, 20).map((signal, index) => ({
    id: signal.signalId,
    name: shortenSignalName(signal.title),
    icon: signal.tags.domains[0] || 'signal',
    ring: rings[index % rings.length],
    quadrant: quadrants[index % quadrants.length],
    status: index < 4 ? 'new' : signal.finalScore > 52 ? 'updated' : 'saved',
    signalType: index % 2 === 0 ? 'TECHNOLOGY' : 'PROCESS',
    importanceLevel: signal.businessImpact === 'high' ? 'large' : 'medium',
    fitLevel: signal.actionability === 'high' ? 'high' : 'medium',
    preview: {
      shortDescription: clampText(signal.summary, 120),
      whyItMatters: clampText(signal.whyItMatters, 180),
      whyItMattersForYou: clampText(signal.whyYouSeeThis, 180),
      howToThinkAboutIt: clampText(signal.insightSummary || signal.summary, 180),
      goodFirstQuestion: `What changes first if ${shortenSignalName(signal.title)} matters now?`,
      suggestedNextStep: clampText(signal.suggestedNextStep, 180),
    },
  }));
}

function shortenSignalName(name: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'Signal';
  const words = trimmed.split(/\s+/).slice(0, 2);
  const short = words.join(' ');
  return short.length > 22 ? `${short.slice(0, 21)}…` : short;
}

function clampText(value: string, max: number): string {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

type SignalPosition = { x: number; y: number; angle: number; radius: number };

// Radial bands aligned with the drawn horizon rings (r = 11.5 / 23 / 34.5 / 46,
// expressed as a fraction of the outer radius). A signal sits inside its ring's
// band; its exact distance from centre is set by the real relevance score, so
// "closer to the core" literally means "more urgent / higher fit".
const RING_BAND: Record<RadarRing, [number, number]> = {
  NOW: [0.15, 0.235],
  PREPARE: [0.28, 0.47],
  LEARN: [0.53, 0.71],
  OBSERVE: [0.78, 0.95],
};
const RING_ORDER: Record<RadarRing, number> = { NOW: 0, PREPARE: 1, LEARN: 2, OBSERVE: 3 };
const RADAR_R = 46; // outer ring radius in the 0–100 viewBox

function computeSignalLayout(signals: RadarMapSignal[]): Map<string, SignalPosition> {
  const scores = signals.map((s) => s.score ?? 0);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const maxScore = scores.length ? Math.max(...scores) : 1;
  const range = Math.max(1, maxScore - minScore);

  const byQuadrant = new Map<RadarMapSignal['quadrant'], RadarMapSignal[]>();
  for (const signal of signals) {
    const bucket = byQuadrant.get(signal.quadrant) ?? [];
    bucket.push(signal);
    byQuadrant.set(signal.quadrant, bucket);
  }

  const layout = new Map<string, SignalPosition>();
  const spread = Math.PI / 2;

  byQuadrant.forEach((bucket, quadrant) => {
    const quadAngle = QUADRANT_START[quadrant];
    // Stable, meaningful arrangement: by horizon (NOW first), then score.
    const ordered = [...bucket].sort(
      (a, b) => RING_ORDER[a.ring] - RING_ORDER[b.ring] || (b.score ?? 0) - (a.score ?? 0)
    );
    const count = ordered.length;
    ordered.forEach((signal, i) => {
      // Even angular slots with padding from both quadrant edges (collision-safe).
      const slot = count === 1 ? 0.5 : i / (count - 1);
      const angle = quadAngle + spread * (0.12 + slot * 0.76);
      // Radius within the ring band, refined by real score (high score → inner edge).
      const [inner, outer] = RING_BAND[signal.ring];
      const norm = ((signal.score ?? 0) - minScore) / range; // 0..1
      const radius = outer - norm * (outer - inner);
      layout.set(signal.id, {
        x: 50 + Math.cos(angle) * radius * RADAR_R,
        y: 50 + Math.sin(angle) * radius * RADAR_R,
        angle,
        radius,
      });
    });
  });

  return layout;
}

// Tracks the app's class-based dark mode so the radar markers can render a
// light, frosted style on the light canvas and a glassy dark style on the dark one.
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function RadarCanvas({
  signals,
  selectedSignalId,
  onSelectSignal,
  ambientMotion,
}: {
  signals: RadarMapSignal[];
  selectedSignalId: string | null;
  onSelectSignal: (id: string) => void;
  ambientMotion: 'soft' | 'full';
}) {
  const isDark = useIsDark();
  const layout = useMemo(() => computeSignalLayout(signals), [signals]);
  const selectedSignal =
    signals.find((signal) => signal.id === selectedSignalId) ?? signals[0] ?? null;
  const selectedPosition = selectedSignal ? (layout.get(selectedSignal.id) ?? null) : null;
  const sectors = useMemo(
    () =>
      QUADRANTS.map((q) => {
        const a0 = QUADRANT_START[q.key];
        const a1 = a0 + Math.PI / 2;
        const R = 46;
        const p0x = 50 + R * Math.cos(a0);
        const p0y = 50 + R * Math.sin(a0);
        const p1x = 50 + R * Math.cos(a1);
        const p1y = 50 + R * Math.sin(a1);
        return {
          key: q.key,
          fill: q.fill,
          d: `M50,50 L${p0x.toFixed(2)},${p0y.toFixed(2)} A${R},${R} 0 0 1 ${p1x.toFixed(2)},${p1y.toFixed(2)} Z`,
        };
      }),
    []
  );

  const handleCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!signals.length) return;
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const current = Math.max(
      0,
      signals.findIndex((signal) => signal.id === selectedSignalId)
    );
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = (current + delta + signals.length) % signals.length;
    onSelectSignal(signals[next].id);
  };

  const cornerClass: Record<QuadrantSpec['corner'], string> = {
    tl: 'left-2.5 top-2.5 items-start text-left',
    tr: 'right-2.5 top-2.5 items-end text-right',
    br: 'right-2.5 bottom-2.5 items-end text-right',
    bl: 'left-2.5 bottom-2.5 items-start text-left',
  };

  return (
    <div className="relative flex h-full min-h-[620px] flex-col gap-2 overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-3 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)] dark:border-white/10 dark:from-[#0A1122] dark:to-[#06080F] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-24px_rgba(0,0,0,0.8)]">
      <div
        className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200/70 bg-[radial-gradient(circle_at_50%_46%,rgba(56,130,246,0.10),transparent_62%)] dark:border-white/[0.06] dark:bg-[radial-gradient(circle_at_50%_46%,rgba(56,130,246,0.14),transparent_62%)]"
        tabIndex={0}
        onKeyDown={handleCanvasKeyDown}
        aria-label={i18n.t('myWork.homeView.radarCanvasAriaLabel', 'Radar canvas')}
      >
        {/* Ambient depth: vignette + soft core bloom */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,transparent_45%,rgba(148,163,184,0.18))] dark:bg-[radial-gradient(circle_at_50%_46%,transparent_40%,rgba(3,5,12,0.75))]" />

        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="radarSweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(96,165,250,0)" />
              <stop offset="62%" stopColor="rgba(96,165,250,0.10)" />
              <stop offset="100%" stopColor="rgba(125,211,252,0.42)" />
            </linearGradient>
            <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(186,230,253,0.95)" />
              <stop offset="45%" stopColor="rgba(56,189,248,0.55)" />
              <stop offset="100%" stopColor="rgba(56,189,248,0)" />
            </radialGradient>
          </defs>

          {/* Quadrant sectors */}
          {sectors.map((s) => (
            <path key={s.key} d={s.d} fill={s.fill} />
          ))}

          {/* Concentric horizon rings */}
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            className="stroke-[rgba(100,116,139,0.45)] dark:stroke-[rgba(148,163,184,0.30)]"
            strokeWidth="0.4"
          />
          <circle
            cx="50"
            cy="50"
            r="34.5"
            fill="none"
            className="stroke-[rgba(100,116,139,0.32)] dark:stroke-[rgba(148,163,184,0.18)]"
            strokeWidth="0.3"
            strokeDasharray="0.6 0.9"
          />
          <circle
            cx="50"
            cy="50"
            r="23"
            fill="none"
            className="stroke-[rgba(100,116,139,0.30)] dark:stroke-[rgba(148,163,184,0.16)]"
            strokeWidth="0.3"
            strokeDasharray="0.6 0.9"
          />
          <circle
            cx="50"
            cy="50"
            r="11.5"
            fill="none"
            className="stroke-[rgba(14,165,233,0.45)] dark:stroke-[rgba(125,211,252,0.28)]"
            strokeWidth="0.35"
          />

          {/* Axis cross */}
          <line
            x1="50"
            y1="4"
            x2="50"
            y2="96"
            className="stroke-[rgba(100,116,139,0.28)] dark:stroke-[rgba(148,163,184,0.16)]"
            strokeWidth="0.28"
          />
          <line
            x1="4"
            y1="50"
            x2="96"
            y2="50"
            className="stroke-[rgba(100,116,139,0.28)] dark:stroke-[rgba(148,163,184,0.16)]"
            strokeWidth="0.28"
          />

          {/* Sonar pulses from the core */}
          {[0, 2, 4].map((delay) => (
            <circle
              key={delay}
              cx="50"
              cy="50"
              r="11.5"
              fill="none"
              stroke="rgba(125,211,252,0.5)"
              strokeWidth="0.4"
            >
              <animate
                attributeName="r"
                values="6;46"
                dur="6s"
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.5;0"
                dur="6s"
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-width"
                values="0.5;0.1"
                dur="6s"
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}

          {/* Rotating sweep */}
          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur={`${ambientMotion === 'soft' ? 22 : 15}s`}
              repeatCount="indefinite"
            />
            <path
              d="M50,50 L96,50 A46,46 0 0,0 76.5,11.4 Z"
              fill="url(#radarSweep)"
              opacity="0.7"
            />
            <line
              x1="50"
              y1="50"
              x2="96"
              y2="50"
              stroke="rgba(125,211,252,0.55)"
              strokeWidth="0.3"
            />
          </g>

          {/* Glowing core */}
          <circle cx="50" cy="50" r="6.5" fill="url(#coreGlow)" opacity="0.85" />
          <circle cx="50" cy="50" r="1.5" fill="#E0F2FE" />

          {/* Beam from core to the selected signal */}
          {selectedPosition && (
            <g>
              <line
                x1="50"
                y1="50"
                x2={selectedPosition.x}
                y2={selectedPosition.y}
                stroke="rgba(186,230,253,0.55)"
                strokeWidth="0.45"
                strokeDasharray="1.4 1"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="0;-4.8"
                  dur="0.9s"
                  repeatCount="indefinite"
                />
              </line>
            </g>
          )}

          {/* Ring labels along the upper axis */}
          {RING_INFO.map((ring) => (
            <text
              key={ring.ring}
              x="51"
              y={ring.y}
              textAnchor="start"
              className="fill-slate-600 dark:fill-slate-300 text-[2.1px] font-medium tracking-[0.18em]"
            >
              {ring.label}
            </text>
          ))}
        </svg>

        {/* Quadrant corner labels */}
        {QUADRANTS.map((q) => {
          const Icon = q.Icon;
          return (
            <div
              key={`${q.key}-label`}
              className={cn(
                'pointer-events-none absolute flex flex-col gap-0.5 rounded-lg border border-slate-200/80 bg-white/85 px-2 py-1.5 backdrop-blur-sm dark:border-white/[0.08] dark:bg-slate-950/45',
                cornerClass[q.corner]
              )}
            >
              <div
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider',
                  q.chip
                )}
              >
                <Icon className="h-3 w-3" />
                {q.title}
              </div>
              <div className="text-[9px] text-slate-500 dark:text-slate-400">{q.subtitle}</div>
            </div>
          );
        })}

        {/* Signal pucks */}
        {signals.map((signal, index) => {
          const position = layout.get(signal.id);
          if (!position) return null;
          const selected = signal.id === selectedSignalId;
          const typeMeta = TYPE_META[signal.signalType] ?? TYPE_META.TREND;
          const accent = TYPE_ACCENT[signal.signalType] ?? '#A78BFA';
          const Icon = typeMeta.Icon;
          const base =
            signal.importanceLevel === 'large' ? 34 : signal.importanceLevel === 'small' ? 26 : 30;
          const size = selected ? base + 8 : base;

          // Theme-aware marker: a frosted white chip with a vivid coloured icon and
          // a soft coloured glow on the light canvas; a glassy dark gem on the dark
          // canvas. Selected = a saturated accent-filled chip that pops.
          const iconColor = selected ? (isDark ? '#0B1220' : '#FFFFFF') : accent;
          const markerBg = selected
            ? isDark
              ? 'linear-gradient(150deg, #FFFFFF 0%, #E6F0FF 100%)'
              : `linear-gradient(155deg, ${accent} 0%, ${accent}DB 100%)`
            : isDark
              ? `linear-gradient(150deg, ${accent}3A 0%, rgba(12,17,28,0.96) 72%)`
              : `linear-gradient(155deg, #FFFFFF 0%, ${accent}1F 100%)`;
          const markerBorder = selected
            ? isDark
              ? 'rgba(255,255,255,0.92)'
              : '#FFFFFF'
            : isDark
              ? `${accent}66`
              : `${accent}7A`;
          const markerShadow = selected
            ? isDark
              ? `0 0 0 3px rgba(255,255,255,0.16), 0 8px 22px -6px ${accent}, 0 2px 6px rgba(0,0,0,0.55)`
              : `0 0 0 3px ${accent}33, 0 10px 22px -6px ${accent}, 0 2px 6px rgba(15,23,42,0.22)`
            : isDark
              ? `0 6px 16px -5px ${accent}AA, inset 0 1px 0 rgba(255,255,255,0.14)`
              : `0 5px 14px -4px ${accent}66, 0 1px 2px rgba(15,23,42,0.12), inset 0 1px 0 #FFFFFF`;
          const pipBorder = isDark ? '#020617' : '#FFFFFF';

          return (
            <motion.button
              key={signal.id}
              type="button"
              onClick={() => onSelectSignal(signal.id)}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.35) }}
              whileHover={{ scale: 1.12, zIndex: 30 }}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${position.x}%`, top: `${position.y}%`, zIndex: selected ? 20 : 10 }}
              data-testid={`radar-signal-${signal.id}`}
            >
              <span
                className="relative flex items-center justify-center transition-transform"
                style={{
                  width: size,
                  height: size,
                  borderRadius: '34%',
                  border: `1px solid ${markerBorder}`,
                  background: markerBg,
                  color: iconColor,
                  boxShadow: markerShadow,
                }}
                title={`${signal.name} · ${signal.ring} · ${signal.quadrant.replaceAll('_', ' ')}`}
              >
                <Icon
                  className={cn(
                    'drop-shadow-sm',
                    selected || signal.importanceLevel === 'large' ? 'h-4 w-4' : 'h-3.5 w-3.5'
                  )}
                />
                {selected && (
                  <motion.span
                    className="absolute inset-0"
                    style={{ borderRadius: '34%' }}
                    animate={{ boxShadow: [`0 0 0 0 ${accent}80`, `0 0 0 12px ${accent}00`] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                {!selected && (signal.status === 'new' || signal.status === 'updated') && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: signal.status === 'new' ? '#34D399' : '#38BDF8',
                      border: `1.5px solid ${pipBorder}`,
                      boxShadow: `0 0 6px ${signal.status === 'new' ? '#34D399' : '#38BDF8'}`,
                    }}
                  />
                )}
              </span>

              <span
                className={cn(
                  'pointer-events-none absolute bottom-[128%] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 shadow-lg transition-opacity',
                  selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
              >
                {signal.name}
              </span>
            </motion.button>
          );
        })}

        {/* Selected signal info card */}
        {selectedSignal && (
          <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-1.5 text-center text-[11px] text-slate-100 shadow-lg backdrop-blur-sm">
            <div className="font-semibold">{selectedSignal.name}</div>
            <div className="text-[10px] text-slate-400">
              {selectedSignal.ring} · {quadrantTitle(selectedSignal.quadrant)}
            </div>
          </div>
        )}

        {!signals.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            No signals match the current filter.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200/70 bg-white/70 px-2.5 py-2 text-[10px] text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-400">
        <div className="truncate">
          <span className="text-slate-500 dark:text-slate-500">
            {i18n.t('myWork.homeView.howToReadLabel', 'How to read:')}
          </span>{' '}
          {i18n.t(
            'myWork.homeView.howToReadBody',
            'closer to centre = more urgent · ring = time horizon · quadrant = life area · size = business impact'
          )}
        </div>
        <div className="mt-0.5 truncate">
          <span className="text-slate-500 dark:text-slate-500">
            {i18n.t('myWork.homeView.horizonLabel', 'Horizon:')}
          </span>{' '}
          {i18n.t('myWork.homeView.horizonBody', 'Now · Prepare · Learn · Observe')}
        </div>
      </div>
    </div>
  );
}

function quadrantTitle(quadrant: RadarMapSignal['quadrant']): string {
  const found = QUADRANTS.find((item) => item.key === quadrant);
  return found?.title ?? quadrant.replaceAll('_', ' ');
}

function RadarPreviewPanel({
  signal,
  onAction,
}: {
  signal: RadarMapSignal | null;
  onAction: (action: HomeScreenAction) => void;
}) {
  const { briefing, loading } = useRadarBriefing(signal?.id ?? null);

  if (!signal) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-slate-500 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-400">
        Pick a signal on the radar to see why it may matter to you right now.
      </div>
    );
  }

  const typeMeta = TYPE_META[signal.signalType] ?? TYPE_META.TREND;
  const statusMeta = STATUS_META[signal.status] ?? STATUS_META.new;
  const Icon = typeMeta.Icon;

  const preview = signal.preview ?? ({} as RadarMapSignal['preview']);
  // Some signals arrive without enriched copy (fallback ingestion / localization
  // still pending). Provide sensible defaults so the panel never renders blank.
  const shortDescription =
    String(preview.shortDescription || '').trim() ||
    `${signal.name} — ${quadrantTitle(signal.quadrant)} signal on your radar.`;
  const whyItMattersForYou =
    String(preview.whyItMattersForYou || '').trim() ||
    `Flagged in your ${quadrantTitle(signal.quadrant)} quadrant at the ${signal.ring} ring.`;

  return (
    <motion.div
      key={signal.id}
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-4 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.25)] dark:border-white/[0.08] dark:from-[#0E1626] dark:to-[#090F1A] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_60px_-24px_rgba(0,0,0,0.8)]"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl border',
            typeMeta.tone
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-tight text-slate-900 dark:text-white">
            {signal.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{signal.ring}</Badge>
            <Badge>{quadrantTitle(signal.quadrant)}</Badge>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>
          {signal.sourceName ? (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-500">
              <span className="truncate">Source: {signal.sourceName}</span>
              {signal.sourceUrl ? (
                <a
                  href={signal.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-200"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ) : null}
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
            {shortDescription}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-primary-400/30 bg-primary-500/10 p-3 dark:border-primary-400/20">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-200">
          Why this is on your radar
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-primary-900/80 dark:text-primary-50/90">
          {whyItMattersForYou}
        </p>
      </div>

      <TeresaBriefing
        briefing={briefing}
        loading={loading}
        preview={preview}
        shortDescription={shortDescription}
      />

      <div className="mt-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-2.5 dark:border-white/10 dark:bg-white/[0.02]">
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
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-500/50 bg-gradient-to-r from-primary-600 to-primary-500 px-3 py-2 text-[12px] font-medium text-white transition hover:from-primary-700 hover:to-primary-600 dark:border-primary-300/50 dark:from-primary-500/35 dark:to-primary-400/25 dark:text-primary-50 dark:hover:from-primary-500/45 dark:hover:to-primary-400/35"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Talk to Teresa
        </button>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <ActionChip
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Save to Notebook"
            onClick={() => onAction({ type: 'create', target: 'note' })}
          />
          <ActionChip
            icon={<Lightbulb className="h-3.5 w-3.5" />}
            label="Create Idea"
            onClick={() => onAction({ type: 'create', target: 'idea' })}
          />
          <ActionChip
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Explore Deeper"
            onClick={() =>
              onAction({
                type: 'chat',
                packet: {
                  sourceBlock: 'aiPulseCore',
                  intent: 'radar_develop_thought',
                  title: signal.name,
                  starterPrompt: `Explore deeper insights for ${signal.name}.`,
                  entityType: 'transformation_signal',
                  entityId: signal.id,
                  contextData: { signal },
                },
              })
            }
          />
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <ActionChip
            icon={<Eye className="h-3.5 w-3.5" />}
            label="Watch Topic"
            tone="subtle"
            onClick={() =>
              onAction({
                type: 'radar_feedback',
                signalId: signal.id,
                feedback: 'watch',
                topic: signal.name,
              })
            }
          />
          <ActionChip
            icon={<XCircle className="h-3.5 w-3.5" />}
            label="Not Relevant"
            tone="subtle"
            onClick={() =>
              onAction({
                type: 'radar_feedback',
                signalId: signal.id,
                feedback: 'forget',
                topic: signal.name,
              })
            }
          />
        </div>
      </div>
    </motion.div>
  );
}

function ShimmerLines() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-2 w-20 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
          <div className="h-2 w-full animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
          <div className="h-2 w-4/5 animate-pulse rounded bg-slate-100 dark:bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

function TeresaBriefing({
  briefing,
  loading,
  preview,
  shortDescription,
}: {
  briefing: RadarBriefing | null;
  loading: boolean;
  preview: RadarMapSignal['preview'];
  shortDescription: string;
}) {
  // AI briefing when available; otherwise the sharp deterministic baseline.
  const items = briefing
    ? [
        {
          title: i18n.t('myWork.homeView.briefing.whatItReallyIs', 'What it really is'),
          body: briefing.whatItIs,
        },
        {
          title: i18n.t('myWork.homeView.briefing.whyItMattersForYou', 'Why it matters for you'),
          body: briefing.whyItMattersForYou,
        },
        {
          title: i18n.t('myWork.homeView.briefing.goodFirstQuestion', 'Good first question'),
          body: briefing.goodFirstQuestion,
        },
        {
          title: i18n.t('myWork.homeView.briefing.suggestedNextStep', 'Suggested next step'),
          body: briefing.suggestedNextStep,
        },
      ]
    : [
        {
          title: i18n.t('myWork.homeView.briefing.whatItIs', 'What it is'),
          body: shortDescription,
        },
        {
          title: i18n.t('myWork.homeView.briefing.whyItMatters', 'Why it matters'),
          body: preview.whyItMatters,
        },
        {
          title: i18n.t('myWork.homeView.briefing.whyItMattersForYou', 'Why it matters for you'),
          body: preview.whyItMattersForYou,
        },
        {
          title: i18n.t('myWork.homeView.briefing.howToThinkAboutIt', 'How to think about it'),
          body: preview.howToThinkAboutIt,
        },
        {
          title: i18n.t('myWork.homeView.briefing.goodFirstQuestion', 'Good first question'),
          body: preview.goodFirstQuestion,
        },
        {
          title: i18n.t('myWork.homeView.briefing.suggestedNextStep', 'Suggested next step'),
          body: preview.suggestedNextStep,
        },
      ];

  return (
    <div className="mt-3 flex-1 overflow-auto rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary-500 dark:text-primary-300" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-200">
          Teresa
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-500">
          {loading ? '· reading this signal…' : briefing ? '· AI briefing' : '· quick read'}
        </span>
      </div>
      {loading ? (
        <ShimmerLines />
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <Section key={`${index}:${item.title}`} title={item.title} body={item.body} />
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={cn(
        'rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-300',
        tone
      )}
    >
      {children}
    </span>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  const text = clampText(body, 220);
  // Skip empty rows so the panel never shows a labelled section with no content
  // (the source signal may not have every preview field populated yet).
  if (!text) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </div>
      <p className="text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">{text}</p>
    </div>
  );
}

function ActionChip({
  icon,
  label,
  onClick,
  tone = 'normal',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'normal' | 'subtle';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition',
        tone === 'normal' &&
          'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.1]',
        tone === 'subtle' &&
          'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400 dark:hover:bg-white/[0.08]'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
