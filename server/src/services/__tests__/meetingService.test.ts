/**
 * Integration tests for meetingService backed by a real in-memory sqlite3
 * database. We mock `DbPromise.js` so the service runs its actual SQL against a
 * throwaway DB, exercising create / read / update / delete / status / decisions
 * / follow-ups end to end (no SQL is stubbed).
 */
import sqlite3 from 'sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const driver = require('sqlite3') as typeof sqlite3;
  return { db: new driver.Database(':memory:') };
});

function allAsync<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: Error | null, rows: unknown[]) =>
      err ? reject(err) : resolve(rows as T[])
    );
  });
}

function getAsync<T = any>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: Error | null, row: unknown) =>
      err ? reject(err) : resolve(row as T | undefined)
    );
  });
}

function runAsync(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (this: { changes: number }, err: Error | null) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

vi.mock('../../utils/DbPromise.js', () => ({
  all: (sql: string, params?: unknown[]) => allAsync(sql, params),
  get: (sql: string, params?: unknown[]) => getAsync(sql, params),
  run: (sql: string, params?: unknown[]) => runAsync(sql, params),
}));

// FIX-M-4 (DEC-58 sceptyk, 2026-08-25): `deleteMeeting` now calls the real
// `ensureMeetingBoundaryTables` before its handoff-cleanup DELETEs. That
// function's DDL (`TIMESTAMPTZ ... DEFAULT NOW()`, a partial unique index)
// is Postgres-only and this harness is sqlite — `ensureHandoffSpineTablesForTest`
// below creates a sqlite-compatible `meeting_notes` (plus the two handoff
// spine tables, normally Postgres-migration-only) so `deleteMeeting`'s own
// SQL still runs for real against equivalent tables; only the CREATE TABLE
// call the production table itself uses is stubbed out here.
vi.mock('../meetingBoundary/meetingBoundaryService.js', () => ({
  ensureMeetingBoundaryTables: vi.fn().mockResolvedValue(undefined),
}));

import {
  addMeetingDecision,
  addMeetingFollowUp,
  createMeeting,
  deleteMeeting,
  ensureMeetingTables,
  getMeeting,
  listMeetings,
  updateMeeting,
  updateMeetingFollowUpStatus,
  updateMeetingStatus,
} from '../meetingService.js';

const ORG = 'org-meeting-test';
const USER = 'user-1';

// FIX-M-4 (DEC-58 sceptyk, 2026-08-25): `artifact_handoff_proposals` /
// `artifact_handoff_receipts` normally exist via the Postgres-only
// `20260912_claude_c_handoff_spine.sql` migration (never created at runtime
// by any service — unlike `meeting_notes`, which `ensureMeetingBoundaryTables`
// does create lazily). This sqlite harness has no migration runner, so we
// create sqlite-compatible equivalents here purely so `deleteMeeting`'s new
// handoff-cleanup DELETEs have real tables to exercise end to end, instead of
// either erroring on a missing table or being tested only by mocks.
async function ensureHandoffSpineTablesForTest() {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS meeting_notes (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      meeting_id TEXT NOT NULL,
      transcript_hash TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'proposed',
      proposal_id TEXT,
      created_by TEXT NOT NULL
    )
  `);
  await runAsync(`
    CREATE TABLE IF NOT EXISTS artifact_handoff_proposals (
      proposal_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      producer_kind TEXT NOT NULL,
      producer_record_id TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      state TEXT NOT NULL DEFAULT 'pending',
      created_by TEXT,
      created_at TEXT
    )
  `);
  await runAsync(`
    CREATE TABLE IF NOT EXISTS artifact_handoff_receipts (
      receipt_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      proposal_id TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      target_record_id TEXT NOT NULL,
      materialized_by TEXT,
      materialized_at TEXT
    )
  `);
}

async function makeMeeting(overrides: Record<string, unknown> = {}) {
  return createMeeting({
    organizationId: ORG,
    createdBy: USER,
    title: 'Kickoff',
    startAt: '2026-07-01T10:00:00.000Z',
    endAt: '2026-07-01T11:00:00.000Z',
    location: 'Zoom',
    attendees: ['Alice', 'Bob'],
    preRead: ['brief.pdf'],
    agenda: ['Intro', 'Scope'],
    decisions: [],
    ...overrides,
  });
}

describe('meetingService', () => {
  beforeAll(async () => {
    await ensureMeetingTables();
    await ensureHandoffSpineTablesForTest();
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await runAsync('DELETE FROM meeting_follow_ups');
    await runAsync('DELETE FROM meetings');
    await runAsync('DELETE FROM meeting_notes');
    await runAsync('DELETE FROM artifact_handoff_receipts');
    await runAsync('DELETE FROM artifact_handoff_proposals');
  });

  it('creates and reads a meeting with JSON arrays mapped back', async () => {
    const created = await makeMeeting();
    expect(created.id).toMatch(/^meeting-/);
    expect(created.attendees).toEqual(['Alice', 'Bob']);
    expect(created.agenda).toEqual(['Intro', 'Scope']);
    expect(created.status).toBe('scheduled');

    const fetched = await getMeeting({ organizationId: ORG, meetingId: created.id });
    expect(fetched?.title).toBe('Kickoff');
  });

  it('scopes reads to the organization', async () => {
    const created = await makeMeeting();
    const other = await getMeeting({ organizationId: 'someone-else', meetingId: created.id });
    expect(other).toBeNull();
  });

  it('lists meetings for an organization', async () => {
    await makeMeeting({ title: 'A' });
    await makeMeeting({ title: 'B' });
    const list = await listMeetings({ organizationId: ORG });
    expect(list).toHaveLength(2);
  });

  it('updates core fields and leaves untouched fields intact', async () => {
    const created = await makeMeeting();
    const updated = await updateMeeting({
      organizationId: ORG,
      meetingId: created.id,
      title: 'Renamed',
      location: 'Office',
      agenda: ['One', 'Two', 'Three'],
    });
    expect(updated?.title).toBe('Renamed');
    expect(updated?.location).toBe('Office');
    expect(updated?.agenda).toEqual(['One', 'Two', 'Three']);
    // attendees were not part of the patch and must survive
    expect(updated?.attendees).toEqual(['Alice', 'Bob']);
  });

  it('rejects updates for the wrong organization', async () => {
    const created = await makeMeeting();
    const result = await updateMeeting({
      organizationId: 'other-org',
      meetingId: created.id,
      title: 'Hacked',
    });
    expect(result).toBeNull();
  });

  it('returns existing record when update has no recognised fields', async () => {
    const created = await makeMeeting();
    const updated = await updateMeeting({ organizationId: ORG, meetingId: created.id });
    expect(updated?.title).toBe('Kickoff');
  });

  it('deletes a meeting and its follow-ups', async () => {
    const created = await makeMeeting();
    await addMeetingFollowUp({
      organizationId: ORG,
      meetingId: created.id,
      title: 'Send notes',
      owner: 'Alice',
    });
    const deleted = await deleteMeeting({ organizationId: ORG, meetingId: created.id });
    expect(deleted).toBe(true);

    const gone = await getMeeting({ organizationId: ORG, meetingId: created.id });
    expect(gone).toBeNull();
    const orphanFollowUps = await allAsync(
      'SELECT * FROM meeting_follow_ups WHERE meeting_id = ?',
      [created.id]
    );
    expect(orphanFollowUps).toHaveLength(0);
  });

  // FIX-M-4 (DEC-58 sceptyk, 2026-08-25): deleteMeeting used to leave
  // `meeting_notes` and their `artifact_handoff_proposals`/
  // `artifact_handoff_receipts` rows behind — nothing FK'd or cascaded them.
  it('deletes a meeting note, its handoff proposal, and its receipt', async () => {
    const created = await makeMeeting();
    const proposalId = 'proposal-1';
    await runAsync(
      `INSERT INTO meeting_notes
         (id, organization_id, meeting_id, transcript_hash, status, proposal_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['note-1', ORG, created.id, 'hash-1', 'materialized', proposalId, USER]
    );
    await runAsync(
      `INSERT INTO artifact_handoff_proposals
         (proposal_id, organization_id, producer_kind, producer_record_id, target_kind, state, created_by)
       VALUES (?, ?, 'meeting', ?, 'material', 'materialized', ?)`,
      [proposalId, ORG, created.id, USER]
    );
    await runAsync(
      `INSERT INTO artifact_handoff_receipts
         (receipt_id, organization_id, proposal_id, target_kind, target_record_id, materialized_by)
       VALUES (?, ?, ?, 'material', 'material-1', ?)`,
      ['receipt-1', ORG, proposalId, USER]
    );

    const deleted = await deleteMeeting({ organizationId: ORG, meetingId: created.id });
    expect(deleted).toBe(true);

    expect(await allAsync('SELECT * FROM meeting_notes WHERE meeting_id = ?', [created.id])).toHaveLength(0);
    expect(
      await allAsync('SELECT * FROM artifact_handoff_proposals WHERE producer_record_id = ?', [
        created.id,
      ])
    ).toHaveLength(0);
    expect(
      await allAsync('SELECT * FROM artifact_handoff_receipts WHERE proposal_id = ?', [proposalId])
    ).toHaveLength(0);
  });

  it('does not touch another meeting\'s notes/proposals when deleting one meeting', async () => {
    const created = await makeMeeting({ title: 'Deleted meeting' });
    const kept = await makeMeeting({ title: 'Kept meeting' });
    const keptProposalId = 'proposal-kept';
    await runAsync(
      `INSERT INTO meeting_notes
         (id, organization_id, meeting_id, transcript_hash, status, proposal_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['note-kept', ORG, kept.id, 'hash-2', 'proposed', keptProposalId, USER]
    );
    await runAsync(
      `INSERT INTO artifact_handoff_proposals
         (proposal_id, organization_id, producer_kind, producer_record_id, target_kind, state, created_by)
       VALUES (?, ?, 'meeting', ?, 'material', 'pending', ?)`,
      [keptProposalId, ORG, kept.id, USER]
    );

    await deleteMeeting({ organizationId: ORG, meetingId: created.id });

    expect(await getMeeting({ organizationId: ORG, meetingId: kept.id })).not.toBeNull();
    expect(await allAsync('SELECT * FROM meeting_notes WHERE meeting_id = ?', [kept.id])).toHaveLength(1);
    expect(
      await allAsync('SELECT * FROM artifact_handoff_proposals WHERE producer_record_id = ?', [
        kept.id,
      ])
    ).toHaveLength(1);
  });

  it('does not delete meetings from another organization', async () => {
    const created = await makeMeeting();
    const deleted = await deleteMeeting({ organizationId: 'other-org', meetingId: created.id });
    expect(deleted).toBe(false);
    const still = await getMeeting({ organizationId: ORG, meetingId: created.id });
    expect(still).not.toBeNull();
  });

  it('toggles meeting status', async () => {
    const created = await makeMeeting();
    const completed = await updateMeetingStatus({
      organizationId: ORG,
      meetingId: created.id,
      status: 'completed',
    });
    expect(completed?.status).toBe('completed');
  });

  it('appends decisions', async () => {
    const created = await makeMeeting();
    const withDecision = await addMeetingDecision({
      organizationId: ORG,
      meetingId: created.id,
      decision: 'Ship MVP',
    });
    expect(withDecision?.decisions).toContain('Ship MVP');
  });

  it('adds and toggles follow-up status', async () => {
    const created = await makeMeeting();
    const withFollowUp = await addMeetingFollowUp({
      organizationId: ORG,
      meetingId: created.id,
      title: 'Email recap',
      owner: 'Bob',
    });
    const followUp = withFollowUp?.followUps[0];
    expect(followUp?.status).toBe('open');

    const toggled = await updateMeetingFollowUpStatus({
      organizationId: ORG,
      meetingId: created.id,
      followUpId: followUp!.id,
      status: 'done',
    });
    expect(toggled?.followUps[0].status).toBe('done');
  });
});
