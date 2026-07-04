import { ArrowRight, Compass } from 'lucide-react';
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
  high: 'from-danger-400 to-amber-400',
  medium: 'from-blue-400 to-primary-400',
  low: 'from-emerald-400 to-blue-400',
};

export const AIPulseCore: React.FC<AIPulseCoreProps> = ({ block, onAction }) => {
  const { t } = useTranslation();
  const payload = block.payload;
  const [primaryFocus, ...secondaryFocus] = payload.focusItems;

  return (
    <HomeBlockShell
      block={block}
      contentClassName="grid h-full grid-cols-1 gap-3 xl:grid-cols-12 xl:gap-4"
    >
      <div className="flex flex-col gap-3 xl:col-span-7">
        <div>
          <h2 className="max-w-[32ch] text-lg font-semibold leading-tight tracking-tight text-white md:text-xl">
            {payload.headline}
          </h2>
          <p className="mt-1.5 max-w-[60ch] text-xs leading-relaxed text-slate-600/85">
            {payload.summary}
          </p>
        </div>

        <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.05] p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-100/90">
            <Compass size={12} className="text-amber-200/80" />
            {t('myWork.radar.worthNoticing')}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-200/85">{payload.insight}</p>
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
                  starterPrompt: t('myWork.radar.pulseActionPrompt'),
                  entityType: 'home',
                  entityId: 'pulse-core',
                  contextData: { headline: payload.headline, insight: payload.insight },
                },
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-500 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            {t('myWork.radar.talkToAI')}
            <ArrowRight size={12} />
          </button>
          <button
            onClick={() => onAction({ type: 'navigate', target: 'tasks' })}
            className="rounded-lg border border-c-border-subtle bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:bg-white/[0.08]"
          >
            {t('myWork.radar.openExecution')}
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3 xl:col-span-5 xl:grid-cols-1">
        {primaryFocus ? (
          <button
            onClick={() =>
              onAction({
                type: 'open',
                target: primaryFocus.type === 'idea' ? 'idea' : primaryFocus.type,
                id: primaryFocus.id,
              })
            }
            className="rounded-lg border border-primary-400/25 bg-primary-500/[0.08] p-2.5 text-left transition hover:bg-primary-500/[0.12]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-primary-100/80">
                {t('myWork.radar.topMove')}
              </div>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-gradient-to-r',
                  PRIORITY_RING[primaryFocus.priority]
                )}
              />
            </div>
            <div className="mt-1.5 text-sm font-semibold leading-snug text-white">
              {primaryFocus.title}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-slate-600/75">
              {primaryFocus.meta}
            </div>
          </button>
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
            className="group rounded-lg border border-c-border-subtle bg-white/[0.03] p-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                Q{index + 2}
              </div>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-gradient-to-r',
                  PRIORITY_RING[item.priority]
                )}
              />
            </div>
            <div className="mt-1 text-[12px] font-semibold leading-snug text-white group-hover:text-primary-200">
              {item.title}
            </div>
            <div className="mt-0.5 text-[10px] leading-relaxed text-slate-600/70">{item.meta}</div>
          </button>
        ))}
      </div>
    </HomeBlockShell>
  );
};
