import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { withPgTransaction } from '../../utils/queryHelpers.js';
import { projectCanonicalRunAfterExternalTransition } from './agentCanonicalRunService.js';

async function safeAll(sql: string, params: unknown[]): Promise<any[]> {
  return dbAll(sql, params, { fallback: true }).catch(() => []);
}

export async function getAgentRunOperationalSnapshot(input: {
  executionRunId: string;
  organizationId: string;
  now?: string;
}): Promise<any | null> {
  const run = await dbGet(
    `SELECT * FROM v8_execution_runs WHERE run_id = ? AND organization_id = ?`,
    [input.executionRunId, input.organizationId]
  );
  if (!run) return null;
  const [transitions, proposals, graphs, tasks, toolEvents, evalRuns, recoveries] =
    await Promise.all([
      safeAll(`SELECT * FROM v8_run_state_transitions WHERE run_id = ? ORDER BY transitioned_at`, [
        input.executionRunId,
      ]),
      safeAll(`SELECT * FROM v8_action_proposals WHERE execution_run_id = ? ORDER BY created_at`, [
        input.executionRunId,
      ]),
      safeAll(
        `SELECT * FROM v8_agent_work_graphs WHERE execution_run_id = ? AND organization_id = ? ORDER BY created_at`,
        [input.executionRunId, input.organizationId]
      ),
      safeAll(
        `SELECT t.* FROM v8_agent_branch_tasks t INNER JOIN v8_agent_work_graphs g ON g.graph_id = t.graph_id WHERE g.execution_run_id = ? AND t.organization_id = ? ORDER BY t.created_at`,
        [input.executionRunId, input.organizationId]
      ),
      safeAll(
        `SELECT * FROM wave8_agent_tool_governance_events WHERE run_id = ? AND organization_id = ? ORDER BY created_at`,
        [input.executionRunId, input.organizationId]
      ),
      safeAll(
        `SELECT * FROM v8_agent_quality_eval_runs WHERE execution_run_id = ? AND organization_id = ? ORDER BY created_at DESC`,
        [input.executionRunId, input.organizationId]
      ),
      safeAll(
        `SELECT * FROM v8_agent_operator_recovery_events WHERE execution_run_id = ? AND organization_id = ? ORDER BY created_at`,
        [input.executionRunId, input.organizationId]
      ),
    ]);
  const now = Date.parse(input.now || new Date().toISOString());
  const expiredLeases = tasks.filter(
    (task) =>
      task.status === 'running' && task.lease_expires_at && Date.parse(task.lease_expires_at) <= now
  );
  const failedTasks = tasks.filter((task) => task.status === 'failed');
  const blockedGraphs = graphs.filter((graph) => graph.status === 'blocked');
  const expiredReview =
    run.state === 'waiting_for_review' && run.expires_at && Date.parse(run.expires_at) <= now;
  const alerts = [
    ...expiredLeases.map((task) => ({
      severity: 'critical',
      code: 'EXPIRED_BRANCH_LEASE',
      targetId: task.task_id,
      safeAction: 'recover_expired_lease',
    })),
    ...failedTasks.map((task) => ({
      severity: 'warning',
      code: 'FAILED_BRANCH',
      targetId: task.task_id,
      safeAction:
        Number(task.attempt_count) < Number(task.max_attempts) ? 'retry_failed_branch' : null,
    })),
    ...blockedGraphs.map((graph) => ({
      severity: 'warning',
      code: 'BLOCKED_GRAPH',
      targetId: graph.graph_id,
      safeAction: null,
    })),
    ...(expiredReview
      ? [
          {
            severity: 'critical',
            code: 'EXPIRED_APPROVAL_REVIEW',
            targetId: input.executionRunId,
            safeAction: 'expire_stale_review',
          },
        ]
      : []),
  ];
  return {
    correlationId: input.executionRunId,
    run,
    transitions,
    proposals,
    graphs,
    tasks,
    toolEvents,
    evalRuns,
    recoveries,
    alerts,
    metrics: {
      proposalsPending: proposals.filter((proposal) => proposal.status === 'pending_review').length,
      branchesRunning: tasks.filter((task) => task.status === 'running').length,
      branchesFailed: failedTasks.length,
      toolInvocationsAllowed: toolEvents.filter((event) => event.decision === 'allowed').length,
      toolInvocationsDenied: toolEvents.filter((event) => event.decision === 'denied').length,
      latestQualityStatus: evalRuns[0]?.status || null,
      recoveryCount: recoveries.length,
    },
  };
}

