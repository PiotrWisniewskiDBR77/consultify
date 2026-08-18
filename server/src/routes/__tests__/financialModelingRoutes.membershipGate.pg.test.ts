/** @vitest-environment node */
/**
 * `server/src/routes/financial-modeling.routes.ts` — real-Postgres, real-HTTP
 * membership-wall suite for the LEGACY (non-v8) financial-modeling router.
 *
 * ── THE SECOND-DOOR PATTERN (why this file exists) ──────────────────────
 * This router writes to `financial_models` / `financial_model_events` via
 * the SAME service functions (`financialModelingService.ts`) the canonical
 * `v8/finance.routes.ts` door uses. A membership wall placed on one door
 * protects nothing while a sibling door to the identical writer stands
 * open — the exact shape this repo was burned by before
 * (`financeSecondDoor.pg.test.ts`, for the /approve route specifically).
 *
 * ── WHAT IS ACTUALLY IN THIS ROUTER'S CHAIN TODAY (verified, not assumed) ──
 * Measured with `grep -n "router\.\(post\|put\|delete\)(" financial-modeling.routes.ts`:
 * 10 mutating route registrations. `grep -c requireActiveMembership` on the
 * file → 2 (one import, one usage). The ONE usage is on
 * `POST /models/:id/approve` (line 546) only. The other 9 mutating routes —
 * POST /models, PUT /models/:id, POST /models/:id/refresh-source,
 * DELETE /models/:id, POST /models/:id/compute, POST /models/:id/submit-review,
 * POST /models/:id/events, PUT /events/:eventId, DELETE /events/:eventId —
 * carry only `verifyToken, isAuthenticated` (+ `validateBody` schema checks
 * on four of them — POST /models, PUT /models/:id, POST /models/:id/events,
 * PUT /events/:eventId; three separate parties miscounted this as three
 * before an audit measured four), which verifies a signed JWT and a
 * non-empty user id but
 * never looks at `organization_members`. A REVOKED member or a caller with
 * NO membership row at all can still create/update/delete/compute against
 * `financial_models` through any of these 9 doors today.
 *
 * ── THIS IS **NOT** THE CROSS-ORG IDOR SHAPE ─────────────────────────────
 * Unlike `budget.routes.ts`'s pre-fix PUT/DELETE (`WHERE id = ?` with no
 * `organization_id` predicate at all), every mutating route in THIS file
 * gates ownership at the route level before mutating — either via
 * `getModel(modelId, req.user.organizationId)`
 * (`... WHERE id = ? AND organization_id = ?`, financialModelingService.ts:1588-1591)
 * for the `/models/:id*` family, or via the inline
 * `SELECT e.id FROM financial_model_events e INNER JOIN financial_models m
 *  ON m.id = e.model_id WHERE e.id = ? AND m.organization_id = ?`
 * (financial-modeling.routes.ts:656-663, :675-682) for the `/events/:eventId`
 * family. `financial-modeling.routes.idor.test.ts` already pins this (mocked
 * DB): a foreign-org id resolves 404 and the downstream service is never
 * called. This suite does NOT re-litigate that — it tests the orthogonal,
 * confirmed-still-open gap: membership STATUS (ACTIVE vs REVOKED vs no row)
 * within the caller's OWN org is never checked on these 9 routes.
 *
 * ── ENV GATE ── mirrors budgetRoutes.membershipGate.pg.test.ts /
 *   financeTwoDoorsMountedAuth.pg.test.ts:
 *   RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgres://...  (host must be
 *   local/disposable; DB name must start with `consultify_fin_`)
 *   JWT_SECRET=test-jwt-secret-key-min-32-chars-long-for-validation
 *
 * ── SCOPE ── originally landed as a tests-first preflight (RED only, no
 * product edit). The wall now DOES land in this same file's history: a
 * follow-up commit mounted `requireActiveMembership` on the 9 previously-open
 * routes in `financial-modeling.routes.ts`, confirmed against a real-Postgres
 * RED (18 of 27 cases failing pre-fix, matching this suite exactly) followed
 * by a real-Postgres GREEN (27 of 27 passing post-fix). This file's
 * assertions were not loosened to get there.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(databaseUrl) &&
  /localhost|127\.0\.0\.1/.test(databaseUrl);

const canonicalVitestJwtSecret = 'test-jwt-secret-key-min-32-chars-long-for-validation';
if (enabled && process.env.JWT_SECRET !== canonicalVitestJwtSecret) {
  throw new Error('FIN_MODELING_MEMBERSHIP_GATE_CANONICAL_VITEST_JWT_SECRET_MISMATCH');
}
const jwtSecret = process.env.JWT_SECRET || canonicalVitestJwtSecret;

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
delete process.env.ENABLE_TEST_AUTH_BYPASS;

const prefix = `finm-mg-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const active = `${prefix}-active`;
const revoked = `${prefix}-revoked`;
const noRow = `${prefix}-no-row`;
const suiteLock = 'financial-modeling-routes-membership-gate';

function authorization(userId: string, organizationId: string, role = 'ADMIN') {
  return {
    Authorization: `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@test.invalid`,
        organizationId,
        organization_id: organizationId,
        role,
        isSuperAdmin: role === 'SUPERADMIN',
      },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`,
  };
}

describe.skipIf(!enabled)(
  'Financial-modeling routes (legacy, non-v8) — membership wall (real HTTP + real PostgreSQL)',
  () => {
    let pool: Pool;
    let lockClient: PoolClient;
    let app: express.Express;

    async function fullResidue(queryable: Pool | PoolClient) {
      const result = await queryable.query(
        `SELECT
           (SELECT count(*)::int FROM organizations WHERE id = $2) AS organizations,
           (SELECT count(*)::int FROM users WHERE id LIKE $1) AS users,
           (SELECT count(*)::int FROM organization_members WHERE id LIKE $1) AS memberships,
           (SELECT count(*)::int FROM financial_models WHERE id LIKE $1) AS models,
           (SELECT count(*)::int FROM financial_model_events WHERE id LIKE $1) AS events`,
        [`${prefix}%`, orgA]
      );
      return result.rows[0];
    }

    const zeroResidue = { organizations: 0, users: 0, memberships: 0, models: 0, events: 0 };

    async function insertModel(id: string, overrides: Partial<{ status: string }> = {}) {
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO financial_models
           (id, organization_id, name, start_date, horizon_months, granularity, scenario,
            status, assumptions_json, currency, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)`,
        [
          id,
          orgA,
          `Model ${id}`,
          '2026-01-01',
          1,
          'monthly',
          'base',
          overrides.status || 'draft',
          '{}',
          'PLN',
          active,
          now,
        ]
      );
    }

    async function insertEvent(id: string, modelId: string) {
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO financial_model_events
           (id, model_id, event_type, name, amount, period_start, cf_classification,
            posting_rules, is_active, created_by, created_at, updated_at)
         VALUES ($1,$2,'revenue','Seed Event',100,'2026-01-01','operating','{}',TRUE,$3,$4,$4)`,
        [id, modelId, active, now]
      );
    }

    async function modelRow(id: string) {
      const result = await pool.query(
        `SELECT id, name, status FROM financial_models WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    }

    async function eventRow(id: string) {
      const result = await pool.query(
        `SELECT id, amount FROM financial_model_events WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    }

    beforeAll(async () => {
      pool = new Pool({ connectionString: databaseUrl });
      const databaseName = (await pool.query(`SELECT current_database() AS name`)).rows[0]
        .name as string;
      if (!databaseName.startsWith('consultify_fin_')) {
        throw new Error(`FIN_MODELING_MEMBERSHIP_GATE_TEST_DB_NOT_DISPOSABLE:${databaseName}`);
      }
      lockClient = await pool.connect();
      await lockClient.query(`SELECT pg_advisory_lock(hashtext($1))`, [suiteLock]);
      const now = new Date().toISOString();

      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
         VALUES($1,$1,'enterprise','active',1,$2)`,
        [orgA, now]
      );
      for (const [userId, role] of [
        [active, 'ADMIN'],
        [revoked, 'ADMIN'],
        [noRow, 'ADMIN'],
      ] as const) {
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
           VALUES($1,$2,$3,'unused',$4,'active',$5)`,
          [userId, orgA, `${userId}@test.invalid`, role, now]
        );
      }
      // Deliberately NO membership row for `noRow`.
      for (const [userId, status] of [
        [active, 'ACTIVE'],
        [revoked, 'REVOKED'],
      ] as const) {
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
           VALUES($1,$2,$3,'ADMIN',$4,$5)`,
          [`${prefix}-${userId}-membership`, orgA, userId, status, now]
        );
      }

      const financialModelingRouter = (await import('../financial-modeling.routes.js')).default;
      app = express();
      app.use(express.json());
      app.use('/api/financial-modeling', financialModelingRouter);
    }, 120_000);

    afterAll(async () => {
      if (!pool) return;
      let cleanupClient: PoolClient | undefined;
      try {
        cleanupClient = await pool.connect();
        await cleanupClient.query('BEGIN');
        // financial_model_events/outputs/validations all FK ON DELETE CASCADE
        // from financial_models(id) — deleting the models cascades the rest.
        await cleanupClient.query(`DELETE FROM financial_models WHERE id LIKE $1`, [`${prefix}%`]);
        await cleanupClient.query(`DELETE FROM organization_members WHERE id LIKE $1`, [
          `${prefix}%`,
        ]);
        await cleanupClient.query(`DELETE FROM users WHERE id LIKE $1`, [`${prefix}%`]);
        await cleanupClient.query(`DELETE FROM organizations WHERE id = $1`, [orgA]);
        expect(await fullResidue(cleanupClient)).toEqual(zeroResidue);
        await cleanupClient.query('COMMIT');
        expect(await fullResidue(pool)).toEqual(zeroResidue);
      } catch (error) {
        if (cleanupClient) await cleanupClient.query('ROLLBACK');
        throw error;
      } finally {
        cleanupClient?.release();
        if (lockClient) {
          await lockClient.query(`SELECT pg_advisory_unlock(hashtext($1))`, [suiteLock]);
          lockClient.release();
        }
        await pool.end();
      }
    });

    // ────────────────────────────────────────────────────────────────
    // POST /models
    // ────────────────────────────────────────────────────────────────
    describe('POST /models (create)', () => {
      it('★ RED today: a REVOKED member can still create a model (no wall)', async () => {
        const res = await request(app)
          .post('/api/financial-modeling/models')
          .set(authorization(revoked, orgA))
          .send({ name: 'Revoked-created model', startDate: '2026-01-01' });
        // Desired/fixed behaviour once requireActiveMembership is mounted.
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('★ RED today: a caller with no organization_members row can still create a model', async () => {
        const res = await request(app)
          .post('/api/financial-modeling/models')
          .set(authorization(noRow, orgA))
          .send({ name: 'NoRow-created model', startDate: '2026-01-01' });
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('GREEN: an ACTIVE member creates a model (not narrowed to only failure paths)', async () => {
        const res = await request(app)
          .post('/api/financial-modeling/models')
          .set(authorization(active, orgA))
          .send({ name: 'Active-created model', startDate: '2026-01-01' });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ success: true });
        const row = await modelRow(res.body.id);
        expect(row).toMatchObject({ id: res.body.id, name: 'Active-created model' });
      });
    });

    // ────────────────────────────────────────────────────────────────
    // PUT /models/:id
    // ────────────────────────────────────────────────────────────────
    describe('PUT /models/:id (update)', () => {
      it('★ RED today: a REVOKED member can still update a model (no wall)', async () => {
        const modelId = `${prefix}-put-revoked`;
        await insertModel(modelId);
        const res = await request(app)
          .put(`/api/financial-modeling/models/${modelId}`)
          .set(authorization(revoked, orgA))
          .send({ name: 'hijacked-by-revoked' });
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        const row = await modelRow(modelId);
        expect(row.name).toBe(`Model ${modelId}`);
      });

      it('★ RED today: a caller with no membership row can still update a model', async () => {
        const modelId = `${prefix}-put-norow`;
        await insertModel(modelId);
        const res = await request(app)
          .put(`/api/financial-modeling/models/${modelId}`)
          .set(authorization(noRow, orgA))
          .send({ name: 'hijacked-by-norow' });
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        const row = await modelRow(modelId);
        expect(row.name).toBe(`Model ${modelId}`);
      });

      it('GREEN: an ACTIVE member updates a model', async () => {
        const modelId = `${prefix}-put-active`;
        await insertModel(modelId);
        const res = await request(app)
          .put(`/api/financial-modeling/models/${modelId}`)
          .set(authorization(active, orgA))
          .send({ name: 'legitimately-updated' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true });
        const row = await modelRow(modelId);
        expect(row.name).toBe('legitimately-updated');
      });
    });

    // ────────────────────────────────────────────────────────────────
    // DELETE /models/:id
    // ────────────────────────────────────────────────────────────────
    describe('DELETE /models/:id', () => {
      it('★ RED today: a REVOKED member can still delete a model (no wall)', async () => {
        const modelId = `${prefix}-del-revoked`;
        await insertModel(modelId);
        const res = await request(app)
          .delete(`/api/financial-modeling/models/${modelId}`)
          .set(authorization(revoked, orgA));
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await modelRow(modelId)).not.toBeNull();
      });

      it('★ RED today: a caller with no membership row can still delete a model', async () => {
        const modelId = `${prefix}-del-norow`;
        await insertModel(modelId);
        const res = await request(app)
          .delete(`/api/financial-modeling/models/${modelId}`)
          .set(authorization(noRow, orgA));
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await modelRow(modelId)).not.toBeNull();
      });

      it('GREEN: an ACTIVE member deletes a draft model', async () => {
        const modelId = `${prefix}-del-active`;
        await insertModel(modelId);
        const res = await request(app)
          .delete(`/api/financial-modeling/models/${modelId}`)
          .set(authorization(active, orgA));
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, deleted: modelId });
        expect(await modelRow(modelId)).toBeNull();
      });
    });

    // ────────────────────────────────────────────────────────────────
    // POST /models/:id/compute
    // ────────────────────────────────────────────────────────────────
    describe('POST /models/:id/compute', () => {
      it('★ RED today: a REVOKED member can still trigger a compute (no wall)', async () => {
        const modelId = `${prefix}-compute-revoked`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/compute`)
          .set(authorization(revoked, orgA))
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('★ RED today: a caller with no membership row can still trigger a compute', async () => {
        const modelId = `${prefix}-compute-norow`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/compute`)
          .set(authorization(noRow, orgA))
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('GREEN: an ACTIVE member computes a model', async () => {
        const modelId = `${prefix}-compute-active`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/compute`)
          .set(authorization(active, orgA))
          .send({});
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true });
      });
    });

    // ────────────────────────────────────────────────────────────────
    // POST /models/:id/submit-review
    // ────────────────────────────────────────────────────────────────
    describe('POST /models/:id/submit-review', () => {
      it('★ RED today: a REVOKED member can still submit a model for review (no wall)', async () => {
        const modelId = `${prefix}-submit-revoked`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/submit-review`)
          .set(authorization(revoked, orgA))
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        const row = await modelRow(modelId);
        expect(row.status).toBe('draft');
      });

      it('★ RED today: a caller with no membership row can still submit a model for review', async () => {
        const modelId = `${prefix}-submit-norow`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/submit-review`)
          .set(authorization(noRow, orgA))
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        const row = await modelRow(modelId);
        expect(row.status).toBe('draft');
      });

      it('GREEN: an ACTIVE member submits a draft model for review', async () => {
        const modelId = `${prefix}-submit-active`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/submit-review`)
          .set(authorization(active, orgA))
          .send({});
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, status: 'review' });
        const row = await modelRow(modelId);
        expect(row.status).toBe('review');
      });
    });

    // ────────────────────────────────────────────────────────────────
    // POST /models/:id/refresh-source
    // (no source bound → business layer replies 400 "no source"; the point
    //  here is proving the caller REACHES that business logic at all — an
    //  ACTIVE member gets the deterministic 400, a REVOKED/no-row caller
    //  should be stopped at 403 before ever reaching it.)
    // ────────────────────────────────────────────────────────────────
    describe('POST /models/:id/refresh-source', () => {
      it('★ RED today: a REVOKED member reaches the handler instead of being walled', async () => {
        const modelId = `${prefix}-refresh-revoked`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/refresh-source`)
          .set(authorization(revoked, orgA))
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('★ RED today: a caller with no membership row reaches the handler instead of being walled', async () => {
        const modelId = `${prefix}-refresh-norow`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/refresh-source`)
          .set(authorization(noRow, orgA))
          .send({});
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('GREEN: an ACTIVE member reaches the handler (deterministic no-source 400, not a 403)', async () => {
        const modelId = `${prefix}-refresh-active`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/refresh-source`)
          .set(authorization(active, orgA))
          .send({});
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ error: 'Model has no source statement to refresh from' });
      });
    });

    // ────────────────────────────────────────────────────────────────
    // POST /models/:id/events (create event)
    // ────────────────────────────────────────────────────────────────
    describe('POST /models/:id/events (create event)', () => {
      const eventBody = {
        eventType: 'revenue',
        name: 'New Event',
        amount: 500,
        periodStart: '2026-02-01',
        cfClassification: 'operating',
      };

      it('★ RED today: a REVOKED member can still create an event (no wall)', async () => {
        const modelId = `${prefix}-evc-revoked`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/events`)
          .set(authorization(revoked, orgA))
          .send(eventBody);
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('★ RED today: a caller with no membership row can still create an event', async () => {
        const modelId = `${prefix}-evc-norow`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/events`)
          .set(authorization(noRow, orgA))
          .send(eventBody);
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
      });

      it('GREEN: an ACTIVE member creates an event', async () => {
        const modelId = `${prefix}-evc-active`;
        await insertModel(modelId);
        const res = await request(app)
          .post(`/api/financial-modeling/models/${modelId}/events`)
          .set(authorization(active, orgA))
          .send(eventBody);
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ success: true });
        const row = await eventRow(res.body.id);
        expect(row).toMatchObject({ id: res.body.id, amount: 500 });
      });
    });

    // ────────────────────────────────────────────────────────────────
    // PUT /events/:eventId
    // ────────────────────────────────────────────────────────────────
    describe('PUT /events/:eventId', () => {
      it('★ RED today: a REVOKED member can still update an event (no wall)', async () => {
        const modelId = `${prefix}-evu-revoked-m`;
        const eventId = `${prefix}-evu-revoked-e`;
        await insertModel(modelId);
        await insertEvent(eventId, modelId);
        const res = await request(app)
          .put(`/api/financial-modeling/events/${eventId}`)
          .set(authorization(revoked, orgA))
          .send({ amount: 999 });
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        const row = await eventRow(eventId);
        expect(row.amount).toBe(100);
      });

      it('★ RED today: a caller with no membership row can still update an event', async () => {
        const modelId = `${prefix}-evu-norow-m`;
        const eventId = `${prefix}-evu-norow-e`;
        await insertModel(modelId);
        await insertEvent(eventId, modelId);
        const res = await request(app)
          .put(`/api/financial-modeling/events/${eventId}`)
          .set(authorization(noRow, orgA))
          .send({ amount: 999 });
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        const row = await eventRow(eventId);
        expect(row.amount).toBe(100);
      });

      it('GREEN: an ACTIVE member updates an event', async () => {
        const modelId = `${prefix}-evu-active-m`;
        const eventId = `${prefix}-evu-active-e`;
        await insertModel(modelId);
        await insertEvent(eventId, modelId);
        const res = await request(app)
          .put(`/api/financial-modeling/events/${eventId}`)
          .set(authorization(active, orgA))
          .send({ amount: 777 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true });
        const row = await eventRow(eventId);
        expect(row.amount).toBe(777);
      });
    });

    // ────────────────────────────────────────────────────────────────
    // DELETE /events/:eventId
    // ────────────────────────────────────────────────────────────────
    describe('DELETE /events/:eventId', () => {
      it('★ RED today: a REVOKED member can still delete an event (no wall)', async () => {
        const modelId = `${prefix}-evd-revoked-m`;
        const eventId = `${prefix}-evd-revoked-e`;
        await insertModel(modelId);
        await insertEvent(eventId, modelId);
        const res = await request(app)
          .delete(`/api/financial-modeling/events/${eventId}`)
          .set(authorization(revoked, orgA));
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await eventRow(eventId)).not.toBeNull();
      });

      it('★ RED today: a caller with no membership row can still delete an event', async () => {
        const modelId = `${prefix}-evd-norow-m`;
        const eventId = `${prefix}-evd-norow-e`;
        await insertModel(modelId);
        await insertEvent(eventId, modelId);
        const res = await request(app)
          .delete(`/api/financial-modeling/events/${eventId}`)
          .set(authorization(noRow, orgA));
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
        expect(await eventRow(eventId)).not.toBeNull();
      });

      it('GREEN: an ACTIVE member deletes an event', async () => {
        const modelId = `${prefix}-evd-active-m`;
        const eventId = `${prefix}-evd-active-e`;
        await insertModel(modelId);
        await insertEvent(eventId, modelId);
        const res = await request(app)
          .delete(`/api/financial-modeling/events/${eventId}`)
          .set(authorization(active, orgA));
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true });
        expect(await eventRow(eventId)).toBeNull();
      });
    });
  }
);
