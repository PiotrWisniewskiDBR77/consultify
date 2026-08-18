/**
 * Production runner for the durable Admin-IAM queue alert evaluator.
 *
 * The candidate set includes tenants with current queue work and tenants with
 * an existing Admin-IAM alert state. The latter is essential: after the last
 * failed/stale job is archived, the next tick must still emit RECOVERED.
 */
import { evaluateAdminIamQueueAlerts } from '../services/adminIamAlertEvaluator.js';
import { queryAll } from '../utils/queryHelpers.js';

const ADMIN_IAM_KINDS = ['ADMIN_IAM_JOB_STALE', 'ADMIN_IAM_JOB_FAILED'] as const;
const DEFAULT_BATCH_SIZE = 500;

export interface AdminIamAlertEvaluationTickResult {
  candidates: number;
  evaluated: number;
  failed: number;
}

function batchSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(1000, Math.trunc(parsed)));
}

export async function runAdminIamAlertEvaluationTick(input: {
  evaluatorId?: string;
  now?: string;
  batchSize?: number;
} = {}): Promise<AdminIamAlertEvaluationTickResult> {
  const limit = batchSize(input.batchSize ?? process.env.ADMIN_IAM_ALERT_BATCH_SIZE);
  const evaluatorId = input.evaluatorId ?? 'scheduler:admin-iam-alerts';
  const rows = await queryAll<{ organization_id: string }>(
    `SELECT organization_id
       FROM (
         SELECT DISTINCT organization_id FROM admin_iam_jobs
         UNION
         SELECT DISTINCT organization_id FROM operational_alert_tenant_states
          WHERE kind IN (?, ?)
       ) candidates
      ORDER BY organization_id
      LIMIT ?`,
    [...ADMIN_IAM_KINDS, limit],
  );

  let evaluated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await evaluateAdminIamQueueAlerts({
        organizationId: row.organization_id,
        evaluatorId,
        ...(input.now ? { now: input.now } : {}),
      });
      evaluated += 1;
    } catch {
      // One malformed/broken tenant must not starve the remaining candidates.
      failed += 1;
    }
  }
  return { candidates: rows.length, evaluated, failed };
}
