import { ArrowUpRight, TrendingUp } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HomeBlockShell } from './HomeBlockShell';
import type { HomeBlock, HomeScreenAction } from './homeV2Types';

interface MomentumBlockProps {
  block: Extract<HomeBlock, { id: 'momentum' }>;
  onAction: (action: HomeScreenAction) => void;
}

export const MomentumBlock: React.FC<MomentumBlockProps> = ({ block, onAction }) => {
  const { t } = useTranslation();
  const payload = block.payload;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-2.5">
        <div>
          <h4 className="text-sm font-semibold leading-tight text-white md:text-base">
            {payload.headline}
          </h4>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600/80">{payload.summary}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {payload.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-c-border-subtle bg-white/[0.04] p-2.5"
            >
              <div className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                {stat.label}
              </div>
              <div className="mt-0.5 text-base font-semibold tabular-nums text-white">
                {stat.value}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-600/75">{stat.trend}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          {payload.signals.map((signal) => (
            <button
              key={signal.id}
              onClick={() =>
                onAction({
                  type: 'chat',
                  packet: {
                    sourceBlock: 'momentum',
                    intent: 'summarize_momentum',
                    title: signal.title,
                    starterPrompt: t('myWork.radar.momentumPrompt', { title: signal.title }),
                    entityType: 'transformation_signal',
                    entityId: signal.id,
                    entityName: signal.title,
                    contextData: {
                      id: signal.id,
                      title: signal.title,
                      summary: signal.summary,
                      tag: signal.tag,
                      tone: signal.tone || 'neutral',
                    },
                  },
                })
              }
              className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-white/[0.04] p-2.5 text-left transition hover:bg-white/[0.08]"
            >
              <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300">
                <TrendingUp size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{signal.title}</div>
                <div className="mt-1 text-xs leading-6 text-slate-600/70">{signal.summary}</div>
              </div>
              <ArrowUpRight size={16} className="text-white/30" />
            </button>
          ))}
        </div>
      </div>
    </HomeBlockShell>
  );
};
