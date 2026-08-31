import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
// Z31 detektor 2026-08-31: unpinned from a hardcoded '/cx_day47' database-name
// suffix that silently skipped this suite (exit 0) on any other disposable
// database name. RUN_DB_TESTS/MOCK_DB plus a real postgres:// URL is the gate.
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeReal = enabled ? describe : describe.skip;
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

describeReal('Day 47 B.1 own calendar event survives reload', { retry: 0 }, () => {
  const prefix = `day47b1_${randomUUID().replaceAll('-', '')}`;
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const userId = randomUUID();
  const attendeeId = randomUUID();
  const foreignUserId = randomUUID();
  let sql: Client;
  let app: Express;
  let authorization: string;
  let foreignAuthorization: string;
  let eventId = '';
  let createBody: any;

  beforeAll(async () => {
    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();
    // Z31 detektor 2026-08-31: this used to re-pin to the literal 'cx_day47'
    // name inside beforeAll, duplicating the outer `enabled` gate above with
    // the same hardcoded name. Only require a real, non-empty database name.
    const target = await sql.query<{ database: string }>('SELECT current_database() AS database');
    if (!target.rows[0]?.database) throw new Error('DAY47_NO_REAL_DATABASE');

    for (const [id, name] of [
      [organizationId, `${prefix}_org`],
      [foreignOrganizationId, `${prefix}_foreign_org`],
    ]) {
      await sql.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
        [id, name]
      );
    }
    for (const [id, orgId, email] of [
      [userId, organizationId, `${prefix}_owner@day47.local`],
      [attendeeId, organizationId, `${prefix}_attendee@day47.local`],
      [foreignUserId, foreignOrganizationId, `${prefix}_foreign@day47.local`],
    ]) {
      await sql.query(
        `INSERT INTO users
           (id, organization_id, email, password, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, 'x', 'Day', 'Forty Seven', 'ADMIN', 'active', now())`,
        [id, orgId, email]
      );
      await sql.query(
        `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', now())`,
        [`${prefix}_${id}`, orgId, id]
      );
    }

    const token = (id: string, orgId: string, email: string) =>
      `Bearer ${jwt.sign({ id, email, organizationId: orgId, organization_id: orgId, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' })}`;
    authorization = token(userId, organizationId, `${prefix}_owner@day47.local`);
    foreignAuthorization = token(
      foreignUserId,
      foreignOrganizationId,
      `${prefix}_foreign@day47.local`
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    const created = await request(app)
      .post('/api/my-work/calendar/events')
      .set('Authorization', authorization)
      .set('x-org-context', organizationId)
      .send({
        title: `${prefix}_event`,
        description: 'B.1 persisted description',
        startAt: '2026-08-28T09:00:00.000Z',
        endAt: '2026-08-28T10:00:00.000Z',
        attendees: [attendeeId],
        source: 'event',
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    createBody = created.body;
    eventId = created.body.id;
  });

  afterAll(async () => {
    if (!sql) return;
    if (eventId) await sql.query('DELETE FROM calendar_events WHERE id = $1', [eventId]);
    await sql.query('DELETE FROM organization_members WHERE id LIKE $1', [`${prefix}_%`]);
    await sql.query('DELETE FROM users WHERE id = ANY($1::text[])', [
      [userId, attendeeId, foreignUserId],
    ]);
    await sql.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
    await sql.end();
  });

  it('returns the complete persisted event contract from POST', () => {
    expect(createBody).toEqual(
      expect.objectContaining({ id: eventId, source: 'event', status: 'confirmed' })
    );
  });

  it('persists tenant, owner, status and null recurrence fields', async () => {
    const row = await sql.query(
      `SELECT organization_id, owner_id, status, recurrence_rule
       FROM calendar_events WHERE id = $1`,
      [eventId]
    );
    expect(row.rows[0]).toEqual(
      expect.objectContaining({
        organization_id: organizationId,
        owner_id: userId,
        status: 'confirmed',
        recurrence_rule: null,
      })
    );
  });

  it('returns the own event after a full reload without sources', async () => {
    const response = await request(app)
      .get('/api/my-work/calendar/unified')
      .query({ start: '2026-08-28T00:00:00.000Z', end: '2026-08-29T00:00:00.000Z' })
      .set('Authorization', authorization)
      .set('x-org-context', organizationId);
    expect(response.status).toBe(200);
    expect(response.body.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'event', sourceId: eventId })])
    );
  });

  it('excludes the own event when sources explicitly omit event', async () => {
    const response = await request(app)
      .get('/api/my-work/calendar/unified')
      .query({
        start: '2026-08-28T00:00:00.000Z',
        end: '2026-08-29T00:00:00.000Z',
        sources: 'task,decision',
      })
      .set('Authorization', authorization)
      .set('x-org-context', organizationId);
    expect(response.body.events).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: eventId })])
    );
  });

  it('does not expose the event to a foreign organization', async () => {
    const response = await request(app)
      .get('/api/my-work/calendar/unified')
      .query({ start: '2026-08-28T00:00:00.000Z', end: '2026-08-29T00:00:00.000Z' })
      .set('Authorization', foreignAuthorization)
      .set('x-org-context', foreignOrganizationId);
    expect(response.status).toBe(200);
    expect(response.body.events).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: eventId })])
    );
  });

  it('makes the same database handle available to My Work Home', async () => {
    const response = await request(app)
      .get('/api/my-work/home/brief')
      .set('Authorization', authorization)
      .set('x-org-context', organizationId);
    expect(response.status).toBe(200);
  });
});
