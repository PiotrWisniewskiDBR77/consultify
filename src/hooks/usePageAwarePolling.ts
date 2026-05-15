import { useEffect, useRef } from 'react';

type PollingOptions = {
  enabled?: boolean;
  intervalMs: number;
  initialDelayMs?: number;
  runImmediately?: boolean;
};

export function usePageAwarePolling(
  callback: () => void | Promise<void>,
  { enabled = true, intervalMs, initialDelayMs = 0, runImmediately = true }: PollingOptions
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: number | null = null;
    let intervalId: number | null = null;

    const invoke = () => {
      void callbackRef.current();
    };

    const start = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (runImmediately) {
        invoke();
      } else if (initialDelayMs > 0) {
        timeoutId = window.setTimeout(invoke, initialDelayMs);
      }
      intervalId = window.setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        invoke();
      }, intervalMs);
    };

    const stop = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        stop();
        return;
      }
      stop();
      start();
    };

    if (runImmediately && initialDelayMs > 0) {
      timeoutId = window.setTimeout(() => {
        invoke();
        intervalId = window.setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return;
          }
          invoke();
        }, intervalMs);
      }, initialDelayMs);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      stop();
    };
  }, [enabled, initialDelayMs, intervalMs, runImmediately]);
}
