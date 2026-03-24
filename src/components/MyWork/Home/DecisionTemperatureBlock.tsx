import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HomeBlockShell } from './HomeBlockShell';
import type { HomeBlock, HomeScreenAction } from './homeV2Types';

interface DecisionTemperatureBlockProps {
  block: Extract<HomeBlock, { id: 'decisionTemperature' }>;
  onAction: (action: HomeScreenAction) => void;
}

export const DecisionTemperatureBlock: React.FC<DecisionTemperatureBlockProps> = ({
  block,
  onAction,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-rose-400/15 bg-rose-500/[0.08] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
              {isPolish ? 'Czeka' : 'Pending'}
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">{payload.pendingCount}</div>
          </div>
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.08] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/50">
              {isPolish ? 'Blokuje' : 'Blocking'}
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">{payload.blockedCount}</div>
          </div>
        </div>

        {payload.hottestDecision ? (
          <button
            onClick={() => onAction({ type: 'open', target: 'decision', id: payload.hottestDecision!.id })}
            className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
              <ShieldAlert size={12} className="text-amber-200" />
              {isPolish ? 'Najgorętsza decyzja' : 'Hottest decision'}
            </div>
            <div className="mt-2 text-lg font-semibold leading-snug text-white">
              {payload.hottestDecision.title}
            </div>
            <div className="mt-2 text-sm text-slate-300/75">{payload.hottestDecision.ownerLabel}</div>
            <div className="mt-1 text-xs text-amber-100/80">{payload.hottestDecision.deadlineLabel}</div>
          </button>
        ) : null}

        <div className="space-y-2">
          {payload.signals.map((signal) => (
            <button
              key={signal.id}
              onClick={() =>
                onAction({
                  type: 'chat',
                  packet: {
                    sourceBlock: 'decisionTemperature',
                    intent: 'unblock_decision',
                    title: signal.title,
                    starterPrompt: isPolish
                      ? `Pomóż odblokować tę decyzję: ${signal.title}`
                      : `Help me unblock this decision: ${signal.title}`,
                    entityType: 'decision',
                    entityId: payload.hottestDecision?.id,
                    entityName: payload.hottestDecision?.title,
                    contextData: { signal, hottestDecision: payload.hottestDecision },
                  },
                })
              }
              className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
            >
              <div className="rounded-xl bg-rose-500/15 p-2 text-rose-200">
                <AlertTriangle size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{signal.title}</div>
                <div className="mt-1 text-xs leading-6 text-slate-300/70">{signal.summary}</div>
              </div>
              <ArrowRight size={16} className="text-white/30" />
            </button>
          ))}
        </div>
      </div>
    </HomeBlockShell>
  );
};
