const QUERY_KEY = 'ff_idea_notebook_right_panel_prototype';
const STORAGE_KEY = 'ff.ideaNotebookRightPanelPrototype';
const ENV_KEY = 'VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  if (['1', 'true', 'on'].includes(value)) return true;
  if (['0', 'false', 'off'].includes(value)) return false;
  return null;
}

export function isIdeaNotebookRightPanelPrototypeEnabled(): boolean {
  try {
    const query =
      typeof window === 'undefined'
        ? null
        : parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    if (query !== null) return query;

    const stored =
      typeof window === 'undefined' ? null : parseFlag(window.localStorage.getItem(STORAGE_KEY));
    if (stored !== null) return stored;

    // Static access is required: Vite replaces this expression in the browser
    // bundle, while a computed lookup remains unresolved.
    return parseFlag(import.meta.env.VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE) ?? false;
  } catch {
    return false;
  }
}

export const IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: STORAGE_KEY,
  env: ENV_KEY,
} as const;
