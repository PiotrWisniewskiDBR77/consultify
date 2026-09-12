/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';
import { errorHandlerMiddleware } from '../../utils/ErrorHandler.js';

// Real Gateway + signed JWT + independent SQL. No route or database mocks.
describe('CODEX4 E2 action-card close/reopen', { retry: 0 }, () => {
  const org = randomUUID();
  const otherOrg = randomUUID();
  const owner = randomUUID();
  const peer = randomUUID();
  const outsider = randomUUID();
  const app = express();
  let sql: Client;
  const auth = (id: string, organizationId = org) =>
    `Bearer ${jwt.sign(
      {
        id,
        userId: id,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
        email: `${id}@cx4.local`,
      },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    )}`;
  const call = (id: string, action: string, actor = owner, organizationId = org) =>
    request(app)
      .post(`/api/action-cards/${id}/${action}`)
      .set('Authorization', auth(actor, organizationId))
      .send({});
  const row = async (id: string) =>
    (await sql.query('SELECT * FROM action_cards WHERE id=$1', [id])).rows[0];
  const inbox = async (id: string) =>
    (
      await sql.query(
        "SELECT * FROM canonical_inbox_items WHERE source_entity_type='action_card' AND source_entity_id=$1",
        [id]
      )
    ).rows;
  async function create(withInbox = true) {
    const result = await request(app)
      .post('/api/action-cards')
      .set('Authorization', auth(owner))
      .send({
        sourceKind: 'kpi_deviation',
        sourceId: randomUUID(),
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        goalMet: false,
        actionRequired: true,
        problem: 'CX4 restore delivery quality',
        rootCause: 'Delayed review',
        actionText: 'Review the action plan',
        ownerUserId: owner,
        dueDate: '2026-10-01',
        comment: 'Preserve this context',
      });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    const id = result.body.card.id as string;
    if (withInbox)
      await sql.query(
        `INSERT INTO canonical_inbox_items
      (id,user_id,organization_id,item_type,source_entity_type,source_entity_id,title,priority,section,status,source_status,created_at,updated_at)
      VALUES($1,$2,$3,'task','action_card',$4,'CX4 restore delivery quality','high','assigned_tasks','pending','OPEN',NOW(),NOW())`,
        [randomUUID(), owner, org, id]
      );
    return id;
  }
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    const db = new URL(String(process.env.DATABASE_URL));
    expect(['localhost', '127.0.0.1']).toContain(db.hostname);
    expect(db.pathname.startsWith('/cx4_')).toBe(true);
    sql = new Client({ connectionString: db.toString() });
    await sql.connect();
    expect((await sql.query('SELECT version() AS version')).rows[0].version).toContain(
      'PostgreSQL'
    );
    for (const organizationId of [org, otherOrg])
      await sql.query(
        "INSERT INTO organizations(id,name,status,plan) VALUES($1,'CX4 reopen test','active','enterprise')",
        [organizationId]
      );
    for (const [id, organizationId] of [
      [owner, org],
      [peer, org],
      [outsider, otherOrg],
    ]) {
      await sql.query(
        "INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active')",
        [id, organizationId, `${id}@cx4.local`]
      );
      await sql.query(
        "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')",
        [randomUUID(), organizationId, id]
      );
    }
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    app.use(errorHandlerMiddleware);
  }, 60000);
  afterAll(async () => {
    if (!sql) return;
    for (const table of [
      'canonical_inbox_items',
      'notifications',
      'action_cards',
      'organization_members',
      'users',
      'organizations',
    ]) {
      await sql.query(
        `DELETE FROM ${table} WHERE ${table === 'organizations' ? 'id' : 'organization_id'} = ANY($1::text[])`,
        [[org, otherOrg]]
      );
    }
    await sql.end();
  });
  it('close -> reopen restores the same card and its system-closed Inbox item', async () => {
    const id = await create();
    const before = await row(id);
    const beforeInbox = await inbox(id);
    expect((await call(id, 'close')).status).toBe(200);
    expect((await row(id)).status).toBe('CLOSED');
    expect((await inbox(id))[0].status).toBe('resolved');
    const reopened = await call(id, 'reopen', peer);
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect(reopened.body.card.status).toBe('OPEN');
    const after = await row(id);
    expect(after).toMatchObject({
      ...before,
      status: 'OPEN',
      updated_by: peer,
      updated_at: after.updated_at,
    });
    const items = await inbox(id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: beforeInbox[0].id, status: 'pending', resolved_at: null });
    expect(JSON.parse(items[0].metadata_json || '{}').closedBy).toBeUndefined();
    const read = await request(app)
      .get(`/api/action-cards/${id}`)
      .set('Authorization', auth(owner));
    expect(read.status).toBe(200);
    expect(read.body.card.status).toBe('OPEN');
    const stable = await row(id);
    const stableInbox = await inbox(id);
    expect((await call(id, 'reopen', peer)).status).toBe(200);
    expect(await row(id)).toEqual(stable);
    expect(await inbox(id)).toEqual(stableInbox);
  });
  it('foreign organization and missing card match close denial without mutating either table', async () => {
    const id = await create();
    await call(id, 'close');
    const before = await row(id);
    const beforeInbox = await inbox(id);
    expect((await call(id, 'close', outsider, otherOrg)).status).toBe(404);
    expect((await call(id, 'reopen', outsider, otherOrg)).status).toBe(404);
    expect(await row(id)).toEqual(before);
    expect(await inbox(id)).toEqual(beforeInbox);
    expect((await call(randomUUID(), 'reopen')).status).toBe(404);
    const closeAnonymous = await request(app).post(`/api/action-cards/${id}/close`);
    const reopenAnonymous = await request(app).post(`/api/action-cards/${id}/reopen`);
    expect(closeAnonymous.status).toBe(401);
    expect(reopenAnonymous.status).toBe(closeAnonymous.status);
  });
  it('reopening preserves manually resolved Inbox items and handles an unmaterialized card', async () => {
    const id = await create();
    await call(id, 'close');
    await sql.query('UPDATE canonical_inbox_items SET metadata_json=$2 WHERE source_entity_id=$1', [
      id,
      JSON.stringify({ reason: 'user decision' }),
    ]);
    const manual = await inbox(id);
    expect((await call(id, 'reopen')).status).toBe(200);
    expect(await inbox(id)).toEqual(manual);
    const absent = await create(false);
    await call(absent, 'close');
    expect((await call(absent, 'reopen')).status).toBe(200);
    expect((await row(absent)).status).toBe('OPEN');
    expect(await inbox(absent)).toHaveLength(0);
  });
  it('dismissed Inbox items stay dismissed even with stale system metadata', async () => {
    const id = await create();
    await sql.query(
      "UPDATE canonical_inbox_items SET status='dismissed', metadata_json=$2 WHERE source_entity_id=$1",
      [id, JSON.stringify({ closedBy: 'action_card_close', reason: 'manual dismissal' })]
    );
    const before = await inbox(id);
    expect((await call(id, 'close')).status).toBe(200);
    expect((await call(id, 'reopen')).status).toBe(200);
    expect(await inbox(id)).toEqual(before);
  });
  it('both directions roll back when either Inbox or card update fails', async () => {
    const id = await create();
    const trigger = `cx4_fail_${id.replaceAll('-', '')}`;
    await sql.query(
      `CREATE FUNCTION pg_temp.${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id::text = '${id}' OR to_jsonb(NEW)->>'source_entity_id' = '${id}' THEN RAISE EXCEPTION 'CX4 injected card write failure'; END IF; RETURN NEW; END $$`
    );
    let table = 'action_cards';
    const addTrigger = () =>
      sql.query(
        `CREATE TRIGGER ${trigger} BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION pg_temp.${trigger}()`
      );
    const dropTrigger = () => sql.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${table}`);
    try {
      for (const target of ['action_cards', 'canonical_inbox_items']) {
        table = target;
        await call(id, 'reopen');
        for (const action of ['close', 'reopen']) {
          if (action === 'reopen') expect((await call(id, 'close')).status).toBe(200);
          const before = await row(id);
          const beforeInbox = await inbox(id);
          await addTrigger();
          const failed = await call(id, action);
          expect(failed.status).toBe(500);
          expect(await row(id)).toEqual(before);
          expect(await inbox(id)).toEqual(beforeInbox);
          await dropTrigger();
        }
      }
    } finally {
      await dropTrigger();
      await sql.query(`DROP FUNCTION pg_temp.${trigger}()`);
    }
  });
  it('close and reopen serialize behind a locked card and keep Inbox consistent', async () => {
    const id = await create();
    await call(id, 'close');
    const blocker = new Client({ connectionString: process.env.DATABASE_URL });
    await blocker.connect();
    const pending: Promise<any>[] = [];
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM action_cards WHERE id=$1 FOR UPDATE', [id]);
      let reopenDone = false;
      let closeDone = false;
      pending.push(
        call(id, 'reopen').then((r) => {
          reopenDone = true;
          return r;
        })
      );
      pending.push(
        call(id, 'close').then((r) => {
          closeDone = true;
          return r;
        })
      );
      // Confirm both requests reached a real PostgreSQL lock wait, not merely a timer.
      let waiting = 0;
      for (let n = 0; n < 100; n++) {
        waiting = Number(
          (
            await sql.query(
              "SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%action_cards%'"
            )
          ).rows[0].n
        );
        if (waiting >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBeGreaterThanOrEqual(2);
      expect(reopenDone).toBe(false);
      expect(closeDone).toBe(false);
      await blocker.query('COMMIT');
      const results = await Promise.all(pending);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      const card = await row(id);
      const item = (await inbox(id))[0];
      expect(item.status).toBe(card.status === 'CLOSED' ? 'resolved' : 'pending');
      expect(item.source_status).toBe(card.status);
    } finally {
      await blocker.query('ROLLBACK');
      await blocker.end();
      await Promise.allSettled(pending);
    }
  });
  it('retrying a legacy partial close repairs Inbox without changing the closed card', async () => {
    const id = await create();
    await sql.query("UPDATE action_cards SET status='CLOSED' WHERE id=$1", [id]);
    const before = await row(id);
    expect((await call(id, 'close')).status).toBe(200);
    expect(await row(id)).toEqual(before);
    expect((await inbox(id))[0].status).toBe('resolved');
    expect((await call(id, 'reopen')).status).toBe(200);
    expect((await inbox(id))[0].status).toBe('pending');
  });
  it('legacy malformed metadata cannot break close or fabricate system ownership on reopen', async () => {
    const id = await create();
    await sql.query(
      "UPDATE canonical_inbox_items SET metadata_json='not-json' WHERE source_entity_id=$1",
      [id]
    );
    expect((await call(id, 'close')).status).toBe(200);
    expect((await inbox(id))[0].status).toBe('resolved');
    await sql.query(
      "UPDATE canonical_inbox_items SET metadata_json='not-json' WHERE source_entity_id=$1",
      [id]
    );
    const before = await inbox(id);
    expect((await call(id, 'reopen')).status).toBe(200);
    expect(await inbox(id)).toEqual(before);
  });
});
