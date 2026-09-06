/** Assessment DOCX download reveal flag. Query > localStorage > env > OFF. */
const LS_KEY = 'ff.assessment_docx';
const QUERY_KEY = 'ff_assessmentDocx';
const ENV_KEY = 'VITE_ASSESSMENT_DOCX_ENABLED';

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

export function isAssessmentDocxEnabled(): boolean {
  return resolveAssessmentDocxFlag(readQueryOverride(), readLocalStorage(), readEnvFlag());
}

export function resolveAssessmentDocxFlag(
  query: boolean | null,
  local: boolean | null,
  env: boolean
): boolean {
  return query ?? local ?? env;
}

export const ASSESSMENT_DOCX_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
