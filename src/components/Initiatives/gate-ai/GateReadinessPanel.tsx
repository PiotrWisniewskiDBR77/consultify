/**
 * GateReadinessPanel — expanded gate-AI readiness detail.
 *
 * PURE presentational (M13 Depth · Fala 1 · §6). Props in, NO data fetching.
 * Lists content gaps (section + score + issues), suggested fixes, and timeline
 * flags (block = amber-strong, warn = amber-soft). Empty/ready state shows a
 * positive message. Bursztyn = ostrzeżenie, NOT danger-fill (§7/§27 canon).
 *
 * @see docs/product/INITIATIVE_GATE_AI_SPEC.md §6
 */

import { AlertTriangle, CheckCircle2, Lightbulb, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { GateAiReadiness, GateAiTimeline, TimelineFlag } from '@/types/gateAi';

export interface GateReadinessPanelProps {
  readiness: GateAiReadiness | null;
  timeline: GateAiTimeline | null;
}

const timelineFlagCls = (severity: TimelineFlag['severity']): string =>
  severity === 'block'
    ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
    : 'bg-amber-500/5 text-amber-700 dark:text-amber-400 border-amber-500/15';

export const GateReadinessPanel: React.FC<GateReadinessPanelProps> = ({ readiness, timeline }) => {
  const { t } = useTranslation();

  const timelineFlags = timeline?.flags ?? [];

  // Empty state — no AI data at all.
  if (!readiness) {
    return (
      <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <ShieldAlert size={16} className="shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('initiatives.gateAi.panel.emptyTitle')}
            </p>
            <p className="text-xs">{t('initiatives.gateAi.panel.emptyDescription')}</p>
          </div>
        </div>
      </div>
    );
  }

  const isReady = readiness.verdict === 'ready';
  const hasGaps = readiness.gaps.length > 0;
  const hasFixes = readiness.fixes.length > 0;
  const hasTimeline = timelineFlags.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl p-4 space-y-4">
      {/* Header: title + score / threshold */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('initiatives.gateAi.panel.title')}
        </span>
        <div className="flex items-center gap-3 text-[11px]">
          <span
            className={`font-bold ${
              isReady
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {t('initiatives.gateAi.panel.scoreLabel')}: {readiness.score}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {t('initiatives.gateAi.panel.thresholdLabel')}: {readiness.threshold}
          </span>
        </div>
      </div>

      {/* Positive / ready state */}
      {isReady && !hasGaps && !hasTimeline && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <CheckCircle2
            size={16}
            className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400"
          />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {t('initiatives.gateAi.panel.readyTitle')}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t('initiatives.gateAi.panel.readyDescription')}
            </p>
          </div>
        </div>
      )}

      {/* Content gaps */}
      {hasGaps && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('initiatives.gateAi.panel.gapsTitle')}
          </p>
          <ul className="space-y-2">
            {readiness.gaps.map((gap, idx) => (
              <li
                key={`${gap.section}-${idx}`}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                    <AlertTriangle
                      size={13}
                      className="shrink-0 text-amber-600 dark:text-amber-400"
                    />
                    {gap.section}
                  </span>
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    {t('initiatives.gateAi.panel.gapSectionScore', { score: gap.score })}
                  </span>
                </div>
                {gap.issues.length > 0 && (
                  <ul className="mt-1.5 ml-5 list-disc space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    {gap.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested fixes */}
      {hasFixes && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('initiatives.gateAi.panel.fixesTitle')}
          </p>
          <ul className="space-y-1">
            {readiness.fixes.map((fix, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-[12px] text-slate-700 dark:text-slate-200"
              >
                <Lightbulb size={13} className="shrink-0 mt-0.5 text-c-info" />
                <span>{fix}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timeline flags */}
      {hasTimeline && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('initiatives.gateAi.panel.timelineTitle')}
          </p>
          <ul className="space-y-1.5">
            {timelineFlags.map((flag, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] ${timelineFlagCls(
                  flag.severity
                )}`}
              >
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <span className="uppercase tracking-wide text-[9px] px-1 py-0.5 rounded bg-amber-500/20">
                      {flag.severity === 'block'
                        ? t('initiatives.gateAi.panel.timelineBlock')
                        : t('initiatives.gateAi.panel.timelineWarn')}
                    </span>
                    {t(`initiatives.gateAi.panel.timelineKind.${flag.kind}`)}
                  </span>
                  <p className="mt-0.5 leading-snug">{flag.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No timeline analysis available for this gate */}
      {!hasTimeline && !timeline && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
          {t('initiatives.gateAi.panel.noTimeline')}
        </p>
      )}
    </div>
  );
};

export default GateReadinessPanel;
