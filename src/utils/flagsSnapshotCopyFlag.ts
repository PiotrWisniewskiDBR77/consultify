/**
 * Chat V9 / ADMIN AG1 v1.2 — feature flag for the "Copy snapshot"
 * button in `ChatV9FlagsPanel`.
 *
 * Why gate an admin-only button
 * -----------------------------
 *   - The panel is already role-gated (SUPERADMIN / OWNER / ADMIN)
 *     and reached via `?v9flags=1`, so the button's discoverability
 *     risk is zero.
 *   - The kill-switch is there purely for **ops**. Some corporate
 *     browser policies prompt on every `navigator.clipboard.writeText`
 *     call, which is bad UX inside an internal tool. If that ever
 *     becomes a recurring report, flipping this flag OFF removes
 *     the button entirely without a redeploy.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsSnapshotCopy=0|1`.
 *   2. `localStorage["ff.flags_snapshot_copy"]`.
 *   3. `import.meta.env.VITE_FLAGS_SNAPSHOT_COPY`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_snapshot_copy';
const QUERY_KEY = 'ff_flagsSnapshotCopy';
const ENV_KEY = 'VITE_FLAGS_SNAPSHOT_COPY';

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

export function isFlagsSnapshotCopyEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_SNAPSHOT_COPY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
