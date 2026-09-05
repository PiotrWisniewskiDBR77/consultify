/**
 * Feature flag for the Audits report creation and DOCX download controls.
 * Default OFF until the owner accepts the screenshots (CLAUDE.md rule 7).
 * The supervisor, not this duty, performs the eventual default flip.
 * Resolution: query > localStorage > env > default false; read failures fail closed.
 */

const LS_KEY = 'ff.audits_report_chain';
const QUERY_KEY = 'ff_auditsReportChain';
const ENV_KEY = 'VITE_AUDITS_REPORT_CHAIN';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

let cached: boolean | null = null;

export function isAuditsReportChainEnabled(): boolean {
  if (cached !== null) return cached;
  try {
    const query =
      typeof window === 'undefined'
        ? null
        : parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    const local =
      query === null && typeof window !== 'undefined'
        ? parseFlag(window.localStorage.getItem(LS_KEY))
        : null;
    const meta = { env: import.meta.env } as unknown as { env?: Record<string, string | undefined> };
    cached = query ?? local ?? parseFlag(meta.env?.[ENV_KEY]) ?? false;
  } catch {
    cached = false;
  }
  return cached;
}

export const resetAuditsReportChainFlagCache = (): void => {
  cached = null;
};

export const AUDITS_REPORT_CHAIN_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
