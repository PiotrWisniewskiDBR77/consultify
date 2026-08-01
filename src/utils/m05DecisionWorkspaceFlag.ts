/**
 * M05 Decision → DecisionWorkspace (real backend, packet MW-06).
 *
 * `MyWorkHub`'s `case 'decision':` branch mounts `DecisionDetailView`, a legacy
 * component that fakes most of its state via `localStorage` — no real
 * persistence, no create support. `DecisionWorkspace` (`src/components/MyWork/
 * Decision/DecisionWorkspace.tsx`) is the real-backend replacement (adds
 * decision creation support), but has not been visually accepted by the
 * product owner yet.
 *
 * Wizualnie NOWY (real backend fetch/save flow, own layout/loading/error
 * states) → domyślnie OFF (reguła #7/#9: nic wizualnie nowego nie idzie na
 * żywo bez zrzutu i akceptu Piotra). The legacy `DecisionDetailView` remains
 * the default render; flipping this flag ON swaps the "decision" document
 * type to `DecisionWorkspace`. Flip to ON only after Piotr accepts a clean
 * screenshot pass.
 *
 * Resolution order (highest wins), identical contract to
 * `m03TasksStandardTableFlag.ts` / `m03InboxStandardTableFlag.ts`:
 *   1. URL query `?ff_m05DecisionWorkspace=0|1` — bypass operatora (staging / zrzut).
 *   2. `localStorage["ff.m05_decision_workspace"]` — override user/org.
 *   3. `import.meta.env.VITE_M05_DECISION_WORKSPACE` — override build-time.
 *   4. Default: OFF (pending akcept Piotra).
 */

const LS_KEY = 'ff.m05_decision_workspace';
const QUERY_KEY = 'ff_m05DecisionWorkspace';
const ENV_KEY = 'VITE_M05_DECISION_WORKSPACE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? false : parsed; // domyślnie OFF — brak akceptu Piotra
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

export function isM05DecisionWorkspaceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const M05_DECISION_WORKSPACE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
