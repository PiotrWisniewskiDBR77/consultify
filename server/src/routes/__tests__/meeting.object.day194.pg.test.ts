/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const organizationId = 'w3-mtg-owner-org-v1';
const adminId = 'w3-mtg-admin-user-v1';
const meetingCases = [
  ['pending', 'w3-mtg-pending-meeting-v1', 'Customer pilot — pending minutes'],
  ['rejected', 'w3-mtg-rejected-meeting-v1', 'Release acceleration — rejected minutes'],
  ['approved', 'w3-mtg-approved-meeting-v1', 'Customer pilot readiness — approved minutes'],
] as const;

describe('Day 194 meeting object GET through real ApiGateway and PostgreSQL', () => {
  let app: express.Express;
  let adminToken: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    adminToken = jwt.sign(
      {
        id: adminId,
        userId: adminId,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  });

  it.each(meetingCases)(
    'returns 200 plus the %s fixture body',
    async (_state, meetingId, title) => {
      const response = await request(app)
        .get(`/api/meeting/${meetingId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      console.info(
        `DAY194_HTTP meeting=${meetingId} status=${response.status} bytes=${Buffer.byteLength(response.text, 'utf8')}`
      );
      expect(response.status).toBe(200);
      expect(response.body.meeting).toEqual(
        expect.objectContaining({ id: meetingId, title, organizationId })
      );
    }
  );
});
