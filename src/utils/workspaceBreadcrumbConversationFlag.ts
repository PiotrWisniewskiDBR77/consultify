/**
 * Chat V9 / NAV-M2-lite+ — kill-switch for the active conversation
 * title as the third breadcrumb segment.
 *
 * When ON (default), the breadcrumb pill renders
 * `Chat › <view label> › <conversation title>` whenever the active
 * conversation has a non-empty title. When OFF, the pill collapses
 * back to the NAV-M2-lite two-segment shape
 * `Chat › <view label>` — the base NAV-M2-lite kill-switch
 * (`ff.workspace_breadcrumb`) remains the outer safety net.
 *
 * Having the extension behind its own flag means ops can cut the
 * title segment independently if a noisy / long / PII-ish
 * conversation title ever shows up, without losing the base
 * wayfinding pill.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumbConversation=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb_conversation"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB_CONVERSATION`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb_conversation';
const QUERY_KEY = 'ff_workspaceBreadcrumbConversation';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB_CONVERSATION';

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

export function isWorkspaceBreadcrumbConversationEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_CONVERSATION_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
