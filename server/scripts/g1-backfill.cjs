#!/usr/bin/env node
/**
 * G1 backfill — M14→M15 closure-handoff benefits (2026-07-10)
 *
 * Faza 0 audit found 45/46 DONE initiatives (staging/TROLLEY, shared with
 * demo) with NO `initiative_benefits` row: the live closure handoff
 * (`executionResultsBridge.handoffFromClosure`, wired at
 * `InitiativeController:2130` on status → DONE) only ever fires on a LIVE
 * status transition. Initiatives that were created ALREADY in DONE status
 * (seed data, trial-session orgs) never passed through that transition, so
 * the handoff never ran for them. See `fireClosureHandoff` in
 * `executionResultsBridge.ts` for the live-path fix (also now called from
 * `InitiativeController.completeInitiative` and `demoSeedService.ts`).
 *
 * This script reconciles the PAST: for every DONE initiative with zero
 * `initiative_benefits` rows, it replays the SAME logic the bridge uses:
 *   1. Planned KPIs (`initiative_kpis` WHERE target_value IS NOT NULL) →
 *      one benefit row per KPI, source_tag = 'M14_CLOSURE_HANDOFF'.
 *   2. If NO such KPIs exist (confirmed to be ALL 45 of the missing rows on
 *      staging, 2026-07-10 — see audit note below) → fall back to the
 *      initiative's own `expected_roi` business-case field, one row,
 *      kpi_id = NULL, same source_tag.
 *   3. Neither KPI nor expected_roi → skipped, no row created (matches the
 *      live bridge's contract: nothing to hand off is not an error).
 *
 * Idempotent: every insert is preceded by the exact dedup check the live
 * bridge uses (kpi_id match / kpi_id IS NULL match, both scoped to
 * source_tag = 'M14_CLOSURE_HANDOFF'), so re-running this script — or running
 * it after the live bridge has already handled some initiatives — never
 * creates duplicates.
 *
 * Fail-soft: each initiative is processed independently; one failure is
 * logged and does not abort the run.
 *
 * SAFETY — dry-run by default. Nothing is written unless you pass --apply.
 *
 * Usage:
 *   DATABASE_URL="postgres://…" node server/scripts/g1-backfill.cjs                # dry-run (default), prints plan
 *   DATABASE_URL="postgres://…" node server/scripts/g1-backfill.cjs --apply        # actually writes
 *   DATABASE_URL="postgres://…" node server/scripts/g1-backfill.cjs --org=<orgId>  # scope to one org (dry-run or --apply)
 *
 * DATABASE_URL is REQUIRED and must be set explicitly by the operator — this
 * script does NOT auto-load any .env file, specifically so it can never
 * silently point at prod (centerbeam) via a stale local env file. Point it at
 * staging (TROLLEY) first, verify the dry-run report, THEN --apply.
 */
'use strict';

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL explicitly before running (no auto-load — see file header).');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ORG_FILTER = (args.find((a) => a.startsWith('--org=')) || '').split('=')[1] || null;

