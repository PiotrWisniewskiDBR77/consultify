/**
 * Interview Creator Shell rollout gate (DEC-2026-08-25-67).
 *
 * DEC 03.09 wieczór (A4, docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md
 * wiersz A4 — "Kreator wywiadu → ON od razu"): wizualna akceptacja jest
 * zamknięta, flaga przełączona na domyślne ON.
 *
 * Resolution order: URL query, localStorage, Vite build env, then hard ON.
 * Override OFF nadal możliwy (query/localStorage) — awaryjny wyłącznik
 * CLAUDE.md §8.
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
    // DEC 03.09 wieczór (A4): domyślna wartość ON w kodzie (nie w env) —
    // produkcja bez żadnej zmiennej pokazuje zatwierdzony kreator.
    return (
      parseFlag(
        (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
      ) ?? true
    );
  } catch {
    // fail-CLOSED na błąd odczytu środowiska pozostaje bezpieczniejszym
    // fallbackiem niż fail-open (wzorzec `orgRedesignFlag.ts`/`chatSignalsFeedFlag.ts`).
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
