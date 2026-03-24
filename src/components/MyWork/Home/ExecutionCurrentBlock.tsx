import { ArrowRight, Gauge, Lock, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HomeBlockShell } from './HomeBlockShell';
import type { HomeBlock, HomeScreenAction } from './homeV2Types';

interface ExecutionCurrentBlockProps {
  block: Extract<HomeBlock, { id: 'executionCurrent' }>;
  onAction: (action: HomeScreenAction) => void;
}

const STATUS_META = {
  accelerating: { icon: <Zap size={14} />, className: 'bg-emerald-500/15 text-emerald-200' },
  steady: { icon: <Gauge size={14} />, className: 'bg-cyan-500/15 text-cyan-200' },
  blocked: { icon: <Lock size={14} />, className: 'bg-amber-500/15 text-amber-200' },
};

export const ExecutionCurrentBlock: React.FC<ExecutionCurrentBlockProps> = ({ block, onAction }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-4">
        <p className="text-sm leading-7 text-slate-300/80">{payload.headline}</p>
        <div className="space-y-2">
          {payload.streams.map((stream) => {
            const openTarget =
              stream.entityType === 'task' || stream.entityType === 'decision'
                ? stream.entityType
                : stream.entityType === 'idea'
                  ? 'idea'
                  : stream.entityType === 'note'
                    ? 'note'
                    : null;

            return (
              <button
                key={stream.id}
                onClick={() =>
                  openTarget && stream.entityId
                    ? onAction({ type: 'open', target: openTarget, id: stream.entityId })
                    : undefined
                }
                className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
              >
                <div className={`rounded-xl p-2 ${STATUS_META[stream.status].className}`}>
                  {STATUS_META[stream.status].icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">{stream.label}</div>
                  <div className="mt-1 text-xs text-slate-300/70">{stream.progressLabel}</div>
                </div>
                <ArrowRight size={16} className="text-white/30" />
              </button>
            );
          })}
        </div>
        <button
          onClick={() =>
            onAction({
              type: 'chat',
              packet: {
                sourceBlock: 'executionCurrent',
                intent: 'sequence_execution',
                title: block.title,
                starterPrompt: isPolish
                  ? 'Ułóż mi najlepszą kolejność działań wykonawczych na podstawie bieżących strumieni.'
                  : 'Sequence the best execution order for me based on the current streams.',
                entityType: 'home',
                entityId: 'execution-current',
                contextData: {
                  headline: payload.headline,
                  streams: payload.streams.map((stream) => ({
                    id: stream.id,
                    label: stream.label,
                    progressLabel: stream.progressLabel,
                    status: stream.status,
                  })),
                },
              },
            })
          }
          className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
        >
          {isPolish ? 'Poproś AI o sequencing' : 'Ask AI for sequencing'}
        </button>
      </div>
    </HomeBlockShell>
  );
};
