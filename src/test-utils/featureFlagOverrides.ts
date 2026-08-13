/**
 * Test-only helper for `useFeatureFlags`' localStorage-backed local overrides
 * (`src/hooks/useFeatureFlags.tsx`, `STORAGE_KEY = 'consultify_feature_flags'`).
 *
 * All Finance AP-mount flags (`useFinance*WorkspaceFlag.ts`) default to
 * `false` (CLAUDE.md #7/#9 — "wygląd tylko za flagą, domyślnie OFF"). Tests
 * that render the REAL, flag-gated workspace component (not a bypassed
 * "Inner" variant) need a way to flip the flag ON for that one test, the
 * same way a real user would via local override — this helper does exactly
 * that, nothing more (no mocking of the flag hook itself, so the gating
 * code under test stays 100% real).
 */

const STORAGE_KEY = 'consultify_feature_flags';

function readOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

/** Sets a local override for one or more flag ids (merges with any existing overrides). */
export function setFeatureFlagOverrides(overrides: Record<string, boolean>): void {
  writeOverrides({ ...readOverrides(), ...overrides });
}

/** Clears every local feature-flag override (call in `afterEach` to avoid leaking state across tests). */
export function clearFeatureFlagOverrides(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
