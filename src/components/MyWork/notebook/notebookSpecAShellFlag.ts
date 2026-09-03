/**
 * Notebook SPEC-A shell rollout flag.
 *
 * DEC 03.09 wieczór (R-11, MYW-NBK-CORE-001,
 * docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md wiersz 39 — "Włączamy
 * domyślnie zaakceptowany widok Notatnika (Praca/Kontekst)? TAK"): widok
 * przeszedł odbiór na 8/8 zrzutach (light/dark × oba stany) i 31/31
 * plików/82/82 nazw testów Notatnika PASS
 * (docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md
 * wiersz MYW-NBK-CORE-001) — jedyne, czego brakowało, to zgoda właściciela
 * na zmianę defaultu, nie kod. Flaga jest teraz domyślnie ON.
 *
 * Malformed/unavailable inputs still resolve to this default (ON), not to a
 * hardcoded `false` — see `isNotebookSpecAShellEnabled()` below. An explicit
 * local override can still turn it OFF (query, local override, or build-time
 * environment) — awaryjny wyłącznik CLAUDE.md §8.
 */
export const ENABLE_NOTEBOOK_SPEC_A_SHELL = true;

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
