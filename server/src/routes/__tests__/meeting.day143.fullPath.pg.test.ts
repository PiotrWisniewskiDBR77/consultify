/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const organizationId = 'day143-meeting-org';
const ownerId = 'day143-meeting-owner';

describe('Day 143 Meeting full path through real ApiGateway and PostgreSQL', () => {
  let app: express.Express;
  let ownerToken: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    await dbRun(
      `INSERT INTO organizations (id, name, status)
       VALUES (?, ?, 'active')
       ON CONFLICT (id) DO NOTHING`,
      [organizationId, 'Day 143 Meeting Evidence']
    );
    await dbRun(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES (?, ?, ?, 'unused-day143-local-only', 'OWNER', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [ownerId, organizationId, 'day143-owner@example.test']
    );
    await dbRun(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES (?, ?, ?, 'OWNER', 'ACTIVE')
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET role = 'OWNER', status = 'ACTIVE'`,
      ['day143-meeting-membership', organizationId, ownerId]
    );
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    ownerToken = jwt.sign(
      {
        id: ownerId,
        userId: ownerId,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  });

  it('creates a meeting over HTTP and reads the persisted row back', async () => {
    const title = `Day 143 full path ${Date.now()}`;
    const response = await request(app)
      .post('/api/meeting')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title,
        startAt: '2026-09-03T08:00:00.000Z',
        endAt: '2026-09-03T09:00:00.000Z',
        timezone: 'Europe/Warsaw',
        location: 'Day 143 local evidence room',
        attendees: ['owner@example.test'],
        preRead: ['Day 143 evidence'],
        agenda: ['Prove the full path'],
      });

    const responseBytes = Buffer.byteLength(response.text, 'utf8');
    console.info(`DAY143_HTTP status=${response.status} bytes=${responseBytes}`);
    expect(response.status).toBe(201);
    expect(response.body.code).not.toBe('BETA_LOCKED');
    expect(response.body.meeting?.id).toBeTruthy();

    const persisted = await dbGet<{ id: string; title: string; organization_id: string }>(
      `SELECT id, title, organization_id
       FROM meetings
       WHERE id = ? AND organization_id = ?`,
      [response.body.meeting.id, organizationId]
    );
    console.info(
      `DAY143_DB id=${persisted?.id || 'MISSING'} organization_id=${persisted?.organization_id || 'MISSING'} title=${persisted?.title || 'MISSING'}`
    );
    expect(persisted).toEqual(
      expect.objectContaining({
        id: response.body.meeting.id,
        title,
        organization_id: organizationId,
      })
    );
  });
});
