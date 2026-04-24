function normalizeHostname(input: string): string {
  const v = (input || '').trim().toLowerCase();
  if (!v) return '';
  // Defensive: window.location.hostname doesn't include ports, but callers might.
  return v.split(':')[0] || '';
}

/**
 * Returns true only for customer-facing public production hosts.
 * Use this to hide internal debug chrome by default.
 */
export function isPublicProductionHost(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return host === 'consultify.ai' || host === 'www.consultify.ai';
}
