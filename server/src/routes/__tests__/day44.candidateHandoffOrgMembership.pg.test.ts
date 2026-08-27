/** @vitest-environment node */
/**
 * Day 44 remediation — FIX-3.
 *
 * The Day 44 fix's own auth chain used `requireOrgAccess()` (JWT-claim shape
 * check only) instead of `validateOrgMembership` (real
 * `organization_members` DB check, `server/src/middleware/auth.middleware.ts:1672`).
 * Measured on real Postgres with the candidate-handoff router mounted
 * ALONE (see `day44.candidateHandoffAuthChain.pg.test.ts` for why "alone"
 * matters): a user whose membership row exists but was revoked (status
 * != 'ACTIVE') reached the handler and got `404 SUBMISSION_NOT_FOUND` --
 * identical to a user with a fully fabricated org/user id pair -- because
 * `requirePermission` grants OWNER/SUPERADMIN an unconditional role
 * bypass regardless of DB membership state (`permissionService.ts`
 * `hasPermission`). That is exactly the scenario this fix exists for
 * (candidate-handoff `/approve` performs a real write), so
 * `validateOrgMembership` was added to the router's own chain.
 *
 * This test proves the closed gap directly: revoked membership now gets
 * `403 ORG_MEMBERSHIP_REVOKED` before the handler runs, with the router
 * mounted alone (no interview.routes.ts, no Gateway to borrow from).
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);
const secret = 'day44-candidate-handoff-org-membership-secret';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.SKIP_STARTUP_VALIDATOR = 'true';
process.env.DISABLE_SCHEDULER = 'true';

describe.skipIf(!enabled)(
  'Day 44 FIX-3 — candidate-handoff router closes the revoked-membership gap',
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const organizationId = randomUUID();
    const revokedUserId = randomUUID();
    const activeUserId = randomUUID();
    let app: express.Express;

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();

      await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$2)', [
        organizationId,
        'Day 44 FIX-3 org membership',
      ]);
      await pool.query(
        `INSERT INTO users (id,organization_id,email,role,status)
         VALUES ($1,$2,$3,'OWNER','active'), ($4,$2,$5,'OWNER','active')`,
        [
          revokedUserId,
          organizationId,
          `${revokedUserId}@test.invalid`,
          activeUserId,
          `${activeUserId}@test.invalid`,
        ]
      );
      // Revoked: row exists, status is not ACTIVE.
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
         VALUES ($1,$2,$3,'OWNER','REMOVED')`,
        [randomUUID(), organizationId, revokedUserId]
      );
      // Active: genuine control case, must still reach the handler.
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
         VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, activeUserId]
      );

      const handoffRouter = (await import('../interviewCandidateHandoff.routes.js')).default;
      app = express();
      app.use(express.json());
      app.use('/api/interview/candidate-handoff', handoffRouter);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(500).json({ error: String(err?.message || err) });
      });
    }, 30000);

    afterAll(async () => {
      await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [
        organizationId,
      ]);
      await pool.query('DELETE FROM users WHERE organization_id=$1', [organizationId]);
      await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
      await pool.end();
    });

    it('rejects a revoked member with 403 ORG_MEMBERSHIP_REVOKED before the handler runs', async () => {
      const revokedToken = jwt.sign(
        { id: revokedUserId, userId: revokedUserId, organizationId, role: 'OWNER' },
        secret,
        { algorithm: 'HS256', expiresIn: '10m' }
      );
      const response = await request(app)
        .get('/api/interview/candidate-handoff/submission/missing/preview')
        .set('Authorization', `Bearer ${revokedToken}`);
      expect(response.status).toBe(403);
      expect(response.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
    });

    it('still lets an active member through to the real handler (control case)', async () => {
      const activeToken = jwt.sign(
        { id: activeUserId, userId: activeUserId, organizationId, role: 'OWNER' },
        secret,
        { algorithm: 'HS256', expiresIn: '10m' }
      );
      const response = await request(app)
        .get('/api/interview/candidate-handoff/submission/missing/preview')
        .set('Authorization', `Bearer ${activeToken}`);
      expect(response.status).toBe(404);
      expect(response.body?.code).toBe('SUBMISSION_NOT_FOUND');
    });
  }
);
