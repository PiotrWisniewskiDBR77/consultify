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
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
            <Users size={12} className="text-slate-200" />
            {isPolish ? 'Sygnał zespołu' : 'Team readout'}
          </div>
          <div className="mt-2 text-lg font-semibold text-white">{payload.headline}</div>
          <div className="mt-2 text-sm leading-7 text-slate-300/78">{payload.summary}</div>
        </div>

        <div className="space-y-2">
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
                    starterPrompt: isPolish
                      ? `Przygotuj mi krótką wiadomość lub update dla zespołu w oparciu o ten sygnał: ${signal.title}`
                      : `Prepare a short team update or alignment note based on this signal: ${signal.title}`,
                    entityType: 'transformation_signal',
                    entityId: signal.id,
                    contextData: signal,
                  },
                })
              }
              className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
            >
              <div className={`rounded-xl p-2 ${TONE_STYLE[signal.tone]}`}>
                <Users size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">{signal.title}</div>
                <div className="mt-1 text-xs leading-6 text-slate-300/70">{signal.detail}</div>
              </div>
              <ArrowRight size={16} className="text-white/30" />
            </button>
          ))}
        </div>
      </div>
    </HomeBlockShell>
  );
};
