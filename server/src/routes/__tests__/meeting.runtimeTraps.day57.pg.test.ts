/** @vitest-environment node */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { parseJsonArray } from '../../services/meetingBoundary/meetingBoundaryService.js';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('Day 57 Meetings runtime traps', () => {
  let app: express.Express;
  let ownerToken: string;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    ownerToken = jwt.sign(
      {
        id: 'w3-mtg-owner-user-v1',
        userId: 'w3-mtg-owner-user-v1',
        organizationId: 'w3-mtg-owner-org-v1',
        role: 'OWNER',
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  });

  it('accepts the current PostgreSQL TEXT representation', () => {
    expect(parseJsonArray<{ task: string }>('[{"task":"Sprawdź wynik"}]')).toEqual([
      { task: 'Sprawdź wynik' },
    ]);
  });

  it('preserves a future pg json/jsonb array instead of silently dropping it', () => {
    expect(parseJsonArray<{ task: string }>([{ task: 'Nie zgub danych' }])).toEqual([
      { task: 'Nie zgub danych' },
    ]);
  });

  it.each([null, '', '{"not":"an array"}', 'not-json'])(
    'keeps the honest empty fallback for %j',
    (value) => {
      expect(parseJsonArray(value)).toEqual([]);
    }
  );

  it('reaches managed notes through the real ApiGateway on real PostgreSQL', async () => {
    const response = await request(app)
      .get('/api/meeting/w3-mtg-pending-meeting-v1/notes')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.code).not.toBe('BETA_LOCKED');
    expect(response.body.notes).toHaveLength(1);
    expect(response.body.notes[0].actionItems).toBeInstanceOf(Array);
  });
});
