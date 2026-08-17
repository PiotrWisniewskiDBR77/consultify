/**
 * Audit Independence Detector Job
 *
 * AUD-POL-001 / AMD-AUD-RIGHTS-001: "the independence detector must be
 * operationalized." Before this job, `auditTrailService.getIndependenceReport`
 * (segregation-of-duties violations that bypassed the write-time guards in
 * permissions.ts — see that service's header) was reachable only through
 * `GET /api/audits/programs/:programId/trail/independence`, which nothing
 * called: no cron, no UI, no script. A detector nobody runs is not a control.
 *
 * One invocation = one bounded, checkpointed, fenced tick. See
 * independenceScanCursor.ts for the durable-cursor and fencing design that
 * makes the sweep survive cold restarts, avoid starving older programs, and
 * refuse to let a superseded worker record progress.
 *
 * Scope boundaries this job deliberately respects:
 *   - It decides NOTHING about policy: it reads, and it logs what it found.
 *     Enabling the flag changes only whether the scan runs, never who may see
 *     what, and never any pack/program state.
 *   - It introduces NO UI. Findings surface through the shared structured
 *     logger, the same ops-visible channel every other cron in Scheduler.ts
 *     uses. A dedicated in-product view would need the project's
 *     prototype-then-owner-screenshot gate, which a backend pass cannot
 *     satisfy — that remains a separate, deliberate follow-up.
 *   - It is registered DEFAULT-OFF. Until the flag is enabled in a real
 *     deployment and observed running, the honest description is
 *     "implemented, gated off" — not "operationalized" or "deployed".
 *
 * Manual single tick: npx tsx server/src/jobs/auditIndependenceDetectorJob.ts
 */

import { randomUUID } from 'node:crypto';

import { getIndependenceReport } from '../services/audits/auditTrailService.js';
import {
  advanceAndRelease,
  claimLease,
  fetchNextBatch,
  releaseLeaseWithoutAdvancing,
  type ProgramRef,
} from '../services/audits/independenceScanCursor.js';
import logger from '../utils/Logger.js';

const DEFAULT_BATCH_SIZE = 200;

export interface IndependenceScanTickResult {
  claimed: boolean;
  scanned: number;
  withViolations: number;
  totalViolations: number;
  errors: number;
  cycleWrapped: boolean;
  cyclesCompletedBefore: number;
  /** False when this worker was superseded mid-tick and its progress was rejected. */
  progressRecorded: boolean;
}

async function scanBatch(
  batch: ProgramRef[],
): Promise<{ withViolations: number; totalViolations: number; errors: number }> {
  let withViolations = 0;
  let totalViolations = 0;
  let errors = 0;

  for (const program of batch) {
    try {
      const report = await getIndependenceReport(program.organizationId, program.id);
      if (report.violations.length > 0) {
        withViolations += 1;
        totalViolations += report.violations.length;
        logger.warn('[AuditIndependenceDetectorJob] Independence violation(s) detected', {
          programId: program.id,
          organizationId: program.organizationId,
          violationCount: report.violations.length,
          violations: report.violations,
        });
      }
    } catch (err: any) {
      errors += 1;
      logger.error('[AuditIndependenceDetectorJob] Scan failed for program', {
        programId: program.id,
        organizationId: program.organizationId,
        error: err?.message || String(err),
      });
    }
  }

  return { withViolations, totalViolations, errors };
}

/**
 * Runs exactly one tick: claim the fenced lease → fetch one bounded batch
 * after the persisted cursor → scan it → advance the cursor (wrapping at
 * end-of-table) → release. Returns `claimed: false`, with no other effect,
 * when another worker holds the lease.
 */
export async function runTick(
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<IndependenceScanTickResult> {
  const runnerId = `${process.pid}-${randomUUID()}`;
  const lease = await claimLease(runnerId);
  if (!lease.claimed) {
    logger.info('[AuditIndependenceDetectorJob] Lease held by another worker — skipping tick', {
      runnerId,
    });
    return {
      claimed: false,
      scanned: 0,
      withViolations: 0,
      totalViolations: 0,
      errors: 0,
      cycleWrapped: false,
      cyclesCompletedBefore: 0,
      progressRecorded: false,
    };
  }

  try {
    const batch = await fetchNextBatch(lease.lastProgramId, batchSize);
    const { withViolations, totalViolations, errors } = await scanBatch(batch);
    const progressRecorded = await advanceAndRelease(lease.fence, batch, batchSize);

    if (!progressRecorded) {
      // This worker's lease expired and another worker took over while it was
      // scanning. Its progress is intentionally discarded — the fence held by
      // the current owner is authoritative. Re-scanning is harmless (read-only).
      logger.warn(
        '[AuditIndependenceDetectorJob] Lease was superseded mid-tick — progress discarded, not recorded',
        { runnerId, fence: lease.fence, scanned: batch.length },
      );
    }

    const result: IndependenceScanTickResult = {
      claimed: true,
      scanned: batch.length,
      withViolations,
      totalViolations,
      errors,
      cycleWrapped: progressRecorded && batch.length < batchSize,
      cyclesCompletedBefore: lease.cyclesCompleted,
      progressRecorded,
    };
    logger.info('[AuditIndependenceDetectorJob] Tick completed', result);
    return result;
  } catch (err: any) {
    // Release WITHOUT advancing so the same batch is retried on the next tick
    // rather than silently skipped. Fenced: a superseded worker cannot release
    // the current owner's lease.
    await releaseLeaseWithoutAdvancing(lease.fence).catch(() => {});
    logger.error('[AuditIndependenceDetectorJob] Tick failed; lease released for retry', {
      runnerId,
      error: err?.message || String(err),
    });
    throw err;
  }
}

/** CLI entry point for a manual single-tick run. */
export async function runJob(): Promise<IndependenceScanTickResult> {
  return runTick();
}
