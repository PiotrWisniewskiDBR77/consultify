const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Passive first-party telemetry: beacons the app fires on its own, with no user
// action and no domain record behind them. Whitelisted by EXACT path + method as
// an explicit list — never a "everything under /api/analytics" regex — so a real
// domain write that happens to live under /api/analytics/* is still caught.
// DEC-590 (Wpis 39): POST /api/analytics/web-vitals accounted for 248 of the 264
// false "unexpected writes" in E2E-1 run 1 and blocked all 16 menu1 cells.
// Methods measured at the call sites, not guessed:
//   /api/v10/teresa/voice-event -> POST (src/contexts/TeresaVoiceContext.tsx:192)
//   /api/errors                 -> POST (src/services/errorLogger.ts:35)
//   /api/analytics/web-vitals   -> POST (server/src/routes/analytics.routes.ts:148)
const PASSIVE_TELEMETRY = Object.freeze([
  Object.freeze({ path: '/api/v10/teresa/voice-event', method: 'POST' }),
  Object.freeze({ path: '/api/errors', method: 'POST' }),
  Object.freeze({ path: '/api/analytics/web-vitals', method: 'POST' }),
]);

export function isPassiveTelemetryRequest({ url, method }) {
  const { pathname } = new URL(url);
  const upper = String(method || '').toUpperCase();
  return PASSIVE_TELEMETRY.some(
    (entry) => entry.path === pathname && entry.method === upper
  );
}

export function isDomainMutationRequest({ url, method }, base) {
  const parsed = new URL(url);
  return (
    parsed.origin === new URL(base).origin &&
    parsed.pathname.startsWith('/api/') &&
    MUTATION_METHODS.has(method) &&
    !parsed.pathname.startsWith('/api/auth/') &&
    !isPassiveTelemetryRequest({ url, method })
  );
}

export { PASSIVE_TELEMETRY };
