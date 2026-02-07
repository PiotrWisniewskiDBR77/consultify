import { run as dbRun } from '../../../utils/DbPromise.js';
import logger from '../../../utils/Logger.js';

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
      [organizationId, userId, runId, conversationId || null, eventType, payload ? JSON.stringify(payload) : null]
    );
  } catch (err: any) {
    // Metrics must never break the primary flow.
    logger.warn('[AgentAuditMetrics] Failed to log event:', err?.message || err);
  }
}

