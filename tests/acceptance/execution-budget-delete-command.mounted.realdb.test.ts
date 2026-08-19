/**
 * EXE-MVP-ACTIONS-001 wave 2 — mounted signed-JWT + real PostgreSQL proof.
 * Requires a disposable, fully migrated database whose name starts with
 * `consultify_exe_budget_delete`; append-only evidence is intentionally not
 * weakened for cleanup. Destroy the disposable database after the run.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
const databaseName = (() => {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres') &&
  databaseName.startsWith('consultify_exe_budget_delete');

describe.skipIf(!enabled).sequential('mounted governed budget delete command', () => {
  const suffix = randomUUID();
  const orgA = `exe-bd-${suffix}-a`;
  const orgB = `exe-bd-${suffix}-b`;
  const adminA = `exe-bd-${suffix}-admin-a`;
  const memberA = `exe-bd-${suffix}-member-a`;
  const revokedA = `exe-bd-${suffix}-revoked-a`;
  const adminB = `exe-bd-${suffix}-admin-b`;
  const initiativeA = `exe-bd-${suffix}-initiative-a`;
  const initiativeB = `exe-bd-${suffix}-initiative-b`;
  let pool: pg.Pool;
  let app: Express;

  const token = (id: string, organizationId: string, role: string) =>
    jwt.sign(
      { id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  async function entry(id: string, org = orgA, initiative = initiativeA, version = 1) {
    await pool.query(
      `INSERT INTO budget_entries
        (id,organization_id,initiative_id,entry_type,cost_type,category,amount,currency,version)
       VALUES ($1,$2,$3,'ACTUAL','OPEX','Proof',25,'PLN',$4)`,
      [id, org, initiative, version]
    );
  }

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: databaseUrl });
    for (const [org, label] of [
      [orgA, 'A'],
      [orgB, 'B'],
    ] as const) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [
        org,
        `Execution ${label}`,
      ]);
    }
    for (const [id, org, role, status] of [
      [adminA, orgA, 'ADMIN', 'ACTIVE'],
      [memberA, orgA, 'MEMBER', 'ACTIVE'],
      [revokedA, orgA, 'ADMIN', 'INACTIVE'],
      [adminB, orgB, 'ADMIN', 'ACTIVE'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name,created_at)
         VALUES($1,$2,$3,'x','TEAM_MEMBER','active','Execution','Proof',now())`,
        [id, org, `${id}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
         VALUES($1,$2,$3,$4,$5,now())`,
        [`mem-${id}`, org, id, role, status]
      );
    }
    await pool.query(
      `INSERT INTO initiatives(id,organization_id,name,status,actual_budget_total)
       VALUES($1,$2,'Execution A','DRAFT',0),($3,$4,'Execution B','DRAFT',0)`,
      [initiativeA, orgA, initiativeB, orgB]
    );
    const router = (await import('../../server/src/routes/executionControl.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/execution-control', router);
  }, 60_000);

  afterAll(async () => {
    await pool
      ?.query(
        `DROP TRIGGER IF EXISTS trg_exe_budget_receipt_forced_failure ON execution_budget_delete_receipts`
      )
      .catch(() => undefined);
    await pool
      ?.query(`DROP FUNCTION IF EXISTS exe_budget_receipt_forced_failure()`)
      .catch(() => undefined);
    await pool?.end();
  });

  it('deletes once, replays after the row is gone, and exposes a cold receipt', async () => {
    const id = `entry-${suffix}-happy`;
    const key = `key-${suffix}-happy`;
    await entry(id);
    const bearer = token(adminA, orgA, 'ADMIN');
    const url = `/api/execution-control/budget/entries/${id}?initiativeId=${initiativeA}&expectedVersion=1`;
    const first = await request(app)
      .delete(url)
      .set('Authorization', `Bearer ${bearer}`)
      .set('X-Idempotency-Key', key);
    expect(first.status).toBe(200);
    expect(first.body.receipt).toMatchObject({
      outcome: 'SUCCEEDED',
      replayed: false,
      entryId: id,
      expectedVersion: 1,
    });
    const replay = await request(app)
      .delete(url)
      .set('Authorization', `Bearer ${bearer}`)
      .set('X-Idempotency-Key', key);
    expect(replay.status).toBe(200);
    expect(replay.body.receipt).toMatchObject({
      outcome: 'SUCCEEDED',
      replayed: true,
      receiptId: first.body.receipt.receiptId,
    });
    const cold = await request(app)
      .get(
        `/api/execution-control/budget/entries/${id}/delete-receipts/${key}?initiativeId=${initiativeA}`
      )
      .set('Authorization', `Bearer ${bearer}`);
    expect(cold.status).toBe(200);
    expect(cold.body.receipt).toMatchObject({
      outcome: 'SUCCEEDED',
      entryId: id,
      expectedVersion: 1,
    });
    const rows = await pool.query(`SELECT count(*)::int n FROM budget_entries WHERE id=$1`, [id]);
    const receipts = await pool.query(
      `SELECT count(*)::int n FROM execution_budget_delete_receipts WHERE organization_id=$1 AND idempotency_key=$2`,
      [orgA, key]
    );
    const audits = await pool.query(
      `SELECT count(*)::int n FROM execution_action_audit WHERE organization_id=$1 AND request_id=$2`,
      [orgA, key]
    );
    expect(rows.rows[0].n).toBe(0);
    expect(receipts.rows[0].n).toBe(1);
    expect(audits.rows[0].n).toBe(1);
  });

  it('serializes concurrent same-key requests into one delete and one replay', async () => {
    const id = `entry-${suffix}-concurrent`;
    const key = `key-${suffix}-concurrent`;
    await entry(id);
    const bearer = token(adminA, orgA, 'ADMIN');
    const make = () =>
      request(app)
        .delete(
          `/api/execution-control/budget/entries/${id}?initiativeId=${initiativeA}&expectedVersion=1`
        )
        .set('Authorization', `Bearer ${bearer}`)
        .set('X-Idempotency-Key', key);
    const [a, b] = await Promise.all([make(), make()]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.receipt.replayed, b.body.receipt.replayed].sort()).toEqual([false, true]);
    const count = await pool.query(
      `SELECT count(*)::int n FROM execution_budget_delete_receipts WHERE organization_id=$1 AND idempotency_key=$2`,
      [orgA, key]
    );
    expect(count.rows[0].n).toBe(1);
  });

  it('rejects stable-key payload collision before consulting the missing target', async () => {
    const id = `entry-${suffix}-collision`;
    const key = `key-${suffix}-collision`;
    await entry(id);
    const bearer = token(adminA, orgA, 'ADMIN');
    const base = `/api/execution-control/budget/entries/${id}?initiativeId=${initiativeA}`;
    expect(
      (
        await request(app)
          .delete(`${base}&expectedVersion=1`)
          .set('Authorization', `Bearer ${bearer}`)
          .set('X-Idempotency-Key', key)
      ).status
    ).toBe(200);
    const collision = await request(app)
      .delete(`${base}&expectedVersion=2`)
      .set('Authorization', `Bearer ${bearer}`)
      .set('X-Idempotency-Key', key);
    expect(collision.status).toBe(409);
    expect(collision.body.error).toMatch(/Idempotency key/);
  });

  it('persists stale, insufficient-role and foreign-target terminal receipts without deleting', async () => {
    const stale = `entry-${suffix}-stale`;
    const denied = `entry-${suffix}-denied`;
    const foreign = `entry-${suffix}-foreign`;
    await entry(stale, orgA, initiativeA, 2);
    await entry(denied);
    await entry(foreign, orgB, initiativeB);
    const adminBearer = token(adminA, orgA, 'ADMIN');
    const memberBearer = token(memberA, orgA, 'MEMBER');
    const staleRes = await request(app)
      .delete(
        `/api/execution-control/budget/entries/${stale}?initiativeId=${initiativeA}&expectedVersion=1`
      )
      .set('Authorization', `Bearer ${adminBearer}`)
      .set('X-Idempotency-Key', `key-${suffix}-stale`);
    const deniedRes = await request(app)
      .delete(
        `/api/execution-control/budget/entries/${denied}?initiativeId=${initiativeA}&expectedVersion=1`
      )
      .set('Authorization', `Bearer ${memberBearer}`)
      .set('X-Idempotency-Key', `key-${suffix}-denied`);
    const foreignRes = await request(app)
      .delete(
        `/api/execution-control/budget/entries/${foreign}?initiativeId=${initiativeA}&expectedVersion=1`
      )
      .set('Authorization', `Bearer ${adminBearer}`)
      .set('X-Idempotency-Key', `key-${suffix}-foreign`);
    expect(staleRes.status).toBe(409);
    expect(deniedRes.status).toBe(403);
    expect(foreignRes.status).toBe(404);
    const remaining = await pool.query(
      `SELECT count(*)::int n FROM budget_entries WHERE id=ANY($1)`,
      [[stale, denied, foreign]]
    );
    expect(remaining.rows[0].n).toBe(3);
  });

  it('rechecks ACTIVE membership from PostgreSQL and denies a still-valid revoked JWT', async () => {
    const id = `entry-${suffix}-revoked`;
    await entry(id);
    const response = await request(app)
      .delete(
        `/api/execution-control/budget/entries/${id}?initiativeId=${initiativeA}&expectedVersion=1`
      )
      .set('Authorization', `Bearer ${token(revokedA, orgA, 'ADMIN')}`)
      .set('X-Idempotency-Key', `key-${suffix}-revoked`);
    expect(response.status).toBe(403);
    expect(
      (await pool.query(`SELECT count(*)::int n FROM budget_entries WHERE id=$1`, [id])).rows[0].n
    ).toBe(1);
  });

  it('rolls back deletion and audit if the terminal receipt cannot be inserted', async () => {
    const id = `entry-${suffix}-rollback`;
    const key = `force-${suffix}-receipt-failure`;
    await entry(id);
    await pool.query(`CREATE OR REPLACE FUNCTION exe_budget_receipt_forced_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.idempotency_key = '${key}' THEN RAISE EXCEPTION 'forced budget receipt failure'; END IF; RETURN NEW; END $$`);
    await pool.query(
      `CREATE TRIGGER trg_exe_budget_receipt_forced_failure BEFORE INSERT ON execution_budget_delete_receipts FOR EACH ROW EXECUTE FUNCTION exe_budget_receipt_forced_failure()`
    );
    const response = await request(app)
      .delete(
        `/api/execution-control/budget/entries/${id}?initiativeId=${initiativeA}&expectedVersion=1`
      )
      .set('Authorization', `Bearer ${token(adminA, orgA, 'ADMIN')}`)
      .set('X-Idempotency-Key', key);
    expect(response.status).toBe(500);
    expect(
      (await pool.query(`SELECT count(*)::int n FROM budget_entries WHERE id=$1`, [id])).rows[0].n
    ).toBe(1);
    expect(
      (
        await pool.query(
          `SELECT count(*)::int n FROM execution_action_audit WHERE organization_id=$1 AND request_id=$2`,
          [orgA, key]
        )
      ).rows[0].n
    ).toBe(0);
    await pool.query(
      `DROP TRIGGER trg_exe_budget_receipt_forced_failure ON execution_budget_delete_receipts`
    );
  });

  it('keeps command receipts append-only under direct SQL', async () => {
    const row = await pool.query(
      `SELECT receipt_id FROM execution_budget_delete_receipts WHERE organization_id=$1 LIMIT 1`,
      [orgA]
    );
    await expect(
      pool.query(
        `UPDATE execution_budget_delete_receipts SET reason_code='tamper' WHERE receipt_id=$1`,
        [row.rows[0].receipt_id]
      )
    ).rejects.toThrow('append-only');
    await expect(
      pool.query(`DELETE FROM execution_budget_delete_receipts WHERE receipt_id=$1`, [
        row.rows[0].receipt_id,
      ])
    ).rejects.toThrow('append-only');
  });
});
