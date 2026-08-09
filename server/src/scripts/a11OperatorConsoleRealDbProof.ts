import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
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

async function migration(name: string): Promise<void> {
  await pool.query(
    adaptQuery(fs.readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'))
  );
}

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migration('20260323_v8_execution_spine.sql');
  await migration('20260323_v8_execution_spine_approval_flow.sql');
  await migration('20260807_agent_t01_transformation_case.sql');
  await migration('20260807_v8_agent_run_identity.sql');
  await migration('20260807_v8_multi_agent_work_manager.sql');
  await migration('20260807_v8_agent_quality_evaluation.sql');
  await migration('20260807_v8_agent_operator_console.sql');
  await pool.query(`CREATE TABLE wave8_agent_tool_governance_events (
    event_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL, tool_id TEXT, tool_name TEXT NOT NULL, project_id TEXT,
    run_id TEXT, decision TEXT NOT NULL, reason TEXT NOT NULL, policy_ref TEXT,
    input_digest TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const runId = '00000000-0000-4000-8000-000000001111';
  await pool.query(
    `INSERT INTO v8_execution_runs
    (run_id, organization_id, context_snapshot_id, initiator_user_id, state, plan_version, goal, expires_at, metadata)
    VALUES ($1, 'org-a11', 'snapshot-a11', 'owner-a11', 'waiting_for_review', 1, 'Diagnose transformation run', '2026-08-07T09:00:00.000Z', '{}')`,
    [runId]
  );
  await pool.query(`INSERT INTO transformation_cases
    (transformation_case_id,organization_id,execution_run_id,initiated_by_user_id,mandate,status,lifecycle_stage,lineage_id,idempotency_key,version)
    VALUES ('case-a11','org-a11',$1,'owner-a11','Diagnose transformation run','plan_proposed','mandate','lineage-a11','case-a11-idem',1)`,[runId]);
  await pool.query(`INSERT INTO v8_agent_run_identities(canonical_run_id,organization_id,transformation_case_id,lineage_id) VALUES ($1,'org-a11','case-a11','lineage-a11')`,[runId]);
  await pool.query(
    `INSERT INTO v8_action_proposals
    (proposal_id, execution_run_id, context_snapshot_ref, proposal_type, target_ref, summary, reason,
     mutation_description, risk_class, approval_class, depends_on, status)
    VALUES ('proposal-a11', $1, 'snapshot-a11', 'request_human_decision', '{}', 'Review', 'Gate', '{}',
     'governance_transition', 'requires_human_approval', '[]', 'pending_review')`,
    [runId]
  );
  await pool.query(
    `INSERT INTO v8_agent_work_graphs
    (graph_id, execution_run_id, organization_id, lead_agent_id, mode, status, budget_json, created_by)
    VALUES ('graph-a11', $1, 'org-a11', 'lead-teresa', 'sequential', 'blocked', '{}', 'owner-a11')`,
    [runId]
  );
  await pool.query(`INSERT INTO v8_agent_branch_tasks
    (task_id, graph_id, organization_id, specialist_agent_id, title, objective, expected_output_schema_json,
     dependencies_json, tool_scope_json, budget_json, status, lease_owner, lease_expires_at, attempt_count, max_attempts)
    VALUES
    ('expired-a11', 'graph-a11', 'org-a11', 'research-agent', 'Expired', 'Recover', '{}', '[]', '[]', '{}', 'running', 'dead-worker', '2026-08-07T09:00:00.000Z', 1, 3),
    ('failed-a11', 'graph-a11', 'org-a11', 'finance-agent', 'Failed', 'Retry', '{}', '[]', '[]', '{}', 'failed', NULL, NULL, 1, 3),
    ('rollback-a11', 'graph-a11', 'org-a11', 'finance-agent', 'Rollback', 'Prove atomicity', '{}', '[]', '[]', '{}', 'failed', NULL, NULL, 1, 3)`);
  await pool.query(
    `INSERT INTO wave8_agent_tool_governance_events
    (event_id, organization_id, user_id, agent_id, tool_name, run_id, decision, reason, input_digest)
    VALUES ('event-allowed', 'org-a11', 'owner-a11', 'research-agent', 'search_web', $1, 'allowed', 'allowed', repeat('a',64)),
           ('event-denied', 'org-a11', 'owner-a11', 'execution-agent', 'create_initiative_draft', $1, 'denied', 'approval_required', repeat('b',64))`,
    [runId]
  );
  await pool.query(
    `INSERT INTO v8_agent_quality_eval_runs
    (eval_run_id, organization_id, execution_run_id, candidate_sha, suite_version, status, score,
     threshold, total_cases, passed_cases, critical_failures_json, created_by)
    VALUES ('eval-a11', 'org-a11', $1, 'abcdef1234567890', '1.0.0', 'failed', 0.8, 0.85, 5, 4, '["tenant_isolation"]', 'owner-a11')`,
    [runId]
  );
  const operator = await import('../services/v8/agentOperatorConsoleService.js');
  const staleRunId = '00000000-0000-4000-8000-000000001112';
  const futureRunId = '00000000-0000-4000-8000-000000001113';
  const wrongStateRunId = '00000000-0000-4000-8000-000000001114';
  const receiptRollbackRunId = '00000000-0000-4000-8000-000000001115';
  const transitionRollbackRunId = '00000000-0000-4000-8000-000000001116';
  await pool.query(`INSERT INTO v8_execution_runs
    (run_id,organization_id,context_snapshot_id,initiator_user_id,state,plan_version,goal,expires_at,metadata)
    VALUES
    ($1,'org-a11','snapshot-stale','owner-a11','waiting_for_review',1,'Expire stale review','2026-08-07T09:00:00.000Z','{}'),
    ($2,'org-a11','snapshot-future','owner-a11','waiting_for_review',1,'Keep future review','2026-08-07T11:00:00.000Z','{}'),
    ($3,'org-a11','snapshot-wrong','owner-a11','planning',1,'Keep planning run','2026-08-07T09:00:00.000Z','{}'),
    ($4,'org-a11','snapshot-receipt','owner-a11','waiting_for_review',1,'Rollback receipt','2026-08-07T09:00:00.000Z','{}'),
    ($5,'org-a11','snapshot-transition','owner-a11','waiting_for_review',1,'Rollback transition','2026-08-07T09:00:00.000Z','{}')`,
    [staleRunId,futureRunId,wrongStateRunId,receiptRollbackRunId,transitionRollbackRunId]);
  await pool.query(`INSERT INTO v8_action_proposals
    (proposal_id,execution_run_id,context_snapshot_ref,proposal_type,target_ref,summary,reason,
     mutation_description,risk_class,approval_class,depends_on,status)
    VALUES ('proposal-stale-a11',$1,'snapshot-stale','request_human_decision','{}','Review','Gate','{}',
      'governance_transition','requires_human_approval','[]','pending_review')`,[staleRunId]);
  const expireInput={organizationId:'org-a11',executionRunId:staleRunId,actorUserId:'operator-a11',targetId:staleRunId,action:'expire_stale_review' as const,reason:'Review deadline elapsed without a governance decision.',idempotencyKey:'a11-expire-stale-review',now:'2026-08-07T10:00:00.000Z'};
  const [expired, expiredConcurrentReplay]=await Promise.all([
    operator.recoverAgentRunTarget(expireInput), operator.recoverAgentRunTarget(expireInput),
  ]);
  assert.equal(expired.recoveryId,expiredConcurrentReplay.recoveryId);
  assert.equal([expired,expiredConcurrentReplay].filter(item=>item.idempotentReplay).length,1);
  assert.equal(expired.status,'expired');
  const staleState=(await pool.query(`SELECT
    (SELECT state FROM v8_execution_runs WHERE run_id=$1) state,
    (SELECT COUNT(*)::int FROM v8_run_state_transitions WHERE run_id=$1 AND from_state='waiting_for_review' AND to_state='expired') transition_count,
    (SELECT COUNT(*)::int FROM v8_agent_operator_recovery_events WHERE execution_run_id=$1 AND action='expire_stale_review') receipt_count,
    (SELECT status FROM v8_action_proposals WHERE proposal_id='proposal-stale-a11') proposal_status`,[staleRunId])).rows[0];
  assert.deepEqual(staleState,{state:'expired',transition_count:1,receipt_count:1,proposal_status:'pending_review'});
  const replay=await operator.recoverAgentRunTarget(expireInput);assert.equal(replay.recoveryId,expired.recoveryId);assert.equal(replay.idempotentReplay,true);
  await assert.rejects(()=>operator.recoverAgentRunTarget({...expireInput,reason:'A materially different reason.'}),/recovery_idempotency_payload_conflict/);
  await assert.rejects(()=>operator.recoverAgentRunTarget({...expireInput,organizationId:'org-foreign',idempotencyKey:'a11-expire-foreign-tenant'}),/operator_target_not_found/);
  await assert.rejects(()=>operator.recoverAgentRunTarget({...expireInput,executionRunId:'00000000-0000-4000-8000-000000009999',targetId:'00000000-0000-4000-8000-000000009999',idempotencyKey:'a11-expire-foreign-run'}),/operator_target_not_found/);
  await assert.rejects(()=>operator.recoverAgentRunTarget({...expireInput,executionRunId:futureRunId,targetId:futureRunId,idempotencyKey:'a11-expire-future'}),/stale_review_expiry_not_allowed/);
  await assert.rejects(()=>operator.recoverAgentRunTarget({...expireInput,executionRunId:wrongStateRunId,targetId:wrongStateRunId,idempotencyKey:'a11-expire-wrong-state'}),/stale_review_expiry_not_allowed/);
  await pool.query(`CREATE OR REPLACE FUNCTION fail_a11_expiry_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='a11-expire-receipt-failure' THEN RAISE EXCEPTION 'forced_expiry_receipt_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_a11_expiry_receipt_trigger BEFORE INSERT ON v8_agent_operator_recovery_events FOR EACH ROW EXECUTE FUNCTION fail_a11_expiry_receipt()`);
  await assert.rejects(()=>operator.recoverAgentRunTarget({...expireInput,executionRunId:receiptRollbackRunId,targetId:receiptRollbackRunId,idempotencyKey:'a11-expire-receipt-failure'}),/forced_expiry_receipt_failure/);
  assert.equal((await pool.query(`SELECT state FROM v8_execution_runs WHERE run_id=$1`,[receiptRollbackRunId])).rows[0].state,'waiting_for_review');
  await pool.query(`DROP TRIGGER fail_a11_expiry_receipt_trigger ON v8_agent_operator_recovery_events; DROP FUNCTION fail_a11_expiry_receipt()`);
  await pool.query(`CREATE OR REPLACE FUNCTION fail_a11_expiry_transition() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.run_id='${transitionRollbackRunId}' THEN RAISE EXCEPTION 'forced_expiry_transition_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_a11_expiry_transition_trigger BEFORE INSERT ON v8_run_state_transitions FOR EACH ROW EXECUTE FUNCTION fail_a11_expiry_transition()`);
  await assert.rejects(()=>operator.recoverAgentRunTarget({...expireInput,executionRunId:transitionRollbackRunId,targetId:transitionRollbackRunId,idempotencyKey:'a11-expire-transition-failure'}),/forced_expiry_transition_failure/);
  assert.equal((await pool.query(`SELECT state FROM v8_execution_runs WHERE run_id=$1`,[transitionRollbackRunId])).rows[0].state,'waiting_for_review');
  await pool.query(`DROP TRIGGER fail_a11_expiry_transition_trigger ON v8_run_state_transitions; DROP FUNCTION fail_a11_expiry_transition()`);
  const before = await operator.getAgentRunOperationalSnapshot({
    executionRunId: runId,
    organizationId: 'org-a11',
    now: '2026-08-07T10:00:00.000Z',
  });
  assert.equal(before.alerts.length, 5);
  assert.equal(before.metrics.proposalsPending, 1);
  assert.equal(before.metrics.toolInvocationsAllowed, 1);
  assert.equal(before.metrics.toolInvocationsDenied, 1);
  assert.equal(before.metrics.latestQualityStatus, 'failed');
  const recoveryInput = {
    organizationId: 'org-a11',
    executionRunId: runId,
    actorUserId: 'operator-a11',
    targetId: 'expired-a11',
    action: 'recover_expired_lease',
    reason: 'Worker process terminated; lease is expired.',
    idempotencyKey: 'a11-expired-recovery-key',
    now: '2026-08-07T10:00:00.000Z',
  } as const;
  const [recovered, concurrentReplay] = await Promise.all([
    operator.recoverAgentRunTarget(recoveryInput),
    operator.recoverAgentRunTarget(recoveryInput),
  ]);
  assert.equal(recovered.status, 'pending');
  assert.equal(concurrentReplay.recoveryId, recovered.recoveryId);
  assert.equal([recovered, concurrentReplay].filter((item) => item.idempotentReplay).length, 1);
  await assert.rejects(
    () => operator.recoverAgentRunTarget({ ...recoveryInput, targetId: 'failed-a11' }),
    /recovery_idempotency_payload_conflict/
  );
  const retried = await operator.recoverAgentRunTarget({
    organizationId: 'org-a11', executionRunId: runId, actorUserId: 'operator-a11',
    targetId: 'failed-a11', action: 'retry_failed_branch', reason: 'Retry bounded transient failure.',
    idempotencyKey: 'a11-failed-retry-key',
  });
  assert.equal(retried.status, 'pending');
  await pool.query(`INSERT INTO v8_agent_branch_tasks
    (task_id,graph_id,organization_id,specialist_agent_id,title,objective,expected_output_schema_json,dependencies_json,tool_scope_json,budget_json,status,lease_owner,lease_expires_at,attempt_count,max_attempts)
    VALUES ('nonexpired-a11','graph-a11','org-a11','ops-agent','Live lease','Do not recover','{}','[]','[]','{}','running','live-worker','2026-08-07T11:00:00.000Z',1,3),
           ('maxed-a11','graph-a11','org-a11','ops-agent','Maxed','Do not retry','{}','[]','[]','{}','failed',NULL,NULL,3,3)`);
  await assert.rejects(() => operator.recoverAgentRunTarget({organizationId:'org-a11',executionRunId:runId,actorUserId:'operator-a11',targetId:'nonexpired-a11',action:'recover_expired_lease',reason:'Must remain live.',idempotencyKey:'a11-nonexpired-key',now:'2026-08-07T10:00:00.000Z'}),/branch_lease_not_expired/);
  await assert.rejects(() => operator.recoverAgentRunTarget({organizationId:'org-a11',executionRunId:runId,actorUserId:'operator-a11',targetId:'maxed-a11',action:'retry_failed_branch',reason:'Must respect max attempts.',idempotencyKey:'a11-maxed-key'}),/branch_retry_not_allowed/);
  await assert.rejects(() => operator.recoverAgentRunTarget({...recoveryInput,organizationId:'org-foreign',idempotencyKey:'a11-foreign-tenant'}),/operator_target_not_found/);
  await assert.rejects(() => operator.recoverAgentRunTarget({...recoveryInput,executionRunId:'foreign-run',idempotencyKey:'a11-foreign-run'}),/operator_target_not_found/);
  await pool.query(`CREATE OR REPLACE FUNCTION fail_a11_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='a11-force-receipt-failure' THEN RAISE EXCEPTION 'forced_receipt_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_a11_receipt_trigger BEFORE INSERT ON v8_agent_operator_recovery_events FOR EACH ROW EXECUTE FUNCTION fail_a11_receipt()`);
  await assert.rejects(() => operator.recoverAgentRunTarget({
    organizationId:'org-a11',executionRunId:runId,actorUserId:'operator-a11',targetId:'rollback-a11',
    action:'retry_failed_branch',reason:'Receipt must be atomic.',idempotencyKey:'a11-force-receipt-failure',
  }),/forced_receipt_failure/);
  assert.equal((await pool.query(`SELECT status FROM v8_agent_branch_tasks WHERE task_id='rollback-a11'`)).rows[0].status,'failed');
  await pool.query(`DROP TRIGGER fail_a11_receipt_trigger ON v8_agent_operator_recovery_events; DROP FUNCTION fail_a11_receipt()`);
  await pool.query(`INSERT INTO v8_agent_work_graphs(graph_id,execution_run_id,organization_id,lead_agent_id,mode,status,budget_json,created_by) VALUES ('graph-rollback-a11',$1,'org-a11','lead','sequential','planned','{}','owner-a11')`,[runId]);
  await pool.query(`INSERT INTO v8_agent_branch_tasks(task_id,graph_id,organization_id,specialist_agent_id,title,objective,expected_output_schema_json,dependencies_json,tool_scope_json,budget_json,status) VALUES ('graph-rollback-task','graph-rollback-a11','org-a11','ops','Pending','Rollback','{}','[]','[]','{}','pending')`);
  await pool.query(`CREATE OR REPLACE FUNCTION fail_a11_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.external_id='graph-rollback-a11' THEN RAISE EXCEPTION 'forced_outbox_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_a11_outbox_trigger BEFORE INSERT ON v8_agent_canonical_projection_outbox FOR EACH ROW EXECUTE FUNCTION fail_a11_outbox()`);
  await assert.rejects(()=>operator.recoverAgentRunTarget({organizationId:'org-a11',executionRunId:runId,actorUserId:'operator-a11',targetId:'graph-rollback-a11',action:'cancel_graph',reason:'Prove outbox rollback.',idempotencyKey:'a11-cancel-outbox-failure'}),/forced_outbox_failure/);
  assert.deepEqual((await pool.query(`SELECT (SELECT status FROM v8_agent_work_graphs WHERE graph_id='graph-rollback-a11') graph_status,(SELECT status FROM v8_agent_branch_tasks WHERE task_id='graph-rollback-task') task_status`)).rows[0],{graph_status:'planned',task_status:'pending'});
  await pool.query(`DROP TRIGGER fail_a11_outbox_trigger ON v8_agent_canonical_projection_outbox; DROP FUNCTION fail_a11_outbox()`);
  const cancelInput={organizationId:'org-a11',executionRunId:runId,actorUserId:'operator-a11',targetId:'graph-a11',action:'cancel_graph' as const,reason:'Stop graph cooperatively.',idempotencyKey:'a11-cancel-graph-key'};
  const [cancelled, cancelReplay]=await Promise.all([operator.recoverAgentRunTarget(cancelInput),operator.recoverAgentRunTarget(cancelInput)]);
  assert.equal(cancelled.recoveryId,cancelReplay.recoveryId);assert.equal([cancelled,cancelReplay].filter(x=>x.idempotentReplay).length,1);
  const cancellationState=(await pool.query(`SELECT (SELECT status FROM v8_agent_work_graphs WHERE graph_id='graph-a11') graph_status,(SELECT status FROM v8_agent_branch_tasks WHERE task_id='nonexpired-a11') running_status,(SELECT status FROM v8_agent_branch_tasks WHERE task_id='rollback-a11') pending_status,(SELECT COUNT(*)::int FROM v8_agent_canonical_projection_outbox WHERE external_id='graph-a11') outbox_count`)).rows[0];
  assert.deepEqual(cancellationState,{graph_status:'cancellation_requested',running_status:'cancellation_requested',pending_status:'cancelled',outbox_count:1});
  const projected=await operator.processCanonicalProjectionOutbox({workerId:'projection-worker-a11'});assert.equal(projected.length,1);assert.equal(projected[0].status,'applied');
  const restartReplay=await operator.processCanonicalProjectionOutbox({workerId:'projection-worker-restart'});assert.deepEqual(restartReplay,[]);
  assert.equal((await pool.query(`SELECT COUNT(*)::int count FROM v8_agent_run_aliases WHERE canonical_run_id=$1 AND alias_type='work_graph' AND external_id='graph-a11'`,[runId])).rows[0].count,1);
  await assert.rejects(()=>operator.acknowledgeWorkGraphTaskCancellation({organizationId:'org-a11',executionRunId:runId,graphId:'graph-a11',taskId:'nonexpired-a11',workerId:'wrong-worker'}),/cancellation_ack_not_allowed/);
  await operator.acknowledgeWorkGraphTaskCancellation({organizationId:'org-a11',executionRunId:runId,graphId:'graph-a11',taskId:'nonexpired-a11',workerId:'live-worker'});
  assert.equal((await pool.query(`SELECT status FROM v8_agent_work_graphs WHERE graph_id='graph-a11'`)).rows[0].status,'cancelled');
  const after = await operator.getAgentRunOperationalSnapshot({
    executionRunId: runId,
    organizationId: 'org-a11',
    now: '2026-08-07T10:00:00.000Z',
  });
  assert.equal(
    after.alerts.some((alert: any) => alert.code === 'EXPIRED_BRANCH_LEASE'),
    false
  );
  assert.equal(after.recoveries.length, 3);
  assert.equal(after.recoveries[0].actor_user_id, 'operator-a11');
  assert.equal(
    await operator.getAgentRunOperationalSnapshot({
      executionRunId: runId,
      organizationId: 'org-foreign',
    }),
    null
  );
  console.log(
    JSON.stringify({
      proof: 'A11_REALDB_GREEN',
      correlatedRunSnapshot: true,
      actionableAlerts: 5,
      metricsReadback: true,
      expiredLeaseRecovered: true,
      atomicIdempotentBranchRecovery: true,
      concurrentSameKey: 2,
      recoveryReceipts: 2,
      payloadConflictFailClosed: true,
      retryFailedBranchExactlyOnce: true,
      receiptFailureRolledBackMutation: true,
      nonExpiredAndMaxAttemptFailClosed: true,
      foreignTenantAndRunFailClosed: true,
      cooperativeGraphCancellation: true,
      cancelConcurrencyExactlyOnce: true,
      outboxFailureRolledBackAllWrites: true,
      restartOutboxProjectionExactlyOnce: true,
      runningTaskCancelledOnlyAfterWorkerAck: true,
      recoveryAuditBeforeAfter: true,
      tenantIsolation: true,
      atomicStaleReviewExpiry: true,
      staleReviewConcurrencyExactlyOnce: true,
      staleReviewReplayNoDuplicates: true,
      staleReviewPayloadConflictFailClosed: true,
      staleReviewReceiptAndTransitionRollback: true,
      futureWrongStateTenantRunFailClosed: true,
      pendingProposalUnchanged: true,
    })
  );
}

main().finally(() => pool.end());
