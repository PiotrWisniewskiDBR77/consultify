const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isPassiveTelemetryUrl(url) {
  return ['/api/v10/teresa/voice-event', '/api/errors'].includes(new URL(url).pathname);
}

export function isDomainMutationRequest({ url, method }, base) {
  const parsed = new URL(url);
  return (
    parsed.origin === new URL(base).origin &&
    parsed.pathname.startsWith('/api/') &&
    MUTATION_METHODS.has(method) &&
    !parsed.pathname.startsWith('/api/auth/') &&
    !isPassiveTelemetryUrl(url)
  );
}
