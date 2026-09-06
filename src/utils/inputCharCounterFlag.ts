/**
 * Chat V9 / INPUT C-IN2 — feature flag for the input character counter.
 *
 * Where this flag gates
 * ---------------------
 *   - `InputCharCounter` renders a small read-only pill in
 *     `EnhancedChatInput`'s action bar that appears only once the
 *     composed message crosses a threshold length. It colour-codes
 *     as the message approaches a soft max so the user sees the
 *     scale of what they are about to send before pressing Send.
 *   - When the flag is off, the pill never renders — the textarea
 *     remains exactly as it was before.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_inputCharCounter=0|1` — operator bypass.
 *   2. `localStorage["ff.input_char_counter"]` — user / org override.
 *   3. `import.meta.env.VITE_INPUT_CHAR_COUNTER` — build-time default.
 *   4. Default: ON. The counter is purely informational and never
 *      blocks Send, so the additive kill-switch is safe to default-on.
 */

const LS_KEY = 'ff.input_char_counter';
const QUERY_KEY = 'ff_inputCharCounter';
const ENV_KEY = 'VITE_INPUT_CHAR_COUNTER';

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

export function isInputCharCounterEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const INPUT_CHAR_COUNTER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
