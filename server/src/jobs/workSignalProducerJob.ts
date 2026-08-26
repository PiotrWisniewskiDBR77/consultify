import { randomUUID } from 'node:crypto';

import { evaluateSignalRules, type SignalRunResult } from '../services/signals/signalEvaluator.js';
import { deterministicSignalRules } from '../services/signals/rules/index.js';
import { queryAll } from '../utils/queryHelpers.js';

const signalDb = { query: queryAll };

export function isSignalProducerEnabled(): boolean {
  return process.env.ENABLE_SIGNAL_PRODUCER === 'true';
}

async function recordDisabled(organizationId: string, trigger: 'CRON' | 'ON_DEMAND') {
  const runId = randomUUID();
  await queryAll(
    `INSERT INTO work_signal_runs
       (run_id, organization_id, kind, trigger, started_at, finished_at, status, duration_ms)
     VALUES (?, ?, 'DETERMINISTIC', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SKIPPED_DISABLED', 0)`,
    [runId, organizationId, trigger]
  );
  return { runId, status: 'SKIPPED_DISABLED' as const };
}

export async function runDeterministicForOrganization(params: {
  organizationId: string;
  trigger: 'CRON' | 'ON_DEMAND';
}): Promise<SignalRunResult | { runId: string; status: 'SKIPPED_DISABLED' }> {
  if (!isSignalProducerEnabled()) return recordDisabled(params.organizationId, params.trigger);
  return evaluateSignalRules({
    db: signalDb,
    organizationId: params.organizationId,
    rules: deterministicSignalRules,
    trigger: params.trigger,
  });
}

export async function runDeterministicTick(): Promise<{
  organizations: number;
  completed: number;
  failed: number;
}> {
  const organizations = await queryAll<{ id: string }>(
    `SELECT id FROM organizations
      WHERE lower(coalesce(status, 'active')) = 'active'
        AND coalesce(is_active::text, '1') IN ('1', 'true')
      ORDER BY id`
  );
  let completed = 0;
  let failed = 0;
  for (const organization of organizations) {
    try {
      const result = await runDeterministicForOrganization({
        organizationId: organization.id,
        trigger: 'CRON',
      });
      if (result.status === 'FAILED') failed += 1;
      else completed += 1;
    } catch {
      failed += 1;
    }
  }
  return { organizations: organizations.length, completed, failed };
}
