import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckSquare,
  FileText,
  Globe2,
  Lightbulb,
  Rocket,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  WandSparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type {
  AIPulseCorePayload,
  CommandDockPayload,
  HomeBlock,
  HomeScreenAction,
  HomeTimeMode,
  IndustryLensPayload,
  SparkFieldPayload,
  TeamSignalPayload,
} from './homeV2Types';
import { useHomeData } from './useHomeData';

interface HomeViewProps {
  userName?: string;
  refreshTrigger?: number;
  onAction: (action: HomeScreenAction) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ userName, refreshTrigger, onAction }) => {
  const { screen, blocks, layout, loading, error } = useHomeData(refreshTrigger);
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';

  const bm = useMemo(() => {
    const m = new Map<string, HomeBlock>();
    for (const b of blocks) m.set(b.id, b);
    return m;
  }, [blocks]);

  const pulse = bm.get('aiPulseCore') as Extract<HomeBlock, { id: 'aiPulseCore' }> | undefined;
  const spark = bm.get('sparkField') as Extract<HomeBlock, { id: 'sparkField' }> | undefined;
  const industry = bm.get('industryLens') as Extract<HomeBlock, { id: 'industryLens' }> | undefined;
  const team = bm.get('teamSignal') as Extract<HomeBlock, { id: 'teamSignal' }> | undefined;
  const dock = bm.get('commandDock') as Extract<HomeBlock, { id: 'commandDock' }> | undefined;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#060B18]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="h-8 w-8 rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    );
  }

  if (error && blocks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#060B18]">
        <p className="text-base text-red-400">{error}</p>
      </div>
    );
  }

  const ideas = spark?.payload.ideas ?? [];
  const notes = spark?.payload.notes ?? [];
  const nudge = spark?.payload.nudge ?? null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#060B18]">
      <BgCanvas timeMode={screen.timeMode} motion={layout.ambientMotion} />

      {/* ── Quiet greeting ── */}
      <div className="relative z-10 flex items-center justify-between px-7 pt-4 pb-2">
        <span className="text-[13px] font-medium text-white/35">
          {pl ? `Twoja przestrzeń wiedzy` : `Your knowledge space`}
          {userName ? ` · ${userName}` : ''}
        </span>
        <span className="text-[12px] text-white/20">{screen.timeMode === 'morning' ? '☀' : screen.timeMode === 'liveDay' ? '◉' : '☾'}</span>
      </div>

      {/* ── BENTO KNOWLEDGE GRID ── */}
      <div
        className="relative z-10 flex-1 gap-3.5 px-7 pb-3"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr 1fr',
          gridTemplateRows: '1.15fr 1fr 0.85fr',
        }}
      >
        {/* YOUR MAIN IDEA — tall left */}
        {ideas[0] ? (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            onClick={() => onAction({ type: 'open', target: 'idea', id: ideas[0].id })}
            style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }}
            className="group flex flex-col rounded-2xl border-l-[3px] border-l-amber-400 border border-white/[0.08] bg-white/[0.05] p-5 text-left transition hover:bg-white/[0.09]"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/70">
              <Lightbulb size={13} /> {pl ? 'Twój pomysł' : 'Your idea'}
            </div>
            {ideas[0].stage && (
              <span className="mt-2 self-start rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">{ideas[0].stage}</span>
            )}
            <h3 className="mt-3 text-xl font-bold leading-snug text-white/90 group-hover:text-white">{ideas[0].title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-white/50">{ideas[0].snippet}</p>

            {nudge && (
              <div className="mt-auto flex items-start gap-2 rounded-xl border border-violet-400/15 bg-violet-500/[0.06] p-3">
                <WandSparkles size={14} className="mt-0.5 flex-shrink-0 text-violet-300" />
                <div>
                  <div className="text-[11px] font-semibold text-violet-300/80">AI</div>
                  <div className="text-[13px] leading-snug text-white/60">{nudge.text}</div>
                </div>
              </div>
            )}
          </motion.button>
        ) : (
          <EmptyCard style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }} icon={<Lightbulb size={20} />} label={pl ? 'Tu pojawią się Twoje pomysły' : 'Your ideas will appear here'} accent="amber" onAction={() => onAction({ type: 'create', target: 'idea' })} />
        )}

        {/* AI CONNECTION — wide hero top-right */}
        {pulse && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ gridRow: '1 / 2', gridColumn: '2 / 4' }}
            className="relative flex flex-col overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-5"
          >
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-violet-500/20 blur-[60px]" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300/80">
                <Sparkles size={13} /> {pl ? 'AI · Twoje połączenie' : 'AI · Your connection'}
              </div>
              <h3 className="mt-3 max-w-[50ch] text-lg font-bold leading-snug text-white/90">{pulse.payload.insight}</h3>
              <p className="mt-2 max-w-[55ch] text-[14px] leading-relaxed text-white/50">{pulse.payload.summary}</p>
              <button
                onClick={() =>
                  onAction({
                    type: 'chat',
                    packet: {
                      sourceBlock: 'aiPulseCore', intent: 'explore_connection', title: pulse.title,
                      starterPrompt: pl ? 'Opowiedz mi więcej o tym połączeniu.' : 'Tell me more about this connection.',
                      entityType: 'home', entityId: 'ai-connection',
                      contextData: { insight: pulse.payload.insight, headline: pulse.payload.headline },
                    },
                  })
                }
                className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-violet-500/20 px-4 py-2 text-[13px] font-semibold text-violet-200 transition hover:bg-violet-500/30"
              >
                {pl ? 'Porozmawiaj o tym z AI' : 'Talk to AI about this'} <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* YOUR NOTE — center */}
        {notes[0] ? (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            onClick={() => onAction({ type: 'open', target: 'note', id: notes[0].id })}
            style={{ gridRow: '2 / 3', gridColumn: '2 / 3' }}
            className="group flex flex-col rounded-2xl border-l-[3px] border-l-blue-400 border border-white/[0.08] bg-white/[0.05] p-5 text-left transition hover:bg-white/[0.09]"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-300/70">
              <FileText size={13} /> {pl ? 'Twoja notatka' : 'Your note'}
            </div>
            <h3 className="mt-3 text-[16px] font-bold leading-snug text-white/90 group-hover:text-white">{notes[0].title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">{notes[0].snippet}</p>
          </motion.button>
        ) : (
          <EmptyCard style={{ gridRow: '2 / 3', gridColumn: '2 / 3' }} icon={<FileText size={18} />} label={pl ? 'Tu pojawią się notatki' : 'Your notes will appear here'} accent="blue" onAction={() => onAction({ type: 'create', target: 'note' })} />
        )}

        {/* WORLD SIGNAL — right middle */}
        {industry && (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            onClick={() => onAction({ type: 'chat', packet: { sourceBlock: 'industryLens', intent: 'translate_signal', title: industry.payload.marketSignal.title, starterPrompt: pl ? `Co to oznacza dla mojego projektu: ${industry.payload.marketSignal.title}` : `What does this mean for my project: ${industry.payload.marketSignal.title}`, entityType: 'industry_signal', entityId: industry.payload.marketSignal.id, contextData: { id: industry.payload.marketSignal.id, title: industry.payload.marketSignal.title, summary: industry.payload.marketSignal.summary, tag: industry.payload.marketSignal.tag, tone: industry.payload.marketSignal.tone || 'neutral' } } })}
            style={{ gridRow: '2 / 3', gridColumn: '3 / 4' }}
            className="group flex flex-col rounded-2xl border-l-[3px] border-l-cyan-400 border border-white/[0.08] bg-white/[0.05] p-5 text-left transition hover:bg-white/[0.09]"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">
              <Globe2 size={13} /> {industry.payload.industryLabel}
            </div>
            <h3 className="mt-3 text-[16px] font-bold leading-snug text-white/90 group-hover:text-white">{industry.payload.marketSignal.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">{industry.payload.marketSignal.summary}</p>
          </motion.button>
        )}

        {/* SECOND IDEA or TEAM — bottom left */}
        {ideas[1] ? (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            onClick={() => onAction({ type: 'open', target: 'idea', id: ideas[1].id })}
            style={{ gridRow: '3 / 4', gridColumn: '1 / 2' }}
            className="group flex flex-col rounded-2xl border-l-[3px] border-l-amber-400/60 border border-white/[0.08] bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.09]"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300/50">
              <Lightbulb size={12} /> {pl ? 'Pomysł' : 'Idea'}
            </div>
            <h3 className="mt-2 text-[15px] font-bold leading-snug text-white/85 group-hover:text-white">{ideas[1].title}</h3>
            <p className="mt-1 text-[12px] text-white/40">{ideas[1].snippet}</p>
          </motion.button>
        ) : (
          <EmptyCard style={{ gridRow: '3 / 4', gridColumn: '1 / 2' }} icon={<Lightbulb size={16} />} label={pl ? 'Więcej pomysłów' : 'More ideas'} accent="amber" onAction={() => onAction({ type: 'create', target: 'idea' })} />
        )}

        {/* TEAM SIGNAL — bottom center */}
        {team && (
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            onClick={() => onAction({ type: 'chat', packet: { sourceBlock: 'teamSignal', intent: 'prepare_alignment_message', title: team.payload.headline, starterPrompt: pl ? `Przygotuj update: ${team.payload.headline}` : `Prepare update: ${team.payload.headline}`, entityType: 'transformation_signal', entityId: 'team-headline', contextData: { headline: team.payload.headline, summary: team.payload.summary } } })}
            style={{ gridRow: '3 / 4', gridColumn: '2 / 3' }}
            className="group flex flex-col rounded-2xl border-l-[3px] border-l-emerald-400 border border-white/[0.08] bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.09]"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300/70">
              <Users size={13} /> {pl ? 'Zespół' : 'Team'}
            </div>
            <h3 className="mt-2 text-[15px] font-bold leading-snug text-white/85 group-hover:text-white">{team.payload.headline}</h3>
            {team.payload.signals[0] && (
              <div className="mt-1.5 flex items-center gap-2 text-[12px] text-emerald-200/50">
                <span className={cn('h-1.5 w-1.5 rounded-full', team.payload.signals[0].tone === 'positive' ? 'bg-emerald-400' : 'bg-amber-400')} />
                {team.payload.signals[0].title}
              </div>
            )}
          </motion.button>
        )}

        {/* BENCHMARK — bottom right */}
        {industry && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            style={{ gridRow: '3 / 4', gridColumn: '3 / 4' }}
            className="flex flex-col justify-center rounded-2xl border-l-[3px] border-l-teal-400 border border-white/[0.08] bg-white/[0.05] p-4"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-teal-300/70">
              <TrendingUp size={13} /> Benchmark
            </div>
            <div className="mt-2 text-3xl font-black text-white">{industry.payload.benchmark.value}</div>
            <div className="mt-1 text-[13px] font-semibold text-emerald-300/60">{industry.payload.benchmark.delta}</div>
            <div className="mt-0.5 text-[12px] text-white/40">{industry.payload.benchmark.label}</div>
          </motion.div>
        )}
      </div>

      {/* ── DOCK ── */}
      {dock && <Dock payload={dock.payload} onAction={onAction} pl={pl} />}
    </div>
  );
};

