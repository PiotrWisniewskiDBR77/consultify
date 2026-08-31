/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const meetingId = 'w3-mtg-pending-meeting-v1';
const ownerId = 'w3-mtg-owner-user-v1';
const ownerOrgId = 'w3-mtg-owner-org-v1';
const foreignOwnerId = 'w3-mtg-foreign-owner-v1';
const foreignOrgId = 'w3-mtg-foreign-org-v1';
const revokedId = 'w3-mtg-revoked-user-v1';

type Probe = {
  family: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: Record<string, unknown>;
};

const meetingRouterFamilies: Probe[] = [
  { family: 'R1 meeting read/write', method: 'get', path: `/api/meeting/${meetingId}` },
  { family: 'R2 participants', method: 'get', path: `/api/meeting/${meetingId}/participants` },
  {
    family: 'R3 invitations',
    method: 'post',
    path: `/api/meeting/${meetingId}/invitations/send`,
    body: { participantIds: [] },
  },
  {
    family: 'R4 decision records',
    method: 'get',
    path: `/api/meeting/${meetingId}/decision-records`,
  },
  {
    family: 'R5 follow-up records',
    method: 'get',
    path: `/api/meeting/${meetingId}/follow-up-records`,
  },
  {
    family: 'R6 retired direct decisions',
    method: 'post',
    path: `/api/meeting/${meetingId}/decisions`,
    body: { decision: 'day57 probe' },
  },
  { family: 'R7 managed notes', method: 'get', path: `/api/meeting/${meetingId}/notes` },
  { family: 'R8 attachments', method: 'get', path: `/api/meeting/${meetingId}/attachments` },
  {
    family: 'R9 recurrence occurrence',
    method: 'patch',
    path: `/api/meeting/${meetingId}/occurrence`,
    body: { scope: 'this', recurrenceId: '2026-09-01T09:00:00Z', title: 'day57 probe' },
  },
];

function token(userId: string, organizationId: string, role: string): string {
  return jwt.sign(
    { id: userId, userId, organizationId, organization_id: organizationId, role },
    config.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

function send(app: express.Express, probe: Probe, bearer: string) {
  const call = request(app)[probe.method](probe.path).set('Authorization', `Bearer ${bearer}`);
  return probe.body ? call.send(probe.body) : call;
}

describe('Day 57 Meetings tenant isolation through the real ApiGateway', () => {
  let app: express.Express;
  let ownerToken: string;
  let foreignOwnerToken: string;
  let revokedAdminToken: string;
  let administratorToken: string;

  beforeAll(async () => {
    // server/vitest.config.ts overwrites the shell value with sqlite. The
    // package restores the required engine before any Gateway/DB work; the
    // independent environment assertion below still rejects a missing or
    // non-Postgres DATABASE_URL instead of skipping.
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    ownerToken = token(ownerId, ownerOrgId, 'OWNER');
    foreignOwnerToken = token(foreignOwnerId, foreignOrgId, 'OWNER');
    revokedAdminToken = token(revokedId, ownerOrgId, 'ADMIN');
    administratorToken = token('w3-mtg-admin-user-v1', ownerOrgId, 'ADMINISTRATOR');
  });

  it.each(meetingRouterFamilies)(
    '$family N1: an active foreign OWNER reaches isolation, never the beta denial',
    async (probe) => {
      const response = await send(app, probe, foreignOwnerToken);
      expect(response.status).not.toBe(200);
      expect(response.body.code).not.toBe('BETA_LOCKED');
      expect(JSON.stringify(response.body)).not.toContain(meetingId);
    }
  );

  it.each(meetingRouterFamilies)(
    '$family N2: body, query and x-org-context cannot steer a foreign tenant',
    async (probe) => {
      const steered = { ...probe, path: `${probe.path}?organizationId=${ownerOrgId}` };
      const call = request(app)
        [steered.method](steered.path)
        .set('Authorization', `Bearer ${foreignOwnerToken}`)
        .set('x-org-context', ownerOrgId);
      const response = await call.send({ ...steered.body, organizationId: ownerOrgId });
      expect(response.status).not.toBe(200);
      expect(response.body.code).not.toBe('BETA_LOCKED');
      expect(JSON.stringify(response.body)).not.toContain(meetingId);
    }
  );

  it.each(meetingRouterFamilies)(
    '$family N4: an INACTIVE membership with ADMIN left in the token is revoked',
    async (probe) => {
      const response = await send(app, probe, revokedAdminToken);
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      expect(response.body.code).not.toBe('BETA_LOCKED');
    }
  );

  it.each([
    ['R1 meeting read', `/api/meeting/${meetingId}`],
    ['R7 managed notes read', `/api/meeting/${meetingId}/notes`],
    ['R8 attachments read', `/api/meeting/${meetingId}/attachments`],
  ])('%s: an active OWNER still reaches the handler', async (_family, path) => {
    const response = await request(app).get(path).set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.code).not.toBe('BETA_LOCKED');
  });

  it.each([
    ['DELETE meeting', 'delete', `/api/meeting/${meetingId}`],
    ['send invitations', 'post', `/api/meeting/${meetingId}/invitations/send`],
    [
      'DELETE participant',
      'delete',
      `/api/meeting/${meetingId}/participants/non-existent-participant`,
    ],
  ] as const)(
    'N5 %s: ADMINISTRATOR passes beta but not the Meeting admin gate',
    async (_name, method, path) => {
      const response = await request(app)
        [method](path)
        .set('Authorization', `Bearer ${administratorToken}`)
        .send(method === 'post' ? { participantIds: [] } : undefined);
      expect([403, 404]).toContain(response.status);
      expect(response.body.code).not.toBe('BETA_LOCKED');
    }
  );

  it('N6: a token signed with a foreign secret is rejected before Meeting data access', async () => {
    const invalid = jwt.sign(
      { id: ownerId, organizationId: ownerOrgId, role: 'OWNER' },
      'day57-foreign-secret-with-at-least-32-characters',
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const response = await request(app)
      .get(`/api/meeting/${meetingId}`)
      .set('Authorization', `Bearer ${invalid}`);
    expect(response.status).toBe(401);
  });

  it('R10 brief N1: an active foreign OWNER cannot read the meeting brief', async () => {
    const response = await request(app)
      .get(`/api/ai-operator/meetings/${meetingId}/brief`)
      .set('Authorization', `Bearer ${foreignOwnerToken}`);
    expect(response.status).not.toBe(200);
    expect(response.body.code).not.toBe('BETA_LOCKED');
    expect(JSON.stringify(response.body)).not.toContain(meetingId);
  });

  it('R10 brief N4: records the cross-file active-membership contract', async () => {
    const response = await request(app)
      .get(`/api/ai-operator/meetings/${meetingId}/brief`)
      .set('Authorization', `Bearer ${revokedAdminToken}`);
    expect(response.status).not.toBe(200);
    expect(response.body.code).not.toBe('BETA_LOCKED');
  });

  it('R10 brief N2: body, query and x-org-context do not reveal the foreign meeting', async () => {
    const response = await request(app)
      .get(`/api/ai-operator/meetings/${meetingId}/brief?organizationId=${ownerOrgId}`)
      .set('Authorization', `Bearer ${foreignOwnerToken}`)
      .set('x-org-context', ownerOrgId)
      .send({ organizationId: ownerOrgId });
    expect(response.status).not.toBe(200);
    expect(response.body.code).not.toBe('BETA_LOCKED');
    expect(JSON.stringify(response.body)).not.toContain(meetingId);
  });
});
