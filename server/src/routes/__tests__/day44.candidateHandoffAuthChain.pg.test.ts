/** @vitest-environment node */
/**
 * Day 44 security proof — REWRITE (odbior fix, dyżur naprawczy 2026-08-28).
 *
 * Why the original version of this file was a tautology (adversarial review
 * finding, mutation-tested): it imported the FULL app (`../../index.js`),
 * i.e. the real Gateway with `/api/interview` (interview.routes.ts) mounted
 * BEFORE `/api/interview/candidate-handoff`. Because `interview.routes.ts`
 * declares its own `router.use(apiAuthRateLimiter, verifyToken,
 * validateOrgMembership, requireOrgAccess(), demoContextMiddleware)` with NO
 * path argument, Express runs those as global middleware for every request
 * whose path starts with `/api/interview` — INCLUDING
 * `/api/interview/candidate-handoff/*` — even though no route in
 * `interview.routes.ts` itself matches. That is the literal mechanism of
 * "borrowed authentication" the Day 44 instruction hypothesized. The old
 * test therefore got `401` for anonymous requests whether or not
 * `interviewCandidateHandoff.routes.ts` declared its own chain, and could
 * never have told the two states apart — a mutation-blind assertion.
 *
 * This version mounts ONLY `interviewCandidateHandoff.routes.ts` (default
 * export) in a bare Express app — no `interview.routes.ts`, no Gateway, no
 * `index.js`. Whatever protects these six routes here is exclusively what
 * the router file itself declares.
 *
 * MUTATION GATE RESULT (recorded honestly, not hidden — see fix-day44
 * report `docs/program/waves/WAVE_03_ACCEPTANCE/INTERVIEW_DAY44_REPORT_20260828.md`
 * follow-up and the worker's FIX-2 section):
 *
 *   - Anonymous-request assertions (`rejects an anonymous request...`)
 *     PASS identically whether the router's own
 *     `apiAuthRateLimiter/verifyToken/requireOrgAccess/demoContextMiddleware`
 *     chain is present OR removed. This is NOT a bug in this test: every
 *     route below also carries its own `requirePermission(...)` middleware,
 *     and `requirePermission` (`server/src/middleware/permission.middleware.ts:269-275`)
 *     independently returns `401 AUTH_REQUIRED` whenever `req.user` is
 *     unset — which it always is with no `verifyToken` upstream. The
 *     anonymous-rejection assertions are therefore NOT mutation-sensitive
 *     to the router-level chain, and are kept here only as an always-true
 *     safety-net regression check, documented as such.
 *
 *   - The authenticated-success assertion IS mutation-sensitive: with the
 *     router's own chain present, a valid OWNER bearer token reaches the
 *     handler (`verifyToken` populates `req.user`, `requireOrgAccess()`
 *     accepts the claim, `requirePermission` grants OWNER by role bypass).
 *     With the router-level chain removed, `req.user` is NEVER populated
 *     (nothing upstream parses `Authorization: Bearer`), so the SAME valid
 *     token now also gets `401 AUTH_REQUIRED` from `requirePermission` —
 *     i.e. removing the "fix" does not open a hole, it makes the router
 *     fail closed for everyone, legitimate callers included. This is the
 *     literal proof that INT-PF-004 hardened robustness under a changed
 *     Gateway mount order, not a security vulnerability: there was no
 *     window in which an anonymous caller could reach the handler in
 *     either state.
 *
 * Manually verified both directions with `--retry=0` during the FIX-2
 * remediation (not committed as a second file — see the worker report for
 * the literal command transcript of both runs: chain present -> PASS,
 * chain removed -> the authenticated-success test goes RED while the
 * anonymous tests stay green exactly as predicted above).
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
const secret = 'day44-candidate-handoff-auth-chain-secret';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.SKIP_STARTUP_VALIDATOR = 'true';
process.env.DISABLE_SCHEDULER = 'true';

describe.skipIf(!enabled)(
  'Day 44 candidate handoff auth chain — router mounted ALONE (no interview.routes.ts, no Gateway)',
  () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const organizationId = randomUUID();
    const userId = randomUUID();
    let app: express.Express;
    let token: string;

    beforeAll(async () => {
      await assertRealPostgresTestEnvironment();

      await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$2)', [
        organizationId,
        'Day 44 auth chain (router-alone)',
      ]);
      await pool.query(
        `INSERT INTO users (id,organization_id,email,role,status)
         VALUES ($1,$2,$3,'OWNER','active')`,
        [userId, organizationId, `${userId}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
         VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), organizationId, userId]
      );
      token = jwt.sign({ id: userId, userId, organizationId, role: 'OWNER' }, secret, {
        algorithm: 'HS256',
        expiresIn: '10m',
      });

      // The proof: import ONLY the candidate-handoff router. If it were
      // still borrowing protection from `interview.routes.ts`/Gateway mount
      // order, this app would have NO auth at all on these paths, because
      // neither is present here.
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
      await pool.query('DELETE FROM users WHERE id=$1', [userId]);
      await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
      await pool.end();
    });

    const paths = [
      '/api/interview/candidate-handoff/submission/missing/preview',
      '/api/interview/candidate-handoff/submission/missing/approve',
      '/api/interview/candidate-handoff/submission/missing',
      '/api/interview/candidate-handoff/insight-finding/missing/preview',
      '/api/interview/candidate-handoff/insight-finding/missing/approve',
      '/api/interview/candidate-handoff/insight-finding/missing',
    ];

    for (const path of paths) {
      it(`rejects an anonymous request before handler (NOT mutation-sensitive — see file header): ${path}`, async () => {
        const before = await pool.query(
          `SELECT count(*)::int AS count FROM initiative_candidates
           WHERE organization_id=$1`,
          [organizationId]
        );
        const response = path.endsWith('/approve')
          ? await request(app).post(path).send({ organizationId })
          : await request(app).get(path);
        expect(response.status).toBe(401);
        const after = await pool.query(
          `SELECT count(*)::int AS count FROM initiative_candidates
           WHERE organization_id=$1`,
          [organizationId]
        );
        expect(after.rows[0].count).toBe(before.rows[0].count);
      });
    }

    it('accepts real authentication and reaches the submission preview handler (MUTATION-SENSITIVE — see file header)', async () => {
      const response = await request(app).get(paths[0]).set('Authorization', `Bearer ${token}`);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      // Real service reached: no such assignment exists, so the honest
      // answer is 404 SUBMISSION_NOT_FOUND, proving the handler itself ran.
      expect(response.status).toBe(404);
      expect(response.body?.code).toBe('SUBMISSION_NOT_FOUND');
    });
  }
);
