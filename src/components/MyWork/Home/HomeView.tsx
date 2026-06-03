import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  Cpu,
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
  RadarMapSignal,
  RadarSignalCard,
  RadarSignalStatus,
  RadarSignalType,
} from './homeV2Types';
import { useHomeData } from './useHomeData';
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
  Icon: React.ComponentType<{ className?: string }>;
  x: number;
  y: number;
};

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'updated', label: 'Updated' },
  { id: 'saved', label: 'Saved' },
  { id: 'watching', label: 'Watching' },
];

const QUADRANTS: QuadrantSpec[] = [
  {
    key: 'MY_DEVELOPMENT',
    title: 'My Development',
    subtitle: 'what I should learn',
    fill: 'rgba(56,189,248,0.12)',
    chip: 'text-cyan-200',
    Icon: UserRound,
    x: 6,
    y: 6,
  },
  {
    key: 'MY_PROJECTS',
    title: 'My Projects',
    subtitle: 'what helps current work',
    fill: 'rgba(45,212,191,0.11)',
    chip: 'text-teal-200',
    Icon: Target,
    x: 50,
    y: 6,
  },
  {
    key: 'MY_INDUSTRY',
    title: 'My Industry',
    subtitle: 'what matters around company',
    fill: 'rgba(217,70,239,0.11)',
    chip: 'text-fuchsia-200',
    Icon: Briefcase,
    x: 50,
    y: 50,
  },
  {
    key: 'MY_ROLE',
    title: 'My Role',
    subtitle: 'what affects responsibility',
    fill: 'rgba(251,191,36,0.10)',
    chip: 'text-amber-200',
    Icon: Workflow,
    x: 6,
    y: 50,
  },
];

const RING_INFO: Array<{ ring: RadarMapSignal['ring']; label: string; helper: string; y: number }> =
  [
    { ring: 'OBSERVE', label: 'OBSERVE', helper: 'keep on radar', y: 10 },
    { ring: 'LEARN', label: 'LEARN', helper: 'build understanding', y: 21.5 },
    { ring: 'PREPARE', label: 'PREPARE', helper: 'get ready', y: 33 },
    { ring: 'NOW', label: 'NOW', helper: 'act or discuss now', y: 44.5 },
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
    label: 'Technology',
    tone: 'border-cyan-300/45 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    dot: 'bg-cyan-400',
  },
  SKILL: {
    Icon: Sparkles,
    label: 'Skill',
    tone: 'border-sky-300/45 bg-sky-50 text-sky-700 hover:bg-sky-100',
    dot: 'bg-sky-400',
  },
  BUSINESS: {
    Icon: Briefcase,
    label: 'Business',
    tone: 'border-teal-300/45 bg-teal-50 text-teal-700 hover:bg-teal-100',
    dot: 'bg-teal-400',
  },
  RISK: {
    Icon: AlertTriangle,
    label: 'Risk',
    tone: 'border-fuchsia-300/45 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100',
    dot: 'bg-fuchsia-400',
  },
  PROCESS: {
    Icon: Workflow,
    label: 'Process',
    tone: 'border-amber-300/45 bg-amber-50 text-amber-700 hover:bg-amber-100',
    dot: 'bg-amber-400',
  },
  TOOL: {
    Icon: Wrench,
    label: 'Tool',
    tone: 'border-indigo-300/45 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    dot: 'bg-indigo-400',
  },
  TREND: {
    Icon: TrendingUp,
    label: 'Trend',
    tone: 'border-violet-300/45 bg-violet-50 text-violet-700 hover:bg-violet-100',
    dot: 'bg-violet-400',
  },
  IDEA: {
    Icon: Lightbulb,
    label: 'Idea',
    tone: 'border-emerald-300/45 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    dot: 'bg-emerald-400',
  },
};

const STATUS_META: Record<RadarSignalStatus, { label: string; tone: string }> = {
  new: { label: 'New', tone: 'border-emerald-400/35 bg-emerald-500/14 text-emerald-200' },
  updated: { label: 'Updated', tone: 'border-sky-400/35 bg-sky-500/14 text-sky-200' },
  saved: { label: 'Saved', tone: 'border-indigo-400/35 bg-indigo-500/14 text-indigo-200' },
  watching: { label: 'Watching', tone: 'border-amber-400/35 bg-amber-500/14 text-amber-200' },
  ignored: { label: 'Ignored', tone: 'border-slate-400/30 bg-slate-500/12 text-slate-600' },
};

