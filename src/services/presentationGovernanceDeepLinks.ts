/**
 * presentationGovernanceDeepLinks
 *
 * Pure deep-link logic for the Consultify SuperAdmin Governance dashboard
 * (Connector Ops > Presentation* tabs). Provides a single, validated shape
 * for cross-tab URL state and small SSR-safe boundary helpers
 * (`applyToLocation` / `parseFromLocation`) so the views never have to
 * touch `window` directly except through these functions.
 *
 * The contract is intentionally small: views import {parse,build,read,
 * apply,diff} only at their boundary effects (mount, tab change, popstate)
 * and treat the rest of the deep-link state as inert data. Validation is
 * strict — unknown / malformed values become `null` rather than being
 * silently passed through, which keeps every consumer honest about what
 * the URL actually carried in.
 *
 * No side effects at module load. No history mutation outside
 * `applyDashboardDeepLinkToLocation`. SSR-safe by construction (every
 * `window` access is guarded).
 */

export type DashboardTab =
  | 'presentation-telemetry'
  | 'presentation-watchlist'
  | 'presentation-operations-health'
  | 'presentation-alert-subscriptions';

export type DashboardSloId =
  | 'generation_success_rate'
  | 'export_success_rate'
  | 'p95_generation_latency_ms'
  | 'agent_edit_success_rate'
  | 'export_blocked_rate';

export interface DashboardDeepLink {
  tab: DashboardTab | null;
  deckId: string | null;
  slo: DashboardSloId | null;
  presetId: string | null;
  windowDays: number | null;
}

export const PARAM_KEYS = {
  tab: 'tab',
  deckId: 'deckId',
  slo: 'slo',
  presetId: 'presetId',
  windowDays: 'windowDays',
} as const;

const ALLOWED_TABS: ReadonlySet<DashboardTab> = new Set<DashboardTab>([
  'presentation-telemetry',
  'presentation-watchlist',
  'presentation-operations-health',
  'presentation-alert-subscriptions',
]);

const ALLOWED_SLOS: ReadonlySet<DashboardSloId> = new Set<DashboardSloId>([
  'generation_success_rate',
  'export_success_rate',
  'p95_generation_latency_ms',
  'agent_edit_success_rate',
  'export_blocked_rate',
]);

// Stable key order so links stay diff-friendly and easy to eyeball in
// share dialogs / tests. Do not reorder without updating the round-trip
// test that asserts this exact sequence.
const STABLE_KEY_ORDER: ReadonlyArray<keyof typeof PARAM_KEYS> = [
  'tab',
  'deckId',
  'slo',
  'presetId',
  'windowDays',
];

const ID_MAX_LENGTH = 80;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const WINDOW_DAYS_MIN = 1;
const WINDOW_DAYS_MAX = 90;

function isAllowedTab(value: string): value is DashboardTab {
  return ALLOWED_TABS.has(value as DashboardTab);
}

function isAllowedSlo(value: string): value is DashboardSloId {
  return ALLOWED_SLOS.has(value as DashboardSloId);
}

function sanitizeId(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > ID_MAX_LENGTH) return null;
  if (!ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function clampWindowDays(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < WINDOW_DAYS_MIN) return WINDOW_DAYS_MIN;
  if (parsed > WINDOW_DAYS_MAX) return WINDOW_DAYS_MAX;
  return parsed;
}

function emptyDeepLink(): DashboardDeepLink {
  return {
    tab: null,
    deckId: null,
    slo: null,
    presetId: null,
    windowDays: null,
  };
}

/**
 * Parse a `URLSearchParams`-compatible string (with or without leading `?`)
 * into a strictly validated `DashboardDeepLink`. Any unknown / malformed
 * value becomes `null`; unknown query keys are silently ignored, which
 * keeps the function backwards-compatible with future params and with
 * unrelated URL noise (analytics tags, etc.).
 */
export function parseDashboardDeepLink(searchString: string): DashboardDeepLink {
  const result = emptyDeepLink();
  if (typeof searchString !== 'string' || searchString.length === 0) {
    return result;
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(
      searchString.startsWith('?') ? searchString.slice(1) : searchString
    );
  } catch {
    return result;
  }

  const rawTab = params.get(PARAM_KEYS.tab);
  if (rawTab && isAllowedTab(rawTab)) {
    result.tab = rawTab;
  }

  const rawSlo = params.get(PARAM_KEYS.slo);
  if (rawSlo && isAllowedSlo(rawSlo)) {
    result.slo = rawSlo;
  }

  result.deckId = sanitizeId(params.get(PARAM_KEYS.deckId));
  result.presetId = sanitizeId(params.get(PARAM_KEYS.presetId));
  result.windowDays = clampWindowDays(params.get(PARAM_KEYS.windowDays));

  return result;
}

