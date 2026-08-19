/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { verifyToken } from '../../server/src/middleware/auth.middleware.js';
import { requireOrgAccess } from '../../server/src/middleware/rbac.middleware.js';
import recoveryRoutes from '../../server/src/routes/resultsVnext/kpiRecoveryChildren.routes.js';
import deviationRoutes from '../../server/src/routes/resultsVnext/kpiDeviation.routes.js';
import resultsRoutes from '../../server/src/routes/v8/results.routes.js';
import { createLegacyCutoverGuard } from '../../server/src/services/legacyCutover/legacyCutoverKernel.js';
import { RESULTS_CUTOVER } from '../../server/src/services/legacyCutover/registry/results.js';

const url = process.env.DATABASE_URL || '';
const real = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && /127\.0\.0\.1|localhost/.test(url);
const tag = `rw-mounted-${randomUUID().slice(0, 8)}`;
const orgA = `${tag}-org-a`, orgB = `${tag}-org-b`;
const actorA = `${tag}-actor-a`, actorB = `${tag}-actor-b`, foreignOwner = `${tag}-owner-b`;
const kpiA = `${tag}-kpi-a`, kpiB = `${tag}-kpi-b`;
const caseA = `${tag}-case-a`, caseB = `${tag}-case-b`;
const cardA = `${tag}-card-a`, cardB = `${tag}-card-b`;
const kpiParent = `${tag}-kpi-parent`, caseParent = randomUUID();

