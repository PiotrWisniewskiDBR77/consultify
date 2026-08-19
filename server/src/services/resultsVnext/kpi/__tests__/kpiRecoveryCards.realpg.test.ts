/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  closeRecoveryCard,
  createRecoveryCard,
  updateRecoveryCard,
} from '../kpiRecoveryCardCommands.js';

const url = process.env.DATABASE_URL || '';
const real = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && /127\.0\.0\.1|localhost/.test(url);
const tag = `rw252632-${randomUUID().slice(0, 8)}`;
const orgA = `${tag}-org-a`, orgB = `${tag}-org-b`;
const actorA = `${tag}-actor-a`, actorB = `${tag}-actor-b`;
const kpiA = `${tag}-kpi-a`, kpiB = `${tag}-kpi-b`;
const caseA = `${tag}-case-a`, caseB = `${tag}-case-b`;
const access = { capabilities: ['*'], platformRole: 'ADMIN' } as any;
const ctx = (overrides: Record<string, unknown> = {}) => ({
  organizationId: orgA, actorUserId: actorA, actorEffectiveRole: 'ADMIN', access, ...overrides,
});

describe.skipIf(!real)('RESULTS-W25/W26/W32 canonical recovery cards (real PostgreSQL)', () => {
  let pool: Pool;
  let cardId = '';

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 8 });
    for (const [org, actor, kpi, kase] of [
      [orgA, actorA, kpiA, caseA], [orgB, actorB, kpiB, caseB],
    ]) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [org, org]);
      await pool.query(`INSERT INTO users(id,organization_id,email,role,status) VALUES($1,$2,$3,'ADMIN','active')`,
        [actor, org, `${actor}@test.invalid`]);
      await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status)
        VALUES($1,$2,$3,'ADMIN','ACTIVE')`, [`${actor}-membership`, org, actor]);
      await pool.query(`INSERT INTO initiative_kpis
        (id,organization_id,name,target_value,direction,threshold_mode,amber_threshold_pct,red_threshold_pct)
        VALUES($1,$2,$3,100,'HIGHER_IS_BETTER','PERCENT_FROM_TARGET',0.1,0.2)`, [kpi, org, kpi]);
      await pool.query(`INSERT INTO kpi_deviation_cases(id,kpi_id,organization_id,period_start,severity,owner_user_id)
        VALUES($1,$2,$3,'2026-08-01','RED',$4)`, [kase, kpi, org, actor]);
    }
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DROP TRIGGER IF EXISTS rw252632_fail_event ON rvn_platform_events`);
    await pool.query(`DROP FUNCTION IF EXISTS rw252632_fail_event()`);
    await pool.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN
      (SELECT event_id FROM rvn_platform_events WHERE organization_id IN ($1,$2))`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_platform_events WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_time_series WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_kpi_recovery_checkpoints WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_kpi_recovery_actions WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_recovery_cards WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_deviation_cases WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM initiative_kpis WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [actorA, actorB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('creates once under concurrency and rejects changed replay, foreign case and revoked replay', async () => {
    const key = `${tag}-create`;
    const [first, second] = await Promise.all([
      createRecoveryCard({ ...ctx(), caseId: caseA, initialPatch: { hypothesis: 'Initial pinned cause', priority: 'HIGH' }, idempotencyKey: key }),
      createRecoveryCard({ ...ctx(), caseId: caseA, initialPatch: { hypothesis: 'Initial pinned cause', priority: 'HIGH' }, idempotencyKey: key }),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(['applied', 'duplicate']);
    expect(first.result.id).toBe(second.result.id);
    cardId = first.result.id;
    expect(first.result).toMatchObject({ hypothesis: 'Initial pinned cause', priority: 'HIGH', version: 2 });
    expect((await pool.query(`SELECT count(*)::int n FROM kpi_recovery_cards WHERE deviation_case_id=$1`, [caseA])).rows[0].n).toBe(1);
    await expect(createRecoveryCard({ ...ctx(), caseId: caseA, initialPatch: { hypothesis: 'Initial pinned cause', priority: 'HIGH' },
      idempotencyKey: `${tag}-other-key` })).rejects.toMatchObject({ code: 'RECOVERY_CARD_ALREADY_EXISTS' });
    await expect(createRecoveryCard({ ...ctx({ organizationId: orgB, actorUserId: actorB }), caseId: caseA,
      idempotencyKey: `${tag}-foreign` })).rejects.toMatchObject({ name: 'AtomicWriteAggregateNotFoundError' });
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2`, [orgA, actorA]);
    await expect(createRecoveryCard({ ...ctx(), caseId: caseA, idempotencyKey: key }))
      .rejects.toMatchObject({ name: 'CommandCapabilityDeniedError' });
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status)
      VALUES($1,$2,$3,'ADMIN','ACTIVE')`, [`${actorA}-membership-restored`, orgA, actorA]);
  });

  it('updates with CAS, exact replay and event-failure rollback', async () => {
    const updated = await updateRecoveryCard({ ...ctx(), cardId, expectedVersion: 2,
      patch: { hypothesis: 'Pinned cause', priority: 'HIGH' }, idempotencyKey: `${tag}-update` });
    expect(updated.result).toMatchObject({ hypothesis: 'Pinned cause', priority: 'HIGH', version: 3 });
    const replay = await updateRecoveryCard({ ...ctx(), cardId, expectedVersion: 2,
      patch: { hypothesis: 'Pinned cause', priority: 'HIGH' }, idempotencyKey: `${tag}-update` });
    expect(replay.outcome).toBe('duplicate');
    await expect(updateRecoveryCard({ ...ctx(), cardId, expectedVersion: 2,
      patch: { hypothesis: 'Changed' }, idempotencyKey: `${tag}-update` }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_FINGERPRINT_CONFLICT' });

    await pool.query(`CREATE FUNCTION rw252632_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.event_type='kpi.recovery_card_updated' THEN RAISE EXCEPTION 'forced card event failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER rw252632_fail_event BEFORE INSERT ON rvn_platform_events
      FOR EACH ROW EXECUTE FUNCTION rw252632_fail_event()`);
    await expect(updateRecoveryCard({ ...ctx(), cardId, expectedVersion: 3,
      patch: { hypothesis: 'Must rollback' }, idempotencyKey: `${tag}-rollback` })).rejects.toThrow('forced card event failure');
    await pool.query(`DROP TRIGGER rw252632_fail_event ON rvn_platform_events`);
    await pool.query(`DROP FUNCTION rw252632_fail_event()`);
    expect((await pool.query(`SELECT hypothesis,version FROM kpi_recovery_cards WHERE id=$1`, [cardId])).rows[0])
      .toMatchObject({ hypothesis: 'Pinned cause', version: 3 });
  });

  it('closes only from a fresh green measurement and replays the identical receipt', async () => {
    await expect(closeRecoveryCard({ ...ctx(), cardId, expectedVersion: 3,
      effectivenessRating: 'EFFECTIVE', idempotencyKey: `${tag}-no-evidence` }))
      .rejects.toMatchObject({ code: 'RECOVERY_CARD_CLOSE_MISSING_EVIDENCE' });
    await pool.query(`INSERT INTO kpi_time_series(id,kpi_id,organization_id,value,period_start,created_at)
      VALUES($1,$2,$3,100,'2026-08-20',clock_timestamp()+interval '1 second')`,
      [`${tag}-measurement`, kpiA, orgA]);
    const key = `${tag}-close`;
    const closed = await closeRecoveryCard({ ...ctx(), cardId, expectedVersion: 3,
      evidenceText: 'Fresh KPI returned to target', effectivenessRating: 'EFFECTIVE', idempotencyKey: key });
    expect(closed.result).toMatchObject({ lifecycleStatus: 'CLOSED', effectivenessRating: 'EFFECTIVE', version: 4 });
    const replay = await closeRecoveryCard({ ...ctx(), cardId, expectedVersion: 3,
      evidenceText: 'Fresh KPI returned to target', effectivenessRating: 'EFFECTIVE', idempotencyKey: key });
    expect(replay.outcome).toBe('duplicate');
    expect(replay.result.id).toBe(cardId);
  });
});
