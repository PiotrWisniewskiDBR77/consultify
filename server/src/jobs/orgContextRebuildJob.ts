/**
 * Organization Context Rebuild Job (M16 P2-1)
 *
 * Keeps Teresa's resolved organization-context snapshots fresh for AI injection.
 * Without this, a snapshot only rebuilds on an explicit admin POST or an
 * event-triggered write, so an org that stops being edited would slowly drift
 * from its underlying claims (and from any schema upgrades).
 *
 * Strategy: every run, find organizations that have at least one context claim
 * and whose snapshot is missing or older than the staleness window, then rebuild
 * each one. Scheduled every 4 hours from the gateway startup.
 *
 * Run via: npx tsx server/src/jobs/orgContextRebuildJob.ts
 * Or schedule with cron: 0 *\/4 * * * (every 4 hours)
 */

import { emitOrgContextRebuilt } from '../realtime/orgContextRealtime.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

/** Snapshots older than this (or missing) are considered stale. */
const STALENESS_MS = 4 * 60 * 60 * 1000; // 4 hours

interface StaleOrgRow {
  organization_id: string;
}

/**
 * Find organizations whose resolved snapshot needs a rebuild: they have at least
 * one context claim, and either have no snapshot row yet or the snapshot's
 * rebuilt_at is older than the staleness window.
 */
async function findOrgsNeedingRebuild(cutoffIso: string): Promise<string[]> {
  try {
    const rows = await DbPromise.all<StaleOrgRow>(
      `SELECT DISTINCT c.organization_id AS organization_id
         FROM organization_context_claims c
         LEFT JOIN organization_context_snapshots s
           ON s.organization_id = c.organization_id
        WHERE s.organization_id IS NULL
           OR s.rebuilt_at IS NULL
           OR s.rebuilt_at < ?`,
      [cutoffIso]
    );
    return (rows || [])
      .map((r) => String(r.organization_id || '').trim())
      .filter((id) => id.length > 0);
  } catch (error: any) {
    logger.error(
      '[OrgContextRebuildJob] Failed to query organizations needing rebuild:',
      error?.message || error
    );
    return [];
  }
}

export async function runOrgContextRebuild(): Promise<{
  scanned: number;
  rebuilt: number;
  errors: number;
}> {
  const startedAt = Date.now();
  const cutoffIso = new Date(startedAt - STALENESS_MS).toISOString();
  logger.info('[OrgContextRebuildJob] Starting org-context rebuild sweep', { cutoffIso });

  const orgIds = await findOrgsNeedingRebuild(cutoffIso);
  let rebuilt = 0;
  let errors = 0;

  for (const organizationId of orgIds) {
    try {
      await organizationContextService.rebuildSnapshot(organizationId);
      const context = await organizationContextService.buildResolvedContext(organizationId);
      emitOrgContextRebuilt({
        organizationId,
        rebuiltAt: context.snapshotUpdatedAt,
        counts: context.counts,
      });
      rebuilt += 1;
    } catch (error: any) {
      errors += 1;
      logger.warn('[OrgContextRebuildJob] Rebuild failed for organization', {
        organizationId,
        error: error?.message || error,
      });
    }
  }

  const result = { scanned: orgIds.length, rebuilt, errors };
  logger.info('[OrgContextRebuildJob] Sweep complete', {
    ...result,
    durationMs: Date.now() - startedAt,
  });
  return result;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the recurring rebuild sweep. Idempotent — calling twice is a no-op.
 * Runs an initial sweep shortly after start, then every 4 hours.
 */
export function startOrgContextRebuildJob(): void {
  if (intervalHandle) return;

  // Initial deferred sweep so startup is not blocked.
  const kickoff = setTimeout(() => {
    void runOrgContextRebuild();
  }, 60_000);
  kickoff.unref?.();

  intervalHandle = setInterval(
    () => {
      void runOrgContextRebuild();
    },
    4 * 60 * 60 * 1000
  );
  intervalHandle.unref?.();

  logger.info('[OrgContextRebuildJob] Scheduled (every 4h)');
}

export function stopOrgContextRebuildJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export default { runOrgContextRebuild, startOrgContextRebuildJob, stopOrgContextRebuildJob };

// Run directly if executed as script
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule) {
  runOrgContextRebuild()
    .then((result) => {
      logger.info('[OrgContextRebuildJob] Result:', JSON.stringify(result));
      process.exit(result.errors === 0 ? 0 : 1);
    })
    .catch((err) => {
      logger.error('[OrgContextRebuildJob] Fatal error:', err);
      process.exit(1);
    });
}
