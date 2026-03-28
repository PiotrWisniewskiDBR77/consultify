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
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-4">
        <div>
          <h4 className="text-2xl font-semibold text-white leading-tight">{payload.headline}</h4>
          <p className="mt-2 text-sm leading-7 text-slate-300/80">{payload.summary}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {payload.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                {stat.label}
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">{stat.value}</div>
              <div className="mt-1 text-xs text-slate-300/65">{stat.trend}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
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
                    starterPrompt: isPolish
                      ? `Wyjaśnij co oznacza ten sygnał momentum dla transformacji: ${signal.title}`
                      : `Explain what this momentum signal means for the transformation: ${signal.title}`,
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
              className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
            >
              <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300">
                <TrendingUp size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{signal.title}</div>
                <div className="mt-1 text-xs leading-6 text-slate-300/70">{signal.summary}</div>
              </div>
              <ArrowUpRight size={16} className="text-white/30" />
            </button>
          ))}
        </div>
      </div>
    </HomeBlockShell>
  );
};
