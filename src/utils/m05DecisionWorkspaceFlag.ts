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
 * MW-05 (decision creation) accepted by Codex review. Per that review,
 * MW-06 now defaults ON for MVP — `DecisionWorkspace` is the live "decision"
 * document view. The legacy `DecisionDetailView` stays reachable instantly
 * as a kill-switch via any of the three overrides below (query for an
 * immediate per-session bypass, localStorage for a user/org override, env
 * for a build-time override) — no code change or redeploy needed to revert.
 *
 * Resolution order (highest wins), identical contract to
 * `m03TasksStandardTableFlag.ts` / `m03InboxStandardTableFlag.ts`:
 *   1. URL query `?ff_m05DecisionWorkspace=0|1` — instant kill-switch bypass.
 *   2. `localStorage["ff.m05_decision_workspace"]` — override user/org.
 *   3. `import.meta.env.VITE_M05_DECISION_WORKSPACE` — override build-time.
 *   4. Default: ON (MVP).
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
    return parsed === null ? true : parsed; // domyślnie ON — MVP, akcept Codex
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
