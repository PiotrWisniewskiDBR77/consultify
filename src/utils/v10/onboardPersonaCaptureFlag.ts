/**
 * Chat V10 / V10-ONB-001 — feature flag for persona capture.
 *
 * What this flag gates
 * --------------------
 * The V10 first-run persona capture surface (picker UI + inference
 * resolver). At Wave A seed only the `PersonaCapture` schema exists;
 * the gate becomes meaningful when V10-ONB-002..005 ship the picker,
 * inference, override, and trust banner.
 *
 * When OFF: tenants fall back to V9 generic onboarding (no persona
 * record materialised). This is the documented kill-switch in
 * `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN §V10-ONB-001 acceptance
 * criteria #5`.
 *
 * Default
 * -------
 * **OFF**. See `ADR-V10-002`.
 *
 * Resolution order
 * ----------------
 *   1. URL query   `?ff_onboard_persona_capture=0|1`
 *   2. localStorage `ff.onboard_persona_capture`
 *   3. env          `VITE_ONBOARD_PERSONA_CAPTURE`
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.onboard_persona_capture';
const QUERY_KEY = 'ff_onboard_persona_capture';
const ENV_KEY = 'VITE_ONBOARD_PERSONA_CAPTURE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? false : parsed;
  } catch {
    return false;
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

export function isOnboardPersonaCaptureEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_PERSONA_CAPTURE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
