import { ArrowRight, Bot, Compass, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { HomeBlockShell } from './HomeBlockShell';
import type { AIPulseCorePayload, HomeBlock, HomeScreenAction } from './homeV2Types';

interface AIPulseCoreProps {
  block: Extract<HomeBlock, { id: 'aiPulseCore' }>;
  onAction: (action: HomeScreenAction) => void;
}

const PRIORITY_RING: Record<AIPulseCorePayload['focusItems'][number]['priority'], string> = {
  high: 'from-rose-400 to-amber-400',
  medium: 'from-cyan-400 to-primary-400',
  low: 'from-emerald-400 to-teal-400',
};

export const AIPulseCore: React.FC<AIPulseCoreProps> = ({ block, onAction }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;
  const [primaryFocus, ...secondaryFocus] = payload.focusItems;

  return (
    <HomeBlockShell
      block={block}
      contentClassName="grid h-full grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5"
      headerRight={
        <div className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-right font-mono">
          <div className="text-[9px] uppercase tracking-wider text-white/45">
            {isPolish ? 'Pulse' : 'Pulse'}
          </div>
          <div className="text-xl font-semibold tabular-nums text-white">{payload.pulseScore}</div>
        </div>
      }
    >
      <div className="flex flex-col justify-between xl:col-span-7">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-gradient-to-r from-violet-500/12 to-fuchsia-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-100/90">
            {isPolish ? 'Lekki briefing' : 'Light briefing'}
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-primary-400/20 bg-primary-500/10 px-2.5 py-1 text-[11px] font-medium text-primary-100">
            <Bot size={13} />
            {payload.greeting}
          </div>

          <div className="flex items-start gap-4">
            <div className="relative hidden xl:flex h-16 w-16 flex-shrink-0 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500 via-violet-400 to-cyan-400 blur-lg opacity-50" />
              <div className="relative rounded-full border border-white/15 bg-navy-950/80 p-3 text-white">
                <Sparkles size={20} />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="max-w-[28ch] text-xl font-semibold leading-tight tracking-tight text-white md:text-2xl">
                {payload.headline}
              </h2>
              <p className="mt-2 max-w-[62ch] text-xs leading-relaxed text-slate-300/90 md:text-sm">
                {payload.summary}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-amber-400/20 border-l-2 border-l-amber-400/45 bg-gradient-to-r from-amber-500/[0.07] to-transparent p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-50/95">
              <Compass size={14} className="text-amber-200" />
              {isPolish ? 'Co warto zauważyć' : 'Worth noticing'}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-200/88 md:text-sm">{payload.insight}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                onAction({
                  type: 'chat',
                  packet: {
                    sourceBlock: 'aiPulseCore',
                    intent: 'prioritize_transformation',
                    title: block.title,
                    starterPrompt: isPolish
                      ? 'Przełóż ten pulse na konkretny plan działania na dziś i ten tydzień.'
                      : 'Turn this pulse into a concrete plan for today and this week.',
                    entityType: 'home',
                    entityId: 'pulse-core',
                    contextData: { headline: payload.headline, insight: payload.insight },
                  },
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-violet-500 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-primary-900/25 transition hover:brightness-110"
            >
              {isPolish ? 'Porozmawiaj z AI' : 'Talk to AI'}
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => onAction({ type: 'navigate', target: 'tasks' })}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
            >
              {isPolish ? 'Przejdź do wykonania' : 'Open execution'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:col-span-5 xl:grid-cols-1">
        {primaryFocus ? (
          <div className="rounded-lg border border-primary-400/30 bg-gradient-to-br from-primary-500/14 via-violet-500/8 to-cyan-400/8 p-3 shadow-lg shadow-violet-950/30">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[9px] font-mono uppercase tracking-wider text-primary-100/85">
                {isPolish ? 'Top move' : 'Top move'}
              </div>
              <span
                className={cn(
                  'h-2 w-2 rounded-full bg-gradient-to-r',
                  PRIORITY_RING[primaryFocus.priority]
                )}
              />
            </div>
            <div className="mt-2 text-base font-semibold leading-snug text-white">{primaryFocus.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-200/80">{primaryFocus.meta}</div>
            <button
              onClick={() =>
                onAction({
                  type: 'open',
                  target: primaryFocus.type === 'idea' ? 'idea' : primaryFocus.type,
                  id: primaryFocus.id,
                })
              }
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.12]"
            >
              {isPolish ? 'Otwórz priorytet' : 'Open priority'}
              <ArrowRight size={14} />
            </button>
          </div>
        ) : null}

        {secondaryFocus.map((item, index) => (
          <button
            key={item.id}
            onClick={() =>
              onAction({
                type: 'open',
                target: item.type === 'idea' ? 'idea' : item.type,
                id: item.id,
              })
            }
            className="group rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.07]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-white/45">
                {isPolish ? `Q${index + 2}` : `Q${index + 2}`}
              </div>
              <span
                className={cn(
                  'h-2 w-2 rounded-full bg-gradient-to-r',
                  PRIORITY_RING[item.priority]
                )}
              />
            </div>
            <div className="mt-1.5 text-sm font-semibold leading-snug text-white group-hover:text-primary-200">
              {item.title}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-slate-300/75">{item.meta}</div>
          </button>
        ))}
      </div>
    </HomeBlockShell>
  );
};
