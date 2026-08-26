import { validate as isUuid } from 'uuid';

import { withPgTransaction } from '../../database/PostgresDatabase.js';
import { TaskService } from '../TaskService.js';
import { getMeetingNote } from '../meetingBoundary/meetingBoundaryService.js';

export class MeetingNoteTaskFunnelError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOTE_NOT_APPROVED'
      | 'ACTION_ITEM_NOT_FOUND'
      | 'TASK_IDEMPOTENCY_COLLISION'
  ) {
    super(message);
  }
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
  try {
    return await withPgTransaction(async (query) => {
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
      const service = new TaskService({ query } as any);
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
        },
        input.actorId,
        { idempotencyKey, sourceType, sourceId }
      );
      return { task, replayed: Boolean(replayBefore.rows[0]) };
    });
  } catch (error: any) {
    if (error?.message === 'TASK_IDEMPOTENCY_COLLISION') {
      throw new MeetingNoteTaskFunnelError(error.message, 'TASK_IDEMPOTENCY_COLLISION');
    }
    throw error;
  }
}
