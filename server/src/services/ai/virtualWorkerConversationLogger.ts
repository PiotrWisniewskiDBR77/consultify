/**
 * Virtual Worker Conversation Logger
 *
 * Logs conversations and messages for analytics, topic intelligence and release evaluation.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

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
  primary_topic: string | null;
  secondary_topics: string[];
  topic_family: string | null;
  topic_confidence: number | null;
  intent: string | null;
  products_discussed: string[];
  fallback_reason: string | null;
  summary: string | null;
  quality_flags: string[];
  session_memory: Record<string, unknown>;
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
  retrieval_query: string | null;
  used_pill_ids: string[];
  used_pill_sections: string[];
  answer_confidence: number | null;
  response_mode: string | null;
  message_topic: string | null;
  message_intent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

type Row = Record<string, unknown>;

function db() {
  return getDatabase();
}

function parseJsonb<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function mergeMetadata(
  current: Record<string, unknown> | null,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(current || {}),
    ...patch,
  };
}

function toConversation(row: Row): Conversation {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    session_id: row.session_id ? String(row.session_id) : null,
    channel: String(row.channel || 'text_chat') as ConversationChannel,
    locale: row.locale ? String(row.locale) : null,
    visitor_fingerprint: row.visitor_fingerprint ? String(row.visitor_fingerprint) : null,
    started_at: String(row.started_at || ''),
    ended_at: row.ended_at ? String(row.ended_at) : null,
    message_count: Number(row.message_count || 0),
    duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    outcome: String(row.outcome || 'unknown') as ConversationOutcome,
    primary_topic: row.primary_topic ? String(row.primary_topic) : null,
    secondary_topics: parseJsonb<string[]>(row.secondary_topics, []),
    topic_family: row.topic_family ? String(row.topic_family) : null,
    topic_confidence: row.topic_confidence == null ? null : Number(row.topic_confidence),
    intent: row.intent ? String(row.intent) : null,
    products_discussed: parseJsonb<string[]>(row.products_discussed, []),
    fallback_reason: row.fallback_reason ? String(row.fallback_reason) : null,
    summary: row.summary ? String(row.summary) : null,
    quality_flags: parseJsonb<string[]>(row.quality_flags, []),
    session_memory: parseJsonb<Record<string, unknown>>(row.session_memory, {}),
    metadata: parseJsonb<Record<string, unknown> | null>(row.metadata, null),
  };
}

function toMessage(row: Row): ConversationMessage {
  return {
    id: String(row.id || ''),
    conversation_id: String(row.conversation_id || ''),
    role: String(row.role || 'user') as 'user' | 'assistant',
    content: String(row.content || ''),
    knowledge_sources_used: parseJsonb<string[] | null>(row.knowledge_sources_used, null),
    matched_products: parseJsonb<string[] | null>(row.matched_products, null),
    token_count: row.token_count == null ? null : Number(row.token_count),
    latency_ms: row.latency_ms == null ? null : Number(row.latency_ms),
    retrieval_query: row.retrieval_query ? String(row.retrieval_query) : null,
    used_pill_ids: parseJsonb<string[]>(row.used_pill_ids, []),
    used_pill_sections: parseJsonb<string[]>(row.used_pill_sections, []),
    answer_confidence: row.answer_confidence == null ? null : Number(row.answer_confidence),
    response_mode: row.response_mode ? String(row.response_mode) : null,
    message_topic: row.message_topic ? String(row.message_topic) : null,
    message_intent: row.message_intent ? String(row.message_intent) : null,
    metadata: parseJsonb<Record<string, unknown>>(row.metadata, {}),
    created_at: String(row.created_at || ''),
  };
}

export async function findOrCreateConversation(opts: {
  workerId: string;
  sessionId: string;
  channel?: ConversationChannel;
  locale?: string;
  visitorFingerprint?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const channel = opts.channel || 'text_chat';

  if (opts.sessionId) {
    const existing = await db().query<{ id: string }>(
      `SELECT id
       FROM virtual_worker_conversations
       WHERE session_id = $1 AND worker_id = $2 AND channel = $3
       LIMIT 1`,
      [opts.sessionId, opts.workerId, channel]
    );
    if (existing.rows[0]) return existing.rows[0].id;
  }

  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_conversations
     (id, worker_id, session_id, channel, locale, visitor_fingerprint, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      opts.workerId,
      opts.sessionId || null,
      channel,
      opts.locale || null,
      opts.visitorFingerprint || null,
      JSON.stringify(opts.metadata || {}),
    ]
  );
  return id;
}

export async function getConversationById(conversationId: string): Promise<Conversation | null> {
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_conversations WHERE id = $1 LIMIT 1',
    [conversationId]
  );
  return result.rows[0] ? toConversation(result.rows[0]) : null;
}

export async function getConversationBySession(opts: {
  workerId: string;
  sessionId: string;
  channel?: ConversationChannel;
}): Promise<Conversation | null> {
  const result = await db().query<Row>(
    `SELECT * FROM virtual_worker_conversations
     WHERE worker_id = $1 AND session_id = $2 AND channel = $3
     LIMIT 1`,
    [opts.workerId, opts.sessionId, opts.channel || 'text_chat']
  );
  return result.rows[0] ? toConversation(result.rows[0]) : null;
}

export async function logMessage(opts: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  knowledgeSourcesUsed?: string[];
  matchedProducts?: string[];
  tokenCount?: number;
  latencyMs?: number;
  retrievalQuery?: string;
  usedPillIds?: string[];
  usedPillSections?: string[];
  answerConfidence?: number;
  responseMode?: string;
  messageTopic?: string;
  messageIntent?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_messages
     (id, conversation_id, role, content, knowledge_sources_used, matched_products, token_count, latency_ms,
      retrieval_query, used_pill_ids, used_pill_sections, answer_confidence, response_mode, message_topic,
      message_intent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      id,
      opts.conversationId,
      opts.role,
      opts.content,
      opts.knowledgeSourcesUsed ? JSON.stringify(opts.knowledgeSourcesUsed) : null,
      opts.matchedProducts ? JSON.stringify(opts.matchedProducts) : null,
      opts.tokenCount || null,
      opts.latencyMs || null,
      opts.retrievalQuery || null,
      JSON.stringify(opts.usedPillIds || []),
      JSON.stringify(opts.usedPillSections || []),
      opts.answerConfidence ?? null,
      opts.responseMode || null,
      opts.messageTopic || null,
      opts.messageIntent || null,
      JSON.stringify(opts.metadata || {}),
    ]
  );

  const conversationPatch =
    opts.role === 'user'
      ? 'last_user_message = $2'
      : 'last_assistant_message = $2';

  await db()
    .query(
      `UPDATE virtual_worker_conversations
       SET message_count = message_count + 1,
           updated_at = NOW(),
           ${conversationPatch}
       WHERE id = $1`,
      [opts.conversationId, opts.content]
    )
    .catch((err: unknown) => {
      logger.warn(
        '[ConversationLogger] message_count update failed:',
        err instanceof Error ? err.message : String(err)
      );
    });

  return id;
}

export const logConversationMessage = logMessage;

export async function updateConversationIntelligence(opts: {
  conversationId: string;
  primaryTopic?: string | null;
  secondaryTopics?: string[];
  topicFamily?: string | null;
  topicConfidence?: number | null;
  intent?: string | null;
  productsDiscussed?: string[];
  fallbackReason?: string | null;
  summary?: string | null;
  qualityFlags?: string[];
  sessionMemory?: Record<string, unknown>;
  metadataPatch?: Record<string, unknown>;
  outcome?: ConversationOutcome;
}): Promise<void> {
  const existing = await getConversationById(opts.conversationId);
  const mergedMetadata = {
    ...(existing?.metadata || {}),
    ...(opts.metadataPatch || {}),
  };

  await db().query(
    `UPDATE virtual_worker_conversations
     SET primary_topic = COALESCE($2, primary_topic),
         secondary_topics = CASE WHEN $3::jsonb IS NOT NULL THEN $3::jsonb ELSE secondary_topics END,
         topic_family = COALESCE($4, topic_family),
         topic_confidence = COALESCE($5, topic_confidence),
         intent = COALESCE($6, intent),
         products_discussed = CASE WHEN $7::jsonb IS NOT NULL THEN $7::jsonb ELSE products_discussed END,
         fallback_reason = COALESCE($8, fallback_reason),
         summary = COALESCE($9, summary),
         quality_flags = CASE WHEN $10::jsonb IS NOT NULL THEN $10::jsonb ELSE quality_flags END,
         session_memory = CASE WHEN $11::jsonb IS NOT NULL THEN $11::jsonb ELSE session_memory END,
         metadata = $12,
         outcome = COALESCE($13, outcome),
         updated_at = NOW()
     WHERE id = $1`,
    [
      opts.conversationId,
      opts.primaryTopic || null,
      opts.secondaryTopics ? JSON.stringify(opts.secondaryTopics) : null,
      opts.topicFamily || null,
      opts.topicConfidence ?? null,
      opts.intent || null,
      opts.productsDiscussed ? JSON.stringify(opts.productsDiscussed) : null,
      opts.fallbackReason || null,
      opts.summary || null,
      opts.qualityFlags ? JSON.stringify(opts.qualityFlags) : null,
      opts.sessionMemory ? JSON.stringify(opts.sessionMemory) : null,
      JSON.stringify(mergedMetadata),
      opts.outcome || null,
    ]
  );
}

export async function endConversation(
  conversationId: string,
  outcome?: ConversationOutcome
): Promise<void> {
  await db().query(
    `UPDATE virtual_worker_conversations
     SET ended_at = NOW(),
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
         outcome = COALESCE($2, outcome),
         updated_at = NOW()
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
     SET ended_at = NOW(), duration_seconds = $2, channel = 'voice', updated_at = NOW()
     WHERE id = $1`,
    [convId, opts.durationSeconds]
  );

  return convId;
}

export async function listConversations(opts: {
  workerId: string;
  limit?: number;
  offset?: number;
  channel?: ConversationChannel;
  outcome?: ConversationOutcome;
  topic?: string;
  intent?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ conversations: Conversation[]; total: number }> {
  const conditions = ['c.worker_id = $1'];
  const params: unknown[] = [opts.workerId];
  let idx = 2;

  if (opts.channel) {
    conditions.push(`c.channel = $${idx}`);
    params.push(opts.channel);
    idx += 1;
  }
  if (opts.outcome) {
    conditions.push(`c.outcome = $${idx}`);
    params.push(opts.outcome);
    idx += 1;
  }
  if (opts.topic) {
    conditions.push(`(c.primary_topic ILIKE $${idx} OR c.topic_family ILIKE $${idx})`);
    params.push(`%${opts.topic}%`);
    idx += 1;
  }
  if (opts.intent) {
    conditions.push(`c.intent = $${idx}`);
    params.push(opts.intent);
    idx += 1;
  }
  if (opts.dateFrom) {
    conditions.push(`c.started_at >= $${idx}`);
    params.push(opts.dateFrom);
    idx += 1;
  }
  if (opts.dateTo) {
    conditions.push(`c.started_at <= $${idx}`);
    params.push(opts.dateTo);
    idx += 1;
  }

  const where = conditions.join(' AND ');
  const countResult = await db().query<{ count: string }>(
    `SELECT COUNT(*) as count FROM virtual_worker_conversations c WHERE ${where}`,
    params
  );
  const total = parseInt(String(countResult.rows[0]?.count || '0'), 10);
  const limit = Math.min(opts.limit || 20, 100);
  const offset = opts.offset || 0;

  const result = await db().query<Row>(
    `SELECT c.* FROM virtual_worker_conversations c
     WHERE ${where}
     ORDER BY c.started_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return {
    conversations: (result.rows || []).map(toConversation),
    total,
  };
}

export async function getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const result = await db().query<Row>(
    'SELECT * FROM virtual_worker_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return (result.rows || []).map(toMessage);
}

export async function redactConversation(opts: {
  workerId: string;
  conversationId: string;
  redactedBy?: string | null;
}): Promise<boolean> {
  const existing = await getConversationById(opts.conversationId);
  if (!existing || existing.worker_id !== opts.workerId) return false;

  const redactionMarker = '[REDACTED BY ADMIN]';
  const metadata = mergeMetadata(existing.metadata, {
    redacted_at: new Date().toISOString(),
    redacted_by: opts.redactedBy || null,
    privacy_action: 'redact',
  });

  await db().query(
    `UPDATE virtual_worker_messages
     SET content = $2,
         retrieval_query = NULL,
         metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
     WHERE conversation_id = $1`,
    [
      opts.conversationId,
      redactionMarker,
      JSON.stringify({
        redacted: true,
        redacted_by: opts.redactedBy || null,
      }),
    ]
  );

  await db().query(
    `UPDATE virtual_worker_conversations
     SET visitor_fingerprint = NULL,
         summary = $2,
         session_memory = '{}'::jsonb,
         last_user_message = $3,
         last_assistant_message = $3,
         metadata = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [opts.conversationId, 'Conversation redacted by admin.', redactionMarker, JSON.stringify(metadata)]
  );

  return true;
}

export async function deleteConversation(opts: {
  workerId: string;
  conversationId: string;
}): Promise<boolean> {
  const existing = await getConversationById(opts.conversationId);
  if (!existing || existing.worker_id !== opts.workerId) return false;

  await db().query('DELETE FROM virtual_worker_messages WHERE conversation_id = $1', [opts.conversationId]);
  const result = await db().query('DELETE FROM virtual_worker_conversations WHERE id = $1 AND worker_id = $2', [
    opts.conversationId,
    opts.workerId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

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
  intentDistribution: Record<string, number>;
  topicDistribution: Record<string, number>;
  fallbackReasons: Record<string, number>;
  qualityFlagDistribution: Record<string, number>;
  conversationsPerDay: Array<{ date: string; count: number }>;
  topKnowledgeSources: Array<{ source: string; count: number }>;
  topKnowledgePills: Array<{ pillId: string; count: number }>;
  topProducts: Array<{ product: string; count: number }>;
}> {
  const conditions = ['c.worker_id = $1'];
  const params: unknown[] = [opts.workerId];
  let idx = 2;

  if (opts.dateFrom) {
    conditions.push(`c.started_at >= $${idx}`);
    params.push(opts.dateFrom);
    idx += 1;
  }
  if (opts.dateTo) {
    conditions.push(`c.started_at <= $${idx}`);
    params.push(opts.dateTo);
    idx += 1;
  }

  const where = conditions.join(' AND ');
  const summaryResult = await db().query<Row>(
    `SELECT
       COUNT(*) as total_conversations,
       COALESCE(SUM(c.message_count), 0) as total_messages,
       COALESCE(AVG(c.duration_seconds), 0) as avg_duration,
       COALESCE(AVG(c.message_count), 0) as avg_messages
     FROM virtual_worker_conversations c
     WHERE ${where}`,
    params
  );

  const summary = summaryResult.rows[0] || {};
  const distributionFromQuery = async (
    sql: string
  ): Promise<Record<string, number>> => {
    const result = await db().query<{ label: string; count: string }>(sql, params).catch(() => ({
      rows: [] as Array<{ label: string; count: string }>,
    }));
    return (result.rows || []).reduce<Record<string, number>>((acc, row) => {
      acc[String(row.label || 'unknown')] = parseInt(String(row.count || '0'), 10);
      return acc;
    }, {});
  };

  const outcomeDistribution = await distributionFromQuery(
    `SELECT c.outcome as label, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY c.outcome`
  );

  const channelDistribution = await distributionFromQuery(
    `SELECT c.channel as label, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY c.channel`
  );

  const intentDistribution = await distributionFromQuery(
    `SELECT COALESCE(c.intent, 'unknown') as label, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY COALESCE(c.intent, 'unknown')`
  );

  const topicDistribution = await distributionFromQuery(
    `SELECT COALESCE(c.primary_topic, 'unknown') as label, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY COALESCE(c.primary_topic, 'unknown')
     ORDER BY count DESC
     LIMIT 10`
  );

  const fallbackReasons = await distributionFromQuery(
    `SELECT COALESCE(c.fallback_reason, 'none') as label, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY COALESCE(c.fallback_reason, 'none')`
  );

  const dailyResult = await db().query<{ date: string; count: string }>(
    `SELECT DATE(c.started_at) as date, COUNT(*) as count
     FROM virtual_worker_conversations c
     WHERE ${where}
     GROUP BY DATE(c.started_at)
     ORDER BY date DESC
     LIMIT 30`,
    params
  );

  const sourcesResult = await db()
    .query<{ source: string; count: string }>(
      `SELECT s.source, COUNT(*) as count
       FROM virtual_worker_messages m
       JOIN virtual_worker_conversations c ON m.conversation_id = c.id
       CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(m.knowledge_sources_used, '[]'::jsonb)) AS s(source)
       WHERE ${where}
       GROUP BY s.source
       ORDER BY count DESC
       LIMIT 10`,
      params
    )
    .catch(() => ({ rows: [] as Array<{ source: string; count: string }> }));

  const pillsResult = await db()
    .query<{ pill_id: string; count: string }>(
      `SELECT p.pill_id, COUNT(*) as count
       FROM virtual_worker_messages m
       JOIN virtual_worker_conversations c ON m.conversation_id = c.id
       CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(m.used_pill_ids, '[]'::jsonb)) AS p(pill_id)
       WHERE ${where}
       GROUP BY p.pill_id
       ORDER BY count DESC
       LIMIT 10`,
      params
    )
    .catch(() => ({ rows: [] as Array<{ pill_id: string; count: string }> }));

  const productsResult = await db()
    .query<{ product: string; count: string }>(
      `SELECT p.product, COUNT(*) as count
       FROM virtual_worker_conversations c
       CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.products_discussed, '[]'::jsonb)) AS p(product)
       WHERE ${where}
       GROUP BY p.product
       ORDER BY count DESC
       LIMIT 10`,
      params
    )
    .catch(() => ({ rows: [] as Array<{ product: string; count: string }> }));

  const qualityResult = await db()
    .query<{ flag: string; count: string }>(
      `SELECT q.flag, COUNT(*) as count
       FROM virtual_worker_conversations c
       CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.quality_flags, '[]'::jsonb)) AS q(flag)
       WHERE ${where}
       GROUP BY q.flag
       ORDER BY count DESC`,
      params
    )
    .catch(() => ({ rows: [] as Array<{ flag: string; count: string }> }));

  return {
    totalConversations: parseInt(String(summary.total_conversations || '0'), 10),
    totalMessages: parseInt(String(summary.total_messages || '0'), 10),
    avgDurationSeconds: Math.round(Number(summary.avg_duration || 0)),
    avgMessagesPerConversation: Math.round(Number(summary.avg_messages || 0) * 10) / 10,
    outcomeDistribution,
    channelDistribution,
    intentDistribution,
    topicDistribution,
    fallbackReasons,
    qualityFlagDistribution: (qualityResult.rows || []).reduce<Record<string, number>>((acc, row) => {
      acc[String(row.flag || 'unknown')] = parseInt(String(row.count || '0'), 10);
      return acc;
    }, {}),
    conversationsPerDay: (dailyResult.rows || []).map((row) => ({
      date: String(row.date || ''),
      count: parseInt(String(row.count || '0'), 10),
    })),
    topKnowledgeSources: (sourcesResult.rows || []).map((row) => ({
      source: String(row.source || ''),
      count: parseInt(String(row.count || '0'), 10),
    })),
    topKnowledgePills: (pillsResult.rows || []).map((row) => ({
      pillId: String(row.pill_id || ''),
      count: parseInt(String(row.count || '0'), 10),
    })),
    topProducts: (productsResult.rows || []).map((row) => ({
      product: String(row.product || ''),
      count: parseInt(String(row.count || '0'), 10),
    })),
  };
}
