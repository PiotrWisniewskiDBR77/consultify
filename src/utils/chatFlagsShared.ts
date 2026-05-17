/**
 * Chat feature-flag shared helpers — generic utilities used by both the
 * Chat V9 registry (`chatV9FeatureFlags.ts`) and the Chat V10 registry
 * (`chatV10FeatureFlags.ts`).
 *
 * Scope (V10 scaffolding pass · 2026-04-18)
 * ------------------------------------------
 * Per master-plan decision D-2 (CHAT_V10_IMPLEMENTATION_PLAN §10,
 * resolved 2026-04-18), V10 lives in a separate registry file from V9;
 * cross-registry helpers are factored here so neither file owns the
 * write-side logic exclusively.
 *
 * V9 currently inlines equivalent helpers — that duplication is
 * intentional for this pass: editing V9 could destabilise 44 green
 * invariants, and the V9 inlines will be migrated to this module in a
 * separate passup. V10 wires to these helpers from day one.
 *
 * What lives here
 * ---------------
 * 1. `FlagKeys` — the three-key shape (`localStorage`, `query`, `env`)
 *    every registered flag declares.
 * 2. `FlagOverrideState` — the tri-state the hub UI exposes
 *    (`'on' | 'off' | null`).
 * 3. `writeFlagOverride` — SSR-safe `localStorage` writer. Returns `true`
 *    on success, `false` when the environment rejects the write (SSR,
 *    private-mode quota).
 * 4. `readFlagOverrideState` — reads the raw override state for a given
 *    key, ignoring URL query and env. Mirrors the V9 helper of the same
 *    purpose.
 *
 * What does NOT live here
 * -----------------------
 * - Registry data. Each version (V9, V10) owns its own descriptor array.
 * - `isEnabled()` resolvers. Each per-flag file (`src/utils/<name>Flag.ts`)
 *   owns its own URL / localStorage / env resolution — this module only
 *   handles raw override writes/reads.
 *
 * SSR safety
 * ----------
 * Every function here must work when `window` is `undefined`. Callers
 * inside SSR contexts (Next.js, unit tests) rely on the silent-fallback
 * contract; throwing from here would crash the render path.
 */

export interface FlagKeys {
  readonly localStorage: string;
  readonly query: string;
  readonly env: string;
}

export type FlagOverrideState = 'on' | 'off' | null;

/**
 * Writes a raw override value to `localStorage`. Pass `null` to remove
 * the key entirely (reverts the flag to env / default). SSR-safe: when
 * `window` is absent, returns `false` without throwing so callers can
 * surface the failure in the UI.
 */
export function writeFlagOverride(key: string, value: '1' | '0' | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the raw override state stored in `localStorage` for a given
 * storage key. Accepts the legacy string-boolean forms (`'true'` / `'false'`)
 * for compatibility with older helper contracts. Returns `null` when
 * there is no stored value, the value is malformed, or `window` is
 * unavailable.
 */
export function readFlagOverrideState(localStorageKey: string): FlagOverrideState {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(localStorageKey);
    if (raw === '1' || raw === 'true') return 'on';
    if (raw === '0' || raw === 'false') return 'off';
    return null;
  } catch {
    return null;
  }
}

/**
 * Maps a `FlagOverrideState` onto the two-string form `writeFlagOverride`
 * accepts. Extracted so the V9 and V10 registries route through the same
 * conversion and cannot drift (e.g. one registry accidentally writing
 * `'true'` while the other writes `'1'`).
 */
export function encodeFlagOverrideState(state: FlagOverrideState): '1' | '0' | null {
  if (state === null) return null;
  return state === 'on' ? '1' : '0';
}
