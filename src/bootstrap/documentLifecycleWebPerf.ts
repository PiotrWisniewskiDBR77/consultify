const DOC_VISIBILITY_PREFIX = 'consultify:doc-visibility';

function markDocumentLifecycle(state: string): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return;
  }
  try {
    performance.mark(`${DOC_VISIBILITY_PREFIX}:${state}`);
  } catch {
    // Keep lifecycle telemetry fail-soft.
  }
}

export function installDocumentLifecycleWebPerf(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const onVisibilityChange = () => {
    markDocumentLifecycle(document.visibilityState || 'unknown');
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
