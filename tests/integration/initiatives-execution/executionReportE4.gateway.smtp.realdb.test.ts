/** @vitest-environment node */
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const maybeDescribe = databaseUrl ? describe : describe.skip;

maybeDescribe('Q2 execution report profile — Gateway/JWT/PG/PDF/SMTP', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const organizationId = randomUUID();
  const ownerId = randomUUID();
  const approverId = randomUUID();
  const projectId = randomUUID();
  const definitionId = randomUUID();
  const snapshotId = randomUUID();
  const successRunId = randomUUID();
  const failureRunId = randomUUID();
  let app: ReturnType<typeof express>;
  let smtp: net.Server;
  let smtpPort = 0;
  let transcript = '';
  const tokens: Record<string, string> = {};
  const saved = new Map<string, string | undefined>();
  const envKeys = ['DATABASE_URL', 'DB_TYPE', 'MOCK_DB', 'ENABLE_EXECUTION_REPORT_E4', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE', 'SMTP_FROM'];
  const auth = (id: string) => ({ Authorization: `Bearer ${tokens[id]}` });

  const reportDefinition = () => ({
    definitionId,
    tenantId: organizationId,
    currentVersion: 1,
    versions: [{
      definitionVersion: 1,
      state: 'PUBLISHED',
      ownerId,
      approverId,
      name: 'Execution report profile',
      purpose: 'Governed execution reporting',
      audience: ['board'],
      cadence: 'WEEKLY',
      scope: { type: 'project', refs: [projectId], projectIds: [projectId], generalBacklogAllowed: false },
      outputSchema: {},
      sections: [{ sectionId: 'delivery', title: 'Delivery', mandatory: true }],
      sourceBindings: [{ bindingId: 'snapshot', sourceType: 'execution_report_snapshot', required: true, scope: 'project' }],
      formulas: [], units: [], currencies: [], windows: [],
      access: { audienceRoles: ['admin'], classification: 'INTERNAL' },
      redaction: { rules: [], defaultState: 'FULL' },
      freshnessThresholdMinutes: 60,
      confidenceThreshold: 'HIGH',
      validationFindings: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString(), publishedBy: approverId,
    }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });

  beforeAll(async () => {
    for (const key of envKeys) saved.set(key, process.env[key]);
    process.env.DATABASE_URL = databaseUrl;
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_EXECUTION_REPORT_E4 = 'true';
    await pool.query(`
      CREATE TABLE organizations (id uuid PRIMARY KEY, name text NOT NULL);
      CREATE TABLE users (id uuid PRIMARY KEY, organization_id uuid NOT NULL, email text, password text, role text, status text, first_name text, last_name text);
      CREATE TABLE organization_members (id uuid PRIMARY KEY, organization_id uuid NOT NULL, user_id uuid NOT NULL, role text, status text);
      CREATE TABLE projects (id uuid PRIMARY KEY, organization_id uuid NOT NULL, name text NOT NULL);
      CREATE TABLE project_members (id uuid PRIMARY KEY, project_id uuid NOT NULL, user_id uuid NOT NULL, project_role text, permissions jsonb);
      CREATE TABLE initiatives (id uuid PRIMARY KEY, organization_id uuid NOT NULL, title text NOT NULL);
      CREATE TABLE initiative_kpis (id uuid PRIMARY KEY, initiative_id uuid NOT NULL, name text NOT NULL, target_value numeric, unit text, sort_order integer DEFAULT 0);
      CREATE TABLE kpi_measurements (id uuid PRIMARY KEY, kpi_id uuid NOT NULL, value numeric NOT NULL, measured_at timestamptz NOT NULL);
      CREATE TABLE ie_aggregate_state (organization_id uuid NOT NULL, aggregate_type text NOT NULL, aggregate_id text NOT NULL, version integer NOT NULL, payload_json jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,aggregate_type,aggregate_id));
      CREATE TABLE ie_command_receipts (organization_id uuid NOT NULL, client_request_id text NOT NULL, command_type text NOT NULL, aggregate_type text NOT NULL, aggregate_id text NOT NULL, aggregate_version integer NOT NULL, correlation_id text NOT NULL, request_fingerprint text NOT NULL, response_json jsonb NOT NULL, PRIMARY KEY (organization_id,client_request_id));
      CREATE TABLE ie_audit_events (organization_id uuid NOT NULL, actor_id text NOT NULL, aggregate_type text NOT NULL, aggregate_id text NOT NULL, aggregate_version integer NOT NULL, command_type text NOT NULL, client_request_id text NOT NULL, correlation_id text NOT NULL, policy_id text NOT NULL, policy_version integer NOT NULL, payload_json jsonb NOT NULL);
      CREATE TABLE ie_outbox_events (organization_id uuid NOT NULL, aggregate_type text NOT NULL, aggregate_id text NOT NULL, aggregate_version integer NOT NULL, event_type text NOT NULL, correlation_id text NOT NULL, causation_id text NOT NULL, payload_json jsonb NOT NULL);
      CREATE TABLE report_definitions (id text PRIMARY KEY, organization_id uuid, key text, name text, kind text, audience text, cadence text, scope text, read_mode text, sections_json jsonb, source_binding jsonb, is_system boolean);
      CREATE TABLE settings (key text PRIMARY KEY, value text NOT NULL);
    `);
    const migration = readFileSync(new URL('../../../server/migrations/20262104_execution_report_snapshots.sql', import.meta.url), 'utf8');
    await pool.query(migration);
    await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [organizationId, 'Q2 isolated']);
    for (const [id, role] of [[ownerId, 'OWNER'], [approverId, 'ADMIN']] as const) {
      await pool.query("INSERT INTO users(id,organization_id,email,password,role,status,first_name,last_name) VALUES($1,$2,$3,'unused',$4,'active','Q2','Reviewer')", [id, organizationId, `${id}@example.test`, role]);
      await pool.query("INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,'ACTIVE')", [randomUUID(), organizationId, id, role]);
    }
    await pool.query('INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)', [projectId, organizationId, 'Q2 project']);
    const initiativeId = randomUUID(), kpiId = randomUUID();
    await pool.query('INSERT INTO initiatives(id,organization_id,title) VALUES($1,$2,$3)', [initiativeId, organizationId, 'Operational excellence']);
    await pool.query('INSERT INTO initiative_kpis(id,initiative_id,name,target_value,unit) VALUES($1,$2,$3,$4,$5)', [kpiId, initiativeId, 'Lead time', 10, 'days']);
    await pool.query('INSERT INTO kpi_measurements(id,kpi_id,value,measured_at) VALUES($1,$2,$3,$4)', [randomUUID(), kpiId, 8, '2026-09-08T00:00:00.000Z']);
    for (const id of [ownerId, approverId]) await pool.query("INSERT INTO project_members(id,project_id,user_id,project_role,permissions) VALUES($1,$2,$3,'PROJECT_LEADER',$4)", [randomUUID(), projectId, id, JSON.stringify(['initiative.view','initiative.update','initiative.review'])]);
    await pool.query("INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'report_definition',$2,1,$3)", [organizationId, definitionId, reportDefinition()]);
    const snapshot = { title: 'Q2 weekly execution', rag: 'GREEN', period: { start: '2026-09-01T00:00:00.000Z', end: '2026-09-07T23:59:59.000Z' }, asOf: '2026-09-08T00:00:00.000Z', metrics: [{ id: 'kpi', label: 'KPI results', value: '1' }], sections: [{ id: 'delivery', title: 'Delivery', narrative: 'On track' }, { id: 'canonical-kpi-results', title: 'KPI results', table: { columns: [{ id: 'kpi', label: 'KPI' }, { id: 'actual', label: 'Result' }], rows: [{ kpi: 'Lead time', actual: '8 days' }] } }] };
    await pool.query("INSERT INTO execution_report_snapshots(id,organization_id,definition_key,level,title,period_start,period_end,as_of,status,rag,payload,created_by) VALUES($1,$2,'weekly-exec','PMO',$3,$4,$5,$6,'DRAFT','GREEN',$7,$8)", [snapshotId, organizationId, snapshot.title, snapshot.period.start, snapshot.period.end, snapshot.asOf, snapshot, ownerId]);

    smtp = net.createServer((socket) => {
      socket.setEncoding('utf8'); let input = ''; let data = false;
      socket.write('220 q2.local ESMTP\r\n');
      socket.on('data', (chunk) => {
        transcript += chunk; input += chunk;
        if (data) { if (input.includes('\r\n.\r\n')) { data = false; input = ''; socket.write('250 queued\r\n'); } return; }
        for (;;) { const end = input.indexOf('\r\n'); if (end < 0) break; const line = input.slice(0,end); input = input.slice(end+2);
          if (/^EHLO/i.test(line)) socket.write('250-q2.local\r\n250-AUTH PLAIN\r\n250 SIZE 10485760\r\n');
          else if (/^AUTH PLAIN/i.test(line)) socket.write('235 authenticated\r\n');
          else if (/^RCPT TO:.*fail@/i.test(line)) socket.write('550 rejected\r\n');
          else if (/^(MAIL FROM|RCPT TO)/i.test(line)) socket.write('250 ok\r\n');
          else if (/^DATA/i.test(line)) { data = true; socket.write('354 continue\r\n'); }
          else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n'); else socket.write('250 ok\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
    smtpPort = (smtp.address() as net.AddressInfo).port;
    await pool.query(
      `INSERT INTO settings(key,value) VALUES
       ('smtp_host','127.0.0.1'),('smtp_port',$1),('smtp_user','sender@example.test'),
       ('smtp_pass','secret'),('smtp_secure','false'),('smtp_from','sender@example.test')`,
      [String(smtpPort)]
    );
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtpPort), SMTP_USER: 'sender@example.test', SMTP_PASS: 'secret', SMTP_SECURE: 'false', SMTP_FROM: 'sender@example.test' });
    vi.doUnmock('../../../server/src/services/emailService.js');
    const { default: config } = await import('../../../server/src/config/Config.js');
    tokens[ownerId] = jwt.sign({ id: ownerId, organizationId, role: 'OWNER' }, config.JWT_SECRET, { expiresIn: '30m' });
    tokens[approverId] = jwt.sign({ id: approverId, organizationId, role: 'ADMIN' }, config.JWT_SECRET, { expiresIn: '30m' });
    const { ApiGateway } = await import('../../../server/src/Gateway.js');
    app = express(); app.use(express.json()); ApiGateway.getInstance().initializeRoutes(app);
    const { queryOne } = await import('../../../server/src/utils/queryHelpers.js');
    expect(await queryOne('SELECT current_database() AS name')).toMatchObject({ name: 'consultify_q2' });
    expect(await queryOne('SELECT status FROM organization_members WHERE user_id=? AND organization_id=?', [ownerId, organizationId])).toMatchObject({ status: 'ACTIVE' });
    const email = await import('../../../server/src/services/emailService.js');
    expect(await email.send({ to: 'smtp-probe@example.test', subject: 'SMTP probe', text: 'probe', requireDelivery: true })).toBe(true);
    expect(transcript).toContain('smtp-probe@example.test');
    transcript = '';
  }, 120_000);

  afterAll(async () => {
    await pool.end();
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
    for (const key of envKeys) { const value = saved.get(key); if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });

  async function createFreezeApprove(reportRunId: string, recipient: string) {
    const create = await request(app).post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}`).set(auth(ownerId)).send({ expectedVersion: 0, clientRequestId: randomUUID(), definitionRef: { definitionId, version: 1 }, parentRunRef: null, audience: [recipient], scopeRefs: [`project:${projectId}`], period: { start: '2026-09-01T00:00:00.000Z', end: '2026-09-07T23:59:59.000Z' }, asOf: '2026-09-08T00:00:00.000Z', sources: [], ownerId, approverId, workReport: { profile: 'execution_report', title: 'Q2 weekly execution', templateId: 'weekly-exec', cadence: 'WEEKLY', projectIds: [projectId], detailLevel: 'EXECUTIVE', snapshotId } });
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    let version = create.body.aggregateVersion;
    for (const action of ['VALIDATE','FREEZE'] as const) { const response = await request(app).post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}/transitions`).set(auth(ownerId)).send({ expectedVersion: version, clientRequestId: randomUUID(), profile: 'execution_report', action }); expect(response.status).toBe(200); version = response.body.aggregateVersion; }
    const approval = await request(app).post(`/api/initiatives/runtime-v1/report-runs/${reportRunId}/transitions`).set(auth(approverId)).send({ expectedVersion: version, clientRequestId: randomUUID(), profile: 'execution_report', action: 'DECIDE', outcome: 'APPROVED', rationale: 'Q2_APPROVED' });
    expect(approval.status).toBe(200); return approval.body.aggregateVersion;
  }

  it('keeps the legacy execution-report API available while the E4 profile is OFF on the same database', async () => {
    process.env.ENABLE_EXECUTION_REPORT_E4 = 'false';
    try {
      const legacy = await request(app).get('/api/execution-reports/runs').set(auth(ownerId));
      expect(legacy.status).toBe(200);
      expect(legacy.body.items.map((item: any) => item.id)).toContain(snapshotId);
      const disabled = await request(app)
        .get(`/api/initiatives/runtime-v1/execution-reports/${successRunId}/pdf`)
        .set(auth(ownerId));
      expect(disabled.status).toBe(404);
      expect(disabled.body).toMatchObject({ error: { code: 'FEATURE_DISABLED' } });
    } finally {
      process.env.ENABLE_EXECUTION_REPORT_E4 = 'true';
    }
  });

  it('runs through Gateway/JWT, returns a real PDF, delivers over local SMTP and persists dashboard receipt', async () => {
    const version = await createFreezeApprove(successRunId, 'board@example.test');
    const pdf = await request(app).get(`/api/initiatives/runtime-v1/execution-reports/${successRunId}/pdf`).set(auth(ownerId));
    expect(pdf.status).toBe(200); expect(pdf.headers['content-type']).toContain('application/pdf'); expect(pdf.body.length).toBeGreaterThan(1000);
    const delivered = await request(app).post(`/api/initiatives/runtime-v1/execution-reports/${successRunId}/deliver`).set(auth(approverId)).send({ expectedVersion: version, clientRequestId: randomUUID(), recipients: ['board@example.test'] });
    expect(delivered.status).toBe(200); expect(delivered.body.status).toBe('PUBLISHED');
    const dashboard = await request(app).get('/api/initiatives/runtime-v1/report-runs').set(auth(ownerId));
    const row = dashboard.body.items.find((item: any) => item.reportRunId === successRunId);
    expect(row.status).toBe('PUBLISHED'); expect(row.workReport.profile).toBe('execution_report'); expect(row.workReport.detailLevel).toBe('EXECUTIVE'); expect(row.workReport.content.sections.map((section: any) => section.id)).toContain('canonical-kpi-results'); expect(row.distributionReceipts).toHaveLength(1);
    expect(transcript).toContain('board@example.test'); expect(transcript).toContain('application/pdf');
  });

  it('captures canonical KPI results in a newly generated execution snapshot', async () => {
    const created = await request(app).post('/api/execution-reports/runs').set(auth(ownerId)).send({
      definitionKey: 'weekly-exec', title: 'KPI-backed execution report', rag: 'GREEN',
      period: { start: '2026-09-01T00:00:00.000Z', end: '2026-09-07T23:59:59.000Z' },
      asOf: '2026-09-08T00:00:00.000Z', metrics: [],
      sections: [{ id: 'delivery', title: 'Delivery', narrative: 'On track' }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.payload.locale).toBe('en');
    const kpi = created.body.payload.sections.find((section: any) => section.id === 'canonical-kpi-results');
    expect(kpi.titleMessage).toEqual({
      key: 'executionReports.kpiResults',
      value: 'KPI results',
      locale: 'en',
    });
    expect(kpi.table.columns.map((column: any) => column.labelMessage?.key)).toEqual([
      'executionReports.initiative',
      'executionReports.kpi',
      'executionReports.result',
      'executionReports.target',
      'executionReports.measuredAt',
    ]);
    expect(kpi.table.rows).toContainEqual(expect.objectContaining({ kpi: 'Lead time', actual: '8 days', target: '10 days' }));
  });

  it('keeps APPROVED with zero receipts when SMTP rejects the recipient', async () => {
    const version = await createFreezeApprove(failureRunId, 'fail@example.test');
    const failed = await request(app).post(`/api/initiatives/runtime-v1/execution-reports/${failureRunId}/deliver`).set(auth(approverId)).send({ expectedVersion: version, clientRequestId: randomUUID(), recipients: ['fail@example.test'] });
    expect(failed.status).toBe(502);
    const state = await pool.query("SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='report_run' AND aggregate_id=$2", [organizationId, failureRunId]);
    expect(state.rows[0].payload_json.status).toBe('APPROVED'); expect(state.rows[0].payload_json.distributionReceipts).toEqual([]); expect(state.rows[0].payload_json.deliveryAttempts[0].recipients[0].status).toBe('FAILED');
  });

  it('runs the recurring execution-report profile through the shared canonical runner', async () => {
    transcript = '';
    const { runScheduledInitiativeWorkReport } = await import('../../../server/src/routes/pmo/initiativesExecutionRuntime.routes.js');
    const reportRunId = await runScheduledInitiativeWorkReport({
      id: randomUUID(),
      organizationId,
      runtimeReport: {
        profile: 'execution_report', definitionId, definitionVersion: 1,
        templateId: 'weekly-exec', title: 'Scheduled Q2 execution', projectIds: [projectId],
        ownerId, approverId, recipients: ['schedule@example.test'], cadence: 'WEEKLY',
        detailLevel: 'MANAGEMENT', snapshotId,
      },
    });
    const state = await pool.query("SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='report_run' AND aggregate_id=$2", [organizationId, reportRunId]);
    expect(state.rows[0].payload_json.status).toBe('PUBLISHED');
    expect(state.rows[0].payload_json.workReport.profile).toBe('execution_report');
    expect(state.rows[0].payload_json.distributionReceipts).toHaveLength(1);
    expect(transcript).toContain('schedule@example.test');
    expect(transcript).toContain('application/pdf');
  });
});
