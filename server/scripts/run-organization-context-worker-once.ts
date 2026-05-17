#!/usr/bin/env tsx
/**
 * Explicit organization context worker tick.
 *
 * Usage:
 *   ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true tsx server/scripts/run-organization-context-worker-once.ts
 *
 * Without ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true this script is a no-op and prints
 * scheduler_disabled. This keeps cron wiring explicit and prevents hidden processing.
 */

import contextDocumentService from '../src/services/organizationContext/ContextDocumentService.js';

async function main(): Promise<void> {
  const limit = Math.max(1, Math.min(Number(process.env.ORG_CONTEXT_WORKER_LIMIT || 5), 25));
  const result = await contextDocumentService.processConfiguredContextDocumentWorkerTick({ limit });
  console.log(
    JSON.stringify(
      {
        contract: 'organization_context_worker_cron_tick_v1',
        result,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      contract: 'organization_context_worker_cron_tick_v1',
      error: String((error as Error)?.message || error),
    })
  );
  process.exit(1);
});
