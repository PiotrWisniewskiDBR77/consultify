import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';

/**
 * A10 canonical live evaluator.
 *
 * This script used to reach for the process-wide DB proxy, which is only wired
 * up by the server bootstrap: run standalone it resolved to an unconnected stub
 * and `DbPromise.all` (fallback: true) turned that into an EMPTY RESULT rather
 * than an error, so the proof reported
 * `A10_LIVE_PROOF_REQUIRES_COMPLETED_TRANSFORMATION_CASE` against a database
 * that did contain a completed Case. It now installs the same pool-backed shim
 * as the other RealDB proofs before importing any service.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  get(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, row: unknown) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows[0] ?? null);
    if (callback)
      void promise.then(
        (row) => callback(null, row),
        (error) => callback(error as Error, null)
      );
    return proofDb;
  },
  all(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, rows: unknown[]) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows);
    if (callback)
      void promise.then(
        (rows) => callback(null, rows),
        (error) => callback(error as Error, [])
      );
    return proofDb;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((result) => ({ changes: result.rowCount ?? 0 }));
    if (callback)
      void promise.then(
        (result) => callback.call(result, null),
        (error) => callback.call({ changes: 0 }, error as Error)
      );
    return proofDb;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize: (callback: () => void) => callback(),
  close: () => Promise.resolve(),
};

async function main(): Promise<void> {
  (globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
  (process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
  const { evaluateTransformationCaseLive } = await import(
    '../services/v8/agentQualityEvaluationService.js'
  );

  const latest = (
    await pool.query<{
      transformation_case_id: string;
      organization_id: string;
      lifecycle_stage: string;
    }>(
      `SELECT transformation_case_id,organization_id,lifecycle_stage
         FROM transformation_cases
        WHERE lifecycle_stage='final_outputs'
        ORDER BY updated_at DESC LIMIT 1`
    )
  ).rows[0];
  if (!latest) throw new Error('A10_LIVE_PROOF_REQUIRES_COMPLETED_TRANSFORMATION_CASE');

  const evaluation = await evaluateTransformationCaseLive({
    transformationCaseId: latest.transformation_case_id,
    organizationId: latest.organization_id,
  });
  if (!evaluation || evaluation.cases.length !== 5) {
    throw new Error('A10_LIVE_EVALUATION_MISSING');
  }
  const crossTenant = await evaluateTransformationCaseLive({
    transformationCaseId: latest.transformation_case_id,
    organizationId: `${latest.organization_id}-foreign`,
  });
  if (crossTenant !== null) throw new Error('A10_TENANT_ISOLATION_FAILED');

  console.log(
    JSON.stringify({
      proof: 'A10_LIVE_READBACK_BOUND',
      transformationCaseId: latest.transformation_case_id,
      lifecycleStage: latest.lifecycle_stage,
      status: evaluation.status,
      score: evaluation.score,
      passedCases: evaluation.cases.filter((item) => item.passed).map((item) => item.caseKey),
      failedCases: evaluation.cases.filter((item) => !item.passed).map((item) => item.caseKey),
      criticalFailures: evaluation.criticalFailures,
      crossTenantReadback: crossTenant,
    })
  );
}

main().then(
  async () => {
    await pool.end();
    process.exit(0);
  },
  async (error) => {
    await pool.end();
    console.error(error);
    process.exit(1);
  }
);
