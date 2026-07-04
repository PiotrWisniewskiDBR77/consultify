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
  const { t } = useTranslation();
  const payload = block.payload;
  const queueClear = payload.pendingCount === 0 && payload.blockedCount === 0;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-2.5">
        {queueClear ? (
          <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] px-3 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-200/90">
              {t('myWork.radar.decisionQueue')}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-emerald-50/90">
              {t('myWork.radar.decisionQueueClear')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-danger-400/15 bg-danger-500/[0.08] p-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-white/50">
                {t('myWork.radar.pending')}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {payload.pendingCount}
              </div>
            </div>
            <div className="rounded-lg border border-amber-400/15 bg-amber-500/[0.08] p-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-white/50">
                {t('myWork.radar.blocking')}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {payload.blockedCount}
              </div>
            </div>
          </div>
        )}

        {payload.hottestDecision ? (
          <button
            onClick={() =>
              onAction({ type: 'open', target: 'decision', id: payload.hottestDecision!.id })
            }
            className="rounded-lg border border-c-border-subtle bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
              <ShieldAlert size={12} className="text-amber-200" />
              {t('myWork.radar.hottestDecision')}
            </div>
            <div className="mt-1.5 text-sm font-semibold leading-snug text-white">
              {payload.hottestDecision.title}
            </div>
            <div className="mt-2 text-sm text-slate-600/75">
              {payload.hottestDecision.ownerLabel}
            </div>
            <div className="mt-1 text-xs text-amber-100/80">
              {payload.hottestDecision.deadlineLabel}
            </div>
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
                    starterPrompt: t('myWork.radar.unblockPrompt', { title: signal.title }),
                    entityType: 'decision',
                    entityId: payload.hottestDecision?.id,
                    entityName: payload.hottestDecision?.title,
                    contextData: { signal, hottestDecision: payload.hottestDecision },
                  },
                })
              }
              className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-white/[0.04] p-2.5 text-left transition hover:bg-white/[0.08]"
            >
              <div className="rounded-xl bg-danger-500/15 p-2 text-danger-200">
                <AlertTriangle size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{signal.title}</div>
                <div className="mt-1 text-xs leading-6 text-slate-600/70">{signal.summary}</div>
              </div>
              <ArrowRight size={16} className="text-white/30" />
            </button>
          ))}
        </div>
      </div>
    </HomeBlockShell>
  );
};
