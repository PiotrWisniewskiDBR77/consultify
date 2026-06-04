/**
 * V8 bridge for InterviewInsightService.
 *
 * Provides the `getCompletedSessionsWithoutInsights` query used by
 * teresaCopilotService → getProactiveSuggestions (L6.4) and re-exports
 * the core service for convenience.
 */

import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export { default } from '../InterviewInsightService.js';
export { create, deleteInsight, getById, list, regenerate } from '../InterviewInsightService.js';
import { create as createInsightCore } from '../InterviewInsightService.js';

const LOG_PREFIX = '[V8:InterviewInsight]';

/**
 * Teresa last-mile (backlog #3): create a REAL interview insight from a handoff.
 *
 * `teresaCopilotService.handleInterviewHandoff` looks for `generateInsight`/`createInsight`,
 * but the service only exported `create` — a name mismatch that forced a synthetic ref.
 * These aliases map the handoff payload onto the canonical `create`, returning `{ id }`.
 * Note: `create` requires at least one eligible session; with none it rejects and the
 * handoff degrades gracefully to a deeplink (unchanged behaviour).
 */
export async function createInsight(params: {
  organizationId: string;
  action?: unknown;
  session_ids?: unknown;
  title?: unknown;
  source?: string;
  proposalId?: string;
}): Promise<{ id: string }> {
  const sessionIds = Array.isArray(params.session_ids)
    ? (params.session_ids as unknown[]).map((s) => String(s)).filter(Boolean)
    : [];
  const insight: any = await createInsightCore({
    organizationId: params.organizationId,
    title: String(params.title || 'Teresa interview insight').slice(0, 500),
    sessionIds,
    promptType: 'summary',
    createdBy: 'teresa',
  } as any);
  return { id: String(insight?.id || '') };
}

export const generateInsight = createInsight;

/**
 * Returns the count of completed interview sessions that have no
 * associated insight records yet. Used by Teresa proactive suggestions.
 */
export async function getCompletedSessionsWithoutInsights(params: {
  organizationId: string;
}): Promise<number> {
  try {
    const rows = await dbAll<{ cnt: number }>(
      `SELECT COUNT(*) as cnt
       FROM interview_sessions s
       WHERE s.organization_id = ?
         AND s.status = 'completed'
         AND NOT EXISTS (
           SELECT 1 FROM interview_insights i
           WHERE i.organization_id = s.organization_id
             AND (i.session_id = s.id
                  OR i.source_session_ids LIKE '%' || s.id || '%')
         )`,
      [params.organizationId],
      { fallback: true }
    );
    const count = rows?.[0]?.cnt ?? 0;
    if (count > 0) {
      logger.info(
        `${LOG_PREFIX} Found ${count} completed session(s) without insights for org ${params.organizationId}`
      );
    }
    return count;
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} getCompletedSessionsWithoutInsights failed: ${(err as Error).message}`
    );
    return 0;
  }
}
