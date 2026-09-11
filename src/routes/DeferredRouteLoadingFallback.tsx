import React from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/shared/states';
import { useDeferredLoading } from '@/hooks/useDeferredLoading';

/**
 * Shared Suspense fallback for lazy route modules.
 *
 * The route import is a real loading phase that happens before a screen can
 * mount its own data-loading state. Keep fast imports quiet, then apply the
 * same timing contract as data-backed surfaces instead of showing a bare
 * spinner during a cold module load.
 */
export const DeferredRouteLoadingFallback: React.FC = () => {
  const { t } = useTranslation();
  // DIAG-W3 (11.09, DIAGNOZA_W3_W4_20260911.md): this is the ONLY Suspense
  // boundary around <Routes> (AppRoutes.tsx:1199), so whatever it renders
  // replaces the WHOLE application — sidebar included. The default 15 s
  // timeout of useDeferredLoading is a DATA contract; a lazy module import
  // cannot "time out" (it resolves, or rejects into RouteErrorBoundary), and
  // this app's own cold boot on staging measures 16-26 s. The old 15 s guard
  // therefore fired BEFORE the app could finish booting and painted a
  // full-screen "Nie udało się wczytać danych na czas" over a load that was
  // still in flight (ODBIOR_STAGING_7e8668c7cc §7.4, W-3: Inicjatywy).
  const phase = useDeferredLoading(true, { timeoutAfterMs: 45_000 });

  if (phase === 'idle') return null;

  if (phase === 'timeout') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--c-surface)] p-6">
        {/* DIAG-W3: never a dead end — the only honest action here is a reload. */}
        <ErrorState variant="timeout" compact onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--c-surface)] p-6 lg:p-10"
      data-testid="route-loading-skeleton"
    >
      <div className="mx-auto max-w-6xl">
        <LoadingState template="panel" label={t('common.loadingTools', 'Loading tools…')} />
        {phase === 'slow' && (
          <p role="status" className="mt-5 text-center text-sm text-[var(--c-text-muted)]">
            {t('common.loadingSlow', 'This is taking longer than usual…')}
          </p>
        )}
      </div>
    </div>
  );
};

DeferredRouteLoadingFallback.displayName = 'DeferredRouteLoadingFallback';
