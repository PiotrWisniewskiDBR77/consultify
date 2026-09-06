/**
 * Chat V9 / VOICE VM3.2 — kill-switch for the "Copy legend"
 * button inside the voice-modes popover.
 *
 * What this gates
 * ---------------
 * When ON (default) the `VoiceModeLegend` popover renders a
 * small "Copy" button in its footer. The button copies a
 * Markdown-ish payload (built by `buildVoiceLegendCopyText`)
 * describing whichever layout the popover is currently
 * showing — two-mode explanation OR the VM1-lite "voice is
 * unavailable" message.
 *
 * When OFF the button is not rendered; the popover is pixel-
 * identical to the pre-VM3.2 build.
 *
 * No new telemetry lives behind this flag — `voice_mode_legend_opened`
 * already covers "user wanted the explanation"; whether they
 * then copy it to clipboard is a refinement for a future ticket.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_voiceLegendCopyText=0|1`.
 *   2. `localStorage["ff.voice_legend_copy_text"]`.
 *   3. `import.meta.env.VITE_VOICE_LEGEND_COPY_TEXT`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.voice_legend_copy_text';
const QUERY_KEY = 'ff_voiceLegendCopyText';
const ENV_KEY = 'VITE_VOICE_LEGEND_COPY_TEXT';

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

export function isVoiceLegendCopyTextEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const VOICE_LEGEND_COPY_TEXT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
