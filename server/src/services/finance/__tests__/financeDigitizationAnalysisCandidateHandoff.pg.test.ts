import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-da-candidate-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const analysisId = `${prefix}-analysis`;
const archivedId = `${prefix}-archived`;

async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}

let service: typeof import('../financeDigitizationAnalysisCandidateHandoff.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_DA_CANDIDATE_ALLOW_CLEANUP !== '1' ||
    !name.startsWith(process.env.FIN_DA_CANDIDATE_DB_PREFIX || 'never-match')
  ) {
    throw new Error('Digitization Candidate proof requires an explicitly guarded disposable DB');
  }
  const client = await db();
  try {
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Candidate A'),($2,'Candidate B')`,
      [orgA, orgB]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Candidate','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO digitization_analyses
       (id,name,description,status,analysis_type,organization_id,created_by,archived_at,created_at,updated_at)
       VALUES($1,'Factory digitization','Upgrade bottleneck','completed','financial',$2,$3,NULL,now(),now()),
             ($4,'Archived source','Do not promote','completed','financial',$2,$3,now(),now(),now())`,
      [analysisId, orgA, actor, archivedId]
    );
    await client.query(
      `INSERT INTO analysis_financials
       (id,analysis_id,organization_id,currency,initial_investment,implementation_cost,
        training_cost,annual_operating_cost,npv,irr,roi_percent,payback_months,
        created_at,updated_at)
       VALUES($1,$2,$3,'EUR',100,20,5,10,55,14,21,18,now(),now())`,
      [`${prefix}-financials`, analysisId, orgA]
    );
  } finally {
    await client.end();
  }
  service = await import('../financeDigitizationAnalysisCandidateHandoff.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    const candidateRows = await client.query<{ candidate_id: string }>(
      `SELECT candidate_id FROM finance_candidate_handoffs
       WHERE organization_id=ANY($1::text[]) AND source_id LIKE $2`,
      [[orgA, orgB], `${prefix}%`]
    );
    await client.query(
      `DELETE FROM finance_candidate_handoffs WHERE organization_id=ANY($1::text[]) AND source_id LIKE $2`,
      [[orgA, orgB], `${prefix}%`]
    );
    if (candidateRows.rows.length) {
      await client.query(`DELETE FROM initiative_candidates WHERE id=ANY($1::text[])`, [
        candidateRows.rows.map((row) => row.candidate_id),
      ]);
    }
    await client.query(`DELETE FROM analysis_financials WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM digitization_analyses WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE id=$1`, [actor]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    await client.query('COMMIT');
    const residue = await client.query<{ n: string }>(
      `SELECT ((SELECT count(*) FROM finance_candidate_handoffs WHERE organization_id=ANY($1::text[]))+
               (SELECT count(*) FROM digitization_analyses WHERE organization_id=ANY($1::text[]))+
               (SELECT count(*) FROM organizations WHERE id=ANY($1::text[])))::text n`,
      [[orgA, orgB]]
    );
    expect(residue.rows[0].n).toBe('0');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
});

describeRealDb('ECO-W10 digitization analysis -> canonical Candidate (real PostgreSQL)', () => {
  it('previews persisted source facts without writing', async () => {
    const preview = await service.previewDigitizationAnalysisCandidate({
      organizationId: orgA,
      analysisId,
    });
    expect(preview).toMatchObject({
      eligible: true,
      preview: {
        sourceType: 'finance_digitization_analysis',
        title: 'Factory digitization',
        sourceSnapshot: { currency: 'EUR', capex: 125, opex: 10, npv: 55, roi: 21 },
      },
    });
    const client = await db();
    try {
      expect(
        await client.query(`SELECT 1 FROM finance_candidate_handoffs WHERE source_id=$1`, [
          analysisId,
        ])
      ).toHaveProperty('rowCount', 0);
    } finally {
      await client.end();
    }
  });

  it('creates exactly one Candidate and receipt under concurrent retries', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        service.confirmDigitizationAnalysisCandidateHandoff({
          organizationId: orgA,
          analysisId,
          createdBy: actor,
        })
      )
    );
    expect(new Set(results.map((result) => result.candidateId))).toHaveLength(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    const client = await db();
    try {
      const state = await client.query<{
        candidates: number;
        receipts: number;
        initiatives: number;
      }>(
        `SELECT
          (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$1 AND source_id=$2) candidates,
          (SELECT count(*)::int FROM finance_candidate_handoffs WHERE organization_id=$1 AND source_id=$2) receipts,
          (SELECT count(*)::int FROM initiatives WHERE organization_id=$1) initiatives`,
        [orgA, analysisId]
      );
      expect(state.rows[0]).toEqual({ candidates: 1, receipts: 1, initiatives: 0 });
    } finally {
      await client.end();
    }
  });

  it('rejects archived and foreign-tenant sources without writing', async () => {
    expect(
      await service.previewDigitizationAnalysisCandidate({
        organizationId: orgA,
        analysisId: archivedId,
      })
    ).toEqual({ eligible: false, reason: 'Digitization analysis is archived' });
    expect(
      await service.previewDigitizationAnalysisCandidate({ organizationId: orgB, analysisId })
    ).toEqual({ eligible: false, reason: 'Digitization analysis not found' });
  });
});
