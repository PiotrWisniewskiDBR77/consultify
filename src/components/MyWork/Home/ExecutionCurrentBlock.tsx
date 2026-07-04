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
  steady: { icon: <Gauge size={14} />, className: 'bg-blue-500/15 text-blue-200' },
  blocked: { icon: <Lock size={14} />, className: 'bg-amber-500/15 text-amber-200' },
};

const VISIBILITY_META = {
  private: { className: 'border-slate-500/30 bg-slate-500/10 text-slate-200' },
  project: { className: 'border-blue-500/30 bg-blue-500/10 text-blue-200' },
  organization: { className: 'border-primary-500/30 bg-primary-500/10 text-primary-200' },
  review_shared: { className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' },
  demo: { className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' },
} as const;

const VISIBILITY_I18N_KEY: Record<string, string> = {
  private: 'myWork.radar.visibility.private',
  project: 'myWork.radar.visibility.project',
  organization: 'myWork.radar.visibility.organization',
  review_shared: 'myWork.radar.visibility.reviewShared',
  demo: 'myWork.radar.visibility.demo',
};

const REVIEW_I18N_KEY: Record<string, string> = {
  private_draft: 'myWork.radar.reviewState.privateDraft',
  reviewable_share: 'myWork.radar.reviewState.reviewReady',
  in_review: 'myWork.radar.reviewState.inReview',
  approved: 'myWork.radar.reviewState.approved',
  published: 'myWork.radar.reviewState.published',
};

export const ExecutionCurrentBlock: React.FC<ExecutionCurrentBlockProps> = ({
  block,
  onAction,
}) => {
  const { t } = useTranslation();
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
      <div className="grid gap-2">
        <p className="text-[11px] leading-relaxed text-slate-600/80">{payload.headline}</p>
        <div className="space-y-1.5">
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
                className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-white/[0.04] p-2.5 text-left transition hover:bg-white/[0.08]"
              >
                <div className={`rounded-xl p-2 ${STATUS_META[stream.status].className}`}>
                  {STATUS_META[stream.status].icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">{stream.label}</div>
                  <div className="mt-1 text-xs text-slate-600/70">{stream.progressLabel}</div>
                </div>
                <ArrowRight size={16} className="text-white/30" />
              </button>
            );
          })}
        </div>
        {orderedArtifactOutputs.length > 0 ? (
          <div className="space-y-1.5 rounded-lg border border-c-border-subtle bg-white/[0.03] p-2.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {t('myWork.radar.outputFlow')}
            </div>
            {orderedArtifactOutputs.map((artifact) => {
              const openTarget =
                artifact.originRuntime === 'presentation'
                  ? ('presentation' as const)
                  : artifact.originRuntime === 'sheet'
                    ? ('sheet' as const)
                    : ('report' as const);
              const visibilityMeta = VISIBILITY_META[artifact.visibilityScope];
              const reviewI18nKey =
                artifact.publishState && artifact.publishState in REVIEW_I18N_KEY
                  ? REVIEW_I18N_KEY[artifact.publishState]
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
                  className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-white/[0.04] p-2.5 text-left transition hover:bg-white/[0.08]"
                >
                  <div className="rounded-xl bg-primary-500/15 p-2 text-primary-200">
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
                        {t(VISIBILITY_I18N_KEY[artifact.visibilityScope])}
                      </span>
                      {reviewI18nKey ? (
                        <span className="rounded-full border border-c-border-subtle bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-200">
                          {t(reviewI18nKey)}
                          {artifact.reviewGateCount && artifact.reviewGateCount > 0
                            ? ` · ${artifact.reviewGateCount}`
                            : ''}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-600/70">
                      {artifact.originRuntime === 'presentation'
                        ? `${t('myWork.radar.artifactType.presentation')} · ${artifact.deliveryState}`
                        : artifact.originRuntime === 'sheet'
                          ? `${t('myWork.radar.artifactType.sheet')} · ${artifact.deliveryState}`
                          : `${t('myWork.radar.artifactType.report')} · ${artifact.deliveryState}`}
                    </div>
                    {artifact.publishState ? (
                      <div className="mt-1 text-[11px] text-slate-600">
                        {t('myWork.radar.outputsLibraryNote')}
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
                starterPrompt: t('myWork.radar.sequencingPrompt'),
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
          className="rounded-lg border border-c-border-subtle bg-white/[0.05] px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-white/[0.08]"
        >
          {t('myWork.radar.askAISequencing')}
        </button>
      </div>
    </HomeBlockShell>
  );
};
