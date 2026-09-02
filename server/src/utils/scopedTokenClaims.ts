/**
 * Scoped-ticket detection shared by every JWT entry point.
 *
 * The MFA enrollment ticket (services/mfaEnrollmentTicket.ts) is signed with
 * the same JWT_SECRET as a session token, because it is issued before a session
 * exists. Every place that verifies that secret must therefore refuse it: the
 * HTTP door (auth.middleware), the socket.io handshake and the collaboration
 * websocket gateways. A session token never carries `purpose`.
 */
export function hasScopedPurposeClaim(decoded: unknown): boolean {
  if (!decoded || typeof decoded !== 'object') return false;
  const purpose = (decoded as Record<string, unknown>).purpose;
  if (purpose === undefined || purpose === null || purpose === '') return false;
  return purpose !== 'access';
}
