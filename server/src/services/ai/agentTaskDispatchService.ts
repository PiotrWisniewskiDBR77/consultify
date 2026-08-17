import { createHash, randomUUID } from 'node:crypto';

import { operationalAlerts } from '../operationalAlertService.js';
import { withPgTransaction } from '../../utils/queryHelpers.js';

export const AI_TASKS_WORKER_FLAG = 'ENABLE_AI_TASKS_WORKER';
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const LEASE_SECONDS = 300;
const ENQUEUE_TIMEOUT_MS = 5_000;

export type AgentDispatchInput = {
  planId: string;
  organizationId: string;
  userId: string;
  dispatchKey: string;
};

type ReceiptRow = {
  receipt_id: string; organization_id: string; user_id: string; plan_id: string;
  dispatch_key: string; bull_job_id: string; payload_digest: string; status: string;
  attempt_count: number;
};

function requireId(value: string, code: string): string {
  const normalized = String(value || '').trim();
  if (!SAFE_ID.test(normalized)) throw new Error(code);
  return normalized;
}

function identity(input: AgentDispatchInput) {
  const normalized = {
    planId: requireId(input.planId, 'AGENT_DISPATCH_PLAN_INVALID'),
    organizationId: requireId(input.organizationId, 'AGENT_DISPATCH_TENANT_INVALID'),
    userId: requireId(input.userId, 'AGENT_DISPATCH_USER_INVALID'),
    dispatchKey: requireId(input.dispatchKey, 'AGENT_DISPATCH_KEY_INVALID'),
  };
  const payloadDigest = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const bullJobId = `agt-${createHash('sha256').update(`${normalized.organizationId}|${normalized.dispatchKey}`).digest('hex')}`;
  return { ...normalized, payloadDigest, bullJobId };
}

async function awaitWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('AGENT_QUEUE_ENQUEUE_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function dispatchAgentTask(
  input: AgentDispatchInput,
  options: { env?: NodeJS.ProcessEnv; beforeEnqueue?: () => Promise<void>; replaceExistingJob?: boolean } = {}
): Promise<{ status: 'DISABLED' | 'ENQUEUED' | 'REPLAY' | 'PENDING'; receiptId?: string; bullJobId?: string }> {
  const env = options.env ?? process.env;
  if (env[AI_TASKS_WORKER_FLAG] !== 'true') return { status: 'DISABLED' };
  if (env.MOCK_REDIS === 'true') throw new Error('AI_TASKS_WORKER_REQUIRES_REAL_REDIS');
  const id = identity(input);
  const receipt = await withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`agent-dispatch:${id.organizationId}:${id.dispatchKey}`]);
    const existing = await tx.query<ReceiptRow>(
      `SELECT * FROM ai_agent_job_receipts WHERE organization_id=? AND dispatch_key=? FOR UPDATE`,
      [id.organizationId, id.dispatchKey]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].payload_digest !== id.payloadDigest) throw new Error('AGENT_DISPATCH_PAYLOAD_COLLISION');
      return existing.rows[0];
    }
    const inserted = await tx.query<ReceiptRow>(
      `INSERT INTO ai_agent_job_receipts
       (organization_id,user_id,plan_id,dispatch_key,bull_job_id,payload_digest,status)
       VALUES(?,?,?,?,?,?,'PENDING') RETURNING *`,
      [id.organizationId,id.userId,id.planId,id.dispatchKey,id.bullJobId,id.payloadDigest]
    );
    return inserted.rows[0];
  });
  if (receipt.status === 'ENQUEUED' || receipt.status === 'RUNNING' || receipt.status === 'SUCCEEDED') {
    return { status: 'REPLAY', receiptId: receipt.receipt_id, bullJobId: receipt.bull_job_id };
  }
  try {
    await options.beforeEnqueue?.();
    const { default: aiQueue } = await import('../../queues/aiQueue.js') as {
      default: {
        add: (name: string, data: unknown, options: Record<string, unknown>) => Promise<unknown>;
        getJob: (id: string) => Promise<{ remove: () => Promise<void> } | null>;
      };
    };
    if (receipt.status === 'FAILED' || options.replaceExistingJob) {
      const failedJob = await aiQueue.getJob(id.bullJobId);
      if (failedJob) await failedJob.remove();
    }
    // Serialize durable state and queue publication for this logical job. The
    // row lock also makes a fast worker wait for the ENQUEUED commit, while a
    // Redis failure rolls the state update back to recoverable PENDING.
    await withPgTransaction(async (tx) => {
      await tx.query(`SELECT * FROM ai_agent_job_receipts WHERE receipt_id=? FOR UPDATE`,
        [receipt.receipt_id]);
      await tx.query(
        `UPDATE ai_agent_job_receipts SET status='ENQUEUED',updated_at=now()
          WHERE receipt_id=? AND status IN ('PENDING','FAILED')`,
        [receipt.receipt_id]
      );
      const enqueuePromise = aiQueue.add('AGENT_BACKGROUND_TASK', {
        taskType: 'AGENT_BACKGROUND_TASK', userId: id.userId,
        payload: { planId: id.planId, organizationId: id.organizationId, userId: id.userId,
          dispatchKey: id.dispatchKey, receiptId: receipt.receipt_id, payloadDigest: id.payloadDigest },
      }, { jobId: id.bullJobId, removeOnComplete: false, removeOnFail: false });
      await awaitWithTimeout(enqueuePromise, ENQUEUE_TIMEOUT_MS);
    });
    return { status: 'ENQUEUED', receiptId: receipt.receipt_id, bullJobId: id.bullJobId };
  } catch {
    operationalAlerts.recordWrite({ correlationId: receipt.receipt_id, tenantId: id.organizationId,
      actorId: id.userId, sourceId: id.planId, result: 'FAILURE' });
    return { status: 'PENDING', receiptId: receipt.receipt_id, bullJobId: id.bullJobId };
  }
}

