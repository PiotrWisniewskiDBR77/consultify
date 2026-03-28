/**
 * Virtual Worker Insights Engine
 *
 * Analyzes conversations and generates AI-driven improvement recommendations.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InsightType =
  | 'knowledge_gap'
  | 'frequent_topic'
  | 'objection_pattern'
  | 'improvement_suggestion'
  | 'escalation_pattern';

export type InsightPriority = 'low' | 'medium' | 'high' | 'critical';
export type InsightStatus = 'new' | 'reviewed' | 'applied' | 'dismissed';

export interface WorkerInsight {
  id: string;
  worker_id: string;
  insight_type: InsightType;
  title: string;
  description: string | null;
  evidence: Record<string, unknown> | null;
  priority: InsightPriority;
  status: InsightStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function db() {
  return getDatabase();
}

function parseJsonb<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

function rowToInsight(row: Record<string, unknown>): WorkerInsight {
  return {
    id: String(row.id || ''),
    worker_id: String(row.worker_id || ''),
    insight_type: String(row.insight_type || 'frequent_topic') as InsightType,
    title: String(row.title || ''),
    description: row.description ? String(row.description) : null,
    evidence: parseJsonb<Record<string, unknown>>(row.evidence),
    priority: String(row.priority || 'medium') as InsightPriority,
    status: String(row.status || 'new') as InsightStatus,
    created_at: String(row.created_at || ''),
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listInsights(opts: {
  workerId: string;
  status?: InsightStatus;
  type?: InsightType;
  limit?: number;
  offset?: number;
}): Promise<{ insights: WorkerInsight[]; total: number }> {
  const conditions = ['worker_id = $1'];
  const params: unknown[] = [opts.workerId];
  let idx = 2;

  if (opts.status) {
    conditions.push(`status = $${idx}`);
    params.push(opts.status);
    idx++;
  }
  if (opts.type) {
    conditions.push(`insight_type = $${idx}`);
    params.push(opts.type);
    idx++;
  }

  const where = conditions.join(' AND ');
  const limit = Math.min(opts.limit || 20, 100);
  const offset = opts.offset || 0;

  const countResult = await db().query<{ count: string }>(
    `SELECT COUNT(*) as count FROM virtual_worker_insights WHERE ${where}`,
    params
  );
  const total = parseInt(String(countResult.rows[0]?.count || '0'), 10);

  const result = await db().query<Record<string, unknown>>(
    `SELECT * FROM virtual_worker_insights
     WHERE ${where}
     ORDER BY
       CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return {
    insights: (result.rows || []).map(rowToInsight),
    total,
  };
}

export async function createInsight(data: {
  worker_id: string;
  insight_type: InsightType;
  title: string;
  description?: string;
  evidence?: Record<string, unknown>;
  priority?: InsightPriority;
}): Promise<WorkerInsight> {
  const id = uuidv4();
  await db().query(
    `INSERT INTO virtual_worker_insights
     (id, worker_id, insight_type, title, description, evidence, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      data.worker_id,
      data.insight_type,
      data.title,
      data.description || null,
      data.evidence ? JSON.stringify(data.evidence) : null,
      data.priority || 'medium',
    ]
  );
  return rowToInsight({
    id,
    ...data,
    status: 'new',
    created_at: new Date().toISOString(),
  });
}

export async function reviewInsight(
  insightId: string,
  status: InsightStatus,
  reviewedBy: string
): Promise<void> {
  await db().query(
    `UPDATE virtual_worker_insights
     SET status = $2, reviewed_at = NOW(), reviewed_by = $3
     WHERE id = $1`,
    [insightId, status, reviewedBy]
  );
}

// ---------------------------------------------------------------------------
// Insights generation (rule-based + LLM-enhanced)
// ---------------------------------------------------------------------------

export async function generateInsights(workerId: string): Promise<WorkerInsight[]> {
  const generated: WorkerInsight[] = [];

  try {
    // 1. Knowledge gap detection: messages with no knowledge sources
    const gapResult = await db()
      .query<{ content: string; count: string }>(
        `SELECT m.content, COUNT(*) as count
       FROM virtual_worker_messages m
       JOIN virtual_worker_conversations c ON m.conversation_id = c.id
       WHERE c.worker_id = $1
         AND m.role = 'user'
         AND (m.knowledge_sources_used IS NULL OR m.knowledge_sources_used = '[]'::jsonb)
         AND m.created_at > NOW() - INTERVAL '7 days'
       GROUP BY m.content
       HAVING COUNT(*) >= 2
       ORDER BY count DESC
       LIMIT 5`,
        [workerId]
      )
      .catch(() => ({ rows: [] as Array<{ content: string; count: string }> }));

    for (const row of gapResult.rows || []) {
      const count = parseInt(String(row.count), 10);
      const preview = String(row.content || '').slice(0, 120);
      generated.push(
        await createInsight({
          worker_id: workerId,
          insight_type: 'knowledge_gap',
          title: `Unanswered topic pattern (${count} occurrences)`,
          description: `Users asked about "${preview}" ${count} times in the last 7 days, but no knowledge sources were matched. Consider adding a Knowledge Pill for this topic.`,
          evidence: { sample_query: preview, occurrence_count: count },
          priority: count >= 5 ? 'high' : 'medium',
        })
      );
    }

    // 2. Abandoned conversations (no outcome or abandoned)
    const abandonedResult = await db()
      .query<{ count: string; avg_msgs: string }>(
        `SELECT COUNT(*) as count, AVG(message_count) as avg_msgs
       FROM virtual_worker_conversations
       WHERE worker_id = $1
         AND outcome IN ('abandoned', 'unknown')
         AND started_at > NOW() - INTERVAL '7 days'
         AND message_count >= 2`,
        [workerId]
      )
      .catch(() => ({ rows: [{ count: '0', avg_msgs: '0' }] }));

    const abandonedCount = parseInt(String(abandonedResult.rows[0]?.count || '0'), 10);
    if (abandonedCount >= 3) {
      generated.push(
        await createInsight({
          worker_id: workerId,
          insight_type: 'improvement_suggestion',
          title: `High abandonment rate (${abandonedCount} in 7 days)`,
          description: `${abandonedCount} conversations were abandoned without a clear outcome. Average message count before abandonment: ${Math.round(Number(abandonedResult.rows[0]?.avg_msgs || 0))}. Consider adding stronger CTAs or improving response quality.`,
          evidence: { abandoned_count: abandonedCount },
          priority: abandonedCount >= 10 ? 'high' : 'medium',
        })
      );
    }

    // 3. Frequent topics (most common user messages)
    const topicResult = await db()
      .query<{ word: string; count: string }>(
        `SELECT lower(regexp_replace(m.content, '[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\\s]', '', 'g')) as word,
              COUNT(*) as count
       FROM virtual_worker_messages m
       JOIN virtual_worker_conversations c ON m.conversation_id = c.id
       WHERE c.worker_id = $1
         AND m.role = 'user'
         AND m.created_at > NOW() - INTERVAL '7 days'
         AND length(m.content) > 10
       GROUP BY lower(regexp_replace(m.content, '[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\\s]', '', 'g'))
       HAVING COUNT(*) >= 3
       ORDER BY count DESC
       LIMIT 5`,
        [workerId]
      )
      .catch(() => ({ rows: [] as Array<{ word: string; count: string }> }));

    for (const row of topicResult.rows || []) {
      const count = parseInt(String(row.count), 10);
      generated.push(
        await createInsight({
          worker_id: workerId,
          insight_type: 'frequent_topic',
          title: `Frequent topic: "${String(row.word || '').slice(0, 80)}"`,
          description: `This topic appeared ${count} times in the last 7 days. Ensure the worker has strong knowledge coverage for it.`,
          evidence: { topic: row.word, count },
          priority: 'low',
        })
      );
    }

    logger.info(`[InsightsEngine] Generated ${generated.length} insights for worker ${workerId}`);
  } catch (error: unknown) {
    logger.error(
      '[InsightsEngine] Failed to generate insights:',
      error instanceof Error ? error.message : String(error)
    );
  }

  return generated;
}
