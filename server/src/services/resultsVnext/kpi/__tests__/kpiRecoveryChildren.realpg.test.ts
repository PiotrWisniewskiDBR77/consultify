/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createRecoveryAction,
  createRecoveryCheckpoint,
  linkRecoveryActionTask,
  resolveRecoveryCheckpoint,
  updateRecoveryAction,
} from '../kpiRecoveryChildCommands.js';

const url = process.env.DATABASE_URL || '';
const real = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && /127\.0\.0\.1|localhost/.test(url);
const tag = `rw2731-${randomUUID().slice(0, 8)}`;
const orgA = `${tag}-org-a`, orgB = `${tag}-org-b`;
const actorA = `${tag}-actor-a`, actorB = `${tag}-actor-b`, foreignOwner = `${tag}-foreign-owner`;
const kpiA = `${tag}-kpi-a`, kpiB = `${tag}-kpi-b`;
const caseA = `${tag}-case-a`, caseB = `${tag}-case-b`;
const cardA = `${tag}-card-a`, cardB = `${tag}-card-b`;
const access = { capabilities: ['*'], platformRole: 'ADMIN' } as any;
const ctx = (overrides: Record<string, unknown> = {}) => ({
  organizationId: orgA, cardId: cardA, actorUserId: actorA,
  actorEffectiveRole: 'ADMIN', access, ...overrides,
});

