const MARK_PREFIX = 'consultify:spa-nav';
const INTERVAL_MEASURE_PREFIX = 'consultify:spa-nav-interval';
const MAX_ROUTE_KEY_LENGTH = 120;
let navCounter = 0;
let lastMarkName: string | null = null;

function sanitizeRouteKey(routeKey: string): string {
  return routeKey.slice(0, MAX_ROUTE_KEY_LENGTH).replace(/[^a-zA-Z0-9:/?&=._-]/g, '_');
}

export function recordSpaNavigationWebPerf(routeKey: string): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return;
  }

  navCounter += 1;
  const safeRouteKey = sanitizeRouteKey(routeKey || 'unknown');
  const currentMarkName = `${MARK_PREFIX}:${safeRouteKey}:${navCounter}`;

  try {
    performance.mark(currentMarkName);
  } catch {
    return;
  }

  if (!lastMarkName || typeof performance.measure !== 'function') {
    lastMarkName = currentMarkName;
    return;
  }

  try {
    performance.measure(`${INTERVAL_MEASURE_PREFIX}:${navCounter}`, lastMarkName, currentMarkName);
  } catch {
    // Keep navigation tracking fail-soft if measure is unavailable or already exists.
  } finally {
    lastMarkName = currentMarkName;
  }
}