/* ── Empty card placeholder ── */

const ACCENT_EMPTY: Record<string, string> = {
  amber: 'border-l-amber-400/30 text-amber-300/30',
  blue: 'border-l-blue-400/30 text-blue-300/30',
};

const EmptyCard: React.FC<{
  style: React.CSSProperties;
  icon: React.ReactNode;
  label: string;
  accent: string;
  onAction: () => void;
}> = ({ style, icon, label, accent, onAction }) => (
  <button
    onClick={onAction}
    style={style}
    className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-center transition hover:bg-white/[0.05] border-l-[3px]', ACCENT_EMPTY[accent])}
  >
    {icon}
    <span className="text-[13px]">{label}</span>
    <Plus size={16} className="mt-1 opacity-50" />
  </button>
);

/* ── Canvas background ── */

const PAL: Record<HomeTimeMode, [string, string, string]> = {
  morning: ['from-violet-600/25 to-cyan-500/20', 'from-amber-500/20 to-rose-400/15', 'from-emerald-500/14 to-teal-400/10'],
  liveDay: ['from-violet-500/25 to-primary-500/20', 'from-cyan-500/18 to-blue-500/14', 'from-rose-500/12 to-amber-400/10'],
  eveningWrap: ['from-indigo-600/25 to-violet-500/20', 'from-rose-500/18 to-amber-500/12', 'from-cyan-500/12 to-emerald-400/10'],
};

