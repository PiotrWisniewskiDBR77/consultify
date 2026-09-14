/**
 * Z-11 (2026-09-14): global `vite:preloadError` listener — the second half
 * of the chunk-load recovery mechanism alongside `ErrorBoundary` /
 * `RouteErrorBoundary` (both in `src/components/`, both consuming the same
 * `src/utils/chunkLoadRecovery.ts`).
 *
 * Vite fires `vite:preloadError` on `window` when a dynamic `import()` it
 * generated fails to load (e.g. `assets/MainLayout-<oldHash>.js` no longer
 * exists after a deploy) — this is a distinct signal from the import()
 * promise rejection itself, and firing/handling it here means we catch the
 * failure before it necessarily has to unwind into a React error boundary.
 * `event.preventDefault()` stops Vite's default (an uncaught rejection).
 */
export function installChunkReloadGuard(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('vite:preloadError', (event) => {
    // Import lazily so a bootstrap-time failure here can never block app
    // boot even if the util module itself has a problem.
    import('@/utils/chunkLoadRecovery')
      .then(({ attemptChunkReload, hasAlreadyAttemptedChunkReload, announceChunkUpdateAvailable }) => {
        try {
          (event as Event).preventDefault?.();
        } catch {
          // ignore — best effort
        }

        if (hasAlreadyAttemptedChunkReload()) {
          announceChunkUpdateAvailable();
          return;
        }
        attemptChunkReload();
      })
      .catch(() => {
        // Recovery module itself failed to import (extreme edge case) — do
        // nothing rather than risk a reload loop.
      });
  });
}
