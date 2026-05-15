/**
 * Chat V9 / VOICE VM4 — barge-in acknowledgement toast with debounce.
 *
 * When a user mutes TTS mid-playback (`UnifiedChatPanel` volume button
 * while `voiceState.isSpeaking`), we confirm the interrupt landed so
 * they know the system heard them. The toast is intentionally short —
 * the spec (`VM4`) calls for "Przerwano odczyt — słucham." but we keep
 * the copy honest: we are not switching to listen mode automatically,
 * just acknowledging the stop.
 *
 * Debounce contract
 * -----------------
 *   Spec DoD: "Nie spamuje przy wielokrotnych przerwach (debounce)."
 *   We cap to at most one toast per `DEBOUNCE_MS` (1500 ms). Subsequent
 *   calls inside the window are silently dropped and do **not** emit
 *   telemetry — the user saw the same toast seconds ago.
 *
 * Why a module-scoped lastShownAt instead of a hook
 * -------------------------------------------------
 *   Barge-in can happen from multiple call sites over the session
 *   (mute button, potentially press-to-talk). A module-scoped guard
 *   means all call sites share the same rate-limit window without
 *   needing a shared context. Tests can reset the state via
 *   `resetBargeInToastState()`.
 */

import toast from 'react-hot-toast';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { isBargeInToastEnabled } from './bargeInToastFlag';

const DEBOUNCE_MS = 1500;

type BargeInSource =
  | 'mute_button'
  // Reserved for future call sites. Keep enum closed so telemetry
  // consumers can depend on a known set.
  | 'replay_button'
  | 'mic_button'
  | 'end_conversation'
  | 'unknown';

interface NotifyBargeInOptions {
  /** User-visible copy for the toast. Caller owns i18n. */
  message: string;
  /** Which gesture triggered the barge-in. Closed enum. */
  source?: BargeInSource;
  /** Override the current time — exposed for tests. Defaults to `Date.now()`. */
  now?: number;
}

// `Number.NEGATIVE_INFINITY` so the first call is never inside the
// debounce window — regardless of how low `Date.now()` (or a test
// `now:`) starts. Using `0` would block any call with `now < DEBOUNCE_MS`.
let lastShownAt = Number.NEGATIVE_INFINITY;

export function notifyBargeIn({
  message,
  source = 'unknown',
  now = Date.now(),
}: NotifyBargeInOptions): boolean {
  if (!isBargeInToastEnabled()) return false;
  if (now - lastShownAt < DEBOUNCE_MS) return false;
  lastShownAt = now;

  try {
    // `toast` icon slot is intentionally empty — the text alone communicates
    // the acknowledgement. A custom icon here would compete with the volume
    // button that fired the interrupt.
    toast(message, {
      duration: 2200,
      position: 'bottom-center',
      id: 'voice-barge-in',
    });
  } catch {
    // Toast host may not be mounted in edge cases (SSR, hot-reload race);
    // swallow silently — VM4 toast must never break the mute gesture.
  }

  try {
    trackFunnelEvent('voice_barge_in_notified', { source });
  } catch {
    // Telemetry is advisory; failures never block the user path.
  }

  return true;
}

/**
 * Reset the module-scoped debounce state. Only for tests — production
 * code MUST rely on the 1.5 s window. Shipped here (not in a test file)
 * so tests can import a typed helper instead of monkey-patching.
 */
export function resetBargeInToastState(): void {
  lastShownAt = Number.NEGATIVE_INFINITY;
}

export const BARGE_IN_TOAST_DEBOUNCE_MS = DEBOUNCE_MS;
