import { ArrowRight, FileSpreadsheet, Gauge, Lock, Zap } from 'lucide-react';
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

const VISIBILITY_META = {
  private: {
    labelEn: 'Private',
    labelPl: 'Prywatne',
    className: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
  },
  project: {
    labelEn: 'Project',
    labelPl: 'Projekt',
    className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  },
  organization: {
    labelEn: 'Organization',
    labelPl: 'Organizacja',
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
  },
  review_shared: {
    labelEn: 'Needs review',
    labelPl: 'Do przegladu',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  demo: {
    labelEn: 'Demo',
    labelPl: 'Demo',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
} as const;

const REVIEW_META = {
  private_draft: {
    labelEn: 'Private draft',
    labelPl: 'Szkic prywatny',
  },
  reviewable_share: {
    labelEn: 'Review ready',
    labelPl: 'Gotowe do review',
  },
  in_review: {
    labelEn: 'In review',
    labelPl: 'W review',
  },
  approved: {
    labelEn: 'Approved',
    labelPl: 'Zatwierdzone',
  },
  published: {
    labelEn: 'Published',
    labelPl: 'Opublikowane',
  },
} as const;

export const ExecutionCurrentBlock: React.FC<ExecutionCurrentBlockProps> = ({
  block,
  onAction,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const payload = block.payload;
  const orderedArtifactOutputs = [...(payload.artifactOutputs || [])].sort((left, right) => {
    const leftScore = left.visibilityScope === 'review_shared' ? 0 : 1;
    const rightScore = right.visibilityScope === 'review_shared' ? 0 : 1;
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftReviewScore = left.publishState === 'in_review' ? 0 : 1;
    const rightReviewScore = right.publishState === 'in_review' ? 0 : 1;
    return leftReviewScore - rightReviewScore;
  });

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
        {orderedArtifactOutputs.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {isPolish ? 'Strumień outputów' : 'Output flow'}
            </div>
            {orderedArtifactOutputs.map((artifact) => {
              const openTarget =
                artifact.originRuntime === 'presentation'
                  ? ('presentation' as const)
                  : artifact.originRuntime === 'sheet'
                    ? ('sheet' as const)
                    : ('report' as const);
              const visibilityMeta = VISIBILITY_META[artifact.visibilityScope];
              const reviewMeta =
                artifact.publishState &&
                artifact.publishState in REVIEW_META
                  ? REVIEW_META[artifact.publishState as keyof typeof REVIEW_META]
                  : null;
              return (
                <button
                  key={artifact.artifactId}
                  onClick={() =>
                    onAction({
                      type: 'open',
                      target: openTarget,
                      id: artifact.id,
                    })
                  }
                  className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08]"
                >
                  <div className="rounded-xl bg-violet-500/15 p-2 text-violet-200">
                    {artifact.originRuntime === 'presentation' ? (
                      <Zap size={14} />
                    ) : artifact.originRuntime === 'sheet' ? (
                      <FileSpreadsheet size={14} />
                    ) : (
                      <Gauge size={14} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-white">{artifact.title}</div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${visibilityMeta.className}`}
                      >
                        {isPolish ? visibilityMeta.labelPl : visibilityMeta.labelEn}
                      </span>
                      {reviewMeta ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-200">
                          {isPolish ? reviewMeta.labelPl : reviewMeta.labelEn}
                          {artifact.reviewGateCount && artifact.reviewGateCount > 0
                            ? ` · ${artifact.reviewGateCount}`
                            : ''}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-300/70">
                      {artifact.originRuntime === 'presentation'
                        ? isPolish
                          ? `Prezentacja · ${artifact.deliveryState}`
                          : `Presentation · ${artifact.deliveryState}`
                        : artifact.originRuntime === 'sheet'
                          ? isPolish
                            ? `Arkusz · ${artifact.deliveryState}`
                            : `Sheet · ${artifact.deliveryState}`
                          : isPolish
                            ? `Raport · ${artifact.deliveryState}`
                            : `Report · ${artifact.deliveryState}`}
                    </div>
                    {artifact.publishState ? (
                      <div className="mt-1 text-[11px] text-slate-400">
                        {isPolish
                          ? 'Review i visibility są spójne z Outputs Library.'
                          : 'Review and visibility stay aligned with the Outputs Library.'}
                      </div>
                    ) : null}
                  </div>
                  <ArrowRight size={16} className="text-white/30" />
                </button>
              );
            })}
          </div>
        ) : null}
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
