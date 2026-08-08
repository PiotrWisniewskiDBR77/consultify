import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
const candidateSha = process.env.CANDIDATE_SHA;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (!candidateSha) throw new Error('CANDIDATE_SHA is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
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
    return callback ? proofDb : promise;
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
    return callback ? proofDb : promise;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((result) => ({ changes: result.rowCount ?? 0 }));
    if (callback)
      void promise.then(
        (result) => callback.call({ changes: result.changes }, null),
        (error) => callback.call({ changes: 0 }, error as Error)
      );
    return callback ? proofDb : promise;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize(callback: () => void) {
    callback();
  },
  close: () => Promise.resolve(),
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260807_v8_agent_quality_evaluation.sql', import.meta.url),
        'utf8'
      )
    )
  );
  const report = 'verified report with canonical lineage';
  const cases = [
    {
      caseKey: 'tenant-isolation',
      capability: 'governance',
      dimension: 'policy_compliance' as const,
      criticalInvariant: 'tenant_isolation' as const,
      validator: 'equals' as const,
      actual: 0,
      expected: 0,
      evidenceRefs: ['pg://tenant-probe'],
    },
    {
      caseKey: 'finance-npv',
      capability: 'finance',
      dimension: 'correctness' as const,
      criticalInvariant: 'financial_mechanics' as const,
      validator: 'numeric_tolerance' as const,
      actual: 125.001,
      expected: { value: 125, tolerance: 0.01 },
      evidenceRefs: ['pg://finance-independent-check'],
    },
    {
      caseKey: 'approval-owner',
      capability: 'approval',
      dimension: 'completeness' as const,
      criticalInvariant: 'gate_ownership' as const,
      validator: 'allowed_state' as const,
      actual: 'approved_by_owner',
      expected: ['approved_by_owner'],
      evidenceRefs: ['pg://approval-audit'],
    },
    {
      caseKey: 'report-digest',
      capability: 'report',
      dimension: 'evidence' as const,
      criticalInvariant: 'source_honesty' as const,
      validator: 'sha256_match' as const,
      actual: report,
      expected: createHash('sha256').update(report).digest('hex'),
      evidenceRefs: ['artifact://report.docx'],
    },
    {
      caseKey: 'truthful-summary',
      capability: 'final_summary',
      dimension: 'usefulness' as const,
      criticalInvariant: 'false_completion' as const,
      validator: 'forbidden_patterns_absent' as const,
      actual: 'Local gates passed; deployed browser proof remains pending.',
      expected: ['all accepted', 'fully deployed'],
      evidenceRefs: ['pg://run-state'],
    },
  ];
  const evaluation = await import('../services/v8/agentQualityEvaluationService.js');
  const passing = await evaluation.runAgentQualityEvaluation({
    organizationId: 'org-a10',
    executionRunId: 'run-a10',
    candidateSha,
    createdBy: 'owner-a10',
    suiteVersion: '1.0.0',
    cases,
  });
  assert.equal(passing.status, 'passed');
  const adversarial = await evaluation.runAgentQualityEvaluation({
    organizationId: 'org-a10',
    executionRunId: 'run-a10',
    candidateSha,
    createdBy: 'owner-a10',
    suiteVersion: '1.0.0-adversarial',
    threshold: 0.5,
    cases: cases.map((test) =>
      test.caseKey === 'tenant-isolation' ? { ...test, actual: 1 } : test
    ),
  });
  assert.equal(adversarial.status, 'failed');
  assert.equal(adversarial.score, 0.8);
  assert.deepEqual(adversarial.criticalFailures, ['tenant_isolation:tenant-isolation']);
  const readback = await evaluation.getAgentQualityEvaluation(passing.evalRunId, 'org-a10');
  assert.equal(readback?.cases.length, 5);
  assert.equal(readback?.run.candidate_sha, candidateSha);
  assert.equal(await evaluation.getAgentQualityEvaluation(passing.evalRunId, 'org-foreign'), null);
  console.log(
    JSON.stringify({
      proof: 'A10_REALDB_GREEN',
      passingGate: true,
      adversarialCriticalFailureBlocked: true,
      mandatoryDimensions: 5,
      criticalInvariants: 5,
      deterministicValidators: true,
      candidateShaPinned: true,
      tenantIsolation: true,
      caseReadback: readback?.cases.length,
    })
  );
}

main().finally(() => pool.end());
