import { run as dbRun } from '../../../utils/DbPromise.js';
import logger from '../../../utils/Logger.js';

let ensureAgentAuditMetricsPromise: Promise<void> | null = null;

export type AgentAuditEventType =
  | 'run_started'
  | 'run_completed'
  | 'run_accepted'
  | 'loop_triggered'
  | 'loop_iteration';

export async function logAgentAuditEvent(args: {
  organizationId: string;
  userId: string;
  runId: string;
  conversationId?: string | null;
  eventType: AgentAuditEventType;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  const { organizationId, userId, runId, conversationId, eventType, payload } = args;
  try {
    if (!ensureAgentAuditMetricsPromise) {
      ensureAgentAuditMetricsPromise = dbRun(
        `CREATE TABLE IF NOT EXISTS ai_agent_audit_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organization_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          conversation_id TEXT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        { fallback: false } as any
      ).catch((error) => {
        ensureAgentAuditMetricsPromise = null;
        throw error;
      });
    }
    await ensureAgentAuditMetricsPromise;
    await dbRun(
      `
        INSERT INTO ai_agent_audit_metrics (
          organization_id,
          user_id,
          run_id,
          conversation_id,
          event_type,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        organizationId,
        userId,
        runId,
        conversationId || null,
        eventType,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err: any) {
    // Metrics must never break the primary flow.
    logger.warn('[AgentAuditMetrics] Failed to log event:', err?.message || err);
  }
}