async function recordRecovery(input: {
  organizationId: string;
  executionRunId: string;
  targetType: 'branch_task' | 'work_graph';
  targetId: string;
  action: 'retry_failed_branch' | 'recover_expired_lease' | 'cancel_graph' | 'expire_stale_review';
  actorUserId: string;
  reason: string;
  before: unknown;
  after: unknown;
}): Promise<string> {
  const recoveryId = `agent-recovery-${uuidv4()}`;
  await dbRun(
    `INSERT INTO v8_agent_operator_recovery_events
      (recovery_id, organization_id, execution_run_id, target_type, target_id, action,
       actor_user_id, reason, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      recoveryId,
      input.organizationId,
      input.executionRunId,
      input.targetType,
      input.targetId,
      input.action,
      input.actorUserId,
      input.reason,
      JSON.stringify(input.before),
      JSON.stringify(input.after),
    ]
  );
  return recoveryId;
}

export async function recoverAgentRunTarget(input: {
  organizationId: string;
  executionRunId: string;
  actorUserId: string;
  targetId: string;
  action: 'retry_failed_branch' | 'recover_expired_lease' | 'cancel_graph' | 'expire_stale_review';
  reason: string;
  idempotencyKey: string;
  now?: string;
}): Promise<{ recoveryId: string; status: string; idempotentReplay?: boolean }> {
  if (!input.reason.trim()) throw new Error('recovery_reason_required');
  if (!input.idempotencyKey?.trim()) throw new Error('recovery_idempotency_key_required');
  if (!input.organizationId.trim() || !input.executionRunId.trim() || !input.actorUserId.trim())
    throw new Error('recovery_identity_required');
  if (input.action === 'cancel_graph') {
    return requestWorkGraphCancellation({ ...input, action: 'cancel_graph' });
  }
  const canonicalPayload = JSON.stringify({
    executionRunId: input.executionRunId,
    targetId: input.targetId,
    action: input.action,
    reason: input.reason.trim(),
  });
  const inputDigest = createHash('sha256').update(canonicalPayload).digest('hex');
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `${input.organizationId}:${input.executionRunId}:${input.idempotencyKey}`,
    ]);
    const replay = (
      await client.query<{ recovery_id: string; input_digest: string; after_json: unknown }>(
        `SELECT recovery_id,input_digest,after_json FROM v8_agent_operator_recovery_events
          WHERE organization_id=? AND execution_run_id=? AND idempotency_key=? FOR UPDATE`,
        [input.organizationId, input.executionRunId, input.idempotencyKey]
      )
    ).rows[0];
    if (replay) {
      if (replay.input_digest !== inputDigest) throw new Error('recovery_idempotency_payload_conflict');
      return {
        recoveryId: replay.recovery_id,
        status: input.action === 'expire_stale_review' ? 'expired' : 'pending',
        idempotentReplay: true,
      };
    }
    if (input.action === 'expire_stale_review') {
      if (input.targetId !== input.executionRunId) throw new Error('operator_target_not_found');
      const run = (
        await client.query<any>(
          `SELECT * FROM v8_execution_runs
            WHERE run_id=? AND organization_id=? FOR UPDATE`,
          [input.executionRunId, input.organizationId]
        )
      ).rows[0];
      if (!run) throw new Error('operator_target_not_found');
      const now = input.now || new Date().toISOString();
      const result = await client.query(
        `UPDATE v8_execution_runs SET state='expired',resolved_at=?,updated_at=?
          WHERE run_id=? AND organization_id=? AND state='waiting_for_review'
            AND expires_at IS NOT NULL AND expires_at<=?`,
        [now, now, input.executionRunId, input.organizationId, now]
      );
      if (Number(result.rowCount ?? 0) !== 1) throw new Error('stale_review_expiry_not_allowed');
      await client.query(
        `INSERT INTO v8_run_state_transitions
          (transition_id,run_id,from_state,to_state,triggered_by,reason,transitioned_at)
         VALUES (?,?,'waiting_for_review','expired',?,?,?)`,
        [`run-transition-${uuidv4()}`, input.executionRunId, input.actorUserId, input.reason.trim(), now]
      );
      const after = { ...run, state: 'expired', resolved_at: now, updated_at: now };
      const recoveryId = `agent-recovery-${uuidv4()}`;
      await client.query(
        `INSERT INTO v8_agent_operator_recovery_events
         (recovery_id,organization_id,execution_run_id,target_type,target_id,action,actor_user_id,
          reason,before_json,after_json,idempotency_key,input_digest)
         VALUES (?,?,?,'execution_run',?,?,?,?,?::text,?::text,?,?)`,
        [recoveryId,input.organizationId,input.executionRunId,input.targetId,input.action,input.actorUserId,
         input.reason.trim(),JSON.stringify(run),JSON.stringify(after),input.idempotencyKey,inputDigest]
      );
      return { recoveryId, status: 'expired', idempotentReplay: false };
    }
    const task = (
      await client.query<any>(
        `SELECT t.* FROM v8_agent_branch_tasks t
          INNER JOIN v8_agent_work_graphs g ON g.graph_id=t.graph_id
          WHERE t.task_id=? AND g.execution_run_id=? AND g.organization_id=?
            AND t.organization_id=? FOR UPDATE OF t`,
        [input.targetId, input.executionRunId, input.organizationId, input.organizationId]
      )
    ).rows[0];
    if (!task) throw new Error('operator_target_not_found');
    if (input.action === 'retry_failed_branch') {
      const result = await client.query(
        `UPDATE v8_agent_branch_tasks SET status='pending',error_text=NULL,updated_at=CURRENT_TIMESTAMP
          WHERE task_id=? AND organization_id=? AND status='failed' AND attempt_count < max_attempts`,
        [input.targetId, input.organizationId]
      );
      if (Number(result.rowCount ?? 0) !== 1) throw new Error('branch_retry_not_allowed');
    } else {
      const now = input.now || new Date().toISOString();
      const result = await client.query(
        `UPDATE v8_agent_branch_tasks SET status='pending',lease_owner=NULL,lease_expires_at=NULL,
          error_text='recovered_expired_lease',updated_at=CURRENT_TIMESTAMP
          WHERE task_id=? AND organization_id=? AND status='running' AND lease_expires_at<=?`,
        [input.targetId, input.organizationId, now]
      );
      if (Number(result.rowCount ?? 0) !== 1) throw new Error('branch_lease_not_expired');
    }
    const after = { ...task, status: 'pending', lease_owner: null, lease_expires_at: null };
    const recoveryId = `agent-recovery-${uuidv4()}`;
    await client.query(
      `INSERT INTO v8_agent_operator_recovery_events
       (recovery_id,organization_id,execution_run_id,target_type,target_id,action,actor_user_id,
        reason,before_json,after_json,idempotency_key,input_digest)
       VALUES (?,?,?,'branch_task',?,?,?,?,?::text,?::text,?,?)`,
      [recoveryId,input.organizationId,input.executionRunId,input.targetId,input.action,input.actorUserId,
       input.reason.trim(),JSON.stringify(task),JSON.stringify(after),input.idempotencyKey,inputDigest]
    );
    return { recoveryId, status: 'pending', idempotentReplay: false };
  });
}

async function requestWorkGraphCancellation(input: {
  organizationId: string; executionRunId: string; actorUserId: string; targetId: string;
  action: 'cancel_graph'; reason: string; idempotencyKey: string;
}): Promise<{ recoveryId: string; status: string; idempotentReplay: boolean }> {
  const payload = JSON.stringify({executionRunId:input.executionRunId,targetId:input.targetId,action:input.action,reason:input.reason.trim()});
  const inputDigest=createHash('sha256').update(payload).digest('hex');
  return withPgTransaction(async(client)=>{
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,[`${input.organizationId}:${input.executionRunId}:${input.idempotencyKey}`]);
    const replay=(await client.query<any>(`SELECT recovery_id,input_digest FROM v8_agent_operator_recovery_events WHERE organization_id=? AND execution_run_id=? AND idempotency_key=? FOR UPDATE`,[input.organizationId,input.executionRunId,input.idempotencyKey])).rows[0];
    if(replay){if(replay.input_digest!==inputDigest)throw new Error('recovery_idempotency_payload_conflict');return{recoveryId:replay.recovery_id,status:'cancellation_requested',idempotentReplay:true};}
    const graph=(await client.query<any>(`SELECT * FROM v8_agent_work_graphs WHERE graph_id=? AND execution_run_id=? AND organization_id=? FOR UPDATE`,[input.targetId,input.executionRunId,input.organizationId])).rows[0];
    if(!graph)throw new Error('operator_target_not_found');
    if(['completed','cancelled'].includes(graph.status))throw new Error('work_graph_cancel_not_allowed');
    await client.query(`UPDATE v8_agent_work_graphs SET status='cancellation_requested',updated_at=CURRENT_TIMESTAMP WHERE graph_id=? AND organization_id=?`,[input.targetId,input.organizationId]);
    await client.query(`UPDATE v8_agent_branch_tasks SET status='cancelled',error_text='graph_cancelled',lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE graph_id=? AND organization_id=? AND status IN ('pending','failed')`,[input.targetId,input.organizationId]);
    await client.query(`UPDATE v8_agent_branch_tasks SET status='cancellation_requested',error_text='graph_cancellation_requested',updated_at=CURRENT_TIMESTAMP WHERE graph_id=? AND organization_id=? AND status='running'`,[input.targetId,input.organizationId]);
    const after={...graph,status:'cancellation_requested'};const recoveryId=`agent-recovery-${uuidv4()}`;
    await client.query(`INSERT INTO v8_agent_operator_recovery_events (recovery_id,organization_id,execution_run_id,target_type,target_id,action,actor_user_id,reason,before_json,after_json,idempotency_key,input_digest) VALUES (?,?,?,'work_graph',?,?,?,?,?::text,?::text,?,?)`,[recoveryId,input.organizationId,input.executionRunId,input.targetId,input.action,input.actorUserId,input.reason.trim(),JSON.stringify(graph),JSON.stringify(after),input.idempotencyKey,inputDigest]);
    await client.query(`INSERT INTO v8_agent_canonical_projection_outbox (outbox_id,organization_id,execution_run_id,alias_type,external_id,actor_user_id,reason) VALUES (?, ?, ?, 'work_graph', ?, ?, ?)`,[`projection-outbox-${uuidv4()}`,input.organizationId,input.executionRunId,input.targetId,input.actorUserId,`Operator requested work graph cancellation: ${input.reason.trim()}`]);
    return{recoveryId,status:'cancellation_requested',idempotentReplay:false};
  });
}

export async function acknowledgeWorkGraphTaskCancellation(input:{organizationId:string;executionRunId:string;graphId:string;taskId:string;workerId:string}){
  return withPgTransaction(async(client)=>{
    const task=(await client.query<any>(`SELECT t.* FROM v8_agent_branch_tasks t JOIN v8_agent_work_graphs g ON g.graph_id=t.graph_id WHERE t.task_id=? AND t.graph_id=? AND t.organization_id=? AND g.execution_run_id=? FOR UPDATE OF t`,[input.taskId,input.graphId,input.organizationId,input.executionRunId])).rows[0];
    if(!task)throw new Error('operator_target_not_found');
    if(task.status==='cancelled')return{idempotentReplay:true,status:'cancelled'};
    if(task.status!=='cancellation_requested'||task.lease_owner!==input.workerId)throw new Error('cancellation_ack_not_allowed');
    await client.query(`UPDATE v8_agent_branch_tasks SET status='cancelled',lease_owner=NULL,lease_expires_at=NULL,error_text='worker_cancellation_acknowledged',updated_at=CURRENT_TIMESTAMP WHERE task_id=? AND organization_id=?`,[input.taskId,input.organizationId]);
    const remaining=(await client.query<{count:number}>(`SELECT COUNT(*)::int count FROM v8_agent_branch_tasks WHERE graph_id=? AND organization_id=? AND status='cancellation_requested'`,[input.graphId,input.organizationId])).rows[0];
    if(Number(remaining?.count??0)===0)await client.query(`UPDATE v8_agent_work_graphs SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE graph_id=? AND organization_id=? AND status='cancellation_requested'`,[input.graphId,input.organizationId]);
    return{idempotentReplay:false,status:'cancelled'};
  });
}

export async function processCanonicalProjectionOutbox(input:{workerId:string;limit?:number}){
  const claimed=await withPgTransaction(async(client)=>{
    const rows=(await client.query<any>(`SELECT * FROM v8_agent_canonical_projection_outbox WHERE status IN ('pending','failed') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ?`,[input.limit??10])).rows;
    for(const row of rows)await client.query(`UPDATE v8_agent_canonical_projection_outbox SET status='claimed',claim_owner=?,claimed_at=?,attempt_count=attempt_count+1,updated_at=? WHERE outbox_id=?`,[input.workerId,new Date().toISOString(),new Date().toISOString(),row.outbox_id]);
    return rows;
  });
  const results=[];
  for(const row of claimed){try{await projectCanonicalRunAfterExternalTransition({canonicalRunId:row.execution_run_id,organizationId:row.organization_id,aliasType:'work_graph',externalId:row.external_id,actorUserId:row.actor_user_id,reason:row.reason});await dbRun(`UPDATE v8_agent_canonical_projection_outbox SET status='applied',applied_at=?,last_error=NULL,updated_at=? WHERE outbox_id=? AND status='claimed'`,[new Date().toISOString(),new Date().toISOString(),row.outbox_id]);results.push({outboxId:row.outbox_id,status:'applied'});}catch(error){await dbRun(`UPDATE v8_agent_canonical_projection_outbox SET status='failed',last_error=?,updated_at=? WHERE outbox_id=? AND status='claimed'`,[String((error as Error).message),new Date().toISOString(),row.outbox_id]);results.push({outboxId:row.outbox_id,status:'failed'});}}
  return results;
}
