/**
 * Chat V9 / VOICE VM3 — feature flag for the voice mode legend popover.
 *
 * Where this flag gates
 * ---------------------
 *   - `VoiceModeLegend` renders a "?" affordance next to the mic button
 *     in `EnhancedChatInput`. When the flag is off, the button is hidden
 *     and the popover never mounts. The mic button itself is unaffected.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_voiceModeLegend=0|1` — operator bypass.
 *   2. `localStorage["ff.voice_mode_legend"]` — user override.
 *   3. `import.meta.env.VITE_VOICE_MODE_LEGEND` — build-time default.
 *   4. Default: ON. A legend popover is additive — it explains existing
 *      UX, it doesn't change any runtime voice behaviour.
 */

const LS_KEY = 'ff.voice_mode_legend';
const QUERY_KEY = 'ff_voiceModeLegend';
const ENV_KEY = 'VITE_VOICE_MODE_LEGEND';

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

export function isVoiceModeLegendEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const VOICE_MODE_LEGEND_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
