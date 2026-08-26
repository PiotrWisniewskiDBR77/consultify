/**
 * Interview Creator Shell rollout gate (DEC-2026-08-25-67).
 *
 * Resolution order: URL query, localStorage, Vite build env, then hard OFF.
 * The shell remains opt-in until visual acceptance has been completed.
 */

const LS_KEY = 'ff.interview_creator_shell';
const QUERY_KEY = 'ff_interviewCreatorShell';
const ENV_KEY = 'VITE_INTERVIEW_CREATOR_SHELL';

export const INTERVIEW_CREATOR_SHELL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readQueryOverride(): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.location?.search) return null;
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorageOverride(): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return parseFlag(meta.env?.[ENV_KEY]) ?? false;
  } catch {
    return false;
  }
}

export function isInterviewCreatorShellEnabled(): boolean {
  const queryOverride = readQueryOverride();
  if (queryOverride !== null) return queryOverride;

  const localOverride = readLocalStorageOverride();
  if (localOverride !== null) return localOverride;

  return readEnvFlag();
}
