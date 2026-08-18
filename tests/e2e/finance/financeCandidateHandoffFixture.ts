import { randomUUID } from 'node:crypto';

import pg from 'pg';

export type FinanceCandidateFixture = {
  runId: string;
  modelId: string;
  concurrentModelId: string;
  packId: string;
  stalePackId: string;
  valuationId: string;
  recommendationId: string;
  sourceIds: string[];
};

export async function seedFinanceCandidateFixture(
  client: pg.PoolClient,
  organizationId: string,
  userId: string
): Promise<FinanceCandidateFixture> {
  const runId = `fin_candidate_${randomUUID().replaceAll('-', '')}`;
  const modelId = `${runId}_model`;
  const concurrentModelId = `${runId}_model_concurrent`;
  const packId = `${runId}_pack`;
  const stalePackId = `${runId}_pack_stale`;
  const valuationId = `${runId}_valuation`;
  const recommendationId = `${runId}_recommendation`;
  const now = new Date().toISOString();
  const snapshot = JSON.stringify({ periods: [{ index: 0 }], validations: [], computedAt: now });

  for (const id of [modelId, concurrentModelId]) {
    await client.query(
      `INSERT INTO financial_models
         (id, organization_id, name, currency, scenario, horizon_months, start_date, status,
          version, approved_by, approved_at, approved_snapshot, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,'EUR','base',24,'2026-01-01','approved',2,$4,$5,$6,$4,$5,$5)`,
      [id, organizationId, `Candidate ${id}`, userId, now, snapshot]
    );
  }
  for (const [id, readiness] of [
    [packId, 'ready'],
    [stalePackId, 'ready'],
  ] as const) {
    await client.query(
      `INSERT INTO financial_statement_packs
         (id, organization_id, entity_name, period_start, period_end, period_label, currency,
          scaling, pack_status, pack_readiness_status, pack_readiness_score, pack_quality_summary,
          pack_quality_reason_codes, source_statement_count, missing_statement_types)
       VALUES ($1,$2,$3,'2026-01-01','2026-03-31','Q1 2026','EUR','units','ready',$4,90,
               'Reconciled','["complete"]',1,'[]')`,
      [id, organizationId, `Candidate ${id}`, readiness]
    );
  }
  await client.query(
    `INSERT INTO valuations
       (id, organization_id, project_id, title, status, source_type, source_id,
        horizon_years, currency, assumptions, peers, results, advisory, version, created_by)
     VALUES ($1,$2,NULL,$3,'APPROVED','manual',NULL,5,'EUR','{}','[]','{}',$4,1,$5)`,
    [
      valuationId,
      organizationId,
      `Candidate ${valuationId}`,
      JSON.stringify({
        generatedAt: now,
        recommendations: [
          {
            id: recommendationId,
            category: 'risk_reduction',
            title: `Candidate ${recommendationId}`,
            hypothesis: 'Reduce execution risk',
            mechanism: 'Governed candidate handoff',
          },
        ],
      }),
      userId,
    ]
  );

  return {
    runId,
    modelId,
    concurrentModelId,
    packId,
    stalePackId,
    valuationId,
    recommendationId,
    sourceIds: [modelId, concurrentModelId, packId, stalePackId, recommendationId],
  };
}

export async function candidateResidue(
  client: pg.PoolClient,
  organizationId: string,
  sourceIds: string[]
): Promise<{ candidates: number; receipts: number }> {
  const result = await client.query<{ candidates: number; receipts: number }>(
    `SELECT
       (SELECT count(*)::int FROM initiative_candidates
         WHERE organization_id=$1 AND source_id=ANY($2::text[])) candidates,
       (SELECT count(*)::int FROM finance_candidate_handoffs
         WHERE organization_id=$1 AND source_id=ANY($2::text[])) receipts`,
    [organizationId, sourceIds]
  );
  return result.rows[0]!;
}

export async function cleanupFinanceCandidateFixture(
  client: pg.PoolClient,
  organizationId: string,
  fixture: FinanceCandidateFixture
): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(
      `DELETE FROM finance_candidate_handoffs WHERE organization_id=$1 AND source_id=ANY($2::text[])`,
      [organizationId, fixture.sourceIds]
    );
    await client.query(
      `DELETE FROM initiative_candidates WHERE organization_id=$1 AND source_id=ANY($2::text[])`,
      [organizationId, fixture.sourceIds]
    );
    await client.query(`DELETE FROM valuations WHERE organization_id=$1 AND id=$2`, [
      organizationId,
      fixture.valuationId,
    ]);
    await client.query(
      `DELETE FROM financial_statement_packs WHERE organization_id=$1 AND id=ANY($2::text[])`,
      [organizationId, [fixture.packId, fixture.stalePackId]]
    );
    await client.query(
      `DELETE FROM financial_models WHERE organization_id=$1 AND id=ANY($2::text[])`,
      [organizationId, [fixture.modelId, fixture.concurrentModelId]]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
