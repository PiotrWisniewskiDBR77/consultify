/**
 * Chat V9 / VOICE VM3.1 — feature flag for the voice-modes legend
 * keyboard shortcut.
 *
 * What this gates
 * ---------------
 * When on (default), a global `keydown` listener maps
 * `Alt+Shift+V` to "open the voice-modes legend popover from
 * anywhere inside the app". When off, the listener is still
 * mounted but short-circuits before doing any work; the legend
 * button in `EnhancedChatInput` keeps working as before. The
 * flag is independent of `voice-mode-legend` (VM3) — flipping
 * this kill-switch drops the shortcut without hiding the help
 * button.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_voiceLegendShortcut=0|1`.
 *   2. `localStorage["ff.voice_legend_shortcut"]`.
 *   3. `import.meta.env.VITE_VOICE_LEGEND_SHORTCUT`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.voice_legend_shortcut';
const QUERY_KEY = 'ff_voiceLegendShortcut';
const ENV_KEY = 'VITE_VOICE_LEGEND_SHORTCUT';

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

export function isVoiceLegendShortcutEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const VOICE_LEGEND_SHORTCUT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/**
 * Name of the CustomEvent dispatched on `window` to ask every
 * mounted `VoiceModeLegend` instance to open its popover. Exported
 * so the legend component and the shortcut component share a
 * single source of truth for the event name.
 */
export const VOICE_LEGEND_OPEN_EVENT = 'chat-v9-voice-legend:open';
