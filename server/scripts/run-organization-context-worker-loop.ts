#!/usr/bin/env tsx
/**
 * Long-running Organization Context worker entrypoint.
 *
 * Used by the dedicated worker deployment (Procfile: `worker: npm run worker:organization-context:loop`)
 * to consume context document processing jobs continuously.
 *
 * Behaviour:
 * - Polls the in-DB ledger every ORG_CONTEXT_WORKER_TICK_MS (default 30000ms).
 * - When ORG_CONTEXT_QUEUE_BACKEND=external is configured, also runs the external queue consumer
 *   tick (HTTP pull/ack/backoff contract).
 * - Honest degradation: if scheduler is disabled, prints status once and idles.
 * - Graceful shutdown on SIGTERM/SIGINT to avoid mid-job interruptions.
 *
 * Source of truth: docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md §17 (Operational Readiness).
 */

import contextDocumentService from '../src/services/organizationContext/ContextDocumentService.js';

const TICK_MS = Math.max(
  5000,
  Math.min(Number(process.env.ORG_CONTEXT_WORKER_TICK_MS || 30000), 300000)
);
const LIMIT = Math.max(
  1,
  Math.min(Number(process.env.ORG_CONTEXT_WORKER_LIMIT || 5), 25)
);

let stopRequested = false;

function log(payload: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      contract: 'organization_context_worker_loop_v1',
      ...payload,
    })
  );
}

async function tick(): Promise<void> {
  if (
    String(process.env.ORG_CONTEXT_WORKER_SCHEDULER_ENABLED || '').toLowerCase() !== 'true'
  ) {
    log({ skipped: true, reason: 'scheduler_disabled' });
    return;
  }

  try {
    const dbResult = await contextDocumentService.processConfiguredContextDocumentWorkerTick({
      limit: LIMIT,
    });
    if (
      !dbResult.skipped &&
      (dbResult.processed > 0 ||
        dbResult.retried > 0 ||
        dbResult.deadLettered > 0 ||
        (dbResult.errors && dbResult.errors.length > 0))
    ) {
      log({
        scheduler: 'db_ledger_tick',
        processed: dbResult.processed,
        retried: dbResult.retried,
        deadLettered: dbResult.deadLettered,
        errors: (dbResult.errors || []).length,
      });
    }
  } catch (err: any) {
    log({ scheduler: 'db_ledger_tick', error: String(err?.message || err) });
  }

  const backend = String(process.env.ORG_CONTEXT_QUEUE_BACKEND || '').toLowerCase();
  if (
    (backend === 'external' || backend === 'external_queue') &&
    process.env.ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL
  ) {
    try {
      const externalResult =
        await contextDocumentService.processExternalContextQueueConsumerTick({ limit: LIMIT });
      if (
        !externalResult.skipped &&
        ((externalResult.pulledMessages || 0) > 0 ||
          (externalResult.errors && externalResult.errors.length > 0))
      ) {
        log({
          scheduler: 'external_queue_tick',
          pulled: externalResult.pulledMessages || 0,
          acked: externalResult.ackedMessages || 0,
          backoff: externalResult.backoffMessages || 0,
          processed: externalResult.processed,
          errors: (externalResult.errors || []).length,
        });
      }
    } catch (err: any) {
      log({ scheduler: 'external_queue_tick', error: String(err?.message || err) });
    }
  }
}

async function main(): Promise<void> {
  log({ event: 'worker_started', tickMs: TICK_MS, limit: LIMIT });

  process.on('SIGTERM', () => {
    log({ event: 'shutdown_requested', signal: 'SIGTERM' });
    stopRequested = true;
  });
  process.on('SIGINT', () => {
    log({ event: 'shutdown_requested', signal: 'SIGINT' });
    stopRequested = true;
  });

  while (!stopRequested) {
    await tick();
    if (stopRequested) break;
    await new Promise((resolve) => setTimeout(resolve, TICK_MS));
  }

  log({ event: 'worker_stopped' });
  process.exit(0);
}

main().catch((err) => {
  log({ event: 'worker_fatal', error: String((err as Error)?.message || err) });
  process.exit(1);
});
