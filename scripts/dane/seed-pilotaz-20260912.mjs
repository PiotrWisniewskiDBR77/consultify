#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const value = (name) => argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const organizationId = value('--organization-id');
const actorUserId = value('--actor-user-id');
const manifestPath = value('--manifest');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!organizationId) throw new Error('--organization-id is required');
if (!actorUserId) throw new Error('--actor-user-id is required');
if (apply && !manifestPath) throw new Error('--apply requires --manifest=<path>');

process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';
process.env.MOCK_REDIS = 'true';
process.env.ENABLE_V8_GLOBAL = 'true';
process.env.DISABLE_SCHEDULER = 'true';
process.env.JWT_SECRET ||= 'codex6-pilot-seed-local-secret-32-characters';

const TAG = 'codex6-pilot-seed-20260912';
const initiatives = [
  ['Stabilize Line 3 uptime', 'high'],
  ['Introduce daily production control', 'high'],
  ['Reduce changeover time', 'high'],
  ['Create maintenance skills matrix', 'medium'],
  ['Digitize downtime reporting', 'medium'],
  ['Improve spare-parts availability', 'medium'],
  ['Standardize shift handovers', 'medium'],
  ['Launch quality-at-source reviews', 'medium'],
  ['Improve supplier delivery reliability', 'low'],
  ['Build energy consumption baseline', 'low'],
  ['Pilot operator suggestion board', 'low'],
  ['Prepare scale-up governance', 'low'],
];
const team = [
  ['operations.lead', 'Olivia', 'Martin', 'Operations Lead', 'Operations'],
  ['maintenance.lead', 'Daniel', 'Brooks', 'Maintenance Lead', 'Maintenance'],
  ['data.analyst', 'Maya', 'Evans', 'Data Analyst', 'Digital'],
];

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

async function state() {
  const result = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM users WHERE organization_id=$1) AS team,
       (SELECT count(*)::int FROM initiatives WHERE organization_id=$1 AND source_id=$2) AS initiatives,
       (SELECT count(*)::int FROM tasks WHERE organization_id=$1 AND idempotency_key LIKE $3) AS tasks,
       (SELECT count(*)::int FROM rvn_kpi_definitions WHERE organization_id=$1 AND kpi_code LIKE 'CX6-PILOT-%') AS indicators,
       (SELECT count(*)::int FROM rvn_kpi_measurements m JOIN rvn_kpi_definitions k ON k.kpi_id=m.kpi_id WHERE m.organization_id=$1 AND k.kpi_code LIKE 'CX6-PILOT-%') AS measurements,
       (SELECT count(*)::int FROM interview_sessions WHERE organization_id=$1 AND name='Pilot discovery interview') AS interviews,
       (SELECT count(*)::int FROM assessments WHERE organization_id=$1 AND name='Pilot digital readiness assessment') AS assessments`,
    [organizationId, TAG, `${TAG}:%`]
  );
  return result.rows[0];
}

const before = await state();
const org = await pool.query('SELECT id,name FROM organizations WHERE id=$1', [organizationId]);
const actor = await pool.query(
  `SELECT u.id,u.email,om.role FROM users u
   JOIN organization_members om ON om.user_id=u.id AND om.organization_id=u.organization_id
   WHERE u.id=$1 AND u.organization_id=$2 AND om.status='ACTIVE'`,
  [actorUserId, organizationId]
);
if (!org.rowCount) throw new Error('Target organization was not found');
if (!actor.rowCount || !['OWNER', 'ADMIN'].includes(actor.rows[0].role)) {
  throw new Error('Actor must be an active OWNER or ADMIN of the target organization');
}

const manifest = {
  schema: 'codex6-pilot-seed-manifest/v1',
  tag: TAG,
  createdAt: new Date().toISOString(),
  mode: apply ? 'apply' : 'dry-run',
  target: { organizationId, organizationName: org.rows[0].name },
  actor: { userId: actorUserId, email: actor.rows[0].email, role: actor.rows[0].role },
  before,
  plan: { teamMembers: team.length, initiatives: initiatives.length, tasks: initiatives.length, indicators: 3, measurements: 6, interviews: 1, assessments: 1 },
};

if (manifestPath) {
  fs.mkdirSync(path.dirname(path.resolve(manifestPath)), { recursive: true });
  fs.writeFileSync(path.resolve(manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify(manifest, null, 2));
if (!apply) {
  console.log('[pilot-seed] dry-run is the default; no data was written');
  await pool.end();
  process.exit(0);
}

const { ApiGateway } = await import('../../server/src/Gateway.ts');
const { withApplicationTransaction } = await import('../../server/src/database/PostgresDatabase.js');
const SuperAdminController = (await import('../../server/src/controllers/SuperAdminController.ts')).default;
const app = express();
app.use(express.json());
ApiGateway.getInstance().initializeRoutes(app);
const userWriterApp = express();
userWriterApp.use(express.json());
userWriterApp.post('/users', SuperAdminController.createUser);
const token = jwt.sign(
  { id: actorUserId, userId: actorUserId, email: actor.rows[0].email, organizationId, organization_id: organizationId, role: 'SUPERADMIN' },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '15m' }
);
const auth = { Authorization: `Bearer ${token}` };

async function call(method, url, body, extraHeaders = {}, targetApp = app) {
  const response = await request(targetApp)[method](url).set(auth).set(extraHeaders).send(body);
  if (response.status >= 400) {
    throw new Error(`${method.toUpperCase()} ${url} -> ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body;
}