export async function claimAgentTask(input: AgentDispatchInput & { receiptId: string; payloadDigest: string; workerId: string }) {
  const id = identity(input);
  if (id.payloadDigest !== input.payloadDigest) throw new Error('AGENT_DISPATCH_PAYLOAD_COLLISION');
  return withPgTransaction(async (tx) => {
    const claimed = await tx.query<ReceiptRow>(
      `UPDATE ai_agent_job_receipts SET status='RUNNING',attempt_count=attempt_count+1,
       lease_owner=?,lease_expires_at=now()+(? * interval '1 second'),updated_at=now()
       WHERE receipt_id=? AND organization_id=? AND user_id=? AND plan_id=? AND payload_digest=?
         AND (status IN ('ENQUEUED','FAILED') OR (status='RUNNING' AND lease_expires_at<now())) RETURNING *`,
      [input.workerId,LEASE_SECONDS,input.receiptId,id.organizationId,id.userId,id.planId,id.payloadDigest]
    );
    const row = claimed.rows[0];
    if (!row) {
      const current = await tx.query<ReceiptRow>(`SELECT * FROM ai_agent_job_receipts WHERE receipt_id=?`, [input.receiptId]);
      if (current.rows[0]?.status === 'SUCCEEDED') return { replayed: true, attemptNo: current.rows[0].attempt_count };
      throw new Error('AGENT_DISPATCH_CLAIM_CONFLICT');
    }
    await tx.query(`INSERT INTO ai_agent_job_attempts(receipt_id,attempt_no,event_type,worker_id) VALUES(?,?,'CLAIMED',?)`,
      [row.receipt_id,row.attempt_count,input.workerId]);
    return { replayed: false, attemptNo: row.attempt_count };
  });
}

export async function finishAgentTask(receiptId: string, workerId: string, ok: boolean, error?: unknown) {
  const code = ok ? null : String(error instanceof Error ? error.message : error || 'AGENT_TASK_FAILED').slice(0,128);
  return withPgTransaction(async (tx) => {
    const row = await tx.query<ReceiptRow>(
      `UPDATE ai_agent_job_receipts SET status=?,completed_at=CASE WHEN ? THEN now() ELSE completed_at END,
       last_error_code=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
       WHERE receipt_id=? AND status='RUNNING' AND lease_owner=? RETURNING *`,
      [ok ? 'SUCCEEDED' : 'FAILED',ok,code,receiptId,workerId]
    );
    if (!row.rows[0]) throw new Error('AGENT_DISPATCH_LEASE_LOST');
    await tx.query(`INSERT INTO ai_agent_job_attempts(receipt_id,attempt_no,event_type,worker_id,error_code) VALUES(?,?,?, ?,?)`,
      [receiptId,row.rows[0].attempt_count,ok ? 'SUCCEEDED' : 'FAILED',workerId,code]);
    operationalAlerts.recordWrite({ correlationId: receiptId, tenantId: row.rows[0].organization_id,
      actorId: row.rows[0].user_id, sourceId: row.rows[0].plan_id, result: ok ? 'SUCCESS' : 'FAILURE' });
    return row.rows[0];
  });
}

export async function redriveAgentTask(
  receiptId: string,
  operatorId: string,
  options: { env?: NodeJS.ProcessEnv; beforeEnqueue?: () => Promise<void> } = {}
) {
  const env = options.env ?? process.env;
  // A disabled worker is a hard kill switch: even an operator request must leave
  // both the receipt and its append-only attempt ledger untouched.
  if (env[AI_TASKS_WORKER_FLAG] !== 'true') return { status: 'DISABLED' as const };
  if (env.MOCK_REDIS === 'true') throw new Error('AI_TASKS_WORKER_REQUIRES_REAL_REDIS');
  const normalizedOperatorId = requireId(operatorId, 'AGENT_OPERATOR_INVALID');
  const row = await withPgTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`agent-redrive:${receiptId}`]);
    const selected = await tx.query<ReceiptRow>(
      `SELECT * FROM ai_agent_job_receipts WHERE receipt_id=? FOR UPDATE`,
      [receiptId]
    );
    const current = selected.rows[0];
    if (!current) throw new Error('AGENT_DISPATCH_NOT_REDRIVABLE');
    if (current.status === 'FAILED') {
      const transitioned = await tx.query<ReceiptRow>(
        `UPDATE ai_agent_job_receipts
            SET status='PENDING', completed_at=NULL, last_error_code=NULL, updated_at=now()
          WHERE receipt_id=? AND status='FAILED' RETURNING *`,
        [receiptId]
      );
      await tx.query(
        `INSERT INTO ai_agent_job_attempts(receipt_id,attempt_no,event_type,worker_id)
         VALUES(?,?,'REDRIVEN',?)`,
        [receiptId, transitioned.rows[0].attempt_count + 1, normalizedOperatorId]
      );
      return transitioned.rows[0];
    }
    if (current.status === 'PENDING') {
      const prior = await tx.query<{ present: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM ai_agent_job_attempts
            WHERE receipt_id=? AND attempt_no=? AND event_type='REDRIVEN'
         ) AS present`,
        [receiptId, current.attempt_count + 1]
      );
      if (prior.rows[0]?.present) return current;
    }
    throw new Error('AGENT_DISPATCH_NOT_REDRIVABLE');
  });
  return dispatchAgentTask(
    { planId: row.plan_id, organizationId: row.organization_id,
      userId: row.user_id, dispatchKey: row.dispatch_key },
    { ...options, env, replaceExistingJob: true }
  );
}
