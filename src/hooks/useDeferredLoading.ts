import { useEffect, useState } from 'react';

export type DeferredLoadingPhase = 'idle' | 'pending' | 'slow' | 'timeout';

export interface DeferredLoadingOptions {
  skeletonAfterMs?: number;
  slowAfterMs?: number;
  timeoutAfterMs?: number;
}

const DEFAULT_SKELETON_AFTER_MS = 300;
const DEFAULT_SLOW_AFTER_MS = 8_000;
const DEFAULT_TIMEOUT_AFTER_MS = 15_000;

export function useDeferredLoading(
  isLoading: boolean,
  options: DeferredLoadingOptions = {},
): DeferredLoadingPhase {
  const {
    skeletonAfterMs = DEFAULT_SKELETON_AFTER_MS,
    slowAfterMs = DEFAULT_SLOW_AFTER_MS,
    timeoutAfterMs = DEFAULT_TIMEOUT_AFTER_MS,
  } = options;
  const [phase, setPhase] = useState<DeferredLoadingPhase>('idle');

  useEffect(() => {
    if (!isLoading) {
      setPhase('idle');
      return;
    }

    setPhase('idle');
    const pendingTimer = window.setTimeout(() => setPhase('pending'), skeletonAfterMs);
    const slowTimer = window.setTimeout(() => setPhase('slow'), slowAfterMs);
    const timeoutTimer = window.setTimeout(() => setPhase('timeout'), timeoutAfterMs);

    return () => {
      window.clearTimeout(pendingTimer);
      window.clearTimeout(slowTimer);
      window.clearTimeout(timeoutTimer);
    };
  }, [isLoading, skeletonAfterMs, slowAfterMs, timeoutAfterMs]);

  return phase;
}

export default useDeferredLoading;
