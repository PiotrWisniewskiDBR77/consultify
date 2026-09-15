#!/usr/bin/env node
/**
 * Idempotent S1.3 fixture: an English KPI result outside its limit produces
 * the owner's Inbox action card and a My Work task linked back to that card.
 *
 * CTO usage:
 *   KPI_DEVIATION_SEED_CONFIRM=SEED_KPI_DEVIATION \
 *   KPI_DEVIATION_SEED_ORGANIZATION_ID=<org uuid> \
 *   KPI_DEVIATION_SEED_OWNER_ID=<active user uuid> \
 *   DATABASE_URL=<explicit target> \
 *   DB_TYPE=postgres NODE_ENV=production \
 *   npx tsx scripts/dev/seed-kpi-deviation.mjs seed
 *
 * Run `readback` with the same org/owner variables to verify without writing.
 * The script never deletes data, changes a user/org or changes feature flags.
 */
import { createHash } from 'node:crypto';

import pg from 'pg';

import { resetConnection } from '../../server/src/database/Database.js';
import { createTaskFromActionCard } from '../../server/src/services/actionCard/actionCardTaskService.js';
import {
  buildKpiDeviationSourceId,
  ensureActionCardForKpiDeviation,
} from '../../server/src/services/actionCard/kpiDeviationActionCard.js';
import { materializeInboxItems } from '../../server/src/services/inboxService.js';
import { recordMeasurement } from '../../server/src/services/resultsVnext/kpi/kpiMeasurementCommands.js';
import { evaluatePerformanceStatus } from '../../server/src/services/resultsVnext/kpi/targetGeometryEvaluator.js';

const command = process.argv[2] ?? 'readback';
const databaseUrl = process.env.DATABASE_URL ?? '';
const organizationId = process.env.KPI_DEVIATION_SEED_ORGANIZATION_ID ?? '';
const ownerId = process.env.KPI_DEVIATION_SEED_OWNER_ID ?? '';
const confirm = process.env.KPI_DEVIATION_SEED_CONFIRM ?? '';
const periodStart = '2026-08-01';
const periodEnd = '2026-08-31';

function fail(message) {
  throw new Error(`[seed-kpi-deviation] BLOCKED: ${message}`);
}

function stableUuid(label) {
  const hex = createHash('sha256').update(`${organizationId}:${label}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

if (!['seed', 'readback'].includes(command)) fail(`unsupported command ${command}`);
if (!databaseUrl) fail('DATABASE_URL is required');
if (!organizationId || !ownerId) fail('organization and owner IDs are required');
if (command === 'seed' && confirm !== 'SEED_KPI_DEVIATION') {
  fail('seed requires KPI_DEVIATION_SEED_CONFIRM=SEED_KPI_DEVIATION');
}

const ids = Object.freeze({
  kpi: stableUuid('kpi'),
  version: stableUuid('definition-version'),
});
const sourceId = buildKpiDeviationSourceId(ids.kpi, periodStart, periodEnd);
const pool = new pg.Pool({ connectionString: databaseUrl });

async function qualifyTarget() {
  const result = await pool.query(
    `SELECT u.id,u.status,u.language,o.id AS organization_id,o.status AS organization_status,
            o.default_language
       FROM users u JOIN organizations o ON o.id=u.organization_id
      WHERE u.id=$1 AND o.id=$2`,
    [ownerId, organizationId]
  );
  const row = result.rows[0];
  if (!row) fail('owner does not belong to the requested organization');
  if (String(row.status).toLowerCase() !== 'active') fail('owner user is not active');
  if (String(row.organization_status).toLowerCase() !== 'active') fail('organization is not active');
  const locale = String(row.language || row.default_language || 'en').toLowerCase();
  if (!locale.startsWith('en')) fail('the selected owner must resolve to English for this EN fixture');
}

async function seedDefinition() {
  await pool.query(
    `INSERT INTO rvn_kpi_definitions
       (kpi_id,organization_id,kpi_code,status,owner_user_id,created_by)
     VALUES($1,$2,'DEMO.KPI.OUTSIDE_LIMIT','active',$3,$3)
     ON CONFLICT (kpi_id) DO NOTHING`,
    [ids.kpi, organizationId, ownerId]
  );
  await pool.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id,kpi_id,organization_id,version_number,name,target_geometry,
        target_value,warning_low,critical_low,approval_status,created_by,effective_from)
     VALUES($1,$2,$3,1,'On-time delivery','threshold_min',100,95,90,'approved',$4,'2026-01-01')
     ON CONFLICT (definition_version_id) DO NOTHING`,
    [ids.version, ids.kpi, organizationId, ownerId]
  );
  await pool.query(
    `UPDATE rvn_kpi_definitions
        SET current_definition_version_id=$1,owner_user_id=$2
      WHERE kpi_id=$3 AND organization_id=$4`,
    [ids.version, ownerId, ids.kpi, organizationId]
  );
}

