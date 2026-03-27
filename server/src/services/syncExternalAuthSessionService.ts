import crypto from 'crypto';

export interface SyncExternalAuthSession {
  state: string;
  integrationId: string;
  organizationId: string;
  connectorId: string;
  mode: 'connect' | 'reauth';
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000;
const sessions = new Map<string, SyncExternalAuthSession>();

function cleanupExpiredSessions(now = Date.now()): void {
  for (const [state, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(state);
    }
  }
}

export function issueSyncExternalAuthSession(input: {
  integrationId: string;
  organizationId: string;
  connectorId: string;
  mode: 'connect' | 'reauth';
}): SyncExternalAuthSession {
  cleanupExpiredSessions();

  const createdAt = Date.now();
  const session: SyncExternalAuthSession = {
    state: crypto.randomBytes(24).toString('hex'),
    integrationId: input.integrationId,
    organizationId: input.organizationId,
    connectorId: input.connectorId,
    mode: input.mode,
    createdAt,
    expiresAt: createdAt + SESSION_TTL_MS,
  };

  sessions.set(session.state, session);
  return session;
}

export function consumeSyncExternalAuthSession(state: string): SyncExternalAuthSession | null {
  cleanupExpiredSessions();

  const session = sessions.get(state);
  if (!session) return null;

  sessions.delete(state);

  if (session.expiresAt <= Date.now()) {
    return null;
  }

  return session;
}
