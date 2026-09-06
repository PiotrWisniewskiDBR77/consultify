/**
 * Chat V9 / VOICE VM4 — feature flag for the barge-in acknowledgement
 * toast. When a user mutes TTS mid-playback, we surface a short toast
 * confirming that their interrupt landed (spec: `VOICE_MODE_AUDIO_
 * EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#VM4`).
 *
 * Where this flag gates
 * ---------------------
 *   - `notifyBargeIn()` is a no-op when the flag is off. The underlying
 *     `stopSpeaking()` behaviour is untouched — only the toast + the
 *     telemetry event are gated.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_bargeInToast=0|1` — operator bypass.
 *   2. `localStorage["ff.barge_in_toast"]` — user override.
 *   3. `import.meta.env.VITE_BARGE_IN_TOAST` — build-time default.
 *   4. Default: ON. Risk is low — a toast is additive and the debounce
 *      in `bargeInToast.ts` caps frequency to <= 1 per `DEBOUNCE_MS`.
 */

const LS_KEY = 'ff.barge_in_toast';
const QUERY_KEY = 'ff_bargeInToast';
const ENV_KEY = 'VITE_BARGE_IN_TOAST';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    return parsed === null ? true : parsed;
  } catch {
    return true;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isBargeInToastEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const BARGE_IN_TOAST_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