describe.skipIf(!real)('mounted signed-JWT RESULTS-W27..W31 cutover (real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;
  const token = (id = actorA, organizationId = orgA) => jwt.sign(
    { id, organizationId, email: `${id}@test.invalid`, role: 'ADMIN' }, process.env.JWT_SECRET as string, { expiresIn: '10m' }
  );
  const auth = (id = actorA, org = orgA) => ({ Authorization: `Bearer ${token(id, org)}` });

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
    await pool.query(`INSERT INTO initiative_kpis
      (id,organization_id,name,target_value,direction,threshold_mode,amber_threshold_pct,red_threshold_pct)
      VALUES($1,$2,$3,100,'HIGHER_IS_BETTER','PERCENT_FROM_TARGET',0.1,0.2)`, [kpiParent, orgA, kpiParent]);
    await pool.query(`INSERT INTO kpi_deviation_cases(id,kpi_id,organization_id,period_start,severity,owner_user_id)
      VALUES($1,$2,$3,'2026-08-01','RED',$4)`, [caseParent, kpiParent, orgA, actorA]);

    app = express();
    app.use(express.json());
    app.use('/api/vnext/results/kpi/deviation-cases', deviationRoutes);
    app.use('/api/vnext/results/kpi/recovery-cards', recoveryRoutes);
    app.use('/api/v8/results', verifyToken, requireOrgAccess(), (req: any, _res, next) => {
      req.v8Context = { organizationId: req.user.organizationId, userId: req.user.id, userRole: req.user.role };
      next();
    }, createLegacyCutoverGuard(RESULTS_CUTOVER), resultsRoutes);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM legacy_cutover_signal_intents WHERE organization_id IN ($1,$2)`, [orgA, orgB]).catch(() => undefined);
    await pool.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN
      (SELECT event_id FROM rvn_platform_events WHERE organization_id IN ($1,$2))`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_platform_events WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM tasks WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_kpi_recovery_checkpoints WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_kpi_recovery_actions WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM rvn_kpi_recovery_backfill_receipts WHERE organization_id IN ($1,$2)`, [orgA, orgB]).catch(() => undefined);
    await pool.query(`DELETE FROM kpi_recovery_checkpoints WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_recovery_actions WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_time_series WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_recovery_cards WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM kpi_deviation_cases WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM initiative_kpis WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM users WHERE id IN ($1,$2,$3)`, [actorA, actorB, foreignOwner]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('mounts all five canonical commands and confirms each through legacy-card cold read', async () => {
    const create = await request(app).post(`/api/vnext/results/kpi/recovery-cards/${cardA}/actions`)
      .set(auth()).send({ title: 'Mounted recovery', actionType: 'DURABLE', ownerUserId: actorA,
        idempotencyKey: `${tag}-mounted-action` }).expect(201);
    const action = create.body.action;
    expect(action).toMatchObject({ title: 'Mounted recovery', rowVersion: 1 });
    const update = await request(app).patch(`/api/vnext/results/kpi/recovery-cards/${cardA}/actions/${action.id}`)
      .set(auth()).send({ expectedVersion: 1, status: 'DONE', idempotencyKey: `${tag}-mounted-update` }).expect(200);
    expect(update.body.action).toMatchObject({ status: 'DONE', rowVersion: 2 });
    const link = await request(app).post(`/api/vnext/results/kpi/recovery-cards/${cardA}/actions/${action.id}/link-task`)
      .set(auth()).send({ expectedVersion: 2, idempotencyKey: `${tag}-mounted-link` }).expect(200);
    expect(link.body).toMatchObject({ linked: true, action: { rowVersion: 3, taskLinkStatus: 'LINKED' } });

    const cp = await request(app).post(`/api/vnext/results/kpi/recovery-cards/${cardA}/checkpoints`)
      .set(auth()).send({ checkpointDate: '2026-08-28', notes: 'Mounted checkpoint',
        idempotencyKey: `${tag}-mounted-cp` }).expect(201);
    const resolved = await request(app).patch(`/api/vnext/results/kpi/recovery-cards/${cardA}/checkpoints/${cp.body.checkpoint.id}`)
      .set(auth()).send({ expectedVersion: 1, status: 'MISSED', idempotencyKey: `${tag}-mounted-resolve` }).expect(200);
    expect(resolved.body.checkpoint).toMatchObject({ status: 'MISSED', rowVersion: 2 });

    const cold = await request(app).get(`/api/v8/results/deviation-cases/${caseA}/recovery-card`).set(auth()).expect(200);
    expect(cold.body.data.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: action.id, status: 'DONE', linkedTaskId: link.body.linkedTaskId, rowVersion: 3 }),
    ]));
    expect(cold.body.data.checkpoints).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: cp.body.checkpoint.id, status: 'MISSED', rowVersion: 2 }),
    ]));
  });

  it('mounts canonical parent create/edit/close and retires W25/W26/W32 before legacy mutation', async () => {
    const created = await request(app).post(`/api/vnext/results/kpi/deviation-cases/${caseParent}/recovery-card`)
      .set(auth()).send({ hypothesis: 'Mounted initial cause', priority: 'HIGH',
        idempotencyKey: `${tag}-parent-create` }).expect(201);
    const parentCard = created.body.card;
    expect(parentCard).toMatchObject({ deviationCaseId: caseParent, hypothesis: 'Mounted initial cause',
      priority: 'HIGH', version: 2, lifecycleStatus: 'ACTIVE' });
    const replay = await request(app).post(`/api/vnext/results/kpi/deviation-cases/${caseParent}/recovery-card`)
      .set(auth()).send({ hypothesis: 'Mounted initial cause', priority: 'HIGH',
        idempotencyKey: `${tag}-parent-create` }).expect(200);
    expect(replay.body).toMatchObject({ outcome: 'duplicate', card: { id: parentCard.id } });

    const updated = await request(app).patch(`/api/vnext/results/kpi/recovery-cards/${parentCard.id}`)
      .set(auth()).send({ expectedVersion: 2, hypothesis: 'Mounted canonical cause', priority: 'HIGH',
        idempotencyKey: `${tag}-parent-update` }).expect(200);
    expect(updated.body.card).toMatchObject({ hypothesis: 'Mounted canonical cause', version: 3 });
    await pool.query(`INSERT INTO kpi_time_series(id,kpi_id,organization_id,value,period_start,created_at)
      VALUES($1,$2,$3,100,'2026-08-20',clock_timestamp()+interval '1 second')`,
      [`${tag}-parent-measurement`, kpiParent, orgA]);
    const closed = await request(app).post(`/api/vnext/results/kpi/recovery-cards/${parentCard.id}/close`)
      .set(auth()).send({ expectedVersion: 3, evidenceText: 'Mounted target recovery', effectivenessRating: 'EFFECTIVE',
        idempotencyKey: `${tag}-parent-close` }).expect(200);
    expect(closed.body.card).toMatchObject({ lifecycleStatus: 'CLOSED', version: 4 });
    const cold = await request(app).get(`/api/v8/results/deviation-cases/${caseParent}/recovery-card`).set(auth()).expect(200);
    expect(cold.body.data).toMatchObject({ id: parentCard.id, hypothesis: 'Mounted canonical cause',
      lifecycleStatus: 'CLOSED', effectivenessRating: 'EFFECTIVE', version: 4 });

    const before = await pool.query(`SELECT to_jsonb(c) card FROM kpi_recovery_cards c WHERE id=$1`, [parentCard.id]);
    await request(app).post(`/api/v8/results/deviation-cases/${caseParent}/recovery-card`).set(auth()).send({}).expect(410);
    await request(app).put(`/api/v8/results/recovery-cards/${parentCard.id}`).set(auth()).send({ version: 3, hypothesis: 'legacy' }).expect(410);
    await request(app).post(`/api/v8/results/recovery-cards/${parentCard.id}/close`).set(auth()).send({ version: 3,
      evidenceText: 'legacy', effectivenessRating: 'EFFECTIVE' }).expect(410);
    const after = await pool.query(`SELECT to_jsonb(c) card FROM kpi_recovery_cards c WHERE id=$1`, [parentCard.id]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    const telemetry = await pool.query(`SELECT DISTINCT writer_id FROM legacy_cutover_usage_events
      WHERE organization_id=$1 AND writer_id=ANY($2::text[])`, [orgA, ['RESULTS-W25','RESULTS-W26','RESULTS-W32']]);
    expect(telemetry.rows.map((row) => row.writer_id).sort()).toEqual(['RESULTS-W25','RESULTS-W26','RESULTS-W32']);
  });

  it('returns exact mounted auth/tenant errors with zero mutation', async () => {
    const before = Number((await pool.query(`SELECT count(*) n FROM rvn_kpi_recovery_actions WHERE organization_id=$1`, [orgA])).rows[0].n);
    const foreignOwnerResponse = await request(app).post(`/api/vnext/results/kpi/recovery-cards/${cardA}/actions`)
      .set(auth()).send({ title: 'Bad owner', actionType: 'IMMEDIATE', ownerUserId: foreignOwner,
        idempotencyKey: `${tag}-mounted-owner-bad` }).expect(409);
    expect(foreignOwnerResponse.body.code).toBe('ASSIGNEE_NOT_ACTIVE_MEMBER');
    await request(app).post(`/api/vnext/results/kpi/recovery-cards/${cardA}/actions`)
      .set(auth(actorB, orgB)).send({ title: 'Foreign card', actionType: 'IMMEDIATE',
        idempotencyKey: `${tag}-mounted-card-bad` }).expect(404);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2`, [orgA, actorA]);
    const revoked = await request(app).post(`/api/vnext/results/kpi/recovery-cards/${cardA}/actions`)
      .set(auth()).send({ title: 'Revoked', actionType: 'IMMEDIATE',
        idempotencyKey: `${tag}-mounted-revoked` }).expect(403);
    expect(revoked.body.code).toBe('COMMAND_CAPABILITY_DENIED');
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status)
      VALUES($1,$2,$3,'ADMIN','ACTIVE')`, [`${actorA}-mounted-restored`, orgA, actorA]);
    expect(Number((await pool.query(`SELECT count(*) n FROM rvn_kpi_recovery_actions WHERE organization_id=$1`, [orgA])).rows[0].n)).toBe(before);
  });

  it('tenant composite FKs reject direct foreign card, task and measurement references', async () => {
    await expect(pool.query(`INSERT INTO rvn_kpi_recovery_actions
      (action_id,organization_id,recovery_card_id,action_type,title,created_by)
      VALUES($1,$2,$3,'IMMEDIATE','bad card',$4)`, [`${tag}-bad-card`, orgB, cardA, actorB]))
      .rejects.toMatchObject({ code: '23503' });
    const foreignTask = `${tag}-foreign-task`;
    await pool.query(`INSERT INTO tasks(id,organization_id,title,created_by) VALUES($1,$2,'foreign',$3)`,
      [foreignTask, orgB, actorB]);
    await expect(pool.query(`INSERT INTO rvn_kpi_recovery_actions
      (action_id,organization_id,recovery_card_id,action_type,title,linked_task_id,created_by)
      VALUES($1,$2,$3,'IMMEDIATE','bad task',$4,$5)`, [`${tag}-bad-task`, orgA, cardA, foreignTask, actorA]))
      .rejects.toMatchObject({ code: '23503' });
    const foreignMeasurement = `${tag}-foreign-measurement`;
    await pool.query(`INSERT INTO kpi_time_series(id,kpi_id,organization_id,value,period_start)
      VALUES($1,$2,$3,1,'2026-08-01')`, [foreignMeasurement, kpiB, orgB]);
    await expect(pool.query(`INSERT INTO rvn_kpi_recovery_checkpoints
      (checkpoint_id,organization_id,recovery_card_id,checkpoint_date,status,kpi_time_series_id,created_by)
      VALUES($1,$2,$3,'2026-08-30','MET',$4,$5)`, [`${tag}-bad-measurement`, orgA, cardA, foreignMeasurement, actorA]))
      .rejects.toMatchObject({ code: '23503' });
  });

  it('all five legacy doors return 410 before mutation and emit per-writer telemetry', async () => {
    const actionId = `${tag}-legacy-action`, checkpointId = `${tag}-legacy-checkpoint`;
    await pool.query(`DELETE FROM kpi_recovery_actions WHERE id=$1`, [actionId]);
    await pool.query(`DELETE FROM kpi_recovery_checkpoints WHERE id=$1`, [checkpointId]);
    await pool.query(`INSERT INTO kpi_recovery_actions(id,organization_id,recovery_card_id,action_type,title,created_by)
      VALUES($1,$2,$3,'IMMEDIATE','legacy',$4)`, [actionId, orgA, cardA, actorA]);
    await pool.query(`INSERT INTO kpi_recovery_checkpoints(id,organization_id,recovery_card_id,checkpoint_date,created_by)
      VALUES($1,$2,$3,'2026-08-29',$4)`, [checkpointId, orgA, cardA, actorA]);
    const before = await pool.query(`SELECT
      (SELECT count(*) FROM kpi_recovery_actions WHERE organization_id=$1) actions,
      (SELECT count(*) FROM kpi_recovery_checkpoints WHERE organization_id=$1) checkpoints,
      (SELECT count(*) FROM tasks WHERE organization_id=$1) tasks`, [orgA]);
    const calls: Array<[string, string]> = [
      ['post', `/api/v8/results/recovery-cards/${cardA}/actions`],
      ['put', `/api/v8/results/recovery-cards/${cardA}/actions/${actionId}`],
      ['post', `/api/v8/results/recovery-cards/${cardA}/actions/${actionId}/link-task`],
      ['post', `/api/v8/results/recovery-cards/${cardA}/checkpoints`],
      ['put', `/api/v8/results/recovery-cards/${cardA}/checkpoints/${checkpointId}/resolve`],
    ];
    for (const [method, endpoint] of calls) {
      await (request(app) as any)[method](endpoint).set(auth()).send({}).expect(410);
    }
    const after = await pool.query(`SELECT
      (SELECT count(*) FROM kpi_recovery_actions WHERE organization_id=$1) actions,
      (SELECT count(*) FROM kpi_recovery_checkpoints WHERE organization_id=$1) checkpoints,
      (SELECT count(*) FROM tasks WHERE organization_id=$1) tasks`, [orgA]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    const telemetry = await pool.query(`SELECT DISTINCT writer_id FROM legacy_cutover_usage_events
      WHERE organization_id=$1 AND writer_id=ANY($2::text[])`, [orgA,
      ['RESULTS-W27','RESULTS-W28','RESULTS-W29','RESULTS-W30','RESULTS-W31']]);
    expect(telemetry.rows.map((r) => r.writer_id).sort()).toEqual(
      ['RESULTS-W27','RESULTS-W28','RESULTS-W29','RESULTS-W30','RESULTS-W31']
    );
  });

  it('migration replays cleanly and fails closed on full-payload backfill mismatch', async () => {
    const sql = fs.readFileSync(path.resolve(process.cwd(), 'server/migrations/20261036_rvn_kpi_recovery_children.sql'), 'utf8');
    await expect(pool.query(sql)).resolves.toBeDefined();
    const adoptedAction = `${tag}-legacy-action`;
    const adoptedCheckpoint = `${tag}-legacy-checkpoint`;
    const adoptedTask = `${tag}-adopted-task`;
    await pool.query(`INSERT INTO tasks(id,organization_id,title,created_by) VALUES($1,$2,'adopted',$3)`,
      [adoptedTask, orgA, actorA]);
    await pool.query(`UPDATE rvn_kpi_recovery_actions
      SET status='DONE', linked_task_id=$2, task_link_status='LINKED', row_version=3, updated_at=now()
      WHERE action_id=$1`, [adoptedAction, adoptedTask]);
    await pool.query(`UPDATE rvn_kpi_recovery_checkpoints
      SET status='MISSED', row_version=2, resolved_at=now() WHERE checkpoint_id=$1`, [adoptedCheckpoint]);
    const canonicalBeforeReplay = await pool.query(`SELECT
      (SELECT to_jsonb(a) FROM rvn_kpi_recovery_actions a WHERE action_id=$1) action,
      (SELECT to_jsonb(c) FROM rvn_kpi_recovery_checkpoints c WHERE checkpoint_id=$2) checkpoint`,
      [adoptedAction, adoptedCheckpoint]);
    await expect(pool.query(sql)).resolves.toBeDefined();
    const canonicalAfterReplay = await pool.query(`SELECT
      (SELECT to_jsonb(a) FROM rvn_kpi_recovery_actions a WHERE action_id=$1) action,
      (SELECT to_jsonb(c) FROM rvn_kpi_recovery_checkpoints c WHERE checkpoint_id=$2) checkpoint`,
      [adoptedAction, adoptedCheckpoint]);
    expect(canonicalAfterReplay.rows[0]).toEqual(canonicalBeforeReplay.rows[0]);
    const legacyId = `${tag}-migration-conflict`;
    await pool.query(`INSERT INTO kpi_recovery_actions(id,organization_id,recovery_card_id,action_type,title,status,created_by)
      VALUES($1,$2,$3,'IMMEDIATE','legacy-title','OPEN',$4)`, [legacyId, orgA, cardA, actorA]);
    await pool.query(`INSERT INTO rvn_kpi_recovery_actions(action_id,organization_id,recovery_card_id,action_type,title,status,created_by)
      VALUES($1,$2,$3,'IMMEDIATE','different-title','DONE',$4)`, [legacyId, orgA, cardA, actorA]);
    await expect(pool.query(sql)).rejects.toThrow('backfill identity/payload conflict');
  });
});