await withApplicationTransaction(async () => {
  const projectResult = await pool.query(
    'SELECT id FROM projects WHERE organization_id=$1 ORDER BY is_system DESC,created_at LIMIT 1',
    [organizationId]
  );
  const projectId = projectResult.rows[0]?.id;
  if (!projectId) throw new Error('The target organization has no project');

  for (const [slug, firstName, lastName, jobTitle, department] of team) {
    const email = `${slug}+${organizationId.slice(0, 8)}@pilot.invalid`;
    let user = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [email]);
    let userId = user.rows[0]?.id;
    if (!userId) {
      const created = await call('post', '/users', {
        email, firstName, lastName, role: 'USER', organizationId,
        password: `Pilot-${organizationId.slice(0, 8)}-${slug}!`, jobTitle, department,
      }, {}, userWriterApp);
      userId = created.id;
    }
    const membership = await pool.query(
      'SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2',
      [organizationId, userId]
    );
    if (!membership.rowCount) {
      await call('post', `/api/organizations/${organizationId}/members`, { targetUserId: userId, role: 'MEMBER' });
    }
  }

  const createdInitiatives = [];
  for (let index = 0; index < initiatives.length; index += 1) {
    const [title, priority] = initiatives[index];
    const existing = await pool.query(
      'SELECT id FROM initiatives WHERE organization_id=$1 AND source_id=$2 AND title=$3',
      [organizationId, TAG, title]
    );
    if (existing.rowCount) {
      createdInitiatives.push({ id: existing.rows[0].id, title });
      continue;
    }
    const created = await call('post', '/api/initiatives', {
      title, summary: `${title} is part of the first 90-day operating plan.`,
      description: `${title} is part of the first 90-day operating plan.`,
      problemStatement: 'The current operating system does not provide stable, measurable delivery.',
      hypothesis: 'A named owner, weekly cadence and visible measure will improve delivery reliability.',
      ownerBusinessId: actorUserId,
      ownerExecutionId: actorUserId,
      scopeIn: ['One pilot production area', 'Daily management cadence', 'Named operating team'],
      scopeOut: ['Capital projects', 'Changes outside the pilot production area'],
      deliverables: ['Weekly operating review', 'Visible pilot measures', 'Verified improvement action'],
      successCriteria: ['Named owner reviews progress weekly', 'Pilot measure improves from baseline'],
      projectId, priority, sourceType: 'pilot_seed', sourceId: TAG,
    });
    createdInitiatives.push({ id: created.id || created.initiative?.id, title });
  }

  for (let index = 4; index < createdInitiatives.length; index += 1) {
    const initiative = createdInitiatives[index];
    const current = await pool.query(
      'SELECT status FROM initiatives WHERE id=$1 AND organization_id=$2',
      [initiative.id, organizationId]
    );
    if (!current.rowCount || String(current.rows[0]?.status || '').toUpperCase() === 'DRAFT') {
      await call('patch', `/api/initiatives/${initiative.id}/status`, {
        status: 'PENDING_APPROVAL',
        reason: 'Prepared for the pilot readiness review',
        overrideReason: 'Governed pilot seed with an accountable owner and explicit scope',
      });
    }
  }

  for (let index = 0; index < createdInitiatives.length; index += 1) {
    const initiative = createdInitiatives[index];
    const title = `Deliver: ${initiative.title}`;
    const existing = await pool.query(
      'SELECT id FROM tasks WHERE organization_id=$1 AND source_id=$2 AND title=$3',
      [organizationId, TAG, title]
    );
    if (!existing.rowCount) {
      await call('post', '/api/tasks', {
        title, description: 'Complete the next verifiable pilot milestone.',
        initiativeId: initiative.id, projectId, status: index < 3 ? 'in_progress' : 'todo',
        priority: index < 4 ? 'high' : 'medium', dueDate: `2026-10-${String(3 + index).padStart(2, '0')}`,
        sourceType: 'pilot_seed', sourceId: TAG, idempotencyKey: `${TAG}:task:${index}`,
      });
    }
  }

  if (!(await pool.query("SELECT 1 FROM interview_sessions WHERE organization_id=$1 AND name='Pilot discovery interview'", [organizationId])).rowCount) {
    await call('post', '/api/interview/sessions', { name: 'Pilot discovery interview', projectId });
  }
  if (!(await pool.query("SELECT 1 FROM assessments WHERE organization_id=$1 AND name='Pilot digital readiness assessment'", [organizationId])).rowCount) {
    await call('post', '/api/assessment-workflow-v2', { assessmentType: 'DRD', name: 'Pilot digital readiness assessment', projectId, businessUnit: 'Operations' });
  }

  const indicatorSpecs = [
    ['Unplanned downtime', 'hours/month', 52, 40],
    ['On-time delivery', 'percent', 81, 95],
    ['Average changeover time', 'minutes', 74, 55],
  ];
  for (let index = 0; index < indicatorSpecs.length; index += 1) {
    const [name, unit, baselineValue, targetValue] = indicatorSpecs[index];
    const kpiCode = `CX6-PILOT-${index + 1}`;
    let kpi = await pool.query(
      'SELECT kpi_id AS id FROM rvn_kpi_definitions WHERE organization_id=$1 AND kpi_code=$2',
      [organizationId, kpiCode]
    );
    let kpiId = kpi.rows[0]?.id;
    if (!kpiId) {
      const created = await call('post', '/api/vnext/results/kpi', {
        kpiCode, name, description: `${TAG}: pilot operating indicator`, unit,
        targetGeometry: index === 1 ? 'threshold_min' : 'threshold_max', targetValue,
        measurementFrequencyDays: 30, idempotencyKey: `${TAG}:kpi:${index}`,
      });
      kpiId = created.kpi?.kpiId;
    }
    for (const [periodStart, value] of [['2026-08-01', baselineValue], ['2026-09-01', baselineValue - (index + 1) * 2]]) {
      const existing = await pool.query(
        'SELECT 1 FROM rvn_kpi_measurements WHERE organization_id=$1 AND kpi_id=$2 AND period_start=$3',
        [organizationId, kpiId, periodStart]
      );
      if (!existing.rowCount) {
        await call('post', `/api/vnext/results/kpi/${kpiId}/measurements`, {
          actualValue: value, periodStart, periodEnd: `${periodStart.slice(0, 8)}28T23:59:59.000Z`,
          source: 'pilot-seed', notes: 'Pilot monthly measurement',
          idempotencyKey: `${TAG}:measurement:${index}:${periodStart}`,
        });
      }
    }
  }
});

const after = await state();
console.log(JSON.stringify({ tag: TAG, committed: true, before, after }, null, 2));
await pool.end();
process.exit(0);
