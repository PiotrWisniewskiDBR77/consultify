/**
 * Chat V9 / INPUT C-IN1 — feature flag for the next-message model chip.
 *
 * Where this flag gates
 * ---------------------
 *   - `NextModelChip` renders a tiny read-only pill inside
 *     `EnhancedChatInput`'s action bar, showing which model will handle
 *     the user's next send (e.g. `"→ gpt-4o"`). Symmetric with the
 *     post-reply Trust Badge: Trust Badge explains *what just ran*,
 *     this chip telegraphs *what is about to run*.
 *   - When the flag is off, the chip renders nothing — the existing
 *     `ModelSelector` surface is unaffected and remains the canonical
 *     place to *change* the active model.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_nextModelChip=0|1` — operator bypass.
 *   2. `localStorage["ff.next_model_chip"]` — user / org override.
 *   3. `import.meta.env.VITE_NEXT_MODEL_CHIP` — build-time default.
 *   4. Default: ON. The chip is purely informational and never mutates
 *      config, so the additive kill-switch is safe to default-on.
 */

const LS_KEY = 'ff.next_model_chip';
const QUERY_KEY = 'ff_nextModelChip';
const ENV_KEY = 'VITE_NEXT_MODEL_CHIP';

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

export function isNextModelChipEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const NEXT_MODEL_CHIP_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
