/**
 * Chat V9 / INPUT C-IN6-lite — one-shot soft-limit inline toast.
 *
 * Why this exists
 * ---------------
 * The C-IN2 `InputCharCounter` goes *rose* once the user's
 * message crosses `max` (8000 chars by default). The pill is a
 * passive signal; it's easy to miss if the user is mid-flow. This
 * component adds a single active nudge the first time the rising
 * edge is crossed in a tab, with a "Don't show again this
 * session" escape hatch modelled on T-PM2.1.
 *
 * Contract
 * --------
 *   - Headless. No DOM of its own — only side-effects
 *     (`toast.custom`, sessionStorage writes).
 *   - Fires at most **once per tab** via a sessionStorage
 *     sentinel. The in-memory `firedThisMountRef` then guarantees
 *     the same mount never fires a second time even if sentinel
 *     writes fail (private-mode browsers, quota issues).
 *   - Only fires on a *rising* edge (`prev < max && curr >= max`).
 *     Sustained over-limit composition does not re-fire on every
 *     keystroke.
 *   - User clicking "Don't show again this session" writes a
 *     separate dismiss sentinel; the gate then treats the tab as
 *     permanently silent, even if sessionStorage later has only
 *     the dismiss key (e.g. cleared fire sentinel, kept dismiss).
 *   - Never blocks Send. The counter pill remains authoritative
 *     about the visible state.
 *   - Zero telemetry. The toast is a UX micro-interaction; the
 *     long-message distribution is already observable via the
 *     counter's tone classes in e2e traces.
 *
 * Kill-switch
 * -----------
 * `ff.input_soft_limit_toast` OFF = the effect short-circuits on
 * every render and the component is a pure no-op.
 */

import React, { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import {
  hasInputSoftLimitToastFiredForSession,
  isInputSoftLimitToastDismissedForSession,
  isInputSoftLimitToastEnabled,
  markInputSoftLimitToastDismissedForSession,
  markInputSoftLimitToastFiredForSession,
} from '../../utils/inputSoftLimitToastFlag';

export interface InputSoftLimitToastNotifyOptions {
  /** Character count that triggered the toast. */
  length: number;
  /** Soft-limit value the counter is using (pill's `max`). */
  max: number;
  /**
   * Callback the notifier wires to the "Don't show again this
   * session" button. Implementation writes the dismiss sentinel
   * and bumps the in-memory ref so no further renders re-arm.
   */
  onDismissForSession: () => void;
}

export interface InputSoftLimitToastProps {
  /** Current textarea value. Only the length matters. */
  value: string;
  /**
   * Soft maximum shared with `InputCharCounter`. Keep this in
   * sync with the counter's `max` so both components agree on
   * where the rose band starts.
   */
  max?: number;
  /** Test seam — production omits. */
  isEnabled?: () => boolean;
  /** Test seam — production omits. */
  hasFiredForSession?: () => boolean;
  /** Test seam — production omits. */
  markFiredForSession?: () => void;
  /** Test seam — production omits. */
  isDismissedForSession?: () => boolean;
  /** Test seam — production omits. */
  markDismissedForSession?: () => void;
  /** Test seam — production omits. */
  notify?: (message: string, options: InputSoftLimitToastNotifyOptions) => void;
}

const DEFAULT_MAX = 8000;

export function buildInputSoftLimitToastMessage(length: number, max: number): string {
  return `Your message is ${length.toLocaleString()} characters — past the ${max.toLocaleString()}-character soft limit. Teresa may trim or summarise long inputs; shorten it if every line matters.`;
}

function defaultNotify(message: string, options: InputSoftLimitToastNotifyOptions): void {
  toast.custom(
    (t) => (
      <div
        role="status"
        aria-live="polite"
        data-testid="chat-v9-input-soft-limit-toast"
        className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 text-[13px] text-slate-700 shadow-lg dark:border-rose-500/30 dark:bg-navy-900 dark:text-slate-200 ${
          t.visible ? 'animate-enter' : 'animate-leave'
        }`}
      >
        <span aria-hidden className="mt-[2px] text-base leading-none">
          ✏️
        </span>
        <div className="min-w-0 flex-1">
          <p className="leading-snug">{message}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              data-testid="chat-v9-input-soft-limit-toast-session-dismiss"
              onClick={() => {
                options.onDismissForSession();
                toast.dismiss(t.id);
              }}
              className="text-[12px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
            >
              Don&apos;t show again this session
            </button>
            <button
              type="button"
              data-testid="chat-v9-input-soft-limit-toast-dismiss"
              onClick={() => toast.dismiss(t.id)}
              className="text-[12px] font-medium text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    ),
    { duration: 5500 }
  );
}

export const InputSoftLimitToast: React.FC<InputSoftLimitToastProps> = ({
  value,
  max = DEFAULT_MAX,
  isEnabled = isInputSoftLimitToastEnabled,
  hasFiredForSession = hasInputSoftLimitToastFiredForSession,
  markFiredForSession = markInputSoftLimitToastFiredForSession,
  isDismissedForSession = isInputSoftLimitToastDismissedForSession,
  markDismissedForSession = markInputSoftLimitToastDismissedForSession,
  notify = defaultNotify,
}) => {
  // Tracks the length on the previous render so we can detect the
  // rising edge (`prev < max && curr >= max`). A ref is the right
  // tool here: we want no re-render from the comparison itself.
  const prevLengthRef = useRef<number>(typeof value === 'string' ? value.length : 0);
  // In-memory guard that survives sessionStorage write failures
  // (private-mode browsers, quota issues, cross-origin wrappers).
  // The tab-level sentinel is authoritative when sessionStorage is
  // healthy; this ref is the belt-and-braces fallback.
  const firedThisMountRef = useRef<boolean>(false);

  useEffect(() => {
    const curr = typeof value === 'string' ? value.length : 0;
    const prev = prevLengthRef.current;
    prevLengthRef.current = curr;

    if (!isEnabled()) return;
    if (firedThisMountRef.current) return;
    if (isDismissedForSession()) return;
    if (hasFiredForSession()) return;

    if (!(prev < max && curr >= max)) return;

    firedThisMountRef.current = true;
    try {
      markFiredForSession();
    } catch {
      // See comments on the sentinel helpers — the ref above is
      // enough to prevent repeats for this mount.
    }

    try {
      notify(buildInputSoftLimitToastMessage(curr, max), {
        length: curr,
        max,
        onDismissForSession: () => {
          try {
            markDismissedForSession();
          } catch {
            // Dismissal is a courtesy; the ref already silences
            // this mount and the fire sentinel silences the tab.
          }
        },
      });
    } catch {
      // A thrown notifier is not a reason to crash the input.
    }
  }, [
    value,
    max,
    isEnabled,
    hasFiredForSession,
    markFiredForSession,
    isDismissedForSession,
    markDismissedForSession,
    notify,
  ]);

  return null;
};

export default InputSoftLimitToast;