const BgCanvas: React.FC<{ timeMode: HomeTimeMode; motion: 'soft' | 'full' }> = ({ timeMode, motion: m }) => {
  const p = PAL[timeMode];
  const d = m === 'soft' ? 28 : 20;
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-8%,rgba(120,119,198,0.12),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] [background-size:44px_44px]" />
      <motion.div className={cn('pointer-events-none absolute -left-44 -top-44 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br blur-[170px]', p[0])} animate={{ x: [0, 30, -18, 0], y: [0, 22, -28, 0], scale: [1, 1.08, 0.94, 1] }} transition={{ duration: d, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className={cn('pointer-events-none absolute -right-36 top-[20%] h-[32rem] w-[32rem] rounded-full bg-gradient-to-br blur-[170px]', p[1])} animate={{ x: [0, -26, 18, 0], y: [0, -20, 22, 0], scale: [1, 0.95, 1.07, 1] }} transition={{ duration: d + 8, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className={cn('pointer-events-none absolute -bottom-28 left-[28%] h-[26rem] w-[26rem] rounded-full bg-gradient-to-br blur-[170px]', p[2])} animate={{ x: [0, 18, -22, 0], y: [0, -14, 18, 0], scale: [1, 1.05, 0.93, 1] }} transition={{ duration: d + 14, repeat: Infinity, ease: 'easeInOut' }} />
    </>
  );
};

/* ── Command dock ── */

const Plus: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

const DIC: Record<string, React.ReactNode> = {
  'new-idea': <Lightbulb size={13} />,
  'new-note': <FileText size={13} />,
  'new-task': <CheckSquare size={13} />,
  'new-decision': <Scale size={13} />,
  'open-calendar': <CalendarDays size={13} />,
  'ask-ai': <Sparkles size={13} />,
};

const Dock: React.FC<{ payload: CommandDockPayload; onAction: (a: HomeScreenAction) => void; pl: boolean }> = ({ payload, onAction, pl }) => (
  <div className="relative z-20 flex h-12 items-center gap-2 border-t border-white/[0.06] bg-[#060B18]/80 px-7 backdrop-blur-md">
    {payload.actions.map((a) => (
      <button
        key={a.id}
        onClick={() => {
          if (a.kind === 'create' && a.target) onAction({ type: 'create', target: a.target as 'idea' });
          else if (a.kind === 'navigate' && a.target) onAction({ type: 'navigate', target: a.target as 'calendar' });
          else if (a.kind === 'chat' && a.starterPrompt) onAction({ type: 'chat', packet: { sourceBlock: 'commandDock', intent: 'general_transform_assist', title: 'Dock', starterPrompt: a.starterPrompt, entityType: 'home', entityId: 'dock' } });
        }}
        className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-semibold text-white/55 transition hover:bg-white/[0.10] hover:text-white/85"
      >
        {DIC[a.id] || <ArrowUpRight size={13} />}
        {a.label}
      </button>
    ))}
    <span className="ml-auto text-[10px] font-medium tracking-wider text-white/15">Transformation OS</span>
  </div>
);