const RING_WEIGHT: Record<RadarMapSignal['ring'], number> = {
  NOW: 0.18,
  PREPARE: 0.38,
  LEARN: 0.62,
  OBSERVE: 0.82,
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

  const lang = String(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-[#060B18]">
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

      <div className="relative z-10 flex-1 overflow-hidden px-4 pb-4 md:px-5">
        <div className="mb-2.5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Your Radar</h2>
            <p className="mt-0.5 max-w-3xl text-[12px] text-slate-600">
              A personal map of signals worth your attention — across your development, projects,
              industry and role.
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
                      ? 'border-primary-300/60 bg-primary-500/20 text-primary-100'
                      : 'border-white/10 bg-white/[0.04] text-slate-600 hover:border-white/20 hover:bg-white/[0.08]'
                  )}
                >
                  {filter.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[10px] tabular-nums',
                      active ? 'bg-primary-400/30 text-white' : 'bg-white/10 text-slate-600'
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
            <div className="max-w-md rounded-2xl border border-white/[0.08] bg-white/[0.03] px-8 py-10 text-center">
              <Radar className="mx-auto mb-3 h-9 w-9 text-primary-300/70" />
              <p className="text-sm font-medium text-white">{t('myWork.radar.empty')}</p>
              <p className="mt-1.5 text-[12px] text-slate-600">{t('myWork.radar.emptyHint')}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.1]"
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
          'bg-[radial-gradient(ellipse_80%_55%_at_50%_-8%,rgba(139,92,246,0.08),transparent)]',
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

function getSignalPosition(signal: RadarMapSignal, index: number, total: number) {
  const baseRadius = RING_WEIGHT[signal.ring];
  const quadAngle = QUADRANT_START[signal.quadrant];
  const spread = Math.PI / 2;
  const slot = (index % Math.max(1, total)) / Math.max(1, total);
  const angle = quadAngle + spread * (0.1 + slot * 0.8);
  const jitter = ((index % 3) - 1) * 0.015;
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
  ambientMotion,
}: {
  signals: RadarMapSignal[];
  selectedSignalId: string | null;
  onSelectSignal: (id: string) => void;
  ambientMotion: 'soft' | 'full';
}) {
  const selectedSignal =
    signals.find((signal) => signal.id === selectedSignalId) ?? signals[0] ?? null;
  const selectedIndex = selectedSignal
    ? signals.findIndex((signal) => signal.id === selectedSignal.id)
    : -1;
  const selectedPosition =
    selectedSignal && selectedIndex >= 0
      ? getSignalPosition(selectedSignal, selectedIndex, signals.length)
      : null;

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

  return (
    <div className="flex h-full min-h-[620px] flex-col gap-2 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/45 via-slate-900/25 to-slate-900/45 p-3 shadow-[inset_0_0_60px_rgba(15,23,42,0.5)]">
      <div
        className="relative flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[radial-gradient(circle_at_50%_50%,rgba(96,165,250,0.08),transparent_58%)]"
        tabIndex={0}
        onKeyDown={handleCanvasKeyDown}
        aria-label="Radar canvas"
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <linearGradient id="radarSweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(96,165,250,0)" />
              <stop offset="70%" stopColor="rgba(96,165,250,0.16)" />
              <stop offset="100%" stopColor="rgba(96,165,250,0.38)" />
            </linearGradient>
          </defs>

          {QUADRANTS.map((q) => (
            <rect key={q.key} x={q.x} y={q.y} width="44" height="44" fill={q.fill} rx="1.8" />
          ))}

          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="0.45"
          />
          <circle
            cx="50"
            cy="50"
            r="33"
            fill="none"
            stroke="rgba(148,163,184,0.22)"
            strokeWidth="0.35"
            strokeDasharray="0.5 0.8"
          />
          <circle
            cx="50"
            cy="50"
            r="22"
            fill="none"
            stroke="rgba(148,163,184,0.18)"
            strokeWidth="0.35"
            strokeDasharray="0.5 0.8"
          />
          <circle
            cx="50"
            cy="50"
            r="11"
            fill="none"
            stroke="rgba(148,163,184,0.2)"
            strokeWidth="0.35"
          />

          <line x1="50" y1="6" x2="50" y2="94" stroke="rgba(148,163,184,0.2)" strokeWidth="0.32" />
          <line x1="6" y1="50" x2="94" y2="50" stroke="rgba(148,163,184,0.2)" strokeWidth="0.32" />

          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur={`${ambientMotion === 'soft' ? 26 : 18}s`}
              repeatCount="indefinite"
            />
            <path
              d="M50,50 L50,6 A44,44 0 0,1 87.8,27.8 Z"
              fill="url(#radarSweep)"
              opacity="0.55"
            />
          </g>

          {RING_INFO.map((ring) => (
            <text
              key={ring.ring}
              x="50.6"
              y={ring.y}
              textAnchor="start"
              className="fill-slate-300 text-[2.2px] tracking-wider"
            >
              {ring.label}
            </text>
          ))}
        </svg>

        {QUADRANTS.map((q) => {
          const Icon = q.Icon;
          return (
            <div
              key={`${q.key}-label`}
              className="group absolute rounded-md bg-black/20 px-1.5 py-1 text-[10px] leading-tight"
              style={{ left: `${q.x + 1.2}%`, top: `${q.y + 1.2}%` }}
            >
              <div
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide',
                  q.chip
                )}
              >
                <Icon className="h-3 w-3" />
                {q.title}
              </div>
              <div className="text-[9px] text-slate-600/85">{q.subtitle}</div>
              <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden whitespace-nowrap rounded-md border border-white/10 bg-slate-950/90 px-2 py-1 text-[10px] text-slate-200 shadow-lg group-hover:block">
                {q.subtitle}
              </div>
            </div>
          );
        })}

        {signals.map((signal, index) => {
          const position = getSignalPosition(signal, index, signals.length);
          const selected = signal.id === selectedSignalId;
          const typeMeta = TYPE_META[signal.signalType] ?? TYPE_META.TREND;
          const Icon = typeMeta.Icon;
          const showPinnedLabel = selected || signal.importanceLevel === 'large';

          return (
            <motion.button
              key={signal.id}
              type="button"
              onClick={() => onSelectSignal(signal.id)}
              initial={{ opacity: 0, scale: 0.72 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.35) }}
              whileHover={{ scale: 1.1 }}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              data-testid={`radar-signal-${signal.id}`}
            >
              <span
                className={cn(
                  'relative flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition',
                  typeMeta.tone,
                  selected &&
                    'h-10 w-10 border-white bg-white text-slate-900 ring-2 ring-primary-300/70'
                )}
                title={`${signal.name} · ${signal.ring} · ${signal.quadrant.replaceAll('_', ' ')}`}
              >
                <Icon className="h-4 w-4" />
                {selected && (
                  <motion.span
                    className="absolute inset-0 rounded-full"
                    animate={{
                      boxShadow: ['0 0 0 0 rgba(96,165,250,0.45)', '0 0 0 12px rgba(96,165,250,0)'],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
              </span>

              {showPinnedLabel ? (
                <span className="pointer-events-none absolute left-[120%] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/12 bg-slate-900/85 px-2 py-0.5 text-[10px] font-medium text-slate-100">
                  {signal.name}
                </span>
              ) : (
                <span className="pointer-events-none absolute left-[120%] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/12 bg-slate-900/85 px-2 py-0.5 text-[10px] font-medium text-slate-100 group-hover:inline-flex">
                  {signal.name}
                </span>
              )}
            </motion.button>
          );
        })}

        {selectedSignal && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/12 bg-slate-900/80 px-2.5 py-1.5 text-[11px] text-slate-100 shadow">
            <div className="font-semibold">{selectedSignal.name}</div>
            <div className="text-[10px] text-slate-600">
              {selectedSignal.ring} · {quadrantTitle(selectedSignal.quadrant)}
            </div>
          </div>
        )}

        {selectedPosition && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="selectedBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(96,165,250,0.0)" />
                <stop offset="70%" stopColor="rgba(96,165,250,0.35)" />
                <stop offset="100%" stopColor="rgba(96,165,250,0.0)" />
              </linearGradient>
            </defs>
            <line
              x1={selectedPosition.x}
              y1={selectedPosition.y}
              x2="98"
              y2="50"
              stroke="url(#selectedBeam)"
              strokeWidth="0.45"
              strokeDasharray="1.2 1"
            />
          </svg>
        )}

        {!signals.length && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">
            No signals match the current filter.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] text-slate-600">
        <div className="truncate">
          <span className="text-slate-600">Areas:</span> My Development · My Projects · My Industry
          · My Role
        </div>
        <div className="truncate">
          <span className="text-slate-600">Horizon:</span> Now · Prepare · Learn · Observe
        </div>
        <div className="truncate">
          <span className="text-slate-600">Types:</span> Technology · Skill · Business · Risk · Tool
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
  if (!signal) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-slate-600">
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
      className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-4"
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
          <h3 className="text-lg font-semibold leading-tight text-white">{signal.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{signal.ring}</Badge>
            <Badge>{quadrantTitle(signal.quadrant)}</Badge>
            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">{shortDescription}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-primary-400/20 bg-primary-500/10 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary-200">
          Why this is on your radar
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-primary-50/90">{whyItMattersForYou}</p>
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-auto rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <Section title="What it is" body={shortDescription} />
        <Section title="Why it matters" body={preview.whyItMatters} />
        <Section title="Why it matters for you" body={preview.whyItMattersForYou} />
        <Section title="How to think about it" body={preview.howToThinkAboutIt} />
        <Section title="Good first question" body={preview.goodFirstQuestion} />
        <Section title="Suggested next step" body={preview.suggestedNextStep} />
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
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
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-300/50 bg-gradient-to-r from-primary-500/35 to-primary-400/25 px-3 py-2 text-[12px] font-medium text-primary-50 transition hover:from-primary-500/45 hover:to-primary-400/35"
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

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={cn(
        'rounded-full border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600',
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
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        {title}
      </div>
      <p className="text-[12px] leading-relaxed text-slate-200">{text}</p>
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
        tone === 'normal' && 'border-white/12 bg-white/[0.04] text-slate-200 hover:bg-white/[0.1]',
        tone === 'subtle' && 'border-white/10 bg-white/[0.02] text-slate-600 hover:bg-white/[0.08]'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