async function seedFlow() {
  await seedDefinition();
  const performanceStatus = evaluatePerformanceStatus({
    geometry: 'threshold_min',
    actualValue: 72,
    targetValue: 100,
    warningLow: 95,
    criticalLow: 90,
  });
  if (performanceStatus !== 'critical') fail(`unexpected performance status ${performanceStatus}`);

  await recordMeasurement({
    kpiId: ids.kpi,
    definitionVersionId: ids.version,
    organizationId,
    periodStart,
    periodEnd,
    actualValue: 72,
    performanceStatus,
    source: 'Consultify S1.3 pilot fixture',
    notes: 'English pilot fixture: KPI result outside the configured limit.',
    recordedBy: ownerId,
    actorEffectiveRole: 'OWNER',
    idempotencyKey: `seed-kpi-deviation:${ids.kpi}:2026-08`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const card = await ensureActionCardForKpiDeviation({
    organizationId,
    actorUserId: ownerId,
    kpiId: ids.kpi,
    kpiName: 'On-time delivery',
    unit: '%',
    periodStart,
    periodEnd,
    actualValue: 72,
    targetValue: 100,
    performanceStatus,
    kpiOwnerUserId: ownerId,
    locale: 'en',
  });
  if (!card.card) fail('action card was not created or recovered');
  await materializeInboxItems(ownerId, organizationId);
  await createTaskFromActionCard({ organizationId, actorUserId: ownerId }, card.card.id);
  await materializeInboxItems(ownerId, organizationId);
}

async function readback() {
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM rvn_kpi_measurements
         WHERE organization_id=$1 AND kpi_id=$2 AND period_start=$3::date AND period_end=$4::date) AS measurements,
       (SELECT count(*)::int FROM action_cards
         WHERE organization_id=$1 AND source_kind='kpi_deviation' AND source_id=$5) AS action_cards,
       (SELECT count(*)::int FROM canonical_inbox_items
         WHERE organization_id=$1 AND user_id=$6 AND source_entity_type='action_card'
           AND source_entity_id IN (SELECT id::text FROM action_cards WHERE organization_id=$1 AND source_id=$5)) AS card_inbox_items,
       (SELECT count(*)::int FROM tasks
         WHERE organization_id=$1 AND source_type='action_card'
           AND source_id IN (SELECT id::text FROM action_cards WHERE organization_id=$1 AND source_id=$5)) AS tasks,
       (SELECT count(*)::int FROM canonical_inbox_items
         WHERE organization_id=$1 AND user_id=$6 AND source_entity_type='task'
           AND source_entity_id IN (
             SELECT id::text FROM tasks WHERE organization_id=$1 AND source_type='action_card'
               AND source_id IN (
                 SELECT id::text FROM action_cards
                  WHERE organization_id=$1 AND source_kind='kpi_deviation' AND source_id=$5
               )
           )) AS task_inbox_items,
       (SELECT id::text FROM action_cards
         WHERE organization_id=$1 AND source_kind='kpi_deviation' AND source_id=$5 LIMIT 1) AS action_card_id,
       (SELECT id::text FROM tasks
         WHERE organization_id=$1 AND source_type='action_card'
           AND source_id IN (
             SELECT id::text FROM action_cards
              WHERE organization_id=$1 AND source_kind='kpi_deviation' AND source_id=$5
           ) LIMIT 1) AS task_id`,
    [organizationId, ids.kpi, periodStart, periodEnd, sourceId, ownerId]
  );
  const counts = result.rows[0];
  for (const key of ['measurements', 'action_cards', 'card_inbox_items', 'tasks', 'task_inbox_items']) {
    if (Number(counts[key]) !== 1) fail(`${key} expected 1, received ${counts[key]}`);
  }
  return {
    schema: 'CONSULTIFY-S1.3-KPI-INBOX-TASK-v1',
    organizationId,
    ownerId,
    ids,
    sourceId,
    counts,
    links: {
      inbox: `/my-work?tab=inbox&actionCardId=${encodeURIComponent(counts.action_card_id)}`,
      task: `/my-work?tab=tasks&taskId=${encodeURIComponent(counts.task_id)}`,
    },
  };
}

try {
  await qualifyTarget();
  if (command === 'seed') await seedFlow();
  console.log(JSON.stringify(await readback(), null, 2));
} finally {
  await pool.end();
  await resetConnection();
}
