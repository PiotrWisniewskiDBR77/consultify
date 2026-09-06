/**
 * Chat V9 / C-IN4-lite — kill-switch for the input hint strip.
 *
 * When ON (default), `EnhancedChatInput` renders a compact
 * keyboard-affordance strip directly under the textarea:
 *
 *   `Enter ↲ send · Shift+Enter newline · Esc clear`
 *
 * When OFF, the strip renders nothing and the input collapses
 * back to its pre-C-IN4 layout.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_inputHintStrip=0|1`.
 *   2. `localStorage["ff.input_hint_strip"]`.
 *   3. `import.meta.env.VITE_INPUT_HINT_STRIP`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.input_hint_strip';
const QUERY_KEY = 'ff_inputHintStrip';
const ENV_KEY = 'VITE_INPUT_HINT_STRIP';

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

export function isInputHintStripEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const INPUT_HINT_STRIP_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
