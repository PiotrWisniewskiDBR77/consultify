import { writeFile } from 'node:fs/promises';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { auditAll, auditRun } from '../../../services/audits/auditsDb.js';

const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL?.startsWith('postgres'));
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ORG = `day41-scale-org-${RUN}`;
const USER = `day41-scale-user-${RUN}`;
const SIZES = [42, 150, 300] as const;
let app: express.Express;

function programId(size: number) {
  return `day41-scale-${size}-${RUN}`;
}
function auth() {
  return `Bearer ${jwt.sign({ id: USER, email: `${USER}@test.local`, role: 'admin', organizationId: ORG, isSuperAdmin: false, isDemo: false, jti: RUN }, (config as unknown as { JWT_SECRET: string }).JWT_SECRET, { expiresIn: '30m' })}`;
}
async function cleanup() {
  for (const table of [
    'audit_program_findings',
    'audit_evidence',
    'audit_program_criteria',
    'audit_programs',
  ]) {
    await auditRun(`DELETE FROM ${table} WHERE organization_id=$1`, [ORG]);
  }
  await auditRun(`DELETE FROM organization_members WHERE organization_id=$1`, [ORG]);
}

beforeAll(async () => {
  if (!REAL_PG) return;
  app = express();
  app.use(express.json());
  const { apiGateway } = await import('../../../Gateway.js');
  apiGateway.initializeRoutes(app);
  await cleanup();
  await auditRun(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [ORG]);
  await auditRun(`INSERT INTO users (id) VALUES ($1) ON CONFLICT DO NOTHING`, [USER]);
  await auditRun(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
    [`day41-scale-member-${RUN}`, ORG, USER]
  );
  for (const size of SIZES) {
    const program = programId(size);
    await auditRun(
      `INSERT INTO audit_programs (id,organization_id,name,status,lifecycle_state,created_by) VALUES ($1,$2,$3,'active','fieldwork',$4)`,
      [program, ORG, `Scale ${size}`, USER]
    );
    await auditRun(
      `INSERT INTO audit_program_criteria
         (id,program_id,organization_id,ordinal,ref_code,node_kind,title,requirement_text,
          expected_evidence,procedure_performed,sample_description,test_performed,test_result,
          auditor_note,auditor_conclusion,conformity_status,work_status,concluded_by,concluded_at)
       SELECT $1||'-c-'||n,$1,$2,n,'S.'||n,'criterion','Kontrola procesu '||n,
              'Organizacja utrzymuje udokumentowaną kontrolę numer '||n,
              '[{"kind":"document","description":"Rejestr i próbka"}]'::jsonb,
              'Przejrzano rejestr','Próba 12 rekordów','Porównanie z procedurą','pass',
              'Bez wyjątków','Kontrola działa','conforming','concluded',$3,NOW()
         FROM generate_series(1,$4::int) n`,
      [program, ORG, USER, size]
    );
    await auditRun(
      `INSERT INTO audit_evidence (id,program_id,organization_id,criterion_id,evidence_kind,title,description,content_hash,sufficiency,reliability,accepted)
       SELECT $1||'-e-'||n||'-'||sample,$1,$2,$1||'-c-'||n,'document',
              'Dowód '||sample||' dla kontroli '||n,'Realistyczny opis dowodu procesowego',
              md5($1||n||sample),'sufficient','reliable',TRUE
         FROM generate_series(1,$3::int) n CROSS JOIN generate_series(1,2) sample`,
      [program, ORG, size]
    );
    await auditRun(
      `INSERT INTO audit_program_findings
         (id,program_id,organization_id,criterion_id,reference_code,statement,requirement_text,
          condition_text,objective_evidence,classification,severity,status,author_id)
       SELECT $1||'-f-'||n,$1,$2,$1||'-c-'||n,'F.'||n,
              'Obserwacja procesowa '||n,'Wymagana kontrola','Kontrola działa z możliwością poprawy',
              jsonb_build_array($1||'-e-'||n||'-1'),'observation','low','confirmed',$3
         FROM generate_series(1,$4::int) n`,
      [program, ORG, USER, size]
    );
  }
}, 180_000);

afterAll(async () => {
  if (REAL_PG) await cleanup();
}, 60_000);

describe.skipIf(!REAL_PG)('Day 41 criteria surface production-scale measurement', () => {
  it('measures 42, 150 and 300 realistic criteria and records the 300-row plan', async () => {
    const measurements: Array<{
      criteria: number;
      contentLengthKb: number;
      medianMs: number;
      samplesMs: number[];
    }> = [];
    for (const size of SIZES) {
      const samples: number[] = [];
      let contentLength = 0;
      for (let run = 0; run < 5; run += 1) {
        const started = performance.now();
        const response = await request(app)
          .get(`/api/audits/criteria?programId=${programId(size)}`)
          .set('Authorization', auth())
          .set('x-organization-id', ORG);
        samples.push(performance.now() - started);
        expect(response.status, JSON.stringify(response.body)).toBe(200);
        contentLength = Number(
          response.headers['content-length'] ?? Buffer.byteLength(JSON.stringify(response.body))
        );
      }
      samples.sort((a, b) => a - b);
      measurements.push({
        criteria: size,
        contentLengthKb: Number((contentLength / 1024).toFixed(2)),
        medianMs: Number(samples[2].toFixed(2)),
        samplesMs: samples.map((value) => Number(value.toFixed(2))),
      });
    }
    const explain = await auditAll<{ 'QUERY PLAN': string }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT * FROM audit_program_criteria
        WHERE organization_id=$1 AND program_id=$2 ORDER BY ordinal ASC`,
      [ORG, programId(300)]
    );
    const plan = explain.map((row) => row['QUERY PLAN']).join('\n');
    const evidence = { measurements, explain: plan };
    console.info('DAY41_CRITERIA_SCALE=' + JSON.stringify(evidence));
    if (process.env.DAY41_SCALE_PATH) {
      await writeFile(process.env.DAY41_SCALE_PATH, JSON.stringify(evidence, null, 2));
    }
    expect(measurements.map((row) => row.criteria)).toEqual([42, 150, 300]);
    expect(measurements.every((row) => row.contentLengthKb > 0 && row.medianMs > 0)).toBe(true);
    expect(plan).toMatch(/Index Scan using idx_audit_program_criteria_(program|status)/);
  }, 180_000);
});
