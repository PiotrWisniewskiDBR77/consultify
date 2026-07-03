/**
 * Feedback ↔ Slack thread anchor — shared by BOTH directions of the pipeline.
 *
 * Part of "Slack Command Center" (docs/plans/SLACK_COMMAND_CENTER_PLAN.md).
 * Extracted from slack/slackInbound.routes.ts (F2) so it can be reused by
 * feedback.routes.ts (F5 — Piotr: "chcę całą historię zgłoszeń, nie tylko
 * te ze Slacka"). A feedback ticket's ORIGIN (Slack slash-command/shortcut
 * vs the in-app FeedbackSidePanel widget) must not change what happens next:
 * every ticket gets posted to #cf-feedback and its Slack message ts is
 * anchored here, so later status/workflow/response changes
 * (`notifySlackThread` in feedback.routes.ts) reply into the SAME thread
 * regardless of where the report came from.
 */

import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';

/**
 * Persist the Slack thread coordinates onto the feedback ticket's metadata_json
 * (merging with whatever is already there). This is what lets status/workflow/
 * response updates reply into the same Slack thread as the original report.
 */
export async function anchorSlackThread(
  feedbackId: string,
  channelId: string | undefined,
  threadTs: string
): Promise<void> {
  try {
    const cols = await getTableColumns('feedback_items');
    if (!cols.has('metadata_json')) return;

    // Preferred path: atomic per-key JSON patch (Postgres jsonb_set) so a
    // concurrent whole-object writer (e.g. escalation's alertDispatch persist)
    // cannot clobber the anchor via read-modify-write. Falls through to the
    // legacy read-modify-write below on engines without jsonb (mock-DB/sqlite).
    try {
      await dbRun(
        `UPDATE feedback_items
         SET metadata_json = jsonb_set(
               jsonb_set(COALESCE(metadata_json, '{}')::jsonb, '{slack_thread_ts}', to_jsonb(?::text), true),
               '{slack_channel_id}', to_jsonb(?::text), true
             )::text
         WHERE id = ?`,
        [threadTs, channelId ?? '', feedbackId]
      );
      return;
    } catch {
      // fall through to read-modify-write
    }

    const row = await dbGet<{ metadata_json?: string }>(
      `SELECT metadata_json FROM feedback_items WHERE id = ?`,
      [feedbackId]
    );
    let meta: Record<string, unknown> = {};
    if (row?.metadata_json) {
      try {
        meta =
          typeof row.metadata_json === 'string'
            ? JSON.parse(row.metadata_json)
            : (row.metadata_json as Record<string, unknown>);
      } catch {
        meta = {};
      }
    }
    meta.slack_thread_ts = threadTs;
    if (channelId) meta.slack_channel_id = channelId;

    const updateCols = ['metadata_json = ?'];
    if (cols.has('updated_at')) updateCols.push('updated_at = CURRENT_TIMESTAMP');
    await dbRun(`UPDATE feedback_items SET ${updateCols.join(', ')} WHERE id = ?`, [
      JSON.stringify(meta),
      feedbackId,
    ]);
  } catch (err) {
    logger.warn('[FeedbackThreadAnchor] anchorSlackThread failed', {
      feedbackId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
