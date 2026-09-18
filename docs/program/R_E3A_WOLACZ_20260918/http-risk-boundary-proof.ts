import express from 'express';
import pg from 'pg';
import request from 'supertest';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL?.startsWith('postgres'))
  throw new Error('DATABASE_URL must point to disposable PostgreSQL');

const ORG = 'org-r-e3a-wolacz';
const PROJECT = 'project-r-e3a-wolacz';
const USER = 'user-r-e3a-wolacz';

function iso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS risk_signal_alerts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      signal_type TEXT,
      severity TEXT,
      title TEXT,
      is_dismissed BOOLEAN DEFAULT FALSE,
      dismissed_by TEXT,
      dismissed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS initiatives (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT,
      planned_end_date TIMESTAMPTZ,
      planned_start_date TIMESTAMPTZ,
      start_date TIMESTAMPTZ,
      sla_deadline TIMESTAMPTZ,
      blocked_reason TEXT,
      blocked_at TIMESTAMPTZ,
      on_hold BOOLEAN DEFAULT FALSE,
      progress INTEGER,
      owner_business_id TEXT,
      owner_execution_id TEXT,
      archived BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS initiative_dependencies (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      from_initiative_id TEXT,
      to_initiative_id TEXT,
      type TEXT
    );
    CREATE TABLE IF NOT EXISTS raid_items (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      initiative_id TEXT,
      type TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      probability TEXT,
      impact TEXT,
      owner_id TEXT,
      mitigation_plan TEXT,
      mitigation_status TEXT,
      due_date TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS raid_appetite_thresholds (
      organization_id TEXT NOT NULL,
      initiative_id TEXT,
      green_max INTEGER,
      amber_max INTEGER,
      red_min INTEGER,
      auto_escalate_above INTEGER
    );
  `);
  await client.query('DELETE FROM risk_signal_alerts WHERE organization_id=$1', [ORG]);
  await client.query('DELETE FROM raid_items WHERE organization_id=$1', [ORG]);
  await client.query('DELETE FROM initiative_dependencies WHERE organization_id=$1', [ORG]);
  await client.query('DELETE FROM initiatives WHERE organization_id=$1', [ORG]);
  await client.query('DELETE FROM raid_appetite_thresholds WHERE organization_id=$1', [ORG]);
  await client.query(
    `INSERT INTO initiatives
      (id, organization_id, project_id, name, status, priority, planned_end_date, planned_start_date, start_date, sla_deadline, blocked_reason, blocked_at, on_hold, progress)
     VALUES
      ('init-overdue', $1, $2, 'HTTP overdue initiative', 'IN_PROGRESS', 'HIGH', $3, $4, $4, NULL, NULL, NULL, FALSE, 55),
      ('init-blocked', $1, $2, 'HTTP blocked initiative', 'IN_PROGRESS', 'MEDIUM', $5, $4, $4, NULL, 'External dependency', $6, TRUE, 20)`,
    [ORG, PROJECT, iso(-22), iso(-40), iso(30), iso(-9)]
  );
  await client.query(
    `INSERT INTO raid_items
      (id, organization_id, initiative_id, type, title, status, probability, impact, owner_id, mitigation_plan, mitigation_status, due_date)
     VALUES
      ('raid-critical', $1, 'init-overdue', 'RISK', 'HTTP critical supplier risk', 'OPEN', 'HIGH', 'CRITICAL', NULL, '', 'OPEN', NULL)`,
    [ORG]
  );
  await client.end();

  const mod = await import('../../../server/src/routes/v8/execution-control.routes.ts');
  const app = express();
  app.use(express.json());
  app.use('/api/v8/execution-control', (req: any, _res, next) => {
    req.user = { id: USER, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    req.userId = USER;
    req.userRole = 'ADMIN';
    req.organizationId = ORG;
    req.can = () => true;
    req.v8Context = {
      organizationId: ORG,
      userId: USER,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/execution-control', mod.default);

  const res = await request(app).get(`/api/v8/execution-control/risk-signals?projectId=${PROJECT}`);
  const classified = (res.body?.data?.signals || [])
    .filter((signal: any) => signal.sourceData?.workRiskBoundary)
    .map((signal: any) => ({
      id: signal.id,
      signalType: signal.signalType,
      severity: signal.severity,
      workRiskBoundary: signal.sourceData.workRiskBoundary,
    }));

  const proof = {
    status: res.status,
    contract: res.body?.meta?.contract,
    count: res.body?.data?.count,
    classifiedCount: classified.length,
    classifiedSample: classified.slice(0, 3),
  };
  console.log(JSON.stringify(proof, null, 2));
  if (res.status !== 200) throw new Error(`HTTP status ${res.status}`);
  if (classified.length < 3)
    throw new Error(`Expected at least 3 classified signals, got ${classified.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
