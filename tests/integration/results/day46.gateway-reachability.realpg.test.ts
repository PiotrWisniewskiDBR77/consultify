/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const NO_RETRY = { retry: 0 } as const;

const families = [
  ['kpi', '/api/vnext/results/kpi'],
  ['kpi/deviation-cases', '/api/vnext/results/kpi/deviation-cases'],
  ['kpi/scorecards', '/api/vnext/results/kpi/scorecards'],
  ['kpi/legacy', '/api/vnext/results/kpi/legacy'],
  ['roi', '/api/vnext/results/roi/cases'],
  ['roi/legacy', '/api/vnext/results/roi/legacy'],
  ['okr', '/api/vnext/results/okr/programs'],
  ['okr/legacy', '/api/vnext/results/okr/legacy'],
  ['search', '/api/vnext/results/search?q=a'],
  ['initiatives/kpi-impacts', `/api/vnext/results/initiatives/${randomUUID()}/kpi-impacts`],
] as const;

describe.skipIf(!enabled)(
  'day46 A.1 — Results reachability through the real ApiGateway',
  NO_RETRY,
  () => {
    const prefix = `day46-a1-${randomUUID()}`;
    const orgA = `${prefix}-org-a`;
    const orgB = `${prefix}-org-b`;
    const actors = [
      ['OWNER', `${prefix}-owner`, orgA, 'OWNER'],
      ['ADMIN', `${prefix}-admin`, orgA, 'ADMIN'],
      ['MEMBER', `${prefix}-member`, orgA, 'MEMBER'],
      ['CONSULTANT', `${prefix}-consultant`, orgA, 'CONSULTANT'],
      ['GUEST', `${prefix}-guest`, orgA, 'GUEST'],
      ['FOREIGN_OWNER', `${prefix}-foreign-owner`, orgB, 'OWNER'],
    ] as const;
    const pool = new Pool({ connectionString: databaseUrl });
    const app = express();

    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const tokenFor = (userId: string, organizationId: string, claimedRole: string) =>
      jwt.sign(
        {
          id: userId,
          userId,
          email: `${userId}@test.invalid`,
          organizationId,
          organization_id: organizationId,
          role: claimedRole,
          isSuperAdmin: true,
          permissions: ['*'],
        },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      );

    beforeAll(async () => {
      expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
      await pool.query(
        `INSERT INTO organizations(id,name,status) VALUES($1,$1,'active'),($2,$2,'active')`,
        [orgA, orgB]
      );
      for (const [, userId, organizationId, role] of actors) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'x',$4,'active')`,
          [userId, organizationId, `${userId}@test.invalid`, role]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
          [randomUUID(), organizationId, userId, role]
        );
      }
    });

    afterAll(async () => {
      await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`, [
        [orgA, orgB],
      ]);
      await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [actors.map(([, userId]) => userId)]);
      await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[orgA, orgB]]);
      await pool.end();
      const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
      await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
    });

    for (const [family, path] of families) {
      for (const [label, userId, organizationId, authoritativeRole] of actors) {
        it(`${family} × ${label} returns the measured envelope status`, async () => {
          const response = await request(app)
            .get(path)
            .set('Authorization', `Bearer ${tokenFor(userId, organizationId, 'OWNER')}`);

          if (authoritativeRole === 'OWNER' || authoritativeRole === 'ADMIN') {
            expect(response.status, JSON.stringify(response.body)).toBe(200);
          } else {
            expect(response.status, JSON.stringify(response.body)).toBe(403);
            expect(response.body.code).toBe('RESULTS_INTERNAL_BETA_VISIBILITY_DENIED');
          }
        });
      }
    }
  }
);
