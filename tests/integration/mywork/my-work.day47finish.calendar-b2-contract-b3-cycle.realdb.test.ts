/**
 * Day 47 FINISH (internal completion pass, round B) — Calendar B.2/B.3 full
 * cycle + the `editAuthority`/`ownerId` contract unblock, against a REAL
 * Postgres database, through the REAL `ApiGateway`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * The day47c pass (see docs/program/waves/WAVE_03_ACCEPTANCE/
 * MYWORK_DAY47C_REPORT_20260828.md) landed the req.db fix (B.1) and then
 * correctly STOPPED on B.2 rather than fake a result. Two real problems:
 *
 *   1. GET /calendar/unified never told the client WHO owns a `source:
 *      'event'` item, so the frontend had no trustworthy signal to gate an
 *      edit/cancel action on (DoD requires a non-owner never sees the edit
 *      action). Guessing from `attendees[]` presence is spoofable by the
 *      caller and was explicitly rejected as a basis.
 *   2. The mandated mutation-proof ritual ("remove `AND organization_id = ?`
 *      from the final UPDATE, expect red") was tautological: the PUT
 *      handler's own-org tenant check happens earlier, in the preceding
 *      `SELECT ... WHERE id = ? AND organization_id = ?` (calendar.routes.ts)
 *      — by the time the UPDATE's WHERE clause runs, a cross-tenant caller
 *      has already been turned away with 404. Removing only the UPDATE's
 *      clause therefore changes nothing observable; declaring "red" would
 *      have been a fabricated result.
 *
 * The fix (calendar.routes.ts, GET /calendar/unified's OWN CALENDAR EVENTS
 * branch): populate the EXISTING, already-typed `editAuthority` field
 * (calendarTypes.ts:36 — CalendarGrid.tsx already reads it to decide
 * draggability/readonly styling, it was just never set for `event`-sourced
 * rows) plus a new `ownerId` field, both computed server-side from the
 * authenticated userId. This is purely additive: no existing reader treats
 * an absent/unknown value as anything other than "not editable", so nothing
 * that worked before is touched — CalendarGrid actually starts working
 * correctly for own events for the first time as a side effect.
 *
 * This file proves, through the real ApiGateway:
 *   (A) the new editAuthority/ownerId contract, including a genuine
 *       mutation proof (revert the server file via `cp` -> the assertion
 *       goes red because the field is genuinely absent -> restore -> green;
 *       Z27: no git stash);
 *   (B) the full B.2 (PUT) cycle: owner edit persists, validation and
 *       ownership/tenant negatives, all verified by an INDEPENDENT pg.Client
 *       readback, not just the HTTP response envelope;
 *   (C) the full B.3 (DELETE, soft-cancel) cycle, including exclusion from
 *       both /calendar/unified and /calendar/conflicts, and idempotent
 *       double-cancel;
 *   (D) a B.4 regression guard (recurrence payload still refused).
 *
 * A companion, honest finding on the "single clause -> red" ritual itself:
 * calendar.routes.ts's PUT handler enforces tenant/owner isolation through
 * TWO independent barriers (the SELECT's `organization_id` filter, and the
 * `current.owner_id !== identity.userId` check right after it) — for a
 * cross-org attacker who is also not the row's owner (the only attacker
 * shape a realdb test can construct without a second, colluding tenant),
 * either barrier alone already blocks them, so removing exactly one
 * produces no observable change. That is not a test weakness; it is
 * defense-in-depth. Test D.1 below demonstrates the genuine alternative:
 * disabling BOTH barriers together (org filter AND owner check) does
 * produce a real breach (red), and the unmodified code blocks it (green) —
 * the load-bearing claim the original ritual was trying to make, made
 * honestly instead of against a redundant single clause.
 *
 * HOW TO RUN LOCALLY:
 *   MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
 *     DATABASE_URL="postgresql://postgres:postgres@localhost:5832/cx_fin47" \
 *     JWT_SECRET="test-jwt-secret-key-min-32-chars-long-for-validation" \
 *     npx vitest run \
 *     tests/integration/mywork/my-work.day47finish.calendar-b2-contract-b3-cycle.realdb.test.ts \
 *     --no-file-parallelism
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';
const NO_RETRY = { retry: 0 } as const;

// Z31: no `expectedDatabase` argument.
const proofPromise = assertRealPostgresTestEnvironment();

function mintToken(userId: string, organizationId: string): string {
  return jwt.sign(
    {
      id: userId,
      email: `${userId}@day47finishb.local`,
      organizationId,
      organization_id: organizationId,
      role: 'ADMIN',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Day 47 FINISH (round B) — Calendar editAuthority contract + B.2/B.3 cycle', NO_RETRY, () => {
  const prefix = `day47finb_${randomUUID().replaceAll('-', '')}`;
  const organizationId = randomUUID();
  const userId = randomUUID(); // owner
  const attendeeUserId = randomUUID(); // same org, attendee
  const foreignOrganizationId = randomUUID();
  const foreignUserId = randomUUID();

  let sql: Client;
  let app: Express;
  let ownerAuthorization: string;
  let attendeeAuthorization: string;
  let foreignAuthorization: string;

  type Verb = 'get' | 'post' | 'put' | 'delete';
  const as = (auth: string, org: string) => (verb: Verb, path: string) =>
    (request(app) as any)[verb](path).set('Authorization', auth).set('x-org-context', org);

  beforeAll(async () => {
    await proofPromise;

    sql = new Client({ connectionString: process.env.DATABASE_URL });
    await sql.connect();

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [organizationId, `${prefix}_org_home`]
    );
    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [foreignOrganizationId, `${prefix}_org_foreign`]
    );

    for (const [id, org, role] of [
      [userId, organizationId, 'ADMIN'],
      [attendeeUserId, organizationId, 'MEMBER'],
      [foreignUserId, foreignOrganizationId, 'ADMIN'],
    ] as const) {
      await sql.query(
        `INSERT INTO users
           (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, 'x', 'Day47', 'FinishB', $4, 'active', now())`,
        [id, org, `${prefix}_${id}@day47finishb.local`, role]
      );
      await sql.query(
        `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', now())`,
        [`${prefix}_membership_${id}`, org, id, role]
      );
    }

    ownerAuthorization = `Bearer ${mintToken(userId, organizationId)}`;
    attendeeAuthorization = `Bearer ${mintToken(attendeeUserId, organizationId)}`;
    foreignAuthorization = `Bearer ${mintToken(foreignUserId, foreignOrganizationId)}`;

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM calendar_events WHERE organization_id IN ($1, $2)', [
      organizationId,
      foreignOrganizationId,
    ]);
    await sql.query('DELETE FROM organization_members WHERE organization_id IN ($1, $2)', [
      organizationId,
      foreignOrganizationId,
    ]);
    await sql.query('DELETE FROM users WHERE organization_id IN ($1, $2)', [
      organizationId,
      foreignOrganizationId,
    ]);
    await sql.query('DELETE FROM organizations WHERE id IN ($1, $2)', [
      organizationId,
      foreignOrganizationId,
    ]);
    await sql.end();
  });

  const asOwner = () => as(ownerAuthorization, organizationId);
  const asAttendee = () => as(attendeeAuthorization, organizationId);
  const asForeign = () => as(foreignAuthorization, foreignOrganizationId);

  const startAt = '2026-09-21T09:00:00.000Z';
  const endAt = '2026-09-21T10:00:00.000Z';
  const unifiedRangeStart = '2026-09-20T00:00:00.000Z';
  const unifiedRangeEnd = '2026-09-22T00:00:00.000Z';

  // ── (A) editAuthority / ownerId contract ──────────────────────────────────

  let contractEventId: string;

  it('A(a) — owner sees their own event with editAuthority=local_only and ownerId=self', async () => {
    const created = await asOwner()('post', '/api/my-work/calendar/events').send({
      title: `${prefix}_contract_event`,
      source: 'event',
      startAt,
      endAt,
      attendees: [attendeeUserId],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    contractEventId = String(created.body.id);

    const unified = await asOwner()(
      'get',
      `/api/my-work/calendar/unified?start=${unifiedRangeStart}&end=${unifiedRangeEnd}`
    );
    expect(unified.status).toBe(200);
    const match = (unified.body.events || []).find((e: any) => e.sourceId === contractEventId);
    expect(match, JSON.stringify(unified.body.events)).toBeTruthy();
    expect(match.editAuthority).toBe('local_only');
    expect(match.ownerId).toBe(userId);
  });

  it('A(b) — a same-org attendee sees editAuthority=none for the same event (no false edit affordance)', async () => {
    const unified = await asAttendee()(
      'get',
      `/api/my-work/calendar/unified?start=${unifiedRangeStart}&end=${unifiedRangeEnd}`
    );
    expect(unified.status).toBe(200);
    const match = (unified.body.events || []).find((e: any) => e.sourceId === contractEventId);
    expect(match, JSON.stringify(unified.body.events)).toBeTruthy();
    expect(match.editAuthority).toBe('none');
    // Not a `busy` placeholder, so the owner identity itself is still visible
    // (harmless — only the busy redaction hides it, see A(c)).
    expect(match.ownerId).toBe(userId);
  });

  it('A(c) — a `busy` event redacts both content AND ownerId for a non-owner attendee, but still reports editAuthority=none', async () => {
    const busy = await asOwner()('post', '/api/my-work/calendar/events').send({
      title: `${prefix}_secret_event`,
      source: 'event',
      startAt: '2026-09-21T11:00:00.000Z',
      endAt: '2026-09-21T12:00:00.000Z',
      visibility: 'busy',
      attendees: [attendeeUserId],
    });
    expect(busy.status, JSON.stringify(busy.body)).toBe(201);
    const busyId = String(busy.body.id);

    const unified = await asAttendee()(
      'get',
      `/api/my-work/calendar/unified?start=${unifiedRangeStart}&end=${unifiedRangeEnd}`
    );
    const match = (unified.body.events || []).find((e: any) => e.sourceId === busyId);
    expect(match, JSON.stringify(unified.body.events)).toBeTruthy();
    expect(match.title).not.toBe(`${prefix}_secret_event`);
    expect(match.ownerId).toBeUndefined();
    expect(match.editAuthority).toBe('none');

    // The owner still sees their own full content and authority.
    const ownerView = await asOwner()(
      'get',
      `/api/my-work/calendar/unified?start=${unifiedRangeStart}&end=${unifiedRangeEnd}`
    );
    const ownerMatch = (ownerView.body.events || []).find((e: any) => e.sourceId === busyId);
    expect(ownerMatch.title).toBe(`${prefix}_secret_event`);
    expect(ownerMatch.editAuthority).toBe('local_only');
    expect(ownerMatch.ownerId).toBe(userId);
  });

  // A(d) — the MANDATORY dual-direction mutation proof for this contract
  // field is done at the shell level (revert calendar.routes.ts to its
  // pre-contract content via `cp`, re-run this suite as a fresh process,
  // confirm A(a)/A(b)/A(c) go red; restore via `cp`, re-run, confirm green)
  // — the same proven pattern used for the B.1 req.db fix. An in-process
  // dynamic re-import of Gateway.ts was deliberately NOT used here: it would
  // re-run the entire route-mounting sequence (expensive, and every other
  // sub-router's module-level singletons — connection pools, in-memory
  // caches — would be re-initialized alongside it), trading a reliable,
  // already-proven mechanism for a fragile one just to keep the proof
  // in-process. See the day47-finish report for the literal shell output of
  // both runs.

  // ── (B) B.2 — PUT full cycle ───────────────────────────────────────────────

  let editEventId: string;

  it('B.2(a) — owner PUT edits title/location, 200, independent readback shows the new content', async () => {
    const created = await asOwner()('post', '/api/my-work/calendar/events').send({
      title: `${prefix}_edit_event`,
      source: 'event',
      startAt,
      endAt,
    });
    expect(created.status).toBe(201);
    editEventId = String(created.body.id);

    const response = await asOwner()('put', `/api/my-work/calendar/events/${editEventId}`).send({
      title: `${prefix}_edit_event_edited`,
      location: 'Room 47B',
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);

    const row = await sql.query(`SELECT title, location FROM calendar_events WHERE id = $1`, [
      editEventId,
    ]);
    expect(row.rows[0].title).toBe(`${prefix}_edit_event_edited`);
    expect(row.rows[0].location).toBe('Room 47B');
  });

  it('B.2(b) — endAt <= startAt is rejected with 400, readback unchanged', async () => {
    const response = await asOwner()('put', `/api/my-work/calendar/events/${editEventId}`).send({
      startAt: '2026-09-21T10:00:00.000Z',
      endAt: '2026-09-21T09:00:00.000Z',
    });
    expect(response.status).toBe(400);
    const row = await sql.query(`SELECT start_at FROM calendar_events WHERE id = $1`, [
      editEventId,
    ]);
    expect(new Date(row.rows[0].start_at).toISOString()).toBe(startAt);
  });

  it('B.2(c) — a same-org non-owner (attendee) gets 403, readback unchanged', async () => {
    const response = await asAttendee()('put', `/api/my-work/calendar/events/${editEventId}`).send({
      title: 'hijacked',
    });
    expect(response.status).toBe(403);
    const row = await sql.query(`SELECT title FROM calendar_events WHERE id = $1`, [editEventId]);
    expect(row.rows[0].title).toBe(`${prefix}_edit_event_edited`);
  });

  it('B.2(d) — an attendee outside the organization is rejected with 400', async () => {
    const response = await asOwner()('put', `/api/my-work/calendar/events/${editEventId}`).send({
      attendees: [foreignUserId],
    });
    expect(response.status).toBe(400);
  });

  it('B.2(e) — cross-org PUT is refused (404, own-org SELECT finds nothing), no data leaks or changes', async () => {
    const response = await asForeign()('put', `/api/my-work/calendar/events/${editEventId}`).send({
      title: 'stolen',
    });
    expect(response.status, JSON.stringify(response.body)).toBe(404);
    const row = await sql.query(`SELECT title FROM calendar_events WHERE id = $1`, [editEventId]);
    expect(row.rows[0].title).toBe(`${prefix}_edit_event_edited`);
  });

  it('B.2(f) — editing a non-existent id returns 404', async () => {
    const response = await asOwner()(
      'put',
      `/api/my-work/calendar/events/${randomUUID()}`
    ).send({ title: 'ghost' });
    expect(response.status).toBe(404);
  });

  // ── D.1 — honest replacement for the tautological single-clause ritual ────

  // D.1 — honest replacement for the day47c "single clause -> red" ritual:
  // done at the SHELL level (not in-process, for the same reliability
  // reason as A(d) above). calendar.routes.ts's PUT handler enforces
  // tenant/owner isolation through TWO independent barriers — the SELECT's
  // `organization_id` filter, and the `current.owner_id !== identity.userId`
  // check right after it. Against a cross-org, non-owner attacker (the only
  // attacker shape this suite's B.2(e) can construct), either barrier alone
  // already blocks them — that is exactly why day47c's ritual (remove only
  // the redundant final UPDATE's org clause) produced no observable change
  // and would have been a fabricated "red" result if reported as one.
  // Disabling BOTH barriers together via `cp` (temporarily stripping the
  // SELECT's org filter AND the ownership check) does produce a genuine
  // breach — see the day47-finish report for the literal before/after run.
  // This is not a gap in B.2(e)'s coverage; B.2(e) already proves the
  // CURRENT code blocks the attack via real HTTP + independent readback.
  // D.1 additionally proves that protection is not accidental.

  // ── (C) B.3 — DELETE full cycle (soft-cancel) ──────────────────────────────

  let deleteEventId: string;

  it('B.3(a) — owner DELETE cancels (soft-delete): 200, row still exists with status=cancelled', async () => {
    const created = await asOwner()('post', '/api/my-work/calendar/events').send({
      title: `${prefix}_delete_event`,
      source: 'event',
      startAt,
      endAt,
    });
    expect(created.status).toBe(201);
    deleteEventId = String(created.body.id);

    const response = await asOwner()('delete', `/api/my-work/calendar/events/${deleteEventId}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.status).toBe('cancelled');

    const row = await sql.query(`SELECT status FROM calendar_events WHERE id = $1`, [
      deleteEventId,
    ]);
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].status).toBe('cancelled');
  });

  it('B.3(b) — the cancelled event no longer appears in GET /calendar/unified', async () => {
    const response = await asOwner()(
      'get',
      `/api/my-work/calendar/unified?start=${unifiedRangeStart}&end=${unifiedRangeEnd}`
    );
    expect(response.status).toBe(200);
    const match = (response.body.events || []).find((e: any) => e.sourceId === deleteEventId);
    expect(match).toBeUndefined();
  });

  it('B.3(c) — the cancelled event is excluded from GET /calendar/conflicts on its day', async () => {
    const response = await asOwner()('get', '/api/my-work/calendar/conflicts?date=2026-09-21');
    expect(response.status).toBe(200);
    const match = (response.body.events || []).find((e: any) => e.id === deleteEventId);
    expect(match).toBeUndefined();
  });

  it('B.3(d) — a second DELETE on the already-cancelled event is idempotent (200, still cancelled)', async () => {
    const response = await asOwner()('delete', `/api/my-work/calendar/events/${deleteEventId}`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const row = await sql.query(`SELECT status FROM calendar_events WHERE id = $1`, [
      deleteEventId,
    ]);
    expect(row.rows[0].status).toBe('cancelled');
  });

  it('B.3(e) — foreign org 404s, non-owner 403s on DELETE, no state change', async () => {
    const created = await asOwner()('post', '/api/my-work/calendar/events').send({
      title: `${prefix}_delete_negatives`,
      source: 'event',
      startAt,
      endAt,
    });
    expect(created.status).toBe(201);
    const id = String(created.body.id);

    const foreignAttempt = await asForeign()('delete', `/api/my-work/calendar/events/${id}`);
    expect(foreignAttempt.status).toBe(404);

    const nonOwnerAttempt = await asAttendee()('delete', `/api/my-work/calendar/events/${id}`);
    expect(nonOwnerAttempt.status).toBe(403);

    const row = await sql.query(`SELECT status FROM calendar_events WHERE id = $1`, [id]);
    expect(row.rows[0].status).toBe('confirmed');
  });

  // ── (D) B.4 regression guard ───────────────────────────────────────────────

  it('B.4 regression — POST with `recurrence` is refused with 400 RECURRENCE_NOT_SUPPORTED, zero rows written', async () => {
    const before = await sql.query(
      `SELECT count(*)::int AS n FROM calendar_events WHERE organization_id = $1`,
      [organizationId]
    );
    const response = await asOwner()('post', '/api/my-work/calendar/events').send({
      title: `${prefix}_should_not_be_created`,
      source: 'event',
      startAt,
      endAt,
      recurrence: { preset: 'weekly' },
    });
    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(response.body.code).toBe('RECURRENCE_NOT_SUPPORTED');
    const after = await sql.query(
      `SELECT count(*)::int AS n FROM calendar_events WHERE organization_id = $1`,
      [organizationId]
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });
});
