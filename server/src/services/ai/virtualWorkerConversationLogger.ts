/**
 * Virtual Worker Conversation Logger
 *
 * Logs conversations and messages for analytics and insights.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConversationChannel = 'text_chat' | 'voice';
export type ConversationOutcome =
  | 'demo_requested'
  | 'trial_started'
  | 'question_answered'
  | 'escalated'
  | 'abandoned'
  | 'unknown';

export interface Conversation {
  id: string;
  worker_id: string;
  session_id: string | null;
  channel: ConversationChannel;
  locale: string | null;
  visitor_fingerprint: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  duration_seconds: number | null;
  outcome: ConversationOutcome;
  metadata: Record<string, unknown> | null;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  knowledge_sources_used: string[] | null;
  matched_products: string[] | null;
  token_count: number | null;
  latency_ms: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function db() {
  return getDatabase();
}

function parseJsonb<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as T;
  if (Array.isArray(raw)) return raw as unknown as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Conversation lifecycle
// ---------------------------------------------------------------------------

export async function findOrCreateConversation(opts: {
  workerId: string;
  sessionId: string;
  channel?: ConversationChannel;
  locale?: string;
  visitorFingerprint?: string;
}): Promise<string> {
  const channel = opts.channel || 'text_chat';

  if (opts.sessionId) {
    const existing = await db().query<{ id: string }>(
      'SELECT id FROM virtual_worker_conversations WHERE session_id = $1 AND worker_id = $2 AND channel = $3 LIMIT 1',
      [opts.sessionId, opts.workerId, channel]
    );
    if (existing.rows[0]) return existing.rows[0].id;
  }

  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_conversations
     (id, worker_id, session_id, channel, locale, visitor_fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      opts.workerId,
      opts.sessionId || null,
      channel,
      opts.locale || null,
      opts.visitorFingerprint || null,
    ]
  );
  return id;
}

export async function logMessage(opts: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  knowledgeSourcesUsed?: string[];
  matchedProducts?: string[];
  tokenCount?: number;
  latencyMs?: number;
}): Promise<string> {
  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_messages
     (id, conversation_id, role, content, knowledge_sources_used, matched_products, token_count, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      opts.conversationId,
      opts.role,
      opts.content,
      opts.knowledgeSourcesUsed ? JSON.stringify(opts.knowledgeSourcesUsed) : null,
      opts.matchedProducts ? JSON.stringify(opts.matchedProducts) : null,
      opts.tokenCount || null,
      opts.latencyMs || null,
    ]
  );

  await db()
    .query(
      `UPDATE virtual_worker_conversations
     SET message_count = message_count + 1
     WHERE id = $1`,
      [opts.conversationId]
    )
    .catch((err: unknown) => {
      logger.warn(
        '[ConversationLogger] message_count update failed:',
        err instanceof Error ? err.message : String(err)
      );
    });

  return id;
}

export async function endConversation(
  conversationId: string,
  outcome?: ConversationOutcome
): Promise<void> {
  await db().query(
    `UPDATE virtual_worker_conversations
     SET ended_at = NOW(),
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
         outcome = COALESCE($2, outcome)
     WHERE id = $1`,
    [conversationId, outcome || null]
  );
}

export async function logVoiceEvent(opts: {
  workerId: string;
  sessionId: string;
  durationSeconds: number;
  locale?: string;
}): Promise<string> {
  const convId = await findOrCreateConversation({
    workerId: opts.workerId,
    sessionId: opts.sessionId,
    channel: 'voice',
    locale: opts.locale,
  });

  await db().query(
    `UPDATE virtual_worker_conversations
     SET ended_at = NOW(), duration_seconds = $2, channel = 'voice'
     WHERE id = $1`,
    [convId, opts.durationSeconds]
  );

  return convId;
}

// ---------------------------------------------------------------------------
// Query: conversations list
// ---------------------------------------------------------------------------

export async function listConversations(opts: {
  workerId: string;
  limit?: number;
  offset?: number;
  channel?: ConversationChannel;
  outcome?: ConversationOutcome;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ conversations: Conversation[]; total: number }> {
  const conditions = ['c.worker_id = $1'];
  const params: unknown[] = [opts.workerId];
  let idx = 2;

  if (opts.channel) {
    conditions.push(`c.channel = $${idx}`);
    params.push(opts.channel);
    idx++;
  }
  if (opts.outcome) {
    conditions.push(`c.outcome = $${idx}`);
    params.push(opts.outcome);
    idx++;
  }
  if (opts.dateFrom) {
    conditions.push(`c.started_at >= $${idx}`);
    params.push(opts.dateFrom);
    idx++;
  }
  if (opts.dateTo) {
    conditions.push(`c.started_at <= $${idx}`);
    params.push(opts.dateTo);
    idx++;
  }

  const where = conditions.join(' AND ');

  const countResult = await db().query<{ count: string }>(
    `SELECT COUNT(*) as count FROM virtual_worker_conversations c WHERE ${where}`,
    params
  );
  const total = parseInt(String(countResult.rows[0]?.count || '0'), 10);

  const limit = Math.min(opts.limit || 20, 100);
  const offset = opts.offset || 0;

  const result = await db().query<Record<string, unknown>>(
    `SELECT c.* FROM virtual_worker_conversations c
     WHERE ${where}
     ORDER BY c.started_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  const conversations: Conversation[] = (result.rows || []).map((row) => ({
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    session_id: row.session_id ? String(row.session_id) : null,
    channel: String(row.channel || 'text_chat') as ConversationChannel,
    locale: row.locale ? String(row.locale) : null,
    visitor_fingerprint: row.visitor_fingerprint ? String(row.visitor_fingerprint) : null,
    started_at: String(row.started_at || ''),
    ended_at: row.ended_at ? String(row.ended_at) : null,
    message_count: Number(row.message_count || 0),
    duration_seconds: row.duration_seconds ? Number(row.duration_seconds) : null,
    outcome: String(row.outcome || 'unknown') as ConversationOutcome,
    metadata: parseJsonb<Record<string, unknown>>(row.metadata),
  }));

  return { conversations, total };
}

export async function getConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  const result = await db().query<Record<string, unknown>>(
    'SELECT * FROM virtual_worker_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );

  return (result.rows || []).map((row) => ({
    id: String(row.id || ''),
    conversation_id: String(row.conversation_id || ''),
    role: String(row.role || 'user') as 'user' | 'assistant',
    content: String(row.content || ''),
    knowledge_sources_used: parseJsonb<string[]>(row.knowledge_sources_used),
    matched_products: parseJsonb<string[]>(row.matched_products),
    token_count: row.token_count ? Number(row.token_count) : null,
    latency_ms: row.latency_ms ? Number(row.latency_ms) : null,
    created_at: String(row.created_at || ''),
  }));
}

// ---------------------------------------------------------------------------
// Analytics queries
// ---------------------------------------------------------------------------

export async function getWorkerAnalytics(opts: {
  workerId: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{
  totalConversations: number;
  totalMessages: number;
  avgDurationSeconds: number;
  avgMessagesPerConversation: number;
  outcomeDistribution: Record<string, number>;
  channelDistribution: Record<string, number>;
  conversationsPerDay: Array<{ date: string; count: number }>;
  topKnowledgeSources: Array<{ source: string; count: number }>;
}> {
  const conditions = ['c.worker_id = $1'];
  const params: unknown[] = [opts.workerId];
  let idx = 2;

  if (opts.dateFrom) {
    conditions.push(`c.started_at >= $${idx}`);
    params.push(opts.dateFrom);
    idx++;
  }
  if (opts.dateTo) {
    conditions.push(`c.started_at <= $${idx}`);
    params.push(opts.dateTo);
    idx++;
  }

  const where = conditions.join(' AND ');

  const summaryResult = await db().query<Record<string, unknown>>(
    `SELECT
       COUNT(*) as total_conversations,
       COALESCE(SUM(c.message_count), 0) as total_messages,
       COALESCE(AVG(c.duration_seconds), 0) as avg_duration,
       COALESCE(AVG(c.message_count), 0) as avg_messages
     FROM virtual_worker_conversations c
     WHERE ${where}`,
    params
  );

  const msgCountResult = await db()
    .query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM virtual_worker_messages m
     JOIN virtual_worker_conversations c ON m.conversation_id = c.id
     WHERE ${where}`,
      params
    )
    .catch(() => ({ rows: [{ cnt: '0' }] }));
  const directMessageCount = parseInt(String(msgCountResult.rows[0]?.cnt || '0'), 10);

  const summary = summaryResult.rows[0] || {};

  const outcomeResult = await db().query<{ outcome: string; count: string }>(
    `SELECT c.outcome, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY c.outcome`,
    params
  );

  const outcomeDistribution: Record<string, number> = {};
  for (const row of outcomeResult.rows || []) {
    outcomeDistribution[String(row.outcome || 'unknown')] = parseInt(String(row.count), 10);
  }

  const channelResult = await db().query<{ channel: string; count: string }>(
    `SELECT c.channel, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY c.channel`,
    params
  );

  const channelDistribution: Record<string, number> = {};
  for (const row of channelResult.rows || []) {
    channelDistribution[String(row.channel || 'text_chat')] = parseInt(String(row.count), 10);
  }

  const dailyResult = await db().query<{ date: string; count: string }>(
    `SELECT DATE(c.started_at) as date, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY DATE(c.started_at)
     ORDER BY date DESC
     LIMIT 30`,
    params
  );

  const conversationsPerDay = (dailyResult.rows || []).map((row) => ({
    date: String(row.date || ''),
    count: parseInt(String(row.count), 10),
  }));

  const sourcesResult = await db()
    .query<{ source: string; count: string }>(
      `SELECT s.source, COUNT(*) as count
     FROM virtual_worker_messages m
     JOIN virtual_worker_conversations c ON m.conversation_id = c.id
     CROSS JOIN LATERAL jsonb_array_elements_text(
       CASE WHEN m.knowledge_sources_used IS NOT NULL
            THEN m.knowledge_sources_used
            ELSE '[]'::jsonb
       END
     ) AS s(source)
     WHERE ${where.replace(/\bc\./g, 'c.')}
     GROUP BY s.source
     ORDER BY count DESC
     LIMIT 10`,
      params
    )
    .catch(() => ({ rows: [] as Array<{ source: string; count: string }> }));

  const topKnowledgeSources = (sourcesResult.rows || []).map((row) => ({
    source: String(row.source || ''),
    count: parseInt(String(row.count), 10),
  }));

  const summedMessages = parseInt(String(summary.total_messages || '0'), 10);

  return {
    totalConversations: parseInt(String(summary.total_conversations || '0'), 10),
    totalMessages: Math.max(summedMessages, directMessageCount),
    avgDurationSeconds: Math.round(Number(summary.avg_duration || 0)),
    avgMessagesPerConversation: Math.round(Number(summary.avg_messages || 0) * 10) / 10,
    outcomeDistribution,
    channelDistribution,
    conversationsPerDay,
    topKnowledgeSources,
  };
}
