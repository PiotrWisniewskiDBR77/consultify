const LS_KEY = 'ff.idea_inspector_right_rail';
const QUERY_KEY = 'ff_ideaInspectorRightRail';
const ENV_KEY = 'VITE_IDEA_INSPECTOR_RIGHT_RAIL';

const parse = (raw: string | null | undefined): boolean | null => {
  if (raw == null) return null;
  if (['1', 'true', 'on'].includes(raw.trim().toLowerCase())) return true;
  if (['0', 'false', 'off'].includes(raw.trim().toLowerCase())) return false;
  return null;
};

let cached: boolean | null = null;
export function isIdeaInspectorRightRailEnabled(): boolean {
  if (cached !== null) return cached;
  const query =
    typeof window === 'undefined'
      ? null
      : parse(new URLSearchParams(window.location.search).get(QUERY_KEY));
  const local =
    query === null && typeof window !== 'undefined'
      ? parse(window.localStorage.getItem(LS_KEY))
      : null;
  const env = parse((import.meta as unknown as { env?: Record<string, string> }).env?.[ENV_KEY]);
  // DEC-90: default ON. localStorage 'off' (and the URL query override) must
  // still be able to disable it per-user/per-session — only the bottom of
  // the fallback chain flipped from false to true.
  cached = query ?? local ?? env ?? true;
  return cached;
}

export const resetIdeaInspectorRightRailFlagCache = () => {
  cached = null;
};
export const IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
