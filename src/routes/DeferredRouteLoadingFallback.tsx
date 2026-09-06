import React from 'react';

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
  const phase = useDeferredLoading(true);

  if (phase === 'idle') return null;

  if (phase === 'timeout') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--c-surface)] p-6">
        <ErrorState variant="timeout" compact />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--c-surface)] p-6 lg:p-10"
      data-testid="route-loading-skeleton"
    >
      <div className="mx-auto max-w-6xl">
        <LoadingState template="panel" label="Ładowanie narzędzi…" />
        {phase === 'slow' && (
          <p role="status" className="mt-5 text-center text-sm text-[var(--c-text-muted)]">
            Ładowanie trwa dłużej niż zwykle…
          </p>
        )}
      </div>
    </div>
  );
};

DeferredRouteLoadingFallback.displayName = 'DeferredRouteLoadingFallback';
