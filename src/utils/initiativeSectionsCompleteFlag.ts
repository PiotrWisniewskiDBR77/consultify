const QUERY_KEY = 'ff_initiative_sections_complete';
const LOCAL_STORAGE_KEY = 'ff.initiative.sections_complete';
const ENV_KEY = 'VITE_VF1_INITIATIVE_SECTIONS_COMPLETE';

function parseFlag(raw: unknown): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

/** DEC-388: operator override, user override, build-time env, fail-closed OFF. */
export function isInitiativeSectionsCompleteEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const query = parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    if (query !== null) return query;
  } catch {
    // Brak dostępu do location nie może ominąć kolejnych warstw.
  }

  try {
    const stored = parseFlag(window.localStorage?.getItem(LOCAL_STORAGE_KEY));
    if (stored !== null) return stored;
  } catch {
    // Prywatny/odcięty storage nie zmienia fail-closed semantyki.
  }

  try {
    // Keep the access static: Vite replaces only the literal env expression.
    const fromEnv = parseFlag(import.meta.env.VITE_VF1_INITIATIVE_SECTIONS_COMPLETE);
    if (fromEnv !== null) return fromEnv;
  } catch {
    // Brak import.meta.env przechodzi do defaultu OFF.
  }

  return false;
}

export const INITIATIVE_SECTIONS_COMPLETE_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
  env: ENV_KEY,
} as const;