describe.skipIf(!real)('RESULTS-W27..W31 canonical recovery children (real PostgreSQL)', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 8 });
    for (const [org, actor, kpi, kase, card] of [
      [orgA, actorA, kpiA, caseA, cardA], [orgB, actorB, kpiB, caseB, cardB],
    ]) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [org, org]);
      await pool.query(`INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'ADMIN','active')`,
        [actor, org, `${actor}@test.invalid`]);
      await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status)
        VALUES($1,$2,$3,'ADMIN','ACTIVE')`, [`${actor}-membership`, org, actor]);
      await pool.query(`INSERT INTO initiative_kpis(id,organization_id,name) VALUES($1,$2,$3)`, [kpi, org, kpi]);
      await pool.query(`INSERT INTO kpi_deviation_cases(id,kpi_id,organization_id,period_start,severity,owner_user_id)
        VALUES($1,$2,$3,'2026-08-01','RED',$4)`, [kase, kpi, org, actor]);
      await pool.query(`INSERT INTO kpi_recovery_cards(id,organization_id,deviation_case_id,kpi_id,created_by)
        VALUES($1,$2,$3,$4,$5)`, [card, org, kase, kpi, actor]);
    }
    await pool.query(`INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'MEMBER','active')`,
      [foreignOwner, orgB, `${foreignOwner}@test.invalid`]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status)
      VALUES($1,$2,$3,'MEMBER','ACTIVE')`, [`${foreignOwner}-membership`, orgB, foreignOwner]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DROP TRIGGER IF EXISTS rw2731_fail_event ON rvn_platform_events`);
    await pool.query(`DROP FUNCTION IF EXISTS rw2731_fail_event()`);
    await pool.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN
      (SELECT event_id FROM rvn_platform_events WHERE organization_id IN ($1,$2))`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_platform_events WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM tasks WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_kpi_recovery_checkpoints WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_kpi_recovery_actions WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_time_series WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_recovery_cards WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_deviation_cases WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM initiative_kpis WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2,$3)`, [actorA, actorB, foreignOwner]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('creates exactly once under concurrency and rejects changed-payload/foreign-owner/foreign-card', async () => {
    const key = `${tag}-create-same`;
    const calls = await Promise.all([
      createRecoveryAction({ ...ctx(), actionType: 'IMMEDIATE', title: 'Recover', ownerUserId: actorA, idempotencyKey: key }),
      createRecoveryAction({ ...ctx(), actionType: 'IMMEDIATE', title: 'Recover', ownerUserId: actorA, idempotencyKey: key }),
    ]);
    expect(calls.map((x) => x.outcome).sort()).toEqual(['applied', 'duplicate']);
    expect(new Set(calls.map((x) => x.result.id)).size).toBe(1);
    expect((await pool.query(`SELECT count(*)::int n FROM rvn_kpi_recovery_actions WHERE organization_id=$1`, [orgA])).rows[0].n).toBe(1);
    await expect(createRecoveryAction({ ...ctx(), actionType: 'IMMEDIATE', title: 'Changed',
      ownerUserId: actorA, idempotencyKey: key })).rejects.toMatchObject({ code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT' });
    await expect(createRecoveryAction({ ...ctx(), actionType: 'DURABLE', title: 'Injected owner',
      ownerUserId: foreignOwner, idempotencyKey: `${tag}-foreign-owner` })).rejects.toMatchObject({ code: 'ASSIGNEE_NOT_ACTIVE_MEMBER' });
    await expect(createRecoveryAction({ ...ctx({ organizationId: orgB, actorUserId: actorB, cardId: cardA }),
      actionType: 'DURABLE', title: 'Foreign card', idempotencyKey: `${tag}-foreign-card` })).rejects.toMatchObject({ name: 'AtomicWriteAggregateNotFoundError' });
  });

  it('CAS updates allow one winner and replay authorization denies a revoked actor', async () => {
    const created = await createRecoveryAction({ ...ctx(), actionType: 'DURABLE', title: 'CAS action',
      ownerUserId: actorA, idempotencyKey: `${tag}-cas-create` });
    const races = await Promise.allSettled([
      updateRecoveryAction({ ...ctx(), actionId: created.result.id, expectedVersion: 1,
        status: 'DONE', idempotencyKey: `${tag}-cas-a` }),
      updateRecoveryAction({ ...ctx(), actionId: created.result.id, expectedVersion: 1,
        status: 'CANCELLED', idempotencyKey: `${tag}-cas-b` }),
    ]);
    expect(races.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(races.filter((x) => x.status === 'rejected')).toHaveLength(1);

    const replayKey = `${tag}-replay-auth`;
    await createRecoveryAction({ ...ctx(), actionType: 'IMMEDIATE', title: 'Private replay',
      idempotencyKey: replayKey });
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2`, [orgA, actorA]);
    await expect(createRecoveryAction({ ...ctx(), actionType: 'IMMEDIATE', title: 'Private replay',
      idempotencyKey: replayKey })).rejects.toMatchObject({ name: 'CommandCapabilityDeniedError', code: 'COMMAND_CAPABILITY_DENIED' });
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status)
      VALUES($1,$2,$3,'ADMIN','ACTIVE')`, [`${actorA}-membership-restored`, orgA, actorA]);
  });

  it('links one canonical task atomically, preserves exact owner, and rolls back task+link on event failure', async () => {
    const created = await createRecoveryAction({ ...ctx(), actionType: 'DURABLE', title: 'Task action',
      ownerUserId: actorA, idempotencyKey: `${tag}-task-create` });
    const links = await Promise.all([
      linkRecoveryActionTask({ ...ctx(), actionId: created.result.id, expectedVersion: 1,
        idempotencyKey: `${tag}-task-link` }),
      linkRecoveryActionTask({ ...ctx(), actionId: created.result.id, expectedVersion: 1,
        idempotencyKey: `${tag}-task-link` }),
    ]);
    expect(new Set(links.map((x) => x.result.linkedTaskId)).size).toBe(1);
    const task = await pool.query(`SELECT organization_id,assignee_id,source_type,source_id FROM tasks WHERE id=$1`,
      [links[0].result.linkedTaskId]);
    expect(task.rows[0]).toMatchObject({ organization_id: orgA, assignee_id: actorA,
      source_type: 'kpi_recovery_action', source_id: created.result.id });

    const rollbackAction = await createRecoveryAction({ ...ctx(), actionType: 'IMMEDIATE', title: 'Rollback action',
      ownerUserId: actorA, idempotencyKey: `${tag}-rollback-create` });
    await pool.query(`CREATE FUNCTION rw2731_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.event_type='kpi.recovery_action_task_linked' THEN RAISE EXCEPTION 'forced event failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER rw2731_fail_event BEFORE INSERT ON rvn_platform_events
      FOR EACH ROW EXECUTE FUNCTION rw2731_fail_event()`);
    await expect(linkRecoveryActionTask({ ...ctx(), actionId: rollbackAction.result.id, expectedVersion: 1,
      idempotencyKey: `${tag}-rollback-link` })).rejects.toThrow('forced event failure');
    await pool.query(`DROP TRIGGER rw2731_fail_event ON rvn_platform_events`);
    await pool.query(`DROP FUNCTION rw2731_fail_event()`);
    expect((await pool.query(`SELECT linked_task_id FROM rvn_kpi_recovery_actions WHERE action_id=$1`,
      [rollbackAction.result.id])).rows[0].linked_task_id).toBeNull();
    expect((await pool.query(`SELECT count(*)::int n FROM tasks WHERE source_id=$1`,
      [rollbackAction.result.id])).rows[0].n).toBe(0);
  });

  it('checkpoint create/replay is exact; foreign measurement is rejected and concurrent resolve has one winner', async () => {
    const key = `${tag}-checkpoint-create`;
    const [a, b] = await Promise.all([
      createRecoveryCheckpoint({ ...ctx(), checkpointDate: '2026-08-25', notes: 'Measure', idempotencyKey: key }),
      createRecoveryCheckpoint({ ...ctx(), checkpointDate: '2026-08-25', notes: 'Measure', idempotencyKey: key }),
    ]);
    expect(new Set([a.result.id, b.result.id]).size).toBe(1);
    const foreignMeasurement = `${tag}-measurement-b`;
    await pool.query(`INSERT INTO kpi_time_series(id,kpi_id,organization_id,value,period_start)
      VALUES($1,$2,$3,10,'2026-08-20')`, [foreignMeasurement, kpiB, orgB]);
    await expect(resolveRecoveryCheckpoint({ ...ctx(), checkpointId: a.result.id, expectedVersion: 1,
      status: 'MET', kpiTimeSeriesId: foreignMeasurement, idempotencyKey: `${tag}-foreign-measurement` }))
      .rejects.toMatchObject({ name: 'AtomicWriteAggregateNotFoundError' });
    const measurement = `${tag}-measurement-a`;
    await pool.query(`INSERT INTO kpi_time_series(id,kpi_id,organization_id,value,period_start)
      VALUES($1,$2,$3,12,'2026-08-21')`, [measurement, kpiA, orgA]);
    const races = await Promise.allSettled([
      resolveRecoveryCheckpoint({ ...ctx(), checkpointId: a.result.id, expectedVersion: 1,
        status: 'MET', kpiTimeSeriesId: measurement, idempotencyKey: `${tag}-resolve-a` }),
      resolveRecoveryCheckpoint({ ...ctx(), checkpointId: a.result.id, expectedVersion: 1,
        status: 'MISSED', idempotencyKey: `${tag}-resolve-b` }),
    ]);
    expect(races.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(races.filter((x) => x.status === 'rejected')).toHaveLength(1);
  });
});
