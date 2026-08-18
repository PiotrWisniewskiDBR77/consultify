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
  const now = input.now ?? new Date().toISOString();
  let cursor = '';
  let candidates = 0;
  let evaluated = 0;
  let failed = 0;
  for (;;) {
    const rows = await queryAll<{ organization_id: string }>(
      `WITH candidate_organizations AS (
         SELECT DISTINCT organization_id FROM admin_iam_jobs
          WHERE status='failed'
             OR (status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?::timestamptz)
         UNION
         SELECT DISTINCT organization_id FROM operational_alert_tenant_states
          WHERE kind IN (?, ?) AND status IN ('ACTIVE','ACKNOWLEDGED')
       )
       SELECT organization_id FROM candidate_organizations
        WHERE organization_id > ? ORDER BY organization_id LIMIT ?`,
      [now, ...ADMIN_IAM_KINDS, cursor, limit],
    );
    if (rows.length === 0) break;
    candidates += rows.length;
    for (const row of rows) {
      cursor = row.organization_id;
      try {
        await evaluateAdminIamQueueAlerts({ organizationId: row.organization_id, evaluatorId, now });
        evaluated += 1;
      } catch {
        // One malformed/broken tenant must not starve this page or later pages.
        failed += 1;
      }
    }
    if (rows.length < limit) break;
  }
  return { candidates, evaluated, failed };
}
