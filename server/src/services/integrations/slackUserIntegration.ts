/**
 * Slack User Integration Service
 *
 * Provides bidirectional Slack communication:
 * - Outbound: post messages, update channels, send notifications
 * - Inbound: receive events via webhook (handled in webhooks/inbox.routes)
 * - Channel management: list, resolve, map to projects
 */

import logger from '../../utils/Logger.js';

export type SlackUserConfig = {
  botToken: string;
  teamId?: string;
  teamName?: string;
  defaultChannelId?: string;
};

export type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount?: number;
};

export type SlackMessageResult = {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
};

function extractToken(config: Record<string, unknown>): string | null {
  const candidates = [
    config.botToken,
    config.bot_token,
    config.accessToken,
    config.access_token,
    config.token,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.startsWith('xoxb-')) return c;
    if (typeof c === 'string' && c.trim()) return c;
  }
  return null;
}

export async function listChannels(config: Record<string, unknown>): Promise<SlackChannel[]> {
  const token = extractToken(config);
  if (!token) throw new Error('No Slack bot token configured');

  const resp = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!resp.ok) throw new Error(`Slack API error: ${resp.status}`);

  const data = (await resp.json()) as {
    ok: boolean;
    channels?: Array<{ id: string; name: string; is_private: boolean; num_members?: number }>;
    error?: string;
  };

  if (!data.ok) throw new Error(`Slack error: ${data.error || 'unknown'}`);

  return (data.channels || []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    isPrivate: ch.is_private,
    memberCount: ch.num_members,
  }));
}

export async function postMessage(
  config: Record<string, unknown>,
  channelId: string,
  text: string,
  blocks?: unknown[]
): Promise<SlackMessageResult> {
  const token = extractToken(config);
  if (!token) return { ok: false, error: 'No Slack bot token configured' };

  const body: Record<string, unknown> = { channel: channelId, text };
  if (blocks && blocks.length > 0) body.blocks = blocks;

  const resp = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) return { ok: false, error: `Slack API ${resp.status}` };

  const data = (await resp.json()) as {
    ok: boolean;
    ts?: string;
    channel?: string;
    error?: string;
  };
  if (!data.ok) {
    logger.warn('[SlackIntegration] postMessage failed', { error: data.error, channelId });
  }
  return data;
}

export async function updateMessage(
  config: Record<string, unknown>,
  channelId: string,
  ts: string,
  text: string
): Promise<SlackMessageResult> {
  const token = extractToken(config);
  if (!token) return { ok: false, error: 'No Slack bot token configured' };

  const resp = await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: channelId, ts, text }),
  });

  if (!resp.ok) return { ok: false, error: `Slack API ${resp.status}` };
  return (await resp.json()) as SlackMessageResult;
}

export async function testConnection(config: Record<string, unknown>): Promise<{
  ok: boolean;
  teamName?: string;
  error?: string;
}> {
  const token = extractToken(config);
  if (!token) return { ok: false, error: 'No Slack bot token' };

  const resp = await fetch('https://slack.com/api/auth.test', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) return { ok: false, error: `Slack API ${resp.status}` };

  const data = (await resp.json()) as { ok: boolean; team?: string; error?: string };
  return { ok: data.ok, teamName: data.team, error: data.error };
}

const slackUserIntegration = {
  listChannels,
  postMessage,
  updateMessage,
  testConnection,
};

export default slackUserIntegration;
