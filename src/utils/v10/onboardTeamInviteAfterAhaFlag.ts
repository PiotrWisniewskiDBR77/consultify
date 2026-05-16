/**
 * Chat V10 / V10-ONB-025 — feature flag for the team-invite-after-aha
 * gate (CTA hidden until `onboard.artifact_saved` OR
 * `onboard.artifact_approved` fires; quiet hint pre-aha; no
 * interactive invite UI pre-aha).
 *
 * Runtime contract lives in
 * `src/models/onboarding/TeamInviteAfterAha.ts`. Default OFF —
 * Wave A seed pins the CTA-state reducer and three invariants;
 * Wave B wires the invite modal and the next-best-action row CTA.
 */

const LS_KEY = 'ff.onboard_team_invite_after_aha';
const QUERY_KEY = 'ff_onboard_team_invite_after_aha';
const ENV_KEY = 'VITE_ONBOARD_TEAM_INVITE_AFTER_AHA';

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

export function isOnboardTeamInviteAfterAhaEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_TEAM_INVITE_AFTER_AHA_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
