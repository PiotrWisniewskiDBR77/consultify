import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type DeepThinkingEventType =
  | 'run_started'
  | 'run_completed'
  | 'run_aborted'
  | 'force_depth'
  | 'copied';

export async function logDeepThinkingEvent(args: {
  organizationId: string;
  userId: string;
  sessionId: string;
  conversationId?: string | null;
  eventType: DeepThinkingEventType;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  const { organizationId, userId, sessionId, conversationId, eventType, payload } = args;
  try {
    await dbRun(
      `
        INSERT INTO ai_deep_thinking_metrics (
          organization_id,
          user_id,
          session_id,
          conversation_id,
          event_type,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [
        organizationId,
        userId,
        sessionId,
        conversationId || null,
        eventType,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err: any) {
    // Metrics must never break the primary flow.
    logger.warn('[DeepThinkingMetrics] Failed to log event:', err?.message || err);
  }
}

