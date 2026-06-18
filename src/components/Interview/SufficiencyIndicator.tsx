/**
 * SufficiencyIndicator
 *
 * V3-D01: Interview sufficiency contract UI.
 * Shows whether enough data has been collected for the interview to proceed to insights generation.
 *
 * - Visual progress indicator (0-100%)
 * - Color coding: RED (<40%), AMBER (40-70%), GREEN (>70%)
 * - List of sufficiency criteria with check/uncheck status
 * - Send-back button when score < threshold, with dialog showing missing items + note
 *
 * @see docs/ui-standards/00-foundation/color-system.md
 * @see docs/ui-standards/00-foundation/visual-language.md
 */

import { AlertCircle, Check, ChevronDown, ChevronUp, RotateCcw, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ───────────────────────────────────────────────────────────────────

export interface SufficiencyCriterion {
  id: string;
  label: string;
  met: boolean;
  weight: number;
  details?: string;
}

export interface SufficiencyIndicatorProps {
  /** Sufficiency score 0-100 */
  score: number;
  /** List of criteria with met status */
  criteria: SufficiencyCriterion[];
  /** Threshold to proceed (e.g., 70) */
  threshold: number;
  /** Called when user sends back with a note */
  onSendBack?: (note: string) => void;
  /** Called when user proceeds to insights */
  onProceed?: () => void;
  /** Read-only mode */
  locked?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getScoreVariant(score: number): 'red' | 'amber' | 'green' {
  if (score < 40) return 'red';
  if (score < 70) return 'amber';
  return 'green';
}

const VARIANT_STYLES = {
  red: {
    bar: 'bg-danger-500',
    text: 'text-danger-400',
    bg: 'bg-danger-500/10',
    label: 'interview.sufficiency.status.red',
  },
  amber: {
    bar: 'bg-amber-500',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    label: 'interview.sufficiency.status.amber',
  },
  green: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    label: 'interview.sufficiency.status.green',
  },
} as const;

// ── Component ───────────────────────────────────────────────────────────────

export const SufficiencyIndicator: React.FC<SufficiencyIndicatorProps> = ({
  score,
  criteria,
  threshold,
  onSendBack,
  onProceed,
  locked = false,
}) => {
  const { t } = useTranslation();
  const [showCriteria, setShowCriteria] = useState(true);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackNote, setSendBackNote] = useState('');

  const variant = getScoreVariant(score);
  const styles = VARIANT_STYLES[variant];
  const canProceed = score >= threshold;
  const missingItems = criteria.filter((c) => !c.met);

  const handleSendBack = () => {
    onSendBack?.(sendBackNote);
    setSendBackNote('');
    setSendBackOpen(false);
  };

  const handleCloseSendBack = () => {
    setSendBackNote('');
    setSendBackOpen(false);
  };

  return (
    <div className="rounded-xl bg-slate-50/50 dark:bg-navy-900/50 p-4 space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('interview.sufficiency.title')}
              </span>
              <span className={`text-sm font-semibold ${styles.text}`}>{score}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${styles.bar}`}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              />
            </div>
          </div>
        </div>
        {!locked && (
          <div className="flex items-center gap-2 shrink-0">
            {canProceed && onProceed && (
              <button
                onClick={onProceed}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-navy-900 text-white hover:bg-primary-600 transition-colors"
              >
                {t('interview.sufficiency.proceed')}
              </button>
            )}
            {!canProceed && onSendBack && (
              <button
                onClick={() => setSendBackOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
              >
                <RotateCcw size={14} />
                {t('interview.sufficiency.sendBack')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Criteria list (collapsible) */}
      {criteria.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCriteria(!showCriteria)}
            className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            {showCriteria ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {t('interview.sufficiency.criteria')} ({criteria.filter((c) => c.met).length}/
            {criteria.length})
          </button>
          {showCriteria && (
            <ul className="space-y-1.5">
              {criteria.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-start gap-2 text-sm ${
                    c.met
                      ? 'text-slate-600 dark:text-slate-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {c.met ? (
                    <Check size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                  ) : (
                    <AlertCircle
                      size={16}
                      className="shrink-0 mt-0.5 text-slate-600 dark:text-slate-500"
                    />
                  )}
                  <span className={c.met ? 'line-through' : ''}>{c.label}</span>
                  {c.details && !c.met && (
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      — {c.details}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Send-back dialog */}
      {sendBackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sendback-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-navy-800 shadow-hig-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3
                id="sendback-dialog-title"
                className="text-lg font-semibold text-slate-900 dark:text-slate-100"
              >
                {t('interview.sufficiency.sendBackDialog.title')}
              </h3>
              <button
                type="button"
                onClick={handleCloseSendBack}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 dark:hover:text-slate-300 transition-colors"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('interview.sufficiency.sendBackDialog.description')}
            </p>

            {missingItems.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t('interview.sufficiency.sendBackDialog.missingItems')}
                </span>
                <ul className="space-y-1 rounded-lg bg-slate-50 dark:bg-navy-900/50 p-3">
                  {missingItems.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                      {c.label}
                      {c.details && <span className="text-xs text-slate-500">— {c.details}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="sendback-note"
                className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                {t('interview.sufficiency.sendBackDialog.noteLabel')}
              </label>
              <textarea
                id="sendback-note"
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value)}
                placeholder={t('interview.sufficiency.sendBackDialog.notePlaceholder')}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseSendBack}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSendBack}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-700 dark:bg-navy-600 text-white hover:bg-slate-600 dark:hover:bg-navy-500 transition-colors"
              >
                <RotateCcw size={14} />
                {t('interview.sufficiency.sendBackConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SufficiencyIndicator;
