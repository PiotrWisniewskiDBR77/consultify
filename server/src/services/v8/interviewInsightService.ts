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

const LOG_PREFIX = '[V8:InterviewInsight]';

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
