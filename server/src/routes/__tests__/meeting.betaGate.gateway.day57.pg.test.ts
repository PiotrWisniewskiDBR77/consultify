/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { createModuleGate } from '../../middleware/betaGate.middleware.js';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const orgId = 'w3-mtg-owner-org-v1';

function token(userId: string, role: string): string {
  return jwt.sign({ id: userId, userId, organizationId: orgId, role }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

describe('Day 57 Meeting beta gate — real Gateway state', () => {
  let app: express.Express;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  it('MEMBER is denied by the real closed beta gate', async () => {
    const response = await request(app)
      .get('/api/meeting')
      .set('Authorization', `Bearer ${token('w3-mtg-member-user-v1', 'MEMBER')}`);
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'BETA_LOCKED' });
  });

  it('ADMIN is exempt and reaches the real handler', async () => {
    const response = await request(app)
      .get('/api/meeting')
      .set('Authorization', `Bearer ${token('w3-mtg-admin-user-v1', 'ADMIN')}`);
    expect(response.status).toBe(200);
    expect(response.body.code).not.toBe('BETA_LOCKED');
  });

  it('ADMINISTRATOR passes beta but is refused by the Meeting admin gate', async () => {
    const response = await request(app)
      .delete('/api/meeting/w3-mtg-pending-meeting-v1')
      .set('Authorization', `Bearer ${token('w3-mtg-admin-user-v1', 'ADMINISTRATOR')}`);
    expect([403, 404]).toContain(response.status);
    expect(response.body.code).not.toBe('BETA_LOCKED');
  });

  it('an anonymous caller is rejected before the beta gate', async () => {
    const response = await request(app).get('/api/meeting');
    expect(response.status).toBe(401);
    expect(response.body.code).not.toBe('BETA_LOCKED');
  });
});

describe('Day 57 Meeting beta gate — isolated public switch contract', () => {
  it.each(['MEMBER', 'USER', 'GUEST'])('status=open calls next for %s', async (role) => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { user?: { role: string } }).user = { role };
      next();
    });
    app.use(createModuleGate('MODULE_MEETING', () => 'open'));
    app.get('/', (_req, res) => res.status(204).end());
    const response = await request(app).get('/');
    expect(response.status).toBe(204);
  });
});
