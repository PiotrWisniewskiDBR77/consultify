/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('../../notificationService.js');

import { materializeInboxItems } from '../../inboxService.js';
import config from '../../../config/Config.js';
import taskRoutes from '../../../routes/pmo/tasks.routes.js';
import { recordMeasurement } from '../../resultsVnext/kpi/kpiMeasurementCommands.js';
import { evaluatePerformanceStatus } from '../../resultsVnext/kpi/targetGeometryEvaluator.js';
import { createTaskFromActionCard } from '../actionCardTaskService.js';
import { ensureActionCardForKpiDeviation } from '../kpiDeviationActionCard.js';

const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)('M1 KPI deviation → Inbox → action card → My Work task (RealPG)', () => {
  const orgId = randomUUID();
  const ownerId = randomUUID();
  const kpiId = randomUUID();
  const versionId = randomUUID();
  const periodStart = '2026-08-01';
  const periodEnd = '2026-08-31';
  let pool: Pool;
  let app: Express;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status,is_active,default_language,created_at)
       VALUES($1,$2,'enterprise','active',1,'en',now())`,
      [orgId, `M1 KPI flow ${orgId}`]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,language,created_at)
       VALUES($1,$2,$3,'unused','KPI','Owner','OWNER','active','en',now())`,
      [ownerId, orgId, `${ownerId}@m1.local`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), orgId, ownerId]
    );
    await pool.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id,organization_id,kpi_code,status,owner_user_id,created_by)
       VALUES($1,$2,'M1.OUTSIDE.LIMIT','active',$3,$3)`,
      [kpiId, orgId, ownerId]
    );
    await pool.query(
      `INSERT INTO rvn_kpi_definition_versions
         (definition_version_id,kpi_id,organization_id,version_number,name,target_geometry,
          target_value,warning_low,critical_low,approval_status,created_by,effective_from)
       VALUES($1,$2,$3,1,'On-time delivery','threshold_min',100,95,90,'approved',$4,now())`,
      [versionId, kpiId, orgId, ownerId]
    );
    await pool.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id=$1 WHERE kpi_id=$2`,
      [versionId, kpiId]
    );
    app = express();
    app.use(express.json());
    app.use('/api/tasks', taskRoutes);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('materializes one owner Inbox card and one idempotent task linked back to that card', async () => {
    const performanceStatus = evaluatePerformanceStatus({
      geometry: 'threshold_min',
      actualValue: 72,
      targetValue: 100,
      warningLow: 95,
      criticalLow: 90,
    });
    expect(performanceStatus).toBe('critical');

    const measurement = await recordMeasurement({
      kpiId,
      definitionVersionId: versionId,
      organizationId: orgId,
      periodStart,
      periodEnd,
      actualValue: 72,
      performanceStatus,
      source: 'M1 full-flow proof',
      recordedBy: ownerId,
      actorEffectiveRole: 'OWNER',
      idempotencyKey: `m1-measurement:${kpiId}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    expect(measurement.outcome).toBe('applied');

    const deviation = await ensureActionCardForKpiDeviation({
      organizationId: orgId,
      actorUserId: ownerId,
      kpiId,
      kpiName: 'On-time delivery',
      unit: '%',
      periodStart,
      periodEnd,
      actualValue: 72,
      targetValue: 100,
      performanceStatus,
      kpiOwnerUserId: ownerId,
    });
    expect(deviation.created).toBe(true);
    expect(deviation.card?.problem).toContain('Deviation: On-time delivery 08.2026');

    await materializeInboxItems(ownerId, orgId);
    const inboxCard = await pool.query<{
      user_id: string;
      source_entity_type: string;
      source_entity_id: string;
    }>(
      `SELECT user_id,source_entity_type,source_entity_id
         FROM canonical_inbox_items
        WHERE organization_id=$1 AND user_id=$2
          AND source_entity_type='action_card' AND source_entity_id=$3`,
      [orgId, ownerId, deviation.card?.id]
    );
    expect(inboxCard.rows).toEqual([
      {
        user_id: ownerId,
        source_entity_type: 'action_card',
        source_entity_id: deviation.card?.id,
      },
    ]);

    const scope = { organizationId: orgId, actorUserId: ownerId };
    const first = await createTaskFromActionCard(scope, deviation.card!.id);
    const second = await createTaskFromActionCard(scope, deviation.card!.id);
    expect(first?.replayed).toBe(false);
    expect(second?.replayed).toBe(true);
    expect(second?.task.id).toBe(first?.task.id);
    expect(first?.source).toEqual({
      type: 'action_card',
      id: deviation.card?.id,
      url: `/action-cards/${deviation.card?.id}`,
    });

    const task = await pool.query<{
      id: string;
      assignee_id: string;
      source_type: string;
      source_id: string;
      description: string;
    }>(
      `SELECT id,assignee_id,source_type,source_id,description
         FROM tasks WHERE organization_id=$1 AND idempotency_key=$2`,
      [orgId, `action-card-task:${deviation.card?.id}`]
    );
    expect(task.rows).toHaveLength(1);
    expect(task.rows[0]).toMatchObject({
      id: first?.task.id,
      assignee_id: ownerId,
      source_type: 'action_card',
      source_id: deviation.card?.id,
    });
    expect(task.rows[0].description).toContain('Owner: KPI Owner');
    expect(task.rows[0].description).toContain('Period: 2026-08-01 – 2026-08-31');
    expect(task.rows[0].description).not.toContain('Główna przyczyna');

    const token = jwt.sign(
      { id: ownerId, email: `${ownerId}@m1.local`, role: 'OWNER', organizationId: orgId },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    const taskDetail = await request(app)
      .get(`/api/tasks/${first?.task.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept-Language', 'en');
    expect(taskDetail.status).toBe(200);
    expect(taskDetail.body).toMatchObject({
      sourceType: 'action_card',
      sourceId: deviation.card?.id,
    });

    await materializeInboxItems(ownerId, orgId);
    const inboxTask = await pool.query<{ source_entity_id: string }>(
      `SELECT source_entity_id FROM canonical_inbox_items
        WHERE organization_id=$1 AND user_id=$2
          AND source_entity_type='task' AND source_entity_id=$3`,
      [orgId, ownerId, first?.task.id]
    );
    expect(inboxTask.rows).toEqual([{ source_entity_id: first?.task.id }]);
  });
});
