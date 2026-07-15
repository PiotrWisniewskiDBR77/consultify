/**
 * Artifact approval status-bar flag (HP-8, 2026-07-15).
 *
 * HP-7 wired a real REST surface for artifactApprovalService.ts
 * (`/api/artifact-approvals/:type/:id/...`, see
 * `server/src/routes/artifactApprovals.routes.ts`). HP-8 is the UI
 * consumer — a small draft/review/approved(/rejected) status pill +
 * role-appropriate actions meant to live in `ArtifactRightPanel`.
 *
 * Per CLAUDE.md rule #7 (Piotr is never the first visual tester) and the
 * `consultify-artefakty` skill's DoD §18.1 (dark+light screenshots +
 * owner acceptance BEFORE anything touches a shared shell like
 * `ArtifactRightPanel`), the actual visual wiring/polish belongs to a
 * follow-up (Vegas) pass that renders it, screenshots it, and gets
 * sign-off — not to this backend-wiring task. This flag exists so that
 * work can drop in the already-built `ArtifactApprovalStatusBar` +
 * `useArtifactApprovalStatus` (src/components/standard, src/hooks) behind
 * an explicit default-OFF switch instead of reinventing one.
 *
 * Resolution order (highest wins), same shape as `studioFlag.ts` /
 * `templateLifecycleFlag.ts`:
 *   1. URL query `?ff_artifactApprovalUi=0|1` — operator bypass.
 *   2. `localStorage["ff.artifactApprovalUi"]` — user/org override.
 *   3. Default: OFF (nothing renders differently until Vegas flips it after
 *      owner acceptance on screenshots).
 */

const LS_KEY = 'ff.artifactApprovalUi';
const QUERY_KEY = 'ff_artifactApprovalUi';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
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

export function isArtifactApprovalUiEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return false;
}

export const ARTIFACT_APPROVAL_UI_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
} as const;
