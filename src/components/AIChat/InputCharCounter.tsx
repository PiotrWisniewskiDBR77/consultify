/**
 * Chat V9 / INPUT C-IN2 — Input character counter pill.
 *
 * Why this exists
 * ---------------
 * Users compose long messages in the chat textarea with no visible
 * signal of scale until the model either truncates the request or
 * returns a degraded answer. Backend per-model caps vary; the
 * counter does not attempt to know them exactly. It instead shows
 * a soft, configurable threshold/max pair so users get an early
 * sense that they are entering "long message" territory, and a
 * stronger warning as they cross the soft cap.
 *
 * Render contract
 * ---------------
 *   - Stays **invisible** until `value.length >= threshold` (so
 *     99% of sessions see no chrome at all).
 *   - Above threshold, renders a compact pill showing `N / max`.
 *   - Colour escalates in three bands:
 *     * `slate`   — below 80% of `max` (normal)
 *     * `amber`   — 80% to 99% of `max` (approaching limit)
 *     * `rose`    — at or above `max` (over soft limit)
 *   - **Never** blocks Send. The counter is advisory; the existing
 *     send path is authoritative about what the backend accepts.
 *   - `role="status"` + `aria-live="polite"` so screen readers
 *     announce length changes at a reasonable cadence without
 *     flooding them on every keystroke.
 *   - Read-only text — no interactive behaviour, no telemetry.
 */

import React from 'react';

import { isInputCharCounterEnabled } from '../../utils/inputCharCounterFlag';

export interface InputCharCounterProps {
  /** Current textarea value. */
  value: string;
  /**
   * Threshold below which the counter is hidden entirely. Defaults
   * to 400 characters — short messages never show chrome.
   */
  threshold?: number;
  /**
   * Soft maximum used to colour-escalate the pill. Defaults to
   * 8000 characters — safe across all currently-shipped models.
   * Beyond this we turn rose to signal "your message is long enough
   * to be worth trimming or summarising".
   */
  max?: number;
  /**
   * Test seam so unit tests can force the enabled / disabled paths
   * without touching URL / localStorage / env. Production never sets.
   */
  isEnabled?: () => boolean;
}

const DEFAULT_THRESHOLD = 400;
const DEFAULT_MAX = 8000;
const WARN_RATIO = 0.8;

function resolveTone(length: number, max: number): 'slate' | 'amber' | 'danger' {
  if (length >= max) return 'danger';
  if (length >= max * WARN_RATIO) return 'amber';
  return 'slate';
}

const TONE_CLASS: Record<'slate' | 'amber' | 'danger', string> = {
  slate:
    'border-slate-200 bg-slate-50 text-slate-600 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-300',
  amber:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600/60 dark:bg-amber-900/30 dark:text-amber-200',
  danger:
    'border-danger-300 bg-danger-50 text-danger-800 dark:border-danger-600/60 dark:bg-danger-900/30 dark:text-danger-200',
};

export const InputCharCounter: React.FC<InputCharCounterProps> = ({
  value,
  threshold = DEFAULT_THRESHOLD,
  max = DEFAULT_MAX,
  isEnabled = isInputCharCounterEnabled,
}) => {
  if (!isEnabled()) return null;
  const length = typeof value === 'string' ? value.length : 0;
  if (length < threshold) return null;

  const tone = resolveTone(length, max);
  const ariaLabel =
    tone === 'danger'
      ? `Message is ${length} characters, over the ${max}-character soft limit`
      : `Message is ${length} of ${max} characters`;

  return (
    <span
      data-testid="input-char-counter"
      data-tone={tone}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums select-none ${TONE_CLASS[tone]}`}
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
};

export default InputCharCounter;
