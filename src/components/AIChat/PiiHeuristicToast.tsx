/**
 * Chat V9 / TRUST T-PM2-lite — headless post-send PII heuristic toast.
 *
 * Behaviour
 * ---------
 * Mounts once at the App root. Listens for `CHAT_V9_PII_CHECK_EVENT`
 * CustomEvents on `window` (dispatched by `EnhancedChatInput` right
 * after a successful `onSend`). When fired and the kill-switch is
 * ON, runs `detectPiiCategories()` on the message text. If any
 * categories hit, it:
 *
 *   1. Emits a single `react-hot-toast` warning via the injectable
 *      `notify` seam. The toast lists the hit categories (email /
 *      phone / IBAN) so the user can decide whether to amend or
 *      keep going.
 *   2. Fires a PII-free telemetry event
 *      (`pii_heuristic_warning_shown`) whose payload is ONLY the
 *      closed-enum category array. Never the raw text, never a
 *      substring, never an id.
 *
 * Throttling
 * ----------
 * Users who send several messages in a row with the same PII
 * don't need repeat toasts in quick succession. A minimum cooldown
 * of `COOLDOWN_MS` is enforced between toasts. Telemetry is also
 * suppressed during the cooldown so the event is a "user was
 * nudged" signal rather than "PII existed in a sent message".
 *
 * Session-level dismiss (T-PM2-lite v1.1)
 * ---------------------------------------
 * When `ff.pii_heuristic_session_dismiss` is ON (default), the
 * toast renders an extra "Don't show again this session" button.
 * Clicking it writes `chatV9.piiToastDismissedForSession = '1'`
 * to `sessionStorage` and from that moment the listener bails
 * out of every subsequent event — no toast, no telemetry — for
 * the lifetime of the current tab. A brand-new tab starts with a
 * fresh sessionStorage so the nudge comes back.
 *
 * Kill-switch
 * -----------
 * When `ff.pii_heuristic_toast` is off, the listener is detached
 * entirely. The dispatch from the input is a no-op; no toast, no
 * telemetry, no detector run.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { detectPiiCategories, type PiiCategory } from '../../utils/piiHeuristic';
import {
  isPiiHeuristicSessionDismissEnabled,
  isPiiToastDismissedForSession,
  markPiiToastDismissedForSession,
} from '../../utils/piiHeuristicSessionDismissFlag';
import {
  CHAT_V9_PII_CHECK_EVENT,
  isPiiHeuristicToastEnabled,
} from '../../utils/piiHeuristicToastFlag';

const COOLDOWN_MS = 4000;

export interface PiiToastNotifyOptions {
  /**
   * When `true`, the default notifier renders an extra
   * "Don't show again this session" action inside the toast.
   * Calling the supplied `onDismissForSession` callback writes
   * the sessionStorage sentinel and suppresses future nudges for
   * this tab. When `false`, the toast renders the v1 shape.
   */
  showSessionDismissAction: boolean;
  /**
   * Callback the notifier should wire to the dismiss action.
   * Purely injected so the component keeps the side-effect (set
   * sessionStorage + bump cooldown) and the notifier stays a
   * pure presentation layer.
   */
  onDismissForSession: () => void;
}

export interface PiiHeuristicToastProps {
  /**
   * Test seam for the feature flag resolver. Production callers
   * never pass this.
   */
  isEnabled?: () => boolean;
  /**
   * Test seam for the session-dismiss kill-switch. Production
   * always uses `isPiiHeuristicSessionDismissEnabled`.
   */
  isSessionDismissEnabled?: () => boolean;
  /**
   * Test seam for the "is this tab already dismissed?" check.
   * Production always reads from sessionStorage via
   * `isPiiToastDismissedForSession`.
   */
  isDismissedForSession?: () => boolean;
  /**
   * Test seam for the toast emitter. Production uses
   * `react-hot-toast`. Tests inject a spy so we can assert the
   * exact payload without rendering a toast surface.
   */
  notify?: (message: string, options: PiiToastNotifyOptions) => void;
  /**
   * Test seam for the "mark dismissed for this tab" side effect.
   * Production writes to sessionStorage via
   * `markPiiToastDismissedForSession`.
   */
  markDismissed?: () => void;
}

