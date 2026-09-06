/**
 * Studio chat-crash containment flag (2026-07-11).
 *
 * `/studio` (StudioView, reachable directly by URL and via the global
 * Command Palette "Studio" entry — no BetaGate) renders an AI chat panel
 * (`StudioChat` -> `useStudioAI`) by default. That hook calls five endpoints
 * that were NEVER implemented server-side:
 *   POST /api/studio/ai/chat
 *   POST /api/studio/ai/generate
 *   POST /api/studio/ai/modify
 *   POST /api/studio/ai/suggest
 *   POST /api/studio/ai/classify
 * `server/src/routes/studio.routes.ts` (mounted at `/api/studio` in
 * Gateway.ts) only has document CRUD + snapshot routes — zero `/ai/*`
 * handlers exist anywhere in `server/src` (confirmed by grep). Sending a
 * chat message in Studio 404s/crashes the UI flow. This is not a URL
 * miswire (no equivalent working endpoint exists under another path —
 * the closest thing, `canvasGraphLlm.ts`, is a different one-shot
 * generation engine with an incompatible response shape). The Studio AI
 * backend simply was never built.
 *
 * Until that backend is built as its own workstream, this flag hides the
 * whole Studio surface (route renders a "coming soon" placeholder instead
 * of the broken chat) so users never hit the crash.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_studio=0|1` — operator bypass for staging / dev checks.
 *   2. `localStorage["ff.studio"]` — user / org override.
 *   3. `import.meta.env.VITE_STUDIO_ENABLED` — build-time override.
 *   4. Default: OFF (crash containment until the AI backend is built).
 */

const LS_KEY = 'ff.studio';
const QUERY_KEY = 'ff_studio';
const ENV_KEY = 'VITE_STUDIO_ENABLED';

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
    return parsed === null ? false : parsed;
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

export function isStudioEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const STUDIO_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
