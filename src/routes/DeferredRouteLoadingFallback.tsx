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
