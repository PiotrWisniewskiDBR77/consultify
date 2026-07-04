import { ArrowRight, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HomeBlockShell } from './HomeBlockShell';
import type { HomeBlock, HomeScreenAction } from './homeV2Types';

interface TeamSignalBlockProps {
  block: Extract<HomeBlock, { id: 'teamSignal' }>;
  onAction: (action: HomeScreenAction) => void;
}

const TONE_STYLE = {
  positive: 'bg-emerald-500/15 text-emerald-200',
  warning: 'bg-amber-500/15 text-amber-200',
  neutral: 'bg-white/10 text-slate-200',
};

export const TeamSignalBlock: React.FC<TeamSignalBlockProps> = ({ block, onAction }) => {
  const { t } = useTranslation();
  const payload = block.payload;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-2.5">
        <div className="rounded-lg border border-c-border-subtle bg-white/[0.04] p-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-wider text-white/40">
            <Users size={10} className="text-slate-600" />
            {t('myWork.radar.teamReadout')}
          </div>
          <div className="mt-1 text-sm font-semibold text-white">{payload.headline}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-600/75">
            {payload.summary}
          </div>
        </div>

        <div className="space-y-1.5">
          {payload.signals.map((signal) => (
            <button
              key={signal.id}
              onClick={() =>
                onAction({
                  type: 'chat',
                  packet: {
                    sourceBlock: 'teamSignal',
                    intent: 'prepare_alignment_message',
                    title: signal.title,
                    starterPrompt: t('myWork.radar.teamUpdatePrompt', { title: signal.title }),
                    entityType: 'transformation_signal',
                    entityId: signal.id,
                    contextData: signal,
                  },
                })
              }
              className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-white/[0.04] p-2.5 text-left transition hover:bg-white/[0.08]"
            >
              <div className={`rounded-xl p-2 ${TONE_STYLE[signal.tone]}`}>
                <Users size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{signal.title}</div>
                <div className="mt-1 text-xs leading-6 text-slate-600/70">{signal.detail}</div>
              </div>
              <ArrowRight size={16} className="text-white/30" />
            </button>
          ))}
        </div>
      </div>
    </HomeBlockShell>
  );
};
