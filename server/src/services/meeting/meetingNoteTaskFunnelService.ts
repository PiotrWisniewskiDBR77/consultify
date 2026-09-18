import { validate as isUuid } from 'uuid';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import { TaskService } from '../TaskService.js';
import { getMeetingNote } from '../meetingBoundary/meetingBoundaryService.js';
import {
  getMeetingFollowUpRecord,
  setMeetingFollowUpTaskId,
} from '../meetingService.js';

export class MeetingNoteTaskFunnelError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOTE_NOT_APPROVED'
      | 'ACTION_ITEM_NOT_FOUND'
      | 'FOLLOW_UP_NOT_FOUND'
      | 'TASK_IDEMPOTENCY_COLLISION'
  ) {
    super(message);
  }
}

/**
 * MTG-2b (DEC-607, Wpis 100/U-52): the funnel used to fold the action's due
 * date into the task DESCRIPTION as free text and never set the structured
 * `due_date`, so "ze spotkania coś wychodzi" lost the termin — the created
 * task had `due_date = NULL` and no calendar/My-Work due ordering. Parse the
 * (free-text or ISO) deadline into a real ISO-8601 datetime; return null when
 * it is absent or unparseable so we never write a bogus date.
 */
function parseDeadlineToIso(value?: string | null): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function createTaskFromMeetingNoteAction(input: {
  organizationId: string;
  meetingId: string;
  noteId: string;
  actionIndex: number;
  actorId: string;
  actorRole?: string | null;
  projectId?: string | null;
}) {
  const note = await getMeetingNote({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    noteId: input.noteId,
    userId: input.actorId,
    roleKey: input.actorRole,
  });
  if (!note || note.status !== 'approved') {
    throw new MeetingNoteTaskFunnelError('Meeting note is not approved', 'NOTE_NOT_APPROVED');
  }
  const action = note.actionItems[input.actionIndex];
  if (!action) {
    throw new MeetingNoteTaskFunnelError(
      'Meeting note action item not found',
      'ACTION_ITEM_NOT_FOUND'
    );
  }

  const idempotencyKey = `meeting-note-action:${input.noteId}:${input.actionIndex}`;
  const sourceType = 'meeting_note_action_item';
  const sourceId = `${input.meetingId}:${input.noteId}:${input.actionIndex}`;

  // The advisory xact lock below serializes every caller that goes through
  // THIS function for the same (organizationId, idempotencyKey), which is
  // what makes two concurrent callers of createTaskFromMeetingNoteAction
  // collapse cleanly without ever reaching a 23505. It cannot serialize a
  // write to `tasks` that lands from OUTSIDE this function's lock (a
  // differently-timed writer touching the same idempotency key). For that
  // residual case attempt() is retried once on a genuine 23505: the retry's
  // own SELECT will now see the row the other writer committed and return it
  // as an honest replay instead of letting the raw pg error escape as an
  // unhandled 500 (see meetingNoteTaskFunnelService.race23505.test.ts).
  const attempt = () =>
    withPgTransaction(async (query) => {
      await query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
        input.organizationId,
        idempotencyKey,
      ]);
      const replayBefore = await query<{ source_type: string; source_id: string }>(
        `SELECT source_type, source_id FROM tasks WHERE organization_id=$1 AND idempotency_key=$2`,
        [input.organizationId, idempotencyKey]
      );
      if (
        replayBefore.rows[0] &&
        (replayBefore.rows[0].source_type !== sourceType ||
          replayBefore.rows[0].source_id !== sourceId)
      ) {
        throw new MeetingNoteTaskFunnelError(
          'Task idempotency key belongs to another source',
          'TASK_IDEMPOTENCY_COLLISION'
        );
      }
      // DEC-153 (odbiór dyżuru 28, DEC-147/153, delegacja właściciela,
      // 2026-08-28): a task born from this funnel MUST carry a non-null
      // assignee_id — every My Work read filters `assignee_id = ?`
      // (my-work.routes.ts), so a NULL assignee makes the task invisible to
      // anyone. That was the bug: this call never set `assigneeId` at all.
      //
      // Rule per DEC-153: assignee = the action item's owner; if none,
      // fall back to the note's author.
      //
      // HONEST LIMITATION (documented per the decision's own instruction):
      // `MeetingNoteActionItem.owner` (meetingBoundaryService.ts) is
      // free-text the AI/heuristic extractor lifts from the transcript — a
      // name, "Unassigned", etc. There is no `ownerUserId`/structured field
      // on the action item (contrast `meeting_follow_ups`, which DOES carry
      // a structured `ownerUserId` next to its text `owner` —
      // meeting.routes.ts createMeetingFollowUpRecord). Resolving that free
      // text to a real user would mean heuristic name-matching (typos,
      // duplicate first names, `owner: "Unassigned"` never actually
      // matching anyone) — explicitly out of scope, since a wrong match
      // silently assigns the task to the wrong person, which is worse than
      // today's invisible-task bug. So under the CURRENT data model this
      // rule always resolves to its fallback branch: the note's author
      // (`note.createdBy`). The raw owner text is not lost — it stays in
      // the task description below, same as before this fix.
      //
      // Tenant guard: only assign to the note's author if that user still
      // belongs to THIS organization. `note` was fetched scoped to
      // `input.organizationId`, but `created_by` is a historical value
      // that is not re-validated on read — a user could since have moved
      // org, or the row could be corrupt. Never hand an assignee_id to a
      // user outside the task's own org; fall back to the actor performing
      // this conversion, who the route has already authenticated as a
      // member of `input.organizationId`.
      const ownerCheck = await query<{ id: string }>(
        `SELECT id FROM users WHERE id = $1 AND organization_id = $2`,
        [note.createdBy, input.organizationId]
      );
      const assigneeId = ownerCheck.rows[0]?.id || input.actorId;

      const service = new TaskService({ query } as any);
      const dueDate = parseDeadlineToIso(action.deadline);
      const task = await service.createTask(
        {
          projectId: input.projectId && isUuid(input.projectId) ? input.projectId : null,
          title: action.task,
          description: [
            action.owner ? `Owner: ${action.owner}` : '',
            action.deadline ? `Deadline: ${action.deadline}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          status: 'todo',
          priority: action.priority || 'medium',
          assigneeId,
          ...(dueDate ? { dueDate } : {}),
        },
        input.actorId,
        { idempotencyKey, sourceType, sourceId }
      );
      return { task, replayed: Boolean(replayBefore.rows[0]) };
    });

  try {
    return await attempt();
  } catch (error: any) {
    if (error?.message === 'TASK_IDEMPOTENCY_COLLISION') {
      throw new MeetingNoteTaskFunnelError(error.message, 'TASK_IDEMPOTENCY_COLLISION');
    }
    if (error?.code === '23505') {
      return await attempt();
    }
    throw error;
  }
}

/**
 * MTG-2b (DEC-607, Wpis 100/U-52) — "ze spotkania coś wychodzi": convert a
 * meeting ACTION (a `meeting_follow_ups` row, the protocol's A-01… block) into
 * a Realizacja task WITHOUT losing its termin or owner, then write the task id
 * back onto the follow-up so the protocol can read `tasks.status` and show the
 * return status.
 *
 * Unlike `createTaskFromMeetingNoteAction` (whose source is free-text lifted
 * from a transcript), a follow-up row carries STRUCTURED `dueAt` and
 * `ownerUserId`, so both survive the conversion as real columns:
 *   - termin  → `tasks.due_date` (ISO), not just description text;
 *   - owner   → `tasks.assignee_id` when `ownerUserId` is a live member of the
 *               org (tenant-guarded), else the actor performing the conversion
 *               (a NULL assignee would make the task invisible to My Work —
 *               DEC-153). The free-text `owner` label is still kept in the
 *               description so nothing the human typed is dropped.
 *
 * Idempotent on `meeting-follow-up:<followUpId>`: a retried conversion replays
 * the SAME task instead of creating a second one, and the task_id writeback is
 * a no-op-equivalent (same value) on replay.
 */
export async function createTaskFromMeetingFollowUp(input: {
  organizationId: string;
  meetingId: string;
  followUpId: string;
  actorId: string;
  projectId?: string | null;
}) {
  const followUp = await getMeetingFollowUpRecord({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    followUpId: input.followUpId,
  });
  if (!followUp) {
    throw new MeetingNoteTaskFunnelError('Meeting follow-up not found', 'FOLLOW_UP_NOT_FOUND');
  }

  const idempotencyKey = `meeting-follow-up:${input.followUpId}`;
  const sourceType = 'meeting_follow_up';
  const sourceId = `${input.meetingId}:${input.followUpId}`;
  const dueDate = parseDeadlineToIso(followUp.dueAt);

  const attempt = () =>
    withPgTransaction(async (query) => {
      await query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
        input.organizationId,
        idempotencyKey,
      ]);
      const replayBefore = await query<{ source_type: string; source_id: string }>(
        `SELECT source_type, source_id FROM tasks WHERE organization_id=$1 AND idempotency_key=$2`,
        [input.organizationId, idempotencyKey]
      );
      if (
        replayBefore.rows[0] &&
        (replayBefore.rows[0].source_type !== sourceType ||
          replayBefore.rows[0].source_id !== sourceId)
      ) {
        throw new MeetingNoteTaskFunnelError(
          'Task idempotency key belongs to another source',
          'TASK_IDEMPOTENCY_COLLISION'
        );
      }

      // Tenant-guard the structured owner: only assign to `ownerUserId` if that
      // user still belongs to THIS org; otherwise fall back to the actor (who
      // the route already authenticated as a member). Never hand an assignee_id
      // to a user outside the task's own org, and never leave it NULL.
      let assigneeId = input.actorId;
      if (followUp.ownerUserId) {
        const ownerCheck = await query<{ id: string }>(
          `SELECT id FROM users WHERE id = $1 AND organization_id = $2`,
          [followUp.ownerUserId, input.organizationId]
        );
        if (ownerCheck.rows[0]?.id) assigneeId = ownerCheck.rows[0].id;
      }

      const service = new TaskService({ query } as any);
      const task = await service.createTask(
        {
          projectId: input.projectId && isUuid(input.projectId) ? input.projectId : null,
          title: followUp.title,
          description: [
            followUp.owner ? `Owner: ${followUp.owner}` : '',
            followUp.dueAt ? `Deadline: ${followUp.dueAt}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          status: 'todo',
          priority: 'medium',
          assigneeId,
          ...(dueDate ? { dueDate } : {}),
        },
        input.actorId,
        { idempotencyKey, sourceType, sourceId }
      );
      return { task, replayed: Boolean(replayBefore.rows[0]) };
    });

  let result: { task: { id: string; title: string; status: string }; replayed: boolean };
  try {
    result = await attempt();
  } catch (error: any) {
    if (error?.message === 'TASK_IDEMPOTENCY_COLLISION') {
      throw new MeetingNoteTaskFunnelError(error.message, 'TASK_IDEMPOTENCY_COLLISION');
    }
    if (error?.code === '23505') {
      result = await attempt();
    } else {
      throw error;
    }
  }

  // W109c: write the task id back onto the action row so the protocol reader
  // (meetingProtocolService) can join `tasks.status` by `task_id` and surface
  // the return status on the protocol. Done after commit; idempotent on replay.
  await setMeetingFollowUpTaskId({
    organizationId: input.organizationId,
    meetingId: input.meetingId,
    followUpId: input.followUpId,
    taskId: result.task.id,
  });

  return result;
}
