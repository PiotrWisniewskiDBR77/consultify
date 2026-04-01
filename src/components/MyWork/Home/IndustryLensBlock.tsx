import { ArrowRight, Bot, Factory, Globe2, Scale } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { HomeBlockShell } from './HomeBlockShell';
import type { HomeBlock, HomeScreenAction, HomeSignalCard } from './homeV2Types';

interface IndustryLensBlockProps {
  block: Extract<HomeBlock, { id: 'industryLens' }>;
  onAction: (action: HomeScreenAction) => void;
}

export const IndustryLensBlock: React.FC<IndustryLensBlockProps> = ({ block, onAction }) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;

  return (
    <HomeBlockShell block={block}>
      <div className="grid gap-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300/75">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
            <Factory size={12} className="mr-1 inline" />
            {payload.industryLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
            {payload.roleLens}
          </span>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <SignalCard
            icon={<Globe2 size={15} />}
            signal={payload.marketSignal}
            toneClass="bg-cyan-500/15 text-cyan-200"
            onAction={onAction}
            isPolish={isPolish}
          />
          <SignalCard
            icon={<Bot size={15} />}
            signal={payload.technologySignal}
            toneClass="bg-indigo-500/15 text-indigo-200"
            onAction={onAction}
            isPolish={isPolish}
          />
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-white/45">
              <Scale size={12} className="text-emerald-200" />
              {isPolish ? 'Benchmark' : 'Benchmark'}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-white">{payload.benchmark.value}</div>
            <div className="text-xs text-slate-300/85">{payload.benchmark.label}</div>
            <div className="mt-0.5 text-[11px] text-emerald-100/80">{payload.benchmark.delta}</div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300/80 md:text-sm">
              {payload.benchmark.implication}
            </p>
          </div>
          <button
            onClick={() =>
              onAction({
                type: 'chat',
                packet: {
                  sourceBlock: 'industryLens',
                  intent: 'compare_peer_case',
                  title: payload.peerCase.title,
                  starterPrompt: isPolish
                    ? `Porównaj ten case do naszego programu transformacji i wskaż 3 wnioski: ${payload.peerCase.title}`
                    : `Compare this peer case to our transformation program and give me 3 implications: ${payload.peerCase.title}`,
                  entityType: 'industry_signal',
                  entityId: 'peer-case',
                  entityName: payload.peerCase.title,
                  contextData: {
                    title: payload.peerCase.title,
                    summary: payload.peerCase.summary,
                    implication: payload.peerCase.implication,
                  },
                },
              })
            }
            className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
          >
            <div className="font-mono text-[9px] uppercase tracking-wider text-white/45">
              {isPolish ? 'Peer case' : 'Peer case'}
            </div>
            <div className="mt-1.5 text-base font-semibold leading-snug text-white">
              {payload.peerCase.title}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300/80 md:text-sm">{payload.peerCase.summary}</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-medium text-primary-200">
              {payload.peerCase.implication}
              <ArrowRight size={14} />
            </div>
          </button>
        </div>
      </div>
    </HomeBlockShell>
  );
};

const SignalCard: React.FC<{
  icon: React.ReactNode;
  signal: HomeSignalCard;
  toneClass: string;
  onAction: (action: HomeScreenAction) => void;
  isPolish: boolean;
}> = ({ icon, signal, toneClass, onAction, isPolish }) => (
  <button
    onClick={() =>
      onAction({
        type: 'chat',
        packet: {
          sourceBlock: 'industryLens',
          intent: 'translate_signal',
          title: signal.title,
          starterPrompt: isPolish
            ? `Wyjaśnij dlaczego ten sygnał ma znaczenie dla naszej transformacji: ${signal.title}`
            : `Explain why this signal matters for our transformation: ${signal.title}`,
          entityType: 'industry_signal',
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
    className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
  >
    <div className={`inline-flex rounded-lg p-1.5 ${toneClass}`}>{icon}</div>
    <div className="mt-2 text-sm font-semibold leading-snug text-white">{signal.title}</div>
    <div className="mt-1 text-xs leading-relaxed text-slate-300/80">{signal.summary}</div>
    <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-white/45">{signal.tag}</div>
  </button>
);