const CATEGORY_LABELS: Record<PiiCategory, string> = {
  email: 'email',
  phone: 'phone number',
  iban: 'IBAN',
};

// eslint-disable-next-line react-refresh/only-export-components
export function buildPiiToastMessage(categories: readonly PiiCategory[]): string {
  if (categories.length === 0) return '';
  const rendered = categories.map((c) => CATEGORY_LABELS[c]).join(', ');
  return `Heads up — your last message looks like it contains ${rendered}. Double-check before Teresa keeps it in context.`;
}

function defaultNotify(message: string, options: PiiToastNotifyOptions): void {
  // `toast.error` is too loud for a heuristic nudge (red halo + long
  // stick time). A custom toast is neutral enough that a false
  // positive feels benign. Stick time is short so rapid follow-up
  // sends don't pile up warnings on screen.
  toast.custom(
    (t) => (
      <div
        role="status"
        aria-live="polite"
        data-testid="chat-v9-pii-toast"
        className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 text-[13px] text-slate-700 shadow-lg dark:border-amber-500/30 dark:bg-navy-900 dark:text-slate-200 ${
          t.visible ? 'animate-enter' : 'animate-leave'
        }`}
      >
        <span aria-hidden className="mt-[2px] text-base leading-none">
          ⚠️
        </span>
        <div className="min-w-0 flex-1">
          <p className="leading-snug">{message}</p>
          {options.showSessionDismissAction && (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                data-testid="chat-v9-pii-toast-session-dismiss"
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
                data-testid="chat-v9-pii-toast-dismiss"
                onClick={() => toast.dismiss(t.id)}
                className="text-[12px] font-medium text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    ),
    { duration: 4500 }
  );
}

export const PiiHeuristicToast: React.FC<PiiHeuristicToastProps> = ({
  isEnabled = isPiiHeuristicToastEnabled,
  isSessionDismissEnabled = isPiiHeuristicSessionDismissEnabled,
  isDismissedForSession = isPiiToastDismissedForSession,
  notify = defaultNotify,
  markDismissed = markPiiToastDismissedForSession,
}) => {
  const lastFiredAtRef = useRef<number>(0);

  const handleEvent = useCallback(
    (event: Event) => {
      if (!isEnabled()) return;
      // Session-dismiss check runs before the detector so a
      // dismissed tab never pays the regex cost either.
      if (isDismissedForSession()) return;

      const detail = (event as CustomEvent<{ text?: unknown } | undefined>).detail;
      const text = typeof detail?.text === 'string' ? detail.text : null;
      if (!text) return;

      const categories = detectPiiCategories(text);
      if (categories.length === 0) return;

      const now = Date.now();
      if (now - lastFiredAtRef.current < COOLDOWN_MS) return;
      lastFiredAtRef.current = now;

      const showSessionDismissAction = isSessionDismissEnabled();
      try {
        notify(buildPiiToastMessage(categories), {
          showSessionDismissAction,
          onDismissForSession: () => {
            try {
              markDismissed();
            } catch {
              // Sentinel write failed — the dismiss is a courtesy,
              // never a contract. Fall through.
            }
            // Bump the cooldown to "never fire again this tab
            // unless sessionStorage is cleared". Belt-and-
            // braces against the next event arriving before the
            // sessionStorage write has landed.
            lastFiredAtRef.current = Number.MAX_SAFE_INTEGER;
          },
        });
      } catch {
        // A thrown notifier is not a reason to crash the listener.
        // The toast is advisory; telemetry still fires so we can
        // see if the surface is silently broken.
      }

      try {
        trackFunnelEvent('pii_heuristic_warning_shown', {
          categories: [...categories],
        });
      } catch {
        // Telemetry is advisory too.
      }
    },
    [isEnabled, isSessionDismissEnabled, isDismissedForSession, notify, markDismissed]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.addEventListener(CHAT_V9_PII_CHECK_EVENT, handleEvent);
    return () => {
      window.removeEventListener(CHAT_V9_PII_CHECK_EVENT, handleEvent);
    };
  }, [handleEvent]);

  return null;
};

export default PiiHeuristicToast;
