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
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(async () => {
    await runAsync('DELETE FROM meeting_follow_ups');
    await runAsync('DELETE FROM meetings');
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
