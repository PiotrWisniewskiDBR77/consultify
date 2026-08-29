/**
 * Notebook SPEC-A shell rollout flag.
 *
 * The accepted Notebook remains the fail-closed default. The shared shell can
 * be enabled only for an explicit review session (query, local override, or
 * build-time environment), and malformed/unavailable inputs resolve to false.
 */
export const ENABLE_NOTEBOOK_SPEC_A_SHELL = false;

const QUERY_KEY = 'ff_notebookSpecAShell';
const STORAGE_KEY = 'ff.ENABLE_NOTEBOOK_SPEC_A_SHELL';
const ENV_KEY = 'VITE_ENABLE_NOTEBOOK_SPEC_A_SHELL';

function parseFlag(value: string | null | undefined): boolean | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'off'].includes(normalized)) return false;
  return null;
}

export function isNotebookSpecAShellEnabled(): boolean {
  try {
    const query =
      typeof window === 'undefined'
        ? null
        : parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    const local =
      query === null && typeof window !== 'undefined'
        ? parseFlag(window.localStorage.getItem(STORAGE_KEY))
        : null;
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return query ?? local ?? parseFlag(meta.env?.[ENV_KEY]) ?? ENABLE_NOTEBOOK_SPEC_A_SHELL;
  } catch {
    return ENABLE_NOTEBOOK_SPEC_A_SHELL;
  }
}

export const NOTEBOOK_SPEC_A_SHELL_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: STORAGE_KEY,
  env: ENV_KEY,
} as const;
