/**
 * Chat V9 / ADMIN AG1 v1.12 — kill-switch for the "Copy
 * override URL" button in the admin flag panel header.
 *
 * What this gates
 * ---------------
 * When ON (default) the `ChatV9FlagsPanel` renders a second
 * header button, next to the AG1 v1.2 "Copy snapshot" button,
 * that writes a shareable URL encoding every current override
 * as `?<flag.keys.query>=0|1`. The URL re-creates the
 * originator's exact override set when opened in any browser.
 *
 * The button is only enabled while at least one override is
 * live — there is no value in copying a URL that encodes
 * "everything at its shipped default".
 *
 * When OFF the button is not rendered; the header layout is
 * pixel-identical to the pre-AG1-v1.12 build.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsPanelOverrideUrlCopy=0|1`.
 *   2. `localStorage["ff.flags_panel_override_url_copy"]`.
 *   3. `import.meta.env.VITE_FLAGS_PANEL_OVERRIDE_URL_COPY`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_panel_override_url_copy';
const QUERY_KEY = 'ff_flagsPanelOverrideUrlCopy';
const ENV_KEY = 'VITE_FLAGS_PANEL_OVERRIDE_URL_COPY';

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
    return parsed === null ? true : parsed;
  } catch {
    return true;
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

export function isFlagsPanelOverrideUrlCopyEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_PANEL_OVERRIDE_URL_COPY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