/**
 * Build a deep-link URL for a `DashboardDeepLink` state. Only non-null
 * values are emitted; the resulting query string is keyed in a stable
 * order so two calls with the same state produce byte-identical URLs.
 *
 * `baseUrl` defaults to `'/'` and is preserved verbatim for the path.
 * Existing query / hash on `baseUrl` is overwritten by the new query
 * string — this function is intentionally not "merge into existing
 * URL"; for that, use `applyDashboardDeepLinkToLocation` which preserves
 * unrelated params.
 */
export function buildDashboardDeepLink(
  state: DashboardDeepLink,
  baseUrl?: string
): string {
  const path = baseUrl ?? '/';
  const params = new URLSearchParams();

  for (const key of STABLE_KEY_ORDER) {
    const value = state[key];
    if (value === null || value === undefined) continue;
    params.set(PARAM_KEYS[key], String(value));
  }

  const query = params.toString();
  if (query.length === 0) return path;

  // Preserve any pre-existing path/hash on baseUrl, but overwrite query.
  // Hand-rolled instead of `URL` to keep relative bases like '/' working
  // without needing a synthetic origin (which would leak into the output).
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const beforeHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = beforeHash.indexOf('?');
  const pathOnly = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;

  return `${pathOnly}?${query}${hash}`;
}

/**
 * Merge the given `state` into `window.location.search` and write it
 * back via History API. SSR-safe (no-op when `window` is undefined).
 *
 * - When `replace !== false` (default): uses `history.replaceState` so
 *   the browser back button is not polluted on routine tab clicks.
 * - When `replace === false`: uses `history.pushState`, suitable for
 *   intentional navigations the user may want to reverse with Back.
 *
 * Existing unrelated query params on the location are preserved.
 * Deep-link keys with a `null` value in `state` are removed from the
 * URL so the result reflects the canonical shape.
 */
export function applyDashboardDeepLinkToLocation(
  state: DashboardDeepLink,
  opts?: { replace?: boolean }
): void {
  if (typeof window === 'undefined' || !window.history || !window.location) {
    return;
  }
  const replace = opts?.replace !== false;

  const current = new URLSearchParams(window.location.search);
  for (const key of STABLE_KEY_ORDER) {
    const value = state[key];
    if (value === null || value === undefined) {
      current.delete(PARAM_KEYS[key]);
    } else {
      current.set(PARAM_KEYS[key], String(value));
    }
  }

  // Re-emit our keys in stable order, after preserving unrelated keys
  // in their original relative order. This keeps deep-link share URLs
  // canonical without disturbing analytics / utm_* params someone else
  // appended.
  const ourKeys = new Set<string>(Object.values(PARAM_KEYS));
  const preserved: Array<[string, string]> = [];
  current.forEach((value, key) => {
    if (!ourKeys.has(key)) preserved.push([key, value]);
  });

  const next = new URLSearchParams();
  for (const [k, v] of preserved) next.append(k, v);
  for (const key of STABLE_KEY_ORDER) {
    const value = state[key];
    if (value === null || value === undefined) continue;
    next.set(PARAM_KEYS[key], String(value));
  }

  const query = next.toString();
  const newUrl = `${window.location.pathname}${query.length > 0 ? `?${query}` : ''}${window.location.hash || ''}`;

  try {
    if (replace) {
      window.history.replaceState(window.history.state, '', newUrl);
    } else {
      window.history.pushState(window.history.state, '', newUrl);
    }
  } catch {
    // Some embedded contexts disallow history mutation. Fail silently
    // because this is purely a UX nicety, not a correctness signal.
  }
}

/**
 * Read the current location into a `DashboardDeepLink`. SSR-safe —
 * returns the all-null shape when `window` is undefined.
 */
export function readDashboardDeepLinkFromLocation(): DashboardDeepLink {
  if (typeof window === 'undefined' || !window.location) {
    return emptyDeepLink();
  }
  return parseDashboardDeepLink(window.location.search);
}

/**
 * Diff helper for view-side effect triggers. Returns the keys whose
 * values differ between `prev` and `next`. Useful for "only re-run my
 * mount logic if my deep-link slice actually changed".
 */
export function diffDeepLinkChanged(
  prev: DashboardDeepLink,
  next: DashboardDeepLink
): (keyof DashboardDeepLink)[] {
  const changed: (keyof DashboardDeepLink)[] = [];
  for (const key of STABLE_KEY_ORDER) {
    if (prev[key] !== next[key]) changed.push(key);
  }
  return changed;
}
