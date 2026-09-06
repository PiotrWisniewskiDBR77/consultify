/**
 * AppContext
 *
 * Build + runtime + user snapshot attached to every feedback submission.
 * Values that identify the user are opt-in — caller supplies them. Everything
 * else is purely environmental.
 */

export interface AppRuntimeContext {
  buildSha: string | null;
  buildAt: string | null;
  appEnv: string | null;
  locale: string;
  timezone: string;
  viewport: { width: number; height: number; dpr: number };
  online: boolean;
  userAgent: string;
  platform: string;
  referrer: string | null;
  route: { pathname: string; search: string; hash: string };
  pageVisibleForMs: number;
  firstPaintAt: number | null;
  memoryMb?: number;
}

export interface AppUserContext {
  userId?: string | null;
  orgId?: string | null;
  role?: string | null;
  flags?: string[];
}

let appEnvOverride: string | null = null;
let firstPaintAt: number | null = null;
let pageVisibleSince: number = 0;
let installed = false;

export function installAppContext(options?: { appEnv?: string | null }): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  appEnvOverride = options?.appEnv ?? null;
  pageVisibleSince = Date.now();

  try {
    const pe = performance.getEntriesByType('paint') as PerformanceEntry[];
    const fp = pe.find((e) => e.name === 'first-contentful-paint' || e.name === 'first-paint');
    if (fp) firstPaintAt = Math.round(fp.startTime);
  } catch {
    // ignore
  }
}

function getMemoryMb(): number | undefined {
  try {
    const mem = (performance as any).memory?.usedJSHeapSize;
    if (typeof mem === 'number') return Math.round(mem / (1024 * 1024));
  } catch {
    // ignore
  }
  return undefined;
}

export function snapshotAppContext(user?: AppUserContext): AppRuntimeContext & {
  user?: AppUserContext;
} {
  const env =
    appEnvOverride ||
    (import.meta.env as Record<string, string>)?.VITE_APP_ENV ||
    (import.meta.env as Record<string, string>)?.MODE ||
    null;
  const buildSha =
    (import.meta.env as Record<string, string>)?.VITE_BUILD_SHA ||
    (typeof window !== 'undefined' ? (window as any).__APP_BUILD_SHA__ : null) ||
    null;
  const buildAt =
    (import.meta.env as Record<string, string>)?.VITE_BUILD_AT ||
    (typeof window !== 'undefined' ? (window as any).__APP_BUILD_AT__ : null) ||
    null;

  return {
    buildSha,
    buildAt,
    appEnv: env,
    locale:
      (typeof document !== 'undefined' && document.documentElement.lang) ||
      (typeof navigator !== 'undefined' ? navigator.language : 'en'),
    timezone:
      (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC',
    viewport: {
      width: typeof window !== 'undefined' ? window.innerWidth : 0,
      height: typeof window !== 'undefined' ? window.innerHeight : 0,
      dpr: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    },
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    platform: typeof navigator !== 'undefined' ? navigator.platform : '',
    referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : null,
    route: {
      pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
      search: typeof window !== 'undefined' ? window.location.search : '',
      hash: typeof window !== 'undefined' ? window.location.hash : '',
    },
    pageVisibleForMs: pageVisibleSince ? Date.now() - pageVisibleSince : 0,
    firstPaintAt,
    memoryMb: getMemoryMb(),
    user,
  };
}
