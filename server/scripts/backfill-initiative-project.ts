#!/usr/bin/env tsx
/**
 * D1 (Zwornik §9 Faza 3, decyzja Piotra 2026-07-12) one-off backfill: assign
 * pre-existing orphan initiatives (`project_id IS NULL`) to the org's system
 * "Portfel — inicjatywy bezpośrednie" container project instead of leaving
 * them un-anchored.
 *
 * Context — this is the BACKFILL half of a two-part fix:
 *  1. Forward-fix (already applied by this task, separate commits): every
 *     initiative creation path now anchors NEW initiatives to a project
 *     (either the caller-supplied one, or the auto-created system portfolio
 *     project) — see `server/src/services/initiativeProjectPolicyService.ts`
 *     (`resolveOrCreateSystemPortfolioProject` / `resolveInitiativeProjectId`),
 *     already wired into the canonical funnel
 *     (`createInitiativeService.ts`) AND the raw-insert call sites flagged by
 *     the F15-sweep (InitiativeController.ts, ToolController.promoteToOutput,
 *     report-builder.routes.ts, assessment-workflow-v2.routes.ts,
 *     economics.routes.ts ×2, v8/finance.routes.ts, onboardingService.ts,
 *     pmo/initiatives.routes.ts `/duplicate`).
 *  2. Backfill (THIS script) — existing rows created BEFORE the forward-fix
 *     still have `project_id IS NULL`. Piotr's decision (D1) explicitly asks
 *     for a DRY-RUN script only; do NOT execute the write path without a
 *     separate, explicit go-ahead.
 *
 * Requires migration 912 (`server/migrations/912_zwornik_delta_bc.sql`) to be
 * applied on the target DB first — that migration adds `projects.is_system`
 * (+ the partial unique index `uq_projects_org_system_portfolio`) which both
 * this script and `resolveOrCreateSystemPortfolioProject` rely on. If the
 * column is missing, this script reports that per-org resolution degrades to
 * "would create system project (schema not ready)" rather than failing hard.
 *
 * Safety:
 * - Read-only by default. For each org with orphan initiatives, prints
 *   whether a system portfolio project already exists (id) or WOULD be
 *   created, and how many initiative rows WOULD be re-anchored to it.
 *   Makes NO database writes unless invoked with --write.
 * - Idempotent: re-running is safe — orgs whose orphans were already
 *   assigned (or that never had any) report zero candidates.
 * - Reuses the exact same lazy-create helper the live write paths use
 *   (`resolveOrCreateSystemPortfolioProject`) so the backfilled project is
 *   indistinguishable from one created organically by the forward-fix.
 *
 * Usage:
 *   npx tsx server/scripts/backfill-initiative-project.ts                 # dry run (default)
 *   npx tsx server/scripts/backfill-initiative-project.ts --org=<orgId>   # scope to one org
 *   npx tsx server/scripts/backfill-initiative-project.ts --write         # apply (NOT authorized by this task)
 *
 * DATABASE_URL / DATABASE_PUBLIC_URL must point at the target environment.
 * NEVER run --write against any environment without Piotr's explicit,
 * separate sign-off (D1 says backfill is a SEPARATE decision from the
 * forward-fix). NOT run by this task — dry-run only.
 */
import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import { resolveOrCreateSystemPortfolioProject } from '../src/services/initiativeProjectPolicyService.js';
import logger from '../src/utils/Logger.js';

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

async function columnExists(client: pg.Client, table: string, column: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return (res.rowCount ?? 0) > 0;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const orgArg = process.argv.find((a) => a.startsWith('--org='));
  const scopedOrg = orgArg ? orgArg.split('=')[1]?.trim() : undefined;

  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: env('DATABASE_URL'),
    publicDatabaseUrl: env('DATABASE_PUBLIC_URL'),
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the initiative-project backfill');
  }
  if (resolvedDb.reason) {
    logger.warn(`[backfill-initiative-project] ${resolvedDb.reason}`);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const hasIsSystem = await columnExists(client, 'projects', 'is_system');
  if (!hasIsSystem) {
    logger.warn(
      '[backfill-initiative-project] projects.is_system column is ABSENT — migration 912 ' +
        'has not been applied to this DB yet. resolveOrCreateSystemPortfolioProject() will ' +
        'fail-soft (return null) for every org below until 912 is applied. Reporting orphan ' +
        'counts anyway; nothing will be written even with --write until the schema is ready.'
    );
  }

  const orphanRows = await client.query<{ organization_id: string; orphan_count: string }>(
    `SELECT organization_id, COUNT(*) AS orphan_count
     FROM initiatives
     WHERE project_id IS NULL
       ${scopedOrg ? 'AND organization_id = $1' : ''}
     GROUP BY organization_id
     ORDER BY orphan_count DESC`,
    scopedOrg ? [scopedOrg] : []
  );

  const orgs = orphanRows.rows || [];
  if (orgs.length === 0) {
    logger.info('[backfill-initiative-project] No orphan initiatives (project_id IS NULL) found.');
    await client.end();
    return;
  }

  let grandOrphans = 0;
  let grandOrgsTouched = 0;

  for (const { organization_id: orgId, orphan_count: orphanCountStr } of orgs) {
    const orphanCount = Number(orphanCountStr) || 0;
    grandOrphans += orphanCount;
    grandOrgsTouched += 1;

    let targetProjectId: string | null = null;
    let targetIsNew = false;
    if (hasIsSystem) {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM projects WHERE organization_id = $1 AND is_system = TRUE LIMIT 1`,
        [orgId]
      );
      if (existing.rowCount) {
        targetProjectId = existing.rows[0].id;
      } else {
        targetIsNew = true;
      }
    }

    logger.info(
      `[backfill-initiative-project] org=${orgId}: orphans=${orphanCount} → target=${
        targetProjectId
          ? `existing system project ${targetProjectId}`
          : targetIsNew
            ? 'WOULD CREATE system project "Portfel — inicjatywy bezpośrednie"'
            : 'UNRESOLVED (is_system column missing — migration 912 not applied)'
      }${write ? ' (WRITE MODE)' : ' (DRY RUN — pass --write to apply)'}`
    );

    if (!write) continue;
    if (!hasIsSystem) {
      logger.warn(
        `[backfill-initiative-project] org=${orgId}: skipping write — is_system column missing.`
      );
      continue;
    }

    // --write path (NOT authorized/executed by this task — kept for the
    // future run once Piotr gives separate consent for the backfill itself).
    const resolvedProjectId = await resolveOrCreateSystemPortfolioProject(orgId);
    if (!resolvedProjectId) {
      logger.warn(
        `[backfill-initiative-project] org=${orgId}: resolveOrCreateSystemPortfolioProject ` +
          'degraded to null (see its own logs) — skipping this org, no rows changed.'
      );
      continue;
    }
    const updateResult = await client.query(
      `UPDATE initiatives SET project_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = $2 AND project_id IS NULL`,
      [resolvedProjectId, orgId]
    );
    logger.info(
      `[backfill-initiative-project] org=${orgId}: wrote project_id=${resolvedProjectId} to ` +
        `${updateResult.rowCount ?? 0} row(s).`
    );
  }

  logger.info(
    `[backfill-initiative-project] TOTAL orgs-with-orphans=${grandOrgsTouched}, ` +
      `orphan-initiatives=${grandOrphans}${write ? ' (WRITE MODE — see per-org lines above)' : ' (DRY RUN — pass --write to apply)'}`
  );

  await client.end();
}

main().catch((error) => {
  logger.error('[backfill-initiative-project] Failed:', (error as Error)?.message || error);
  process.exit(1);
});
