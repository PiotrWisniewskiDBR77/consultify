import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { auditRun } from '../../../services/audits/auditsDb.js';

const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL?.startsWith('postgres'));
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ORG = `day41-reach-org-${RUN}`;
const USER = `day41-reach-user-${RUN}`;
const PACK = `day41-reach-pack-${RUN}`;
const PROGRAM = `day41-reach-program-${RUN}`;
const LIFECYCLE_PROGRAM = `day41-lifecycle-program-${RUN}`;
const SECTION_IDS = [
  'executive_summary',
  'scope',
  'methodology',
  'limitations',
  'overall_conclusion',
  'findings_by_severity',
  'findings_by_area',
  'objective_evidence_references',
  'systemic_conclusions',
  'corrective_action_plan',
  'verification_plan',
  'appendices',
  'traceability_matrix',
];

let app: express.Express;
let independent: Client;

function auth() {
  return `Bearer ${jwt.sign(
    {
      id: USER,
      email: `${USER}@example.test`,
      role: 'admin',
      organizationId: ORG,
      isSuperAdmin: false,
      isDemo: false,
      jti: `jti-${RUN}`,
    },
    (config as unknown as { JWT_SECRET: string }).JWT_SECRET,
    { expiresIn: '30m' }
  )}`;
}

function body<T>(response: { body: unknown }): T {
  const envelope = response.body as { data?: unknown };
  return (
    envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : envelope
  ) as T;
}

async function cleanup() {
  for (const table of [
    'audit_reports',
    'audit_outputs',
    'audit_program_members',
    'audit_program_criteria',
    'audit_programs',
    'audit_packs',
  ]) {
    await auditRun(`DELETE FROM ${table} WHERE organization_id = $1`, [ORG]);
  }
  await auditRun(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG]);
}

beforeAll(async () => {
  if (!REAL_PG) return;
  app = express();
  app.use(express.json({ limit: '5mb' }));
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
  independent = new Client({ connectionString: process.env.DATABASE_URL });
  await independent.connect();
  await cleanup();
  await auditRun(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [ORG]);
  await auditRun(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [USER]);
  await auditRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
    [`day41-reach-member-${RUN}`, ORG, USER]
  );
  await auditRun(
    `INSERT INTO audit_packs (id, organization_id, pack_key, title, publication_status, created_by)
     VALUES ($1, $2, $3, 'Day 41 pack', 'published', $4)`,
    [PACK, ORG, `day41-reach-${RUN}`, USER]
  );
  for (const [id, name] of [
    [PROGRAM, 'Day 41 report chain'],
    [LIFECYCLE_PROGRAM, 'Day 41 lifecycle-only'],
  ]) {
    await auditRun(
      `INSERT INTO audit_programs
         (id, organization_id, name, status, pack_id, pack_key, pack_version,
          lifecycle_state, criteria_snapshot_at, created_by, lead_auditor_id)
       VALUES ($1, $2, $3, 'active', $4, $5, 1, 'planning', NOW(), $6, $6)`,
      [id, ORG, name, PACK, `day41-reach-${RUN}`, USER]
    );
    await auditRun(
      `INSERT INTO audit_program_members
         (id, program_id, organization_id, user_id, member_role, assigned_by)
       VALUES ($1, $2, $3, $4, 'lead_auditor', $4)`,
      [`day41-reach-pm-${id}`, id, ORG, USER]
    );
  }
  await auditRun(
    `INSERT INTO audit_program_criteria
       (id, program_id, organization_id, ordinal, ref_code, node_kind, title,
        requirement_text, conformity_status, work_status, concluded_by, concluded_at)
     VALUES ($1, $2, $3, 1, 'D41.1', 'criterion', 'Lifecycle criterion',
             'A completed criterion for lifecycle reachability', 'conforming',
             'concluded', $4, NOW())`,
    [`day41-lifecycle-criterion-${RUN}`, LIFECYCLE_PROGRAM, ORG, USER]
  );
}, 180_000);

afterAll(async () => {
  if (!REAL_PG) return;
  await cleanup();
  await independent.end();
}, 60_000);

describe.skipIf(!REAL_PG)('Day 41 report-chain reachability on real PostgreSQL', () => {
  it('finalizes an Output and creates the ordered, sealed 13-section report through HTTP', async () => {
    const outputResponse = await request(app)
      .post('/api/audits/outputs/finalize')
      .set('Authorization', auth())
      .send({ programId: PROGRAM, title: 'Day 41 Output' });
    expect(outputResponse.status, JSON.stringify(outputResponse.body)).toBe(201);
    const output = body<{ id: string }>(outputResponse);

    const outputReadback = await independent.query<{
      version: number;
      content_hash: string;
    }>(`SELECT version, content_hash FROM audit_outputs WHERE id = $1`, [output.id]);
    expect(outputReadback.rows).toHaveLength(1);
    expect(outputReadback.rows[0].version).toBe(1);
    expect(outputReadback.rows[0].content_hash).toBeTruthy();

    const reportResponse = await request(app)
      .post('/api/audits/reports')
      .set('Authorization', auth())
      .send({
        programId: PROGRAM,
        outputId: output.id,
        reportKind: 'audit_report',
        title: 'Day 41 audit report',
      });
    expect(reportResponse.status, JSON.stringify(reportResponse.body)).toBe(201);
    const report = body<{ id: string }>(reportResponse);
    const reportReadback = await independent.query<{
      payload: { sections: Array<{ id: string }> };
      content_hash: string;
    }>(`SELECT payload, content_hash FROM audit_reports WHERE id = $1`, [report.id]);
    expect(reportReadback.rows[0].payload.sections).toHaveLength(13);
    expect(reportReadback.rows[0].payload.sections.map((section) => section.id)).toEqual(
      SECTION_IDS
    );
    expect(reportReadback.rows[0].content_hash).not.toBe(outputReadback.rows[0].content_hash);
  });

  it('reaching closure through lifecycle transitions does not create an Output', async () => {
    for (const targetState of [
      'preparation',
      'fieldwork',
      'evidence_review',
      'findings_review',
      'management_response',
      'approval',
      'remediation',
      'effectiveness_verification',
      'closure',
    ]) {
      const response = await request(app)
        .post(`/api/audits/programs/${LIFECYCLE_PROGRAM}/transition`)
        .set('Authorization', auth())
        .send({ targetState });
      expect(response.status, `${targetState}: ${JSON.stringify(response.body)}`).toBe(200);
    }
    const readback = await independent.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_outputs WHERE program_id = $1`,
      [LIFECYCLE_PROGRAM]
    );
    expect(readback.rows[0].count).toBe('0');
  });
});