const CLOSURE_HANDOFF_SOURCE = 'M14_CLOSURE_HANDOFF';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log(`Connected. Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);
  if (ORG_FILTER) console.log(`Scoped to organization_id = ${ORG_FILTER}`);

  const summary = {
    scanned: 0,
    createdFromKpi: 0,
    createdFromFallback: 0,
    skippedDedup: 0,
    skippedNoData: 0,
    errors: 0,
  };

  try {
    const orgClause = ORG_FILTER ? 'AND i.organization_id = $1' : '';

    const { rows: targets } = await client.query(
      `SELECT i.id, i.organization_id, COALESCE(i.title, i.name) AS name, i.expected_roi
         FROM initiatives i
        WHERE i.status = 'DONE'
          AND NOT EXISTS (
            SELECT 1 FROM initiative_benefits b WHERE b.initiative_id = i.id
          )
          ${orgClause}
        ORDER BY i.organization_id, i.id`,
      ORG_FILTER ? [ORG_FILTER] : []
    );

    console.log(`\nFound ${targets.length} DONE initiative(s) with zero initiative_benefits rows.\n`);

    for (const initiative of targets) {
      summary.scanned += 1;
      try {
        const { rows: kpis } = await client.query(
          `SELECT id, name, description, target_value
             FROM initiative_kpis
            WHERE initiative_id = $1 AND target_value IS NOT NULL`,
          [initiative.id]
        );

        if (kpis.length > 0) {
          for (const kpi of kpis) {
            const { rows: existing } = await client.query(
              `SELECT id FROM initiative_benefits
                WHERE initiative_id = $1 AND kpi_id = $2 AND source_tag = $3
                LIMIT 1`,
              [initiative.id, kpi.id, CLOSURE_HANDOFF_SOURCE]
            );
            if (existing.length > 0) {
              summary.skippedDedup += 1;
              continue;
            }

            console.log(
              `  [KPI]      ${initiative.organization_id} / ${initiative.id} — "${kpi.name}" → target ${kpi.target_value}`
            );
            if (APPLY) {
              await client.query(
                `INSERT INTO initiative_benefits (
                   id, initiative_id, organization_id, name, description,
                   benefit_type, kpi_id, target_value, status, source_tag,
                   created_by, created_at, updated_at
                 ) VALUES (
                   gen_random_uuid()::text, $1, $2, $3, $4,
                   'quantitative', $5, $6, 'tracking', $7,
                   NULL, NOW(), NOW()
                 )`,
                [
                  initiative.id,
                  initiative.organization_id,
                  kpi.name,
                  kpi.description || null,
                  kpi.id,
                  kpi.target_value,
                  CLOSURE_HANDOFF_SOURCE,
                ]
              );
            }
            summary.createdFromKpi += 1;
          }
          continue;
        }

        // Fallback: no KPIs with a target — try expected_roi (this was ALL 45
        // of the missing rows found in the 2026-07-10 staging audit).
        const { rows: existingFallback } = await client.query(
          `SELECT id FROM initiative_benefits
            WHERE initiative_id = $1 AND kpi_id IS NULL AND source_tag = $2
            LIMIT 1`,
          [initiative.id, CLOSURE_HANDOFF_SOURCE]
        );
        if (existingFallback.length > 0) {
          summary.skippedDedup += 1;
          continue;
        }

        const expectedRoi =
          initiative.expected_roi !== null && initiative.expected_roi !== undefined
            ? Number(initiative.expected_roi)
            : null;

        if (expectedRoi === null || Number.isNaN(expectedRoi)) {
          console.log(
            `  [SKIP]     ${initiative.organization_id} / ${initiative.id} — no KPIs, no expected_roi, nothing to hand off`
          );
          summary.skippedNoData += 1;
          continue;
        }

        console.log(
          `  [FALLBACK] ${initiative.organization_id} / ${initiative.id} — "${initiative.name}" → expected_roi ${expectedRoi}`
        );
        if (APPLY) {
          await client.query(
            `INSERT INTO initiative_benefits (
               id, initiative_id, organization_id, name, description,
               benefit_type, kpi_id, target_value, status, confidence_level,
               source_tag, created_by, created_at, updated_at
             ) VALUES (
               gen_random_uuid()::text, $1, $2, $3, $4,
               'quantitative', NULL, $5, 'tracking', 'low',
               $6, NULL, NOW(), NOW()
             )`,
            [
              initiative.id,
              initiative.organization_id,
              `${initiative.name || 'Initiative'} — ROI docelowy (business case)`,
              'Backfill G1: brak initiative_kpis w chwili zamknięcia — wartość z pola expected_roi inicjatywy.',
              expectedRoi,
              CLOSURE_HANDOFF_SOURCE,
            ]
          );
        }
        summary.createdFromFallback += 1;
      } catch (err) {
        summary.errors += 1;
        console.error(`  [ERROR]    ${initiative.organization_id} / ${initiative.id} — ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }

  console.log('\n=== G1 backfill summary ===');
  console.log(`Mode:                     ${APPLY ? 'APPLIED' : 'DRY-RUN — nothing written'}`);
  console.log(`Initiatives scanned:      ${summary.scanned}`);
  console.log(`Benefits from KPI:        ${summary.createdFromKpi}`);
  console.log(`Benefits from fallback:   ${summary.createdFromFallback}`);
  console.log(`Skipped (already exists): ${summary.skippedDedup}`);
  console.log(`Skipped (no data at all): ${summary.skippedNoData}`);
  console.log(`Errors:                   ${summary.errors}`);
  if (!APPLY) {
    console.log('\nThis was a DRY RUN. Re-run with --apply to write these rows.');
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
