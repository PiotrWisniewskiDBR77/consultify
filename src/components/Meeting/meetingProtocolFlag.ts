/**
 * MTG-2a (DEC-607) — reveal flag for the structured meeting protocol document.
 *
 * Why a flag: the protocol is a NEW archetype-B document surface generated from
 * meeting registers (agenda / attendance / decisions / actions), reached from the
 * meeting card. Per project canon a new screen ships behind a flag defaulting to
 * OFF until the owner accepts it on a screenshot ("Piotr nigdy nie jest pierwszym
 * testerem wizualnym").
 *
 * ★ Default = OFF. OFF → the meeting card renders no "Protocol" entry and the
 * protocol route is unreachable from the UI. ON → the entry appears and the
 * document viewer mounts.
 *
 * Order of precedence (highest wins), mirroring `documentViewerFlag.ts`:
 *   1. URL query `?ff_meeting_protocol=0|1` — operator/dev/dev-render bypass.
 *   2. `localStorage["ff.meetingProtocol"]` — user/org override.
 *   3. `import.meta.env.VITE_MEETING_PROTOCOL` — build time.
 *   4. Default: OFF (fail-closed — an unparsable value is OFF, never ON).
 */

const LS_KEY = 'ff.meetingProtocol';
const QUERY_KEY = 'ff_meeting_protocol';
const ENV_KEY = 'VITE_MEETING_PROTOCOL';

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

export function isMeetingProtocolEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const MEETING_PROTOCOL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
