/**
 * Microsoft Teams User Integration Service
 *
 * Provides bidirectional Teams communication via Microsoft Graph API:
 * - Outbound: post messages to channels, send notifications
 * - Inbound: receive events via webhook subscription (change notifications)
 * - Team/channel management: list joined teams, channels, resolve mappings
 */

import logger from '../../utils/Logger.js';

export type TeamsConfig = {
  accessToken: string;
  tenantId?: string;
};

export type TeamsTeam = {
  id: string;
  displayName: string;
  description?: string;
};

export type TeamsChannel = {
  id: string;
  displayName: string;
  teamId: string;
};

export type TeamsMessageResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

function extractToken(config: Record<string, unknown>): string | null {
  const candidates = [
    config.accessToken,
    config.access_token,
    config.bearerToken,
    config.bearer_token,
    config.token,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export async function listJoinedTeams(config: Record<string, unknown>): Promise<TeamsTeam[]> {
  const token = extractToken(config);
  if (!token) throw new Error('No Teams access token configured');

  const resp = await fetch(`${GRAPH_BASE}/me/joinedTeams`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resp.status === 401) throw new Error('Teams token expired — reauth required');
  if (!resp.ok) throw new Error(`Graph API error: ${resp.status}`);

  const data = (await resp.json()) as { value?: Array<{ id: string; displayName: string; description?: string }> };
  return (data.value || []).map((t) => ({
    id: t.id,
    displayName: t.displayName,
    description: t.description,
  }));
}

export async function listChannels(
  config: Record<string, unknown>,
  teamId: string
): Promise<TeamsChannel[]> {
  const token = extractToken(config);
  if (!token) throw new Error('No Teams access token configured');

  const resp = await fetch(`${GRAPH_BASE}/teams/${teamId}/channels`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) throw new Error(`Graph API error: ${resp.status}`);

  const data = (await resp.json()) as { value?: Array<{ id: string; displayName: string }> };
  return (data.value || []).map((ch) => ({
    id: ch.id,
    displayName: ch.displayName,
    teamId,
  }));
}

export async function postChannelMessage(
  config: Record<string, unknown>,
  teamId: string,
  channelId: string,
  content: string,
  contentType: 'text' | 'html' = 'html'
): Promise<TeamsMessageResult> {
  const token = extractToken(config);
  if (!token) return { ok: false, error: 'No Teams access token configured' };

  const resp = await fetch(`${GRAPH_BASE}/teams/${teamId}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: { contentType, content },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => resp.statusText);
    logger.warn('[TeamsIntegration] postChannelMessage failed', { status: resp.status, teamId, channelId });
    return { ok: false, error: `Graph API ${resp.status}: ${errText.slice(0, 200)}` };
  }

  const data = (await resp.json()) as { id?: string };
  return { ok: true, id: data.id };
}

export async function sendChatMessage(
  config: Record<string, unknown>,
  chatId: string,
  content: string
): Promise<TeamsMessageResult> {
  const token = extractToken(config);
  if (!token) return { ok: false, error: 'No Teams access token configured' };

  const resp = await fetch(`${GRAPH_BASE}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: { contentType: 'html', content } }),
  });

  if (!resp.ok) return { ok: false, error: `Graph API ${resp.status}` };
  const data = (await resp.json()) as { id?: string };
  return { ok: true, id: data.id };
}

export async function createSubscription(
  config: Record<string, unknown>,
  resource: string,
  notificationUrl: string,
  expirationMinutes = 60
): Promise<{ ok: boolean; subscriptionId?: string; error?: string }> {
  const token = extractToken(config);
  if (!token) return { ok: false, error: 'No Teams access token' };

  const expiration = new Date(Date.now() + expirationMinutes * 60_000).toISOString();

  const resp = await fetch(`${GRAPH_BASE}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      changeType: 'created,updated',
      notificationUrl,
      resource,
      expirationDateTime: expiration,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return { ok: false, error: `Graph API ${resp.status}: ${errText.slice(0, 200)}` };
  }

  const data = (await resp.json()) as { id?: string };
  return { ok: true, subscriptionId: data.id };
}

export async function testConnection(config: Record<string, unknown>): Promise<{
  ok: boolean;
  displayName?: string;
  error?: string;
}> {
  const token = extractToken(config);
  if (!token) return { ok: false, error: 'No Teams access token' };

  const resp = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) return { ok: false, error: `Graph API ${resp.status}` };

  const data = (await resp.json()) as { displayName?: string };
  return { ok: true, displayName: data.displayName };
}

const teamsUserIntegration = {
  listJoinedTeams,
  listChannels,
  postChannelMessage,
  sendChatMessage,
  createSubscription,
  testConnection,
};

export default teamsUserIntegration;
