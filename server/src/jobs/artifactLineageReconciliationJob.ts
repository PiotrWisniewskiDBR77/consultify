/**
 * MAT-010 — production recovery trigger for the durable lineage outbox.
 *
 * Wraps the two halves of the recovery story into one bounded, observable
 * tick, registered in the existing cron `Scheduler`
 * (server/src/cron/Scheduler.ts) rather than a bespoke timer, matching this
 * codebase's existing job convention (see e.g. `WebhookRetry`, `Auto Recovery
 * Probes` in Scheduler.ts):
 *
 *   1. `reconcilePendingLineageEvents()` — replay durable PENDING markers left
 *      by a failed direct write. This is the common case: a transient error
 *      on the direct write, successfully caught by the durable outbox.
 *   2. `backfillMissingLineageReceipts()` — deterministic rebuild for the
 *      worst case: BOTH the direct write and the pending-outbox write failed
 *      for a `created` event, so neither a receipt nor a pending marker
 *      exists anywhere. See `artifactLineageService.ts` for why this can
 *      only recover `created` events (MAT-010 report, gap G4).
 *
 * Idempotent (both halves are — see their own doc comments), tenant-safe
 * (every row carries its own organization_id, this job never scopes to one
 * tenant), restart-resilient (nothing lives in process memory; every read
 * and write is a Postgres row), bounded (a fixed LIMIT per call, no
 * unbounded loop — a large backlog drains progressively across repeated
 * ticks), and observable (a non-trivial tick logs a structured summary; the
 * per-artifact-kind admin read endpoint `GET /api/artifact-lineage/pending`
 * remains available for on-demand inspection).
 */
import {
  backfillMissingLineageReceipts,
  reconcilePendingLineageEvents,
} from '../services/lineage/artifactLineageService.js';
import logger from '../utils/Logger.js';

export interface LineageReconciliationTickResult {
  reconcile: { scanned: number; recovered: number; stillFailing: number };
  backfill: { scanned: number; backfilled: number; errors: number };
}

const DEFAULT_RECONCILE_LIMIT = 200;
const DEFAULT_BACKFILL_LIMIT = 100;

/**
 * One bounded reconciliation tick. Safe to call from a cron schedule or an
 * operator-triggered admin action — never loops internally, so it always
 * returns in bounded time regardless of backlog size.
 */
export async function runArtifactLineageReconciliationTick(params?: {
  reconcileLimit?: number;
  backfillLimit?: number;
}): Promise<LineageReconciliationTickResult> {
  const reconcile = await reconcilePendingLineageEvents({
    limit: params?.reconcileLimit ?? DEFAULT_RECONCILE_LIMIT,
  });
  const backfill = await backfillMissingLineageReceipts({
    limit: params?.backfillLimit ?? DEFAULT_BACKFILL_LIMIT,
  });

  if (
    reconcile.recovered > 0 ||
    reconcile.stillFailing > 0 ||
    backfill.backfilled > 0 ||
    backfill.errors > 0
  ) {
    logger.info('[ArtifactLineage] reconciliation tick completed', { reconcile, backfill });
  }

  return { reconcile, backfill };
}
