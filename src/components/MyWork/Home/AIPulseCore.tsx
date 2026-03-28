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

  return (
    <HomeBlockShell
      block={block}
      className="xl:col-span-12"
      contentClassName="grid h-full grid-cols-1 xl:grid-cols-[1.55fr_0.95fr] gap-6"
      headerRight={
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
            {isPolish ? 'Pulse score' : 'Pulse score'}
          </div>
          <div className="text-2xl font-semibold text-white">{payload.pulseScore}</div>
        </div>
      }
    >
      <div className="flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-100 mb-4">
            <Bot size={14} />
            {payload.greeting}
          </div>

          <div className="flex items-start gap-5">
            <div className="relative hidden md:flex h-28 w-28 flex-shrink-0 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-500 via-violet-400 to-cyan-400 blur-xl opacity-60" />
              <div className="absolute inset-3 rounded-full border border-white/15 bg-white/[0.05]" />
              <div className="relative rounded-full border border-white/15 bg-navy-950/70 px-4 py-4 text-white">
                <Sparkles size={28} />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-3xl md:text-4xl font-semibold leading-[1.08] tracking-tight text-white max-w-[18ch]">
                {payload.headline}
              </h2>
              <p className="mt-3 max-w-[62ch] text-sm md:text-base leading-7 text-slate-300/85">
                {payload.summary}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 md:p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Compass size={16} className="text-primary-300" />
              {isPolish ? 'Insight AI' : 'AI insight'}
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-300/80">{payload.insight}</p>
          </div>

          <div className="flex flex-wrap gap-3">
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
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-primary-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-900/30 transition hover:-translate-y-0.5"
            >
              {isPolish ? 'Porozmawiaj z AI' : 'Talk to AI'}
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => onAction({ type: 'navigate', target: 'tasks' })}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
            >
              {isPolish ? 'Przejdź do wykonania' : 'Open execution'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
        {payload.focusItems.map((item, index) => (
          <button
            key={item.id}
            onClick={() =>
              onAction({
                type: 'open',
                target: item.type === 'idea' ? 'idea' : item.type,
                id: item.id,
              })
            }
            className="group rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07] hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                {isPolish ? `Ruch ${index + 1}` : `Move ${index + 1}`}
              </div>
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full bg-gradient-to-r',
                  PRIORITY_RING[item.priority]
                )}
              />
            </div>
            <div className="mt-2 text-base font-semibold leading-snug text-white group-hover:text-primary-200">
              {item.title}
            </div>
            <div className="mt-1.5 text-xs leading-6 text-slate-300/70">{item.meta}</div>
          </button>
        ))}
      </div>
    </HomeBlockShell>
  );
};
