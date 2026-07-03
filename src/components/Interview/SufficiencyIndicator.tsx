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
    bar: 'bg-[var(--c-danger)]',
    text: 'text-[var(--c-danger)]',
    bg: 'bg-[var(--c-danger)]/10',
    label: 'interview.sufficiency.status.red',
  },
  amber: {
    bar: 'bg-[var(--c-warning)]',
    text: 'text-[var(--c-warning)]',
    bg: 'bg-[var(--c-warning)]/10',
    label: 'interview.sufficiency.status.amber',
  },
  green: {
    bar: 'bg-[var(--c-success)]',
    text: 'text-[var(--c-success)]',
    bg: 'bg-[var(--c-success)]/10',
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
    <div className="rounded-token-lg bg-[var(--c-surface-raised)] p-4 space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--c-text-muted)]">
                {t('interview.sufficiency.title')}
              </span>
              <span className={`text-sm font-semibold ${styles.text}`}>{score}%</span>
            </div>
            <div className="h-2 rounded-token-pill bg-[var(--c-border-subtle)] overflow-hidden">
              <div
                className={`h-full rounded-token-pill transition-all duration-300 ${styles.bar}`}
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
                className="px-3 py-1.5 text-sm font-medium rounded-token-md bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
              >
                {t('interview.sufficiency.proceed')}
              </button>
            )}
            {!canProceed && onSendBack && (
              <button
                onClick={() => setSendBackOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-token-md border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] hover:bg-[var(--c-surface-raised)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
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
            className="flex items-center gap-2 text-xs font-medium text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] rounded-token-xs"
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
                      ? 'text-[var(--c-text-muted)]'
                      : 'text-[var(--c-text)]'
                  }`}
                >
                  {c.met ? (
                    <Check size={16} className="shrink-0 mt-0.5 text-[var(--c-success)]" />
                  ) : (
                    <AlertCircle
                      size={16}
                      className="shrink-0 mt-0.5 text-[var(--c-text-muted)]"
                    />
                  )}
                  <span className={c.met ? 'line-through' : ''}>{c.label}</span>
                  {c.details && !c.met && (
                    <span className="text-xs text-[var(--c-text-muted)]">
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
          <div className="w-full max-w-md rounded-token-xl bg-[var(--c-surface)] border border-[var(--c-border)] shadow-hig-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3
                id="sendback-dialog-title"
                className="text-lg font-semibold text-[var(--c-text)]"
              >
                {t('interview.sufficiency.sendBackDialog.title')}
              </h3>
              <button
                type="button"
                onClick={handleCloseSendBack}
                className="p-1 rounded-token-md text-[var(--c-text-muted)] hover:bg-[var(--c-surface-raised)] hover:text-[var(--c-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-[var(--c-text-secondary)]">
              {t('interview.sufficiency.sendBackDialog.description')}
            </p>

            {missingItems.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--c-text-muted)]">
                  {t('interview.sufficiency.sendBackDialog.missingItems')}
                </span>
                <ul className="space-y-1 rounded-token-md bg-[var(--c-surface-raised)] p-3">
                  {missingItems.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start gap-2 text-sm text-[var(--c-text)]"
                    >
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-[var(--c-warning)]" />
                      {c.label}
                      {c.details && <span className="text-xs text-[var(--c-text-muted)]">— {c.details}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="sendback-note"
                className="text-xs font-medium uppercase tracking-wide text-[var(--c-text-muted)]"
              >
                {t('interview.sufficiency.sendBackDialog.noteLabel')}
              </label>
              <textarea
                id="sendback-note"
                value={sendBackNote}
                onChange={(e) => setSendBackNote(e.target.value)}
                placeholder={t('interview.sufficiency.sendBackDialog.notePlaceholder')}
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-token-md border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseSendBack}
                className="px-3 py-1.5 text-sm font-medium rounded-token-md text-[var(--c-text-secondary)] hover:bg-[var(--c-surface-raised)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSendBack}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-token-md bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
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
