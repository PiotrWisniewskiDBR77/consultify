import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  decideDeliveryEvidence,
  submitDeliveryEvidence,
} from '../../../server/src/domain/initiatives-execution/deliveryEvidence';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('EXE-002 independent delivery evidence realDB', () => {
  const pool = new Pool({ connectionString: url, max: 4 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const org = 'org-exe002';
  const envelope = (
    actorId: string,
    expectedVersion: number,
    clientRequestId: string,
    commandType: string,
    payload: any,
    createIfMissing = false
  ) => ({
    organizationId: org,
    actorId,
    aggregateType: 'delivery_evidence',
    aggregateId: 'evidence-exe002',
    expectedVersion,
    clientRequestId,
    correlationId: clientRequestId,
    policyId: 'delivery-evidence',
    policyVersion: 1,
    commandType,
    createIfMissing,
    payload,
  });

  beforeAll(async () => {
    for (const file of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', file), 'utf8'));
  });
  beforeEach(async () => {
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES
       ($1,'initiative','initiative-1',5,$2::jsonb),
       ($1,'execution_case','case-1',3,$3::jsonb),
       ($1,'execution_task','task-open',1,$4::jsonb)`,
      [
        org,
        JSON.stringify({ initiativeId: 'initiative-1', lifecycleState: 'IN_EXECUTION' }),
        JSON.stringify({
          executionCaseId: 'case-1',
          initiativeId: 'initiative-1',
          state: 'ACTIVE',
        }),
        JSON.stringify({
          taskId: 'task-open',
          executionCaseId: 'case-1',
          initiativeId: 'initiative-1',
          status: 'OPEN',
        }),
      ]
    );
  });
  afterAll(async () => pool.end());

  const submission = {
    initiativeId: 'initiative-1',
    executionCaseId: 'case-1',
    taskId: 'task-open',
    reviewerId: 'independent-reviewer',
    evidenceRefs: [{ ref: 'artifact:delivery:sha256', version: 1 }],
  };

  it('approves evidence independently of Task status and appends exactly one Results signal under replay and concurrency', async () => {
    await submitDeliveryEvidence(
      uow,
      envelope('delivery-owner', 0, 'submit-once', 'delivery-evidence.submit', submission, true)
    );
    const taskBefore = await pool.query(
      `SELECT payload_json->>'status' status FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_task' AND aggregate_id='task-open'`,
      [org]
    );
    expect(taskBefore.rows[0].status).toBe('OPEN');

    const decision = envelope(
      'independent-reviewer',
      1,
      'approve-once',
      'delivery-evidence.decide',
      {
        outcome: 'APPROVE',
        rationale: 'Artifact and source version verified',
        resultsSignalId: 'results-signal-exe002',
      }
    );
    const [first, concurrent] = await Promise.allSettled([
      decideDeliveryEvidence(uow, decision),
      decideDeliveryEvidence(uow, {
        ...decision,
        clientRequestId: 'approve-concurrent',
        correlationId: 'approve-concurrent',
      }),
    ]);
    expect([first.status, concurrent.status].sort()).toEqual(['fulfilled', 'rejected']);
    const replay = await decideDeliveryEvidence(uow, decision);
    expect(replay.status).toBe('REPLAYED');
    const rows = await pool.query(
      `SELECT aggregate_id,version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='results_delivery_signal'`,
      [org]
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ aggregate_id: 'results-signal-exe002', version: 1 });
    expect(rows.rows[0].payload_json.deliveryEvidenceRef).toEqual({
      evidenceId: 'evidence-exe002',
      version: 2,
    });
    const taskAfter = await pool.query(
      `SELECT payload_json->>'status' status FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_task' AND aggregate_id='task-open'`,
      [org]
    );
    expect(taskAfter.rows[0].status).toBe('OPEN');
  });

  it('fails closed for self-review, wrong reviewer, foreign tenant and missing versioned evidence', async () => {
    await expect(
      submitDeliveryEvidence(
        uow,
        envelope(
          'delivery-owner',
          0,
          'self-review',
          'delivery-evidence.submit',
          {
            ...submission,
            reviewerId: 'delivery-owner',
          },
          true
        )
      )
    ).rejects.toThrow('Independent reviewer');
    await expect(
      submitDeliveryEvidence(
        uow,
        envelope(
          'delivery-owner',
          0,
          'missing-evidence',
          'delivery-evidence.submit',
          {
            ...submission,
            evidenceRefs: [],
          },
          true
        )
      )
    ).rejects.toThrow('versioned delivery evidence');
    await submitDeliveryEvidence(
      uow,
      envelope('delivery-owner', 0, 'valid-submit', 'delivery-evidence.submit', submission, true)
    );
    await expect(
      decideDeliveryEvidence(
        uow,
        envelope('wrong-reviewer', 1, 'wrong-reviewer', 'delivery-evidence.decide', {
          outcome: 'APPROVE',
          rationale: 'No authority',
          resultsSignalId: 'forbidden-signal',
        })
      )
    ).rejects.toThrow('Independent pending evidence review');
    const foreign = new PostgresMaterialCommandUnitOfWork(pool);
    await expect(
      decideDeliveryEvidence(foreign, {
        ...envelope('independent-reviewer', 1, 'foreign', 'delivery-evidence.decide', {
          outcome: 'APPROVE',
          rationale: 'Wrong tenant',
          resultsSignalId: 'foreign-signal',
        }),
        organizationId: 'foreign-org',
      })
    ).rejects.toThrow('aggregate version conflict');
    const count = await pool.query(
      `SELECT count(*)::int n FROM ie_aggregate_state WHERE aggregate_type='results_delivery_signal'`
    );
    expect(count.rows[0].n).toBe(0);
  });
});
