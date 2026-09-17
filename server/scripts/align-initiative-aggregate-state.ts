#!/usr/bin/env tsx
/**
 * D-19 (Wpis 60 · STAGE-1 · DEC-539) — CLI front-end for the shared aggregate
 * alignment planner. ALL logic lives in
 * `server/src/services/initiatives/alignInitiativeAggregateService.ts` (moved
 * here->there unchanged in v3 / Wpis 77 so the LIVE demo-clone path and the
 * static seed step call the SAME `processOrg`). This file only parses argv,
 * opens the connection and prints totals.
 *
 * SAFETY (enforced by the shared planner, restated for the operator)
 * ------------------------------------------------------------------
 * - DRY-RUN by default: prints before/after counts per org and per status and
 *   makes ZERO writes. Writes happen only with `--apply`.
 * - `--apply` requires at least one explicit `--org <id>`; there is no "all orgs"
 *   write mode (`resolveAlignCliOptions` refuses).
 * - HARD allow-list = showcase orgs only (Atelier Toys demo-session orgs and
 *   "Northwind Manufacturing Ltd."). Any other org — DBR77 in particular — is
 *   REFUSED; DBR77's divergent rows are printed for the CTO's decision, never
 *   written.
 * - No migration, no DDL. Only `ie_aggregate_state.payload_json` is touched.
 * - Idempotent: a second `--apply` finds every row already in the right group and
 *   changes 0 rows.
 * - The connection guard `resolveReachableDatabaseUrl()` refuses a loopback
 *   (localhost/127.0.0.1) DATABASE_URL unless `NODE_ENV=test`; there is no
 *   `allowLocalHost` escape hatch.
 * - ZERO writes to staging/demo from this task: running it there is the CTO's
 *   deployment-22 runbook.
 *
 * Usage:
 *   npx tsx server/scripts/align-initiative-aggregate-state.ts                 # dry run, all orgs (read-only)
 *   npx tsx server/scripts/align-initiative-aggregate-state.ts --org=<id>      # dry run, one org
 *   npx tsx server/scripts/align-initiative-aggregate-state.ts --apply --org=<id> [--org=<id2>]  # write (showcase orgs only)
 *
 * DATABASE_URL / DATABASE_PUBLIC_URL must point at the target environment.
 */
import pg from 'pg';

import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import {
  processOrg,
  readOrgIdsWithAggregates,
  reportDbr77ForDecision,
  resolveAlignCliOptions,
  type OrgCounts,
} from '../src/services/initiatives/alignInitiativeAggregateService.js';
import logger from '../src/utils/Logger.js';

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

function emptyCounts(): OrgCounts {
  return {
    align: 0,
    'skip-aligned': 0,
    'skip-short-circuit': 0,
    'skip-no-stage': 0,
    alignByStatus: {},
  };
}

async function main(): Promise<void> {
  const { apply, orgIds } = resolveAlignCliOptions(process.argv);

  const resolvedDb = resolveReachableDatabaseUrl({
    databaseUrl: env('DATABASE_URL'),
    publicDatabaseUrl: env('DATABASE_PUBLIC_URL'),
  });
  const databaseUrl = resolvedDb.databaseUrl;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for align-initiative-aggregate-state');
  }
  if (resolvedDb.reason) {
    logger.warn(`[align-initiative-aggregate] ${resolvedDb.reason}`);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    logger.info(
      `[align-initiative-aggregate] mode=${apply ? 'APPLY' : 'DRY-RUN'} ` +
        `orgs=${orgIds.length > 0 ? orgIds.join(',') : '<all orgs, read-only>'}`
    );

    // Always surface the DBR77 rows for the CTO, in every mode.
    await reportDbr77ForDecision(client);

    const targetOrgs = orgIds.length > 0 ? orgIds : await readOrgIdsWithAggregates(client);
    const totals = emptyCounts();
    let totalWrote = 0;
    let alignedOrgs = 0;

    for (const orgId of targetOrgs) {
      const { counts, wrote, allowed } = await processOrg(client, orgId, apply);
      totals.align += counts.align;
      totals['skip-aligned'] += counts['skip-aligned'];
      totals['skip-short-circuit'] += counts['skip-short-circuit'];
      totals['skip-no-stage'] += counts['skip-no-stage'];
      for (const [status, n] of Object.entries(counts.alignByStatus)) {
        totals.alignByStatus[status] = (totals.alignByStatus[status] || 0) + n;
      }
      totalWrote += wrote;
      if (apply && allowed && wrote > 0) alignedOrgs += 1;
    }

    const totalByStatus = Object.entries(totals.alignByStatus)
      .map(([status, n]) => `${status}:${n}`)
      .join(', ');
    logger.info(
      `[align-initiative-aggregate] TOTAL would-align=${totals.align} ` +
        `already-aligned=${totals['skip-aligned']} ` +
        `short-circuit=${totals['skip-short-circuit']} no-stage=${totals['skip-no-stage']}` +
        (totalByStatus ? ` :: align-by-status → ${totalByStatus}` : '') +
        (apply ? ` :: WROTE=${totalWrote} across ${alignedOrgs} org(s)` : ' (DRY-RUN — pass --apply --org <id> to write)')
    );
  } finally {
    await client.end();
  }
}

// Run only when invoked directly (tsx server/scripts/...), never on import — the
// pure planner above is unit-tested from tests/backend without touching a DB.
const invokedDirectly = String(process.argv[1] || '')
  .replace(/\\/g, '/')
  .endsWith('align-initiative-aggregate-state.ts');
if (invokedDirectly) {
  main().catch((error) => {
    logger.error('[align-initiative-aggregate] Failed:', (error as Error)?.message || error);
    process.exit(1);
  });
}
