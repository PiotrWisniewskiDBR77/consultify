/** @vitest-environment node */
/**
 * P0-1 differentiating test (day28 duty fix-round, FIX-1).
 *
 * Context: b299a809c8 wrapped createTaskFromMeetingNoteAction in a real
 * Postgres transaction + `pg_advisory_xact_lock(hashtext(orgId), hashtext(key))`
 * to serialize concurrent callers — a strictly better defense against the
 * TWO-CALLERS-THROUGH-THIS-FUNCTION race than the pre-fix "insert, catch
 * 23505, retry" pattern (autocommit, no transaction, no lock). But the same
 * commit also DELETED the `error?.code === '23505'` rescue branch entirely.
 *
 * The existing "collapses two concurrent replays" integration test does not
 * distinguish old vs. new code: with only two real callers going through the
 * exported function, the lock (new code) or the retry (old code) both
 * resolve the race cleanly — hence the reviewer's finding that it passes
 * 5/5 on both sides of b299a809c8.
 *
 * This test forces the ACTUAL scenario the deleted branch existed to guard:
 * a 23505 that reaches the INSERT despite the SELECT-then-INSERT check
 * finding nothing (i.e. a write to `tasks` with the same
 * (organization_id, idempotency_key) that lands between this call's own
 * SELECT and INSERT but is NOT mediated by this call's own advisory lock —
 * for example a second write path, or the direct-prior-insert /
 * lock-bypassed-second-caller scenarios the duty brief names). It is
 * implemented as a database-layer mock (no live Postgres needed) so the
 * INSERT can be made to throw a real-shaped 23505 deterministically instead
 * of depending on timing:
 *
 *   1st  pg_advisory_xact_lock(...)                -> no-op (mocked)
 *   1st  SELECT source_type, source_id FROM tasks   -> not found
 *   1st  SELECT organization_id FROM users          -> found
 *   1st  SELECT * FROM tasks WHERE ... idempotency  -> not found
 *   1st  INSERT INTO tasks (...)                    -> throws { code: '23505' }
 *        (simulating: another writer's row for this exact
 *        (organization_id, idempotency_key) has just committed, invisible to
 *        the SELECTs above but colliding at INSERT time)
 *   [only reached if the code retries:]
 *   2nd  SELECT organization_id FROM users          -> found
 *   2nd  SELECT * FROM tasks WHERE ... idempotency  -> NOW found (the "other
 *        writer"'s row, same source_type/source_id) -> returns it, replayed
 *
 * Same mock wiring is compatible with BOTH the pre-fix file (which reads the
 * db via `getDatabase()` from Database.js) and the post-fix file (which
 * reads it via `withPgTransaction()` from PostgresDatabase.js) — both are
 * stubbed here, pointed at the same query router, so this single test file
 * can be run unmodified against either version of
 * meetingNoteTaskFunnelService.ts to prove which one handles the forced
 * 23505 honestly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const EXISTING_TASK_ROW = {
  id: 'existing-task-id',
  organization_id: 'org-race-1',
  project_id: null,
  title: 'Prepare the evidence pack',
  description: null,
  status: 'todo',
  priority: 'medium',
  assignee_id: null,
  due_date: null,
  estimated_hours: null,
  actual_hours: null,
  tags: null,
  created_at: '2026-08-27T00:00:00.000Z',
  updated_at: '2026-08-27T00:00:00.000Z',
  idempotency_key: 'meeting-note-action:note-race-1:0',
  source_type: 'meeting_note_action_item',
  source_id: 'meeting-race-1:note-race-1:0',
};

function buildMockQuery() {
  // Flips to true the moment the (mocked) INSERT hits the forced 23505 —
  // modeling the other writer's row becoming visible to subsequent reads.
  const state = { otherWriterCommitted: false };
  const calls: string[] = [];
  const query = vi.fn(async (sql: string, _params: unknown[] = []) => {
    calls.push(sql);
    if (/pg_advisory_xact_lock/.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    if (/SELECT source_type, source_id FROM tasks/.test(sql)) {
      return state.otherWriterCommitted
        ? {
            rows: [
              { source_type: EXISTING_TASK_ROW.source_type, source_id: EXISTING_TASK_ROW.source_id },
            ],
            rowCount: 1,
          }
        : { rows: [], rowCount: 0 };
    }
    if (/SELECT organization_id FROM users WHERE id/.test(sql)) {
      return { rows: [{ organization_id: 'org-race-1' }], rowCount: 1 };
    }
    // DEC-153 tenant/owner-resolution check (meetingNoteTaskFunnelService.ts):
    // the note's author ('aaaaaaaa-1111-4111-8111-111111111111', see getMeetingNote mock below)
    // is a real org-race-1 member, so this resolves and the created task is
    // assigned to them.
    if (/SELECT id FROM users WHERE id = \$1 AND organization_id = \$2/.test(sql)) {
      return { rows: [{ id: 'aaaaaaaa-1111-4111-8111-111111111111' }], rowCount: 1 };
    }
    if (/SELECT \* FROM tasks WHERE organization_id=\$1 AND idempotency_key=\$2/.test(sql)) {
      return state.otherWriterCommitted
        ? { rows: [EXISTING_TASK_ROW], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }
    if (/INSERT INTO tasks/.test(sql)) {
      state.otherWriterCommitted = true;
      const err: any = new Error(
        'duplicate key value violates unique constraint "tasks_org_idempotency_key_idx"'
      );
      err.code = '23505';
      throw err;
    }
    throw new Error(`meetingNoteTaskFunnelService race23505 test: unexpected query: ${sql}`);
  });
  return { query, calls, state };
}

let mock: ReturnType<typeof buildMockQuery>;

vi.mock('../../../database/Database.js', () => ({
  getDatabase: async () => ({ query: mock.query }),
}));

vi.mock('../../../database/PostgresDatabase.js', () => ({
  withPgTransaction: async (fn: (query: typeof mock.query) => Promise<unknown>) => fn(mock.query),
}));

vi.mock('../../meetingBoundary/meetingBoundaryService.js', () => ({
  getMeetingNote: vi.fn(async () => ({
    id: 'note-race-1',
    status: 'approved',
    createdBy: 'aaaaaaaa-1111-4111-8111-111111111111',
    actionItems: [{ task: 'Prepare the evidence pack', owner: 'A. Nowak', priority: 'medium' }],
  })),
}));

beforeEach(() => {
  mock = buildMockQuery();
  vi.clearAllMocks();
});

describe('meetingNoteTaskFunnelService — forced 23505 (P0-1 differentiating test)', () => {
  it('honestly reports replayed:true when the INSERT collides with a row the checks missed', async () => {
    const { createTaskFromMeetingNoteAction } = await import('../meetingNoteTaskFunnelService.js');

    const result = await createTaskFromMeetingNoteAction({
      organizationId: 'org-race-1',
      meetingId: 'meeting-race-1',
      noteId: 'note-race-1',
      actionIndex: 0,
      actorId: 'user-race-1',
      actorRole: 'ADMIN',
      projectId: null,
    });

    expect(result.replayed).toBe(true);
    expect(result.task.id).toBe(EXISTING_TASK_ROW.id);
  });
});
