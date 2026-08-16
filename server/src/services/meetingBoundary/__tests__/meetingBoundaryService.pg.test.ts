/**
 * Lane C (closure) — MTG-BVP-001: `meetingBoundaryService.ts` acceptance
 * evidence, against a REAL local Postgres (no mocks).
 *
 * Lives under `server/src/services/meetingBoundary/__tests__/` — not
 * `tests/<newdir>/` — specifically so the ROOT `vitest.config.ts` collects it
 * via its existing glob
 * `server/src/services/**\/__tests__/**\/*.{test,spec}.{js,ts,jsx,tsx}` (same
 * reasoning as `server/src/services/artifactHandoff/__tests__/handoffSpine.pg.test.ts`,
 * which this suite deliberately mirrors in structure).
 *
 * Exercises the proposal-first flow this closure task adds on top of the
 * ALREADY-migrated/tested `handoffSpineService.ts`:
 *   create meeting -> propose note (AI output, durable + idempotent) ->
 *   human approve -> exactly-one materialize -> cold reopen; double approval;
 *   concurrent approval; replayed generate-notes; unapproved-materializes-
 *   nothing; reject; tenant isolation.
 *
 * Every fixture id is prefixed `claude_c_<runId>-...`; `afterAll` deletes
 * every row this file created (meeting_notes -> meetings -> handoff spine
 * rows for the 'meeting' producer kind), verified by a final COUNT(*).
 *
 * Run (root config, no --config flag):
 *   export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity"
 *   export DB_TYPE=postgres CI=true MOCK_DB=false RUN_DB_TESTS=1
 *   npx vitest run server/src/services/meetingBoundary --no-file-parallelism --maxWorkers=1
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { materializeProposal } from '../../artifactHandoff/handoffSpineService.js';
import { createMeeting, ensureMeetingTables } from '../../meetingService.js';
import {
  decideMeetingNote,
  ensureMeetingBoundaryTables,
  getMeetingNote,
  listMeetingNotesForMeeting,
  proposeMeetingNote,
} from '../meetingBoundaryService.js';

function requireLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `meetingBoundaryService.pg.test.ts requires a LOCAL DATABASE_URL (got: ${url || '(unset)'}). ` +
        'This suite writes real rows and must never point at a shared/demo/prod database.'
    );
  }
  return url;
}

const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const PREFIX = `claude_c_${RUN_ID}-`;
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-a`;
const USER_B = `${PREFIX}user-b`;

const pool = new Pool({ connectionString: requireLocalDatabaseUrl() });

async function makeMeeting(organizationId = ORG_A) {
  const meeting = await createMeeting({
    organizationId,
    createdBy: USER_A,
    title: `${PREFIX}meeting`,
    startAt: '2026-09-15T09:00:00.000Z',
    endAt: '2026-09-15T10:00:00.000Z',
  });
  return meeting.id;
}

async function countFixtureRows(): Promise<{ notes: number; meetings: number; proposals: number; receipts: number }> {
  const notes = await pool.query(`SELECT COUNT(*)::int AS n FROM meeting_notes WHERE organization_id LIKE $1`, [
    `${PREFIX}%`,
  ]);
  const meetings = await pool.query(`SELECT COUNT(*)::int AS n FROM meetings WHERE organization_id LIKE $1`, [
    `${PREFIX}%`,
  ]);
  const proposals = await pool.query(
    `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id LIKE $1 AND producer_kind = 'meeting'`,
    [`${PREFIX}%`]
  );
  const receipts = await pool.query(
    `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE organization_id LIKE $1`,
    [`${PREFIX}%`]
  );
  return {
    notes: notes.rows[0].n,
    meetings: meetings.rows[0].n,
    proposals: proposals.rows[0].n,
    receipts: receipts.rows[0].n,
  };
}

beforeAll(async () => {
  await ensureMeetingTables();
  await ensureMeetingBoundaryTables();
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('meeting_notes', 'artifact_handoff_proposals', 'artifact_handoff_receipts')`
  );
  if (tables.rows.length !== 3) {
    throw new Error(
      `meetingBoundaryService.pg.test.ts requires both ` +
        `server/migrations/20260912_claude_c_meeting_boundary.sql and ` +
        `server/migrations/20260912_claude_c_handoff_spine.sql to be applied. ` +
        `Found ${tables.rows.length}/3 tables.`
    );
  }
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(
      `DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1 AND producer_kind = 'meeting'`,
      [`${PREFIX}%`]
    );
    await pool.query(`DELETE FROM meeting_notes WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM meeting_follow_ups WHERE meeting_id IN (SELECT id FROM meetings WHERE organization_id LIKE $1)`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM meetings WHERE organization_id LIKE $1`, [`${PREFIX}%`]);

    const remaining = await countFixtureRows();
    expect(remaining).toEqual({ notes: 0, meetings: 0, proposals: 0, receipts: 0 });
  } finally {
    await pool.end();
  }
});

describe('propose -> approve -> materialize happy path', () => {
  it('runs create->agenda(implicit)->notes->proposal->approve->exactly-one output->cold reopen', async () => {
    const meetingId = await makeMeeting();

    const proposed = await proposeMeetingNote({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic',
      language: 'en',
      transcript: `${PREFIX} we decided to ship Friday. action item: prepare rollout plan.`,
      summary: 'Ship Friday; rollout plan needed.',
      keyPoints: ['Ship Friday'],
      decisions: [{ decision: 'Ship on Friday' }],
      actionItems: [{ task: 'Prepare rollout plan', owner: 'Bob' }],
    });
    expect(proposed.replayed).toBe(false);
    expect(proposed.note.status).toBe('proposed');
    expect(proposed.note.proposalId).toBe(proposed.proposal.proposalId);
    expect(proposed.proposal.state).toBe('pending');
    expect(proposed.proposal.targetKind).toBe('material');
    expect(proposed.proposal.producerKind).toBe('meeting');
    expect(proposed.proposal.producerRecordId).toBe(meetingId);

    const decided = await decideMeetingNote({
      organizationId: ORG_A,
      meetingId,
      noteId: proposed.note.id,
      decidedBy: USER_B,
      action: 'approve',
    });
    expect(decided).not.toBeNull();
    expect(decided!.note.status).toBe('approved');
    expect(decided!.proposal.state).toBe('materialized');
    expect(decided!.receipt).not.toBeNull();
    expect(decided!.receipt!.targetRecordId).toBe(proposed.note.id);
    expect(decided!.replayed).toBe(false);

    // Cold reopen: fresh, independent reads — never trust the in-memory
    // objects the functions handed back.
    const reread = await getMeetingNote({ organizationId: ORG_A, meetingId, noteId: proposed.note.id });
    expect(reread?.status).toBe('approved');
    expect(reread?.decisions).toEqual([{ decision: 'Ship on Friday' }]);

    const list = await listMeetingNotesForMeeting({ organizationId: ORG_A, meetingId });
    expect(list.some((n) => n.id === proposed.note.id && n.status === 'approved')).toBe(true);

    const receiptRow = await pool.query(
      `SELECT * FROM artifact_handoff_receipts WHERE proposal_id = $1`,
      [proposed.proposal.proposalId]
    );
    expect(receiptRow.rows).toHaveLength(1);
    expect(receiptRow.rows[0].target_record_id).toBe(proposed.note.id);
  });
});

describe('exactly-one on approval', () => {
  it('double approval (sequential) produces ONE receipt', async () => {
    const meetingId = await makeMeeting();
    const proposed = await proposeMeetingNote({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic',
      language: 'en',
      transcript: `${PREFIX} double approval transcript`,
      summary: 's',
      keyPoints: [],
      decisions: [],
      actionItems: [],
    });

    const first = await decideMeetingNote({
      organizationId: ORG_A,
      meetingId,
      noteId: proposed.note.id,
      decidedBy: USER_A,
      action: 'approve',
    });
    const second = await decideMeetingNote({
      organizationId: ORG_A,
      meetingId,
      noteId: proposed.note.id,
      decidedBy: USER_B,
      action: 'approve',
    });

    expect(first!.replayed).toBe(false);
    expect(second!.replayed).toBe(true);
    expect(first!.receipt!.receiptId).toBe(second!.receipt!.receiptId);

    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`, [
      proposed.proposal.proposalId,
    ]);
    expect(rows.rows[0].n).toBe(1);
  });

  it('two CONCURRENT approvals produce ONE receipt', async () => {
    const meetingId = await makeMeeting();
    const proposed = await proposeMeetingNote({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic',
      language: 'en',
      transcript: `${PREFIX} concurrent approval transcript`,
      summary: 's',
      keyPoints: [],
      decisions: [],
      actionItems: [],
    });

    const [r1, r2] = await Promise.all([
      decideMeetingNote({
        organizationId: ORG_A,
        meetingId,
        noteId: proposed.note.id,
        decidedBy: USER_A,
        action: 'approve',
      }),
      decideMeetingNote({
        organizationId: ORG_A,
        meetingId,
        noteId: proposed.note.id,
        decidedBy: USER_B,
        action: 'approve',
      }),
    ]);

    const replayedCount = [r1!.replayed, r2!.replayed].filter(Boolean).length;
    expect(replayedCount).toBe(1);
    expect(r1!.receipt!.receiptId).toBe(r2!.receipt!.receiptId);

    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`, [
      proposed.proposal.proposalId,
    ]);
    expect(rows.rows[0].n).toBe(1);

    const noteRow = await pool.query(`SELECT status FROM meeting_notes WHERE id = $1`, [proposed.note.id]);
    expect(noteRow.rows[0].status).toBe('approved');
  });
});

describe('replayed generate-notes (idempotency key)', () => {
  it('same idempotency key -> ONE note row AND ONE proposal, both replays', async () => {
    const meetingId = await makeMeeting();
    const idempotencyKey = `${PREFIX}idem-generate-notes`;
    const transcript = `${PREFIX} replay transcript, decided X, action Y`;
    const input = {
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic' as const,
      language: 'en',
      transcript,
      summary: 'summary',
      keyPoints: ['a'],
      decisions: [{ decision: 'X' }],
      actionItems: [{ task: 'Y' }],
      idempotencyKey,
    };

    const first = await proposeMeetingNote(input);
    const second = await proposeMeetingNote(input);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.note.id).toBe(first.note.id);
    expect(second.proposal.proposalId).toBe(first.proposal.proposalId);

    const noteRows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM meeting_notes WHERE organization_id = $1 AND meeting_id = $2 AND idempotency_key = $3`,
      [ORG_A, meetingId, idempotencyKey]
    );
    expect(noteRows.rows[0].n).toBe(1);

    const proposalRows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(proposalRows.rows[0].n).toBe(1);
  });

  it('same transcript with NO explicit key still dedupes (deterministic default key)', async () => {
    const meetingId = await makeMeeting();
    const transcript = `${PREFIX} deterministic default key transcript`;
    const makeInput = () => ({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic' as const,
      language: 'en',
      transcript,
      summary: 's',
      keyPoints: [],
      decisions: [],
      actionItems: [],
    });

    const first = await proposeMeetingNote(makeInput());
    const second = await proposeMeetingNote(makeInput());
    expect(second.replayed).toBe(true);
    expect(second.note.id).toBe(first.note.id);
  });

  it('two CONCURRENT proposeMeetingNote calls with the same key produce exactly one note row', async () => {
    const meetingId = await makeMeeting();
    const idempotencyKey = `${PREFIX}idem-concurrent-note`;
    const input = {
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic' as const,
      language: 'en',
      transcript: `${PREFIX} concurrent note transcript`,
      summary: 's',
      keyPoints: [],
      decisions: [],
      actionItems: [],
      idempotencyKey,
    };

    const [r1, r2] = await Promise.all([proposeMeetingNote(input), proposeMeetingNote(input)]);
    expect(r1.note.id).toBe(r2.note.id);
    expect(r1.proposal.proposalId).toBe(r2.proposal.proposalId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM meeting_notes WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(rows.rows[0].n).toBe(1);
  });
});

describe('unapproved proposal materializes nothing', () => {
  it('materializeProposal on a still-pending proposal is rejected and creates no receipt', async () => {
    const meetingId = await makeMeeting();
    const proposed = await proposeMeetingNote({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic',
      language: 'en',
      transcript: `${PREFIX} not approved transcript`,
      summary: 's',
      keyPoints: [],
      decisions: [],
      actionItems: [],
    });

    await expect(
      materializeProposal({
        organizationId: ORG_A,
        proposalId: proposed.proposal.proposalId,
        targetRecordId: proposed.note.id,
        materializedBy: USER_A,
      })
    ).rejects.toThrow(/must be 'approved'/);

    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`, [
      proposed.proposal.proposalId,
    ]);
    expect(rows.rows[0].n).toBe(0);

    const noteRow = await pool.query(`SELECT status FROM meeting_notes WHERE id = $1`, [proposed.note.id]);
    expect(noteRow.rows[0].status).toBe('proposed');
  });
});

describe('reject path', () => {
  it('reject flips the note + proposal to rejected and materializes nothing', async () => {
    const meetingId = await makeMeeting();
    const proposed = await proposeMeetingNote({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic',
      language: 'en',
      transcript: `${PREFIX} reject path transcript`,
      summary: 's',
      keyPoints: [],
      decisions: [],
      actionItems: [],
    });

    const decided = await decideMeetingNote({
      organizationId: ORG_A,
      meetingId,
      noteId: proposed.note.id,
      decidedBy: USER_A,
      action: 'reject',
      reason: 'not accurate',
    });
    expect(decided!.note.status).toBe('rejected');
    expect(decided!.proposal.state).toBe('rejected');
    expect(decided!.receipt).toBeNull();

    const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`, [
      proposed.proposal.proposalId,
    ]);
    expect(rows.rows[0].n).toBe(0);

    // A rejected proposal cannot later be approved. `decideMeetingNote`
    // tolerates `approveProposal`'s INVALID_STATE_TRANSITION (that catch
    // exists to make DOUBLE approval idempotent — see the function's doc
    // comment) and lets `materializeProposal` render the final verdict, so
    // the surfaced message names the state it actually failed on.
    await expect(
      decideMeetingNote({
        organizationId: ORG_A,
        meetingId,
        noteId: proposed.note.id,
        decidedBy: USER_B,
        action: 'approve',
      })
    ).rejects.toThrow(/must be 'approved' first/);
  });
});

describe('tenant isolation', () => {
  it('org B cannot read or decide an org A meeting note', async () => {
    const meetingId = await makeMeeting(ORG_A);
    const proposed = await proposeMeetingNote({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic',
      language: 'en',
      transcript: `${PREFIX} tenant isolation transcript`,
      summary: 's',
      keyPoints: [],
      decisions: [],
      actionItems: [],
    });

    const crossOrgRead = await getMeetingNote({ organizationId: ORG_B, meetingId, noteId: proposed.note.id });
    expect(crossOrgRead).toBeNull();

    const crossOrgDecision = await decideMeetingNote({
      organizationId: ORG_B,
      meetingId,
      noteId: proposed.note.id,
      decidedBy: USER_B,
      action: 'approve',
    });
    expect(crossOrgDecision).toBeNull();

    // The proposal itself must be untouched by the cross-tenant attempt.
    const proposalRow = await pool.query(
      `SELECT state, organization_id FROM artifact_handoff_proposals WHERE proposal_id = $1`,
      [proposed.proposal.proposalId]
    );
    expect(proposalRow.rows[0].state).toBe('pending');
    expect(proposalRow.rows[0].organization_id).toBe(ORG_A);
  });
});

describe('no foreign-owner writes', () => {
  it('approving a note never creates rows in tasks/decisions/materials', async () => {
    const meetingId = await makeMeeting();
    const proposed = await proposeMeetingNote({
      organizationId: ORG_A,
      meetingId,
      createdBy: USER_A,
      source: 'heuristic',
      language: 'en',
      transcript: `${PREFIX} foreign owner check transcript`,
      summary: 's',
      keyPoints: [],
      decisions: [{ decision: 'Would-be decision' }],
      actionItems: [{ task: 'Would-be task' }],
    });
    await decideMeetingNote({
      organizationId: ORG_A,
      meetingId,
      noteId: proposed.note.id,
      decidedBy: USER_A,
      action: 'approve',
    });

    const foreignTables = ['tasks', 'decisions', 'materials'];
    for (const table of foreignTables) {
      const exists = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS present`,
        [table]
      );
      if (!exists.rows[0].present) continue; // table may not exist in this env — nothing to check
      const rows = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE created_by = $1`, [USER_A]).catch(
        () => null
      );
      if (rows) {
        expect(rows.rows[0].n).toBe(0);
      }
    }

    // Meeting's OWN legacy tables must also be untouched by the governed
    // (non-legacy-compat) path.
    const meetingRow = await pool.query(`SELECT decisions_json FROM meetings WHERE id = $1`, [meetingId]);
    expect(JSON.parse(meetingRow.rows[0].decisions_json || '[]')).toEqual([]);
    const followUpRows = await pool.query(`SELECT COUNT(*)::int AS n FROM meeting_follow_ups WHERE meeting_id = $1`, [
      meetingId,
    ]);
    expect(followUpRows.rows[0].n).toBe(0);
  });
});
