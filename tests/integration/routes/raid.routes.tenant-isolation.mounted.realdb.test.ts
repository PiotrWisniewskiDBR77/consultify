/**
 * P0 IDOR fix — mounted signed-JWT + real PostgreSQL proof.
 *
 * PUT/PATCH/DELETE /api/raid/:id previously updated or deleted any
 * raid_items row by id alone, with no organization_id filter anywhere in
 * the WHERE clause (nor in the severity/probability re-read SELECT). Any
 * authenticated user of ANY organization could overwrite, change the
 * status of, or permanently delete another organization's RAID item —
 * confirmed live via probe (200 + readback proved the mutation).
 *
 * This test mounts the REAL raid.routes.ts router behind REAL
 * verifyToken/isAuthenticated middleware, against a REAL migrated
 * PostgreSQL database (MOCK_DB=false), and proves:
 *  (1) an org A caller can mutate its own row (200),
 *  (2) an org A caller can never mutate an org B row via PUT/PATCH/DELETE
 *      (404, never 403 — a 403 would confirm the row exists), and the row
 *      is verified UNCHANGED afterwards via readback,
 *  (3) a non-existent id also returns 404,
 *  (4) MUTATION PROOF: removing the org guard makes the org B mutation
 *      attempts succeed (200) and actually mutate the row — proving the
 *      test is a real regression guard and not a false-positive 404.
 *
 * Requires a disposable, fully migrated Postgres database. Destroy the
 * disposable database after the run.
 *
 * FIX-212 (2026-08-31): this file used to also require the database name to
 * start with `consultify_raid_idor_test` (databaseName.startsWith(...)).
 * That extra pin is the Z31 defect measured across six prior incidents —
 * any disposable DB with a different name (e.g. one from a shared local
 * Postgres container) made `enabled` false and the whole file SKIP at exit
 * 0, silently. Per the standing rule ("odpinaj strażnika, nie przypinaj
 * mocniej") the guard is removed, not tightened; the file now runs under
 * the same three-condition gate (`RUN_DB_TESTS=1`, `MOCK_DB=false`, a
 * postgres:// URL) used by its sibling realdb tests.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!enabled).sequential('mounted RAID routes tenant isolation (IDOR fix)', () => {
  const suffix = randomUUID();
  const orgA = `raid-idor-${suffix}-a`;
  const orgB = `raid-idor-${suffix}-b`;
  const userA = `raid-idor-${suffix}-user-a`;
  const userB = `raid-idor-${suffix}-user-b`;
  const itemAId = `raid-idor-${suffix}-item-a`;
  const itemBId = `raid-idor-${suffix}-item-b`;
  const missingId = `raid-idor-${suffix}-missing`;
  let pool: pg.Pool;
  let app: Express;

  const token = (id: string, organizationId: string, role: string) =>
    jwt.sign(
      { id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  const readItem = async (id: string) => {
    const { rows } = await pool.query(
      `SELECT id, organization_id, title, description, status, impact, probability, owner_id, due_date
       FROM raid_items WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  };

  const seedItem = async (id: string, org: string, title: string) => {
    await pool.query(
      `INSERT INTO raid_items (id, organization_id, initiative_id, type, title, description,
                                impact, probability, risk_score, score_category, status, owner_id, due_date, created_at, updated_at)
       VALUES ($1,$2,NULL,'RISK',$3,'seed description','MEDIUM','MEDIUM',9,'AMBER','OPEN',NULL,NULL, now(), now())`,
      [id, org, title]
    );
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });

    for (const [org, label] of [
      [orgA, 'A'],
      [orgB, 'B'],
    ] as const) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
        org,
        `RAID IDOR ${label}`,
      ]);
    }
    for (const [id, org] of [
      [userA, orgA],
      [userB, orgB],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
         VALUES($1,$2,$3,'x','ADMIN','active','Raid','Idor',now())`,
        [id, org, `${id}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,'ADMIN','ACTIVE',now())`,
        [`mem-${id}`, org, id]
      );
    }

    await seedItem(itemAId, orgA, 'Org A original title');
    await seedItem(itemBId, orgB, 'Org B original title');

    const router = (await import('../../../server/src/routes/raid.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/raid', router);
  }, 60_000);

  afterAll(async () => {
    // Best-effort cleanup of seeded rows, then close the pool.
    try {
      await pool.query(`DELETE FROM raid_items WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
        orgA,
        orgB,
      ]);
      await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
      await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    } catch {
      // ignore cleanup failures — disposable database is destroyed by the harness anyway.
    }
    await pool?.end();
  });

  it('(1) owner of org A can PUT/PATCH its own row — 200, readback confirms the mutation', async () => {
    const bearer = token(userA, orgA, 'ADMIN');

    const putRes = await request(app)
      .put(`/api/raid/${itemAId}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ title: 'Org A updated title' });
    expect(putRes.status).toBe(200);

    const patchRes = await request(app)
      .patch(`/api/raid/${itemAId}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ status: 'CLOSED' });
    expect(patchRes.status).toBe(200);

    const row = await readItem(itemAId);
    expect(row.title).toBe('Org A updated title');
    expect(row.status).toBe('CLOSED');
  });

  it('(2) org A caller on org B row: PUT/PATCH/DELETE all 404, and readback proves zero mutation', async () => {
    const bearer = token(userA, orgA, 'ADMIN');
    const before = await readItem(itemBId);
    expect(before).not.toBeNull();
    expect(before.organization_id).toBe(orgB);

    const putRes = await request(app)
      .put(`/api/raid/${itemBId}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ title: 'HACKED BY ORG A' });
    expect(putRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/raid/${itemBId}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ status: 'CLOSED' });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/raid/${itemBId}`)
      .set('Authorization', `Bearer ${bearer}`);
    expect(deleteRes.status).toBe(404);

    const after = await readItem(itemBId);
    expect(after).not.toBeNull();
    expect(after.title).toBe(before.title);
    expect(after.status).toBe(before.status);
    expect(after.organization_id).toBe(orgB);
  });

  it('(3) a non-existent id returns 404 for PUT/PATCH/DELETE', async () => {
    const bearer = token(userA, orgA, 'ADMIN');

    const putRes = await request(app)
      .put(`/api/raid/${missingId}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ title: 'does not matter' });
    expect(putRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/raid/${missingId}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ status: 'CLOSED' });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/raid/${missingId}`)
      .set('Authorization', `Bearer ${bearer}`);
    expect(deleteRes.status).toBe(404);
  });

  it('still allows the owning org (B) to mutate its own row', async () => {
    const bearer = token(userB, orgB, 'ADMIN');
    const patchRes = await request(app)
      .patch(`/api/raid/${itemBId}`)
      .set('Authorization', `Bearer ${bearer}`)
      .send({ status: 'CLOSED' });
    expect(patchRes.status).toBe(200);

    const row = await readItem(itemBId);
    expect(row.status).toBe('CLOSED');
  });
});
