#!/usr/bin/env node
/**
 * Backfill: Excele orphan tp_tables sheet artifacts (pre-P-2 split-brain).
 *
 * Context (see server/src/routes/workbook.routes.ts "P-2 split-brain fix" +
 * server/src/services/v8/artifactRegistryService.ts adoptRunArtifactForWorkbook):
 * before P-2 landed, generating the real .xlsx for an ArtifactRun that had
 * already materialized a governed Table Studio sheet (tp_tables row) created a
 * SECOND Outputs Library card instead of adopting the first one. Concretely:
 *
 *   - artifact A: v8_output_artifacts (artifact_family='sheet') whose primary
 *     v8_artifact_origin_links row has origin_runtime='sheet',
 *     origin_record_id = <tp_tables.id>  (never re-pointed — orphan)
 *   - artifact B: a second, standalone v8_output_artifacts row whose origin
 *     link has origin_runtime='sheet', origin_record_id = <generated_workbooks.id>
 *     (the real, downloadable .xlsx card — this is the one users actually want)
 *
 * This script finds A/B pairs in the SAME organization that plausibly refer to
 * the same logical deliverable (matched by title, tp_tables.name), and — for
 * anything found — marks the ORPHAN (A, the tp_tables-origin card with no real
 * workbook backing it) as `delivery_state = 'archived'`. It NEVER hard-deletes
 * rows. Default mode is DRY-RUN (report only); pass --execute to apply.
 *
 * Hard guard: refuses to run against prod (centerbeam). Staging (trolley) only.
 * The supervisor session runs this — NOT the worker that wrote it.
 *
 * Usage:
 *   node server/migrations/ops/backfill_excele_orphan_tp_tables.cjs             # dry-run
 *   node server/migrations/ops/backfill_excele_orphan_tp_tables.cjs --execute   # apply (archive orphans)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvStaging() {
  const envPath = path.resolve(__dirname, '../../../.env.staging.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in .env.staging.local');
  let url = line.slice('DATABASE_URL='.length).trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1);
  }
  return url;
}

// Levenshtein-lite: cheap normalized-title equality/containment check (no extra deps).
function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titlesLikelyMatch(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // one contains the other (handles "(1)" suffixes, "Copy of", trailing punctuation, etc.)
  return na.includes(nb) || nb.includes(na);
}

async function main() {
  const execute = process.argv.includes('--execute');
  const connectionString = loadEnvStaging();
  const host = (() => {
    try {
      return new URL(connectionString).host;
    } catch {
      return '(unparseable)';
    }
  })();

  // Hard guard: refuse to run against prod (centerbeam). Trolley (staging) only.
  if (host.includes('centerbeam')) {
    throw new Error(`Refusing to run against prod host: ${host}`);
  }
  console.log(
    `[excele-orphan-backfill] Target host: ${host} (${execute ? 'EXECUTE — will archive orphans' : 'DRY-RUN — report only'})`
  );

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // 1) All sheet-family artifacts whose PRIMARY origin link still points at a
    //    tp_tables row (i.e. never adopted/re-pointed to a real workbook).
    const orphanCandidates = await client.query(
      `SELECT
         a.artifact_id,
         a.organization_id,
         a.title_snapshot,
         a.delivery_state,
         a.created_at,
         l.link_id,
         l.origin_record_id AS tp_table_id
       FROM v8_output_artifacts a
       JOIN v8_artifact_origin_links l
         ON l.artifact_id = a.artifact_id
        AND l.organization_id = a.organization_id
        AND l.is_primary_origin = 1
       WHERE a.artifact_family = 'sheet'
         AND l.origin_runtime = 'sheet'
         AND a.delivery_state != 'archived'
         AND EXISTS (
           SELECT 1 FROM tp_tables t WHERE t.id::text = l.origin_record_id
         )`
    );

    console.log(
      `[excele-orphan-backfill] Candidate tp_tables-origin sheet artifacts: ${orphanCandidates.rows.length}`
    );

    if (orphanCandidates.rows.length === 0) {
      console.log('[excele-orphan-backfill] Nothing to check. Exiting.');
      return;
    }

    // 2) All sheet-family artifacts whose PRIMARY origin link points at a real
    //    generated_workbooks row (the actual downloadable .xlsx card).
    const workbookCards = await client.query(
      `SELECT
         a.artifact_id,
         a.organization_id,
         a.title_snapshot,
         a.created_at,
         l.origin_record_id AS workbook_id
       FROM v8_output_artifacts a
       JOIN v8_artifact_origin_links l
         ON l.artifact_id = a.artifact_id
        AND l.organization_id = a.organization_id
        AND l.is_primary_origin = 1
       WHERE a.artifact_family = 'sheet'
         AND l.origin_runtime = 'sheet'
         AND a.delivery_state != 'archived'
         AND EXISTS (
           SELECT 1 FROM generated_workbooks w WHERE w.id = l.origin_record_id
         )`
    );

    console.log(
      `[excele-orphan-backfill] Existing real-workbook sheet artifacts: ${workbookCards.rows.length}`
    );

    // 3) tp_tables titles (name) for the candidate orphans, to match against
    //    the workbook cards' title_snapshot.
    const tableIds = orphanCandidates.rows.map((r) => r.tp_table_id);
    const tableNames = tableIds.length
      ? await client.query(
          `SELECT id::text AS id, name FROM tp_tables WHERE id::text = ANY($1::text[])`,
          [tableIds]
        )
      : { rows: [] };
    const tableNameById = new Map(tableNames.rows.map((r) => [r.id, r.name]));

    const pairs = [];
    for (const orphan of orphanCandidates.rows) {
      const tableTitle = tableNameById.get(orphan.tp_table_id) || orphan.title_snapshot;
      const match = workbookCards.rows.find(
        (wb) =>
          wb.organization_id === orphan.organization_id &&
          wb.artifact_id !== orphan.artifact_id &&
          (titlesLikelyMatch(wb.title_snapshot, tableTitle) ||
            titlesLikelyMatch(wb.title_snapshot, orphan.title_snapshot))
      );
      if (match) {
        pairs.push({ orphan, match, tableTitle });
      }
    }

    console.log(
      `\n[excele-orphan-backfill] Matched orphan pairs (same org, title match): ${pairs.length}\n`
    );

    for (const { orphan, match, tableTitle } of pairs) {
      console.log(
        `  ORPHAN artifact_id=${orphan.artifact_id} org=${orphan.organization_id} ` +
          `tp_table_id=${orphan.tp_table_id} title="${tableTitle}" created_at=${orphan.created_at}`
      );
      console.log(
        `    -> matches REAL workbook card artifact_id=${match.artifact_id} ` +
          `workbook_id=${match.workbook_id} title="${match.title_snapshot}" created_at=${match.created_at}\n`
      );
    }

    if (pairs.length === 0) {
      console.log('[excele-orphan-backfill] No orphan/workbook title matches found. Nothing to archive.');
      return;
    }

    if (!execute) {
      console.log(
        `[excele-orphan-backfill] DRY-RUN complete. ${pairs.length} orphan(s) would be archived ` +
          `(delivery_state='archived'). Re-run with --execute to apply.`
      );
      return;
    }

    console.log(`[excele-orphan-backfill] EXECUTE: archiving ${pairs.length} orphan(s)...`);
    let archived = 0;
    for (const { orphan } of pairs) {
      const result = await client.query(
        `UPDATE v8_output_artifacts
            SET delivery_state = 'archived',
                last_transition_at = NOW()
          WHERE artifact_id = $1
            AND organization_id = $2
            AND delivery_state != 'archived'`,
        [orphan.artifact_id, orphan.organization_id]
      );
      if (result.rowCount > 0) archived += 1;
    }
    console.log(`[excele-orphan-backfill] Archived ${archived}/${pairs.length} orphan artifact(s).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[excele-orphan-backfill] FAILED:', e.message);
  process.exit(1);
});
