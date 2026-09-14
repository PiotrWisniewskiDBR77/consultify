/**
 * Z-11 (2026-09-14): jedno, wspólne miejsce wykrywania i naprawy błędu
 * "nieistniejący chunk" po wdrożeniu na staging/demo — karta otwarta PRZED
 * wdrożeniem trzyma stare `index.html`, które odwołuje się do plików
 * `assets/*-<hash>.js` usuniętych przez nowy build. Objawy w logach:
 * `Failed to fetch dynamically imported module`, `Importing a module script
 * failed`, zdarzenie `vite:preloadError`.
 *
 * NIE per trasa: to jest JEDYNY mechanizm wykrywania + jedyny licznik
 * "czy już próbowaliśmy przeładować" w tej sesji przeglądarki, używany przez
 * `ErrorBoundary` (powłoka aplikacji, w tym `MainLayout`), `RouteErrorBoundary`
 * (pojedyncza trasa) i globalny listener `vite:preloadError` w `index.tsx`.
 */

export const CHUNK_LOAD_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'module script failed',
  'dynamically imported module',
  'ChunkLoadError',
  'Outdated Optimize Dep',
] as const;

export function isChunkLoadError(error: unknown): boolean {
  const parts = [
    String((error as { message?: unknown } | null | undefined)?.message ?? ''),
    String((error as { name?: unknown } | null | undefined)?.name ?? ''),
    String(error ?? ''),
  ];
  const haystack = parts.join('\n');
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => haystack.includes(pattern));
}

const RELOAD_FLAG_KEY = 'consultify:chunk-reload-attempted:v1';

function buildSha(): string {
  try {
    return String((import.meta.env as Record<string, string> | undefined)?.VITE_BUILD_SHA || '');
  } catch {
    return '';
  }
}

/** Ties the one-time guard to this build + URL: a fresh deploy (new SHA) or a
 * navigation to a different URL gets its own single attempt, so the guard
 * never permanently "uses up" the one reload across an entire session. */
function reloadToken(): string {
  const href = typeof window !== 'undefined' ? window.location.href : '';
  return `${buildSha()}|${href}`;
}

export function hasAlreadyAttemptedChunkReload(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(RELOAD_FLAG_KEY) === reloadToken();
  } catch {
    // Storage unavailable (private mode, disabled) — treat as "not attempted
    // yet" so we still try once; worst case is a single extra reload.
    return false;
  }
}

/**
 * Marks the one-time attempt and reloads the page. Returns `true` when a
 * reload was actually triggered, `false` when we already tried once for this
 * build+URL in this session (caller should show the "new version" banner
 * instead of reloading again, to avoid a loop).
 */
export function attemptChunkReload(): boolean {
  if (hasAlreadyAttemptedChunkReload()) return false;
  try {
    if (typeof window === 'undefined') return false;
    window.sessionStorage.setItem(RELOAD_FLAG_KEY, reloadToken());
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export const CHUNK_UPDATE_EVENT = 'consultify:chunk-update-available';

/** Fired when we already tried the one automatic reload and the chunk is
 * still missing — the persistent top banner listens for this. */
export function announceChunkUpdateAvailable(): void {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(CHUNK_UPDATE_EVENT));
  } catch {
    // never let telemetry/UI wiring break the recovery path
  }
}
