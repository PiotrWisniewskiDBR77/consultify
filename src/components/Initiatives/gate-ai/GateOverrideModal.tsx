/**
 * GateOverrideModal — conscious soft-block override (M13 Depth · Fala 1 · §6).
 *
 * PURE presentational. Shows the gaps + timeline-block summary and a MANDATORY
 * reason textarea; the confirm button ("Proceed anyway") is DISABLED until the
 * reason is non-empty. onConfirm(reason) / onCancel callbacks out. Dark+light.
 *
 * @see docs/product/INITIATIVE_GATE_AI_SPEC.md §5/§6
 */

import { AlertTriangle, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GateAiReadiness, GateAiTimeline } from '@/types/gateAi';

export interface GateOverrideModalProps {
  open: boolean;
  readiness: GateAiReadiness | null;
  timeline: GateAiTimeline | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const GateOverrideModal: React.FC<GateOverrideModalProps> = ({
  open,
  readiness,
  timeline,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  // Reset the reason whenever the modal is (re)opened.
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const canConfirm = trimmed.length > 0;

  const blockingFlags = (timeline?.flags ?? []).filter((f) => f.severity === 'block');
  const gaps = readiness?.gaps ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('initiatives.gateAi.override.title')}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {t('initiatives.gateAi.override.title')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('initiatives.gateAi.override.description')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('initiatives.gateAi.override.cancel')}
            className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[55vh] overflow-y-auto">
          {readiness && (
            <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-400">
              {t('initiatives.gateAi.override.summaryScore', {
                score: readiness.score,
                threshold: readiness.threshold,
              })}
            </p>
          )}

          {gaps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('initiatives.gateAi.override.gapsTitle')}
              </p>
              <ul className="space-y-1">
                {gaps.map((gap, idx) => (
                  <li
                    key={`${gap.section}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {gap.section}
                    </span>
                    <span className="text-amber-700 dark:text-amber-400">{gap.score}/100</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {blockingFlags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('initiatives.gateAi.override.timelineTitle')}
              </p>
              <ul className="space-y-1">
                {blockingFlags.map((flag, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300"
                  >
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    <span>{flag.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mandatory reason */}
          <div className="space-y-1.5">
            <label
              htmlFor="gate-override-reason"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {t('initiatives.gateAi.override.reasonLabel')}
            </label>
            <textarea
              id="gate-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t('initiatives.gateAi.override.reasonPlaceholder')}
              className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 px-3 py-2 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/40">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            {t('initiatives.gateAi.override.cancel')}
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => canConfirm && onConfirm(trimmed)}
            className="px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 dark:disabled:bg-navy-700 disabled:text-slate-500 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            {t('initiatives.gateAi.override.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GateOverrideModal;
