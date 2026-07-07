#!/usr/bin/env node
/**
 * Cleanup: DBR77 sędzia/probe test records left on demo/trolley.
 *
 * Context (see Harvard/wdrozenie-100 handoffs, task in worktree
 * consultify-wt/r2Cleanup branch naprawa-r2Cleanup): repeated live-judge
 * ("sędzia BCG") test runs against the DBR77 PdM (predictive maintenance)
 * brief create decisions/tasks/initiatives/notebook pages/deck & doc
 * artifacts on the demo org(s). Until now `/api/decisions` had no DELETE,
 * so probes could not clean up after themselves — records piled up on
 * demo, which is the product's face (see CLAUDE.md "demo=twarz produktu").
 *
 * This script finds records that plausibly came from those test runs by
 * matching BOTH:
 *   (a) title/name contains one of the known DBR77 PdM test-brief phrases
 *       (Polish, case-insensitive, diacritics-normalized), AND
 *   (b) created within the last RECENCY_HOURS hours (default 12h — generous
 *       enough to catch a same-day judge run, tight enough that older real
 *       customer data can never match by accident).
 *
 * Scope: decisions, tasks, initiatives, notebook_pages (Notatnik "docs"),
 * v8_output_artifacts (decks/reports/sheets — artifact_family in
 * ('presentation','document','sheet')).
 *
 * NEVER hard-deletes. Marks matches as archived/cancelled via each table's
 * own reversible-state column:
 *   - decisions:            status = 'cancelled'
 *   - tasks:                status = 'archived'   (falls back to leaving
 *                            status alone + tagging via title prefix is
 *                            NOT done — we only ever touch status)
 *   - initiatives:           status = 'archived'
 *   - notebook_pages:        no status column — DELETEd is NOT used; instead
 *                            title gets an "[ARCHIVED-TEST]" prefix and
 *                            visibility flips to 'private' so it drops out
 *                            of any project-shared view. (Reversible: undo
 *                            by stripping the prefix.)
 *   - v8_output_artifacts:   delivery_state = 'archived'
 *
 * Default mode is DRY-RUN (report only, zero writes). Pass --execute to
 * apply. Hard guard: refuses to run against prod (host contains
 * "centerbeam"). Intended target: trolley (demo/staging shared DB).
 *
 * Usage:
 *   node server/migrations/ops/cleanup_demo_test_records.cjs                # dry-run, default 12h window
 *   node server/migrations/ops/cleanup_demo_test_records.cjs --hours=24     # widen recency window
 *   node server/migrations/ops/cleanup_demo_test_records.cjs --execute      # apply (archive matches)
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
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1);
  }
  return url;
}

// Known DBR77 PdM ("predykcyjne utrzymanie ruchu") test-brief phrases.
// Kept in Polish, matched case-insensitively with diacritics stripped so
// "predykcyjnego" / "predykcyjne" / accented variants all hit. Deliberately
// CONSERVATIVE: every phrase is multi-word (>=2 tokens) so a short generic
// word can never match on its own — avoids false-positives against real
// customer data that happens to mention e.g. "RPA" or "AI" alone.
const TEST_BRIEF_PHRASES = [
  'predykcyjnego utrzymania ruchu',
  'predykcyjne utrzymanie ruchu',
  'wybor dostawcy rpa',
  '3 maszyn krytycznych',
  'trzech maszyn krytycznych',
  'business case pdm',
  'model finansowy roi pdm',
  'strategia ai dla zarzadu',
];

function normalize(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleMatchesBrief(title) {
  const n = normalize(title);
  if (!n) return false;
  return TEST_BRIEF_PHRASES.some((phrase) => n.includes(normalize(phrase)));
}

async function main() {
  const execute = process.argv.includes('--execute');
  const hoursArg = process.argv.find((a) => a.startsWith('--hours='));
  const recencyHours = hoursArg ? Number(hoursArg.split('=')[1]) : 12;
  if (!Number.isFinite(recencyHours) || recencyHours <= 0) {
    throw new Error(`Invalid --hours value: ${hoursArg}`);
  }

  const connectionString = loadEnvStaging();
  const host = (() => {
    try {
      return new URL(connectionString).host;
    } catch {
      return '(unparseable)';
    }
  })();

  // Hard guard: refuse to run against prod (centerbeam). Trolley (staging/demo) only.
  if (host.includes('centerbeam')) {
    throw new Error(`Refusing to run against prod host: ${host}`);
  }

  console.log(
    `[cleanup-demo-test-records] Target host: ${host} (${
      execute ? 'EXECUTE — will archive matches' : 'DRY-RUN — report only'
    }), recency window: ${recencyHours}h`
  );

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const report = {
    decisions: [],
    tasks: [],
    initiatives: [],
    notebook_pages: [],
    v8_output_artifacts: [],
  };

  try {
    // ------------------------------------------------------------------
    // 1) decisions — title + recency, exclude already-cancelled
    // ------------------------------------------------------------------
    const decisions = await client.query(
      `SELECT id, organization_id, title, status, created_at
         FROM decisions
        WHERE created_at >= NOW() - ($1 || ' hours')::interval
          AND status IS DISTINCT FROM 'cancelled'`,
      [String(recencyHours)]
    );
    report.decisions = decisions.rows.filter((r) => titleMatchesBrief(r.title));

    // ------------------------------------------------------------------
    // 2) tasks — title + recency, exclude already-archived/done/completed
    // ------------------------------------------------------------------
    const tasks = await client.query(
      `SELECT id, organization_id, title, status, created_at
         FROM tasks
        WHERE created_at >= NOW() - ($1 || ' hours')::interval
          AND status IS DISTINCT FROM 'archived'`,
      [String(recencyHours)]
    );
    report.tasks = tasks.rows.filter((r) => titleMatchesBrief(r.title));

    // ------------------------------------------------------------------
    // 3) initiatives — name/title + recency, exclude already-archived
    // ------------------------------------------------------------------
    const initiatives = await client.query(
      `SELECT id, organization_id, name, title, status, created_at
         FROM initiatives
        WHERE created_at >= NOW() - ($1 || ' hours')::interval
          AND status IS DISTINCT FROM 'archived'`,
      [String(recencyHours)]
    );
    report.initiatives = initiatives.rows.filter(
      (r) => titleMatchesBrief(r.name) || titleMatchesBrief(r.title)
    );

    // ------------------------------------------------------------------
    // 4) notebook_pages ("docs") — title + recency
    // ------------------------------------------------------------------
    const notebookPages = await client.query(
      `SELECT id, organization_id, title, created_at
         FROM notebook_pages
        WHERE created_at >= NOW() - ($1 || ' hours')::interval
          AND title NOT LIKE '[ARCHIVED-TEST]%'`,
      [String(recencyHours)]
    );
    report.notebook_pages = notebookPages.rows.filter((r) => titleMatchesBrief(r.title));

    // ------------------------------------------------------------------
    // 5) v8_output_artifacts (decks/docs/sheets) — title_snapshot + recency
    // ------------------------------------------------------------------
    // NOTE: created_at on this table is `text` (legacy sqlite-era column,
    // Postgres baseline never tightened it) — cast explicitly for the
    // interval comparison instead of relying on an implicit text->timestamptz
    // cast, which Postgres does NOT do automatically in a WHERE clause.
    const artifacts = await client.query(
      `SELECT artifact_id, organization_id, title_snapshot, artifact_family,
              output_type, delivery_state, created_at
         FROM v8_output_artifacts
        WHERE created_at::timestamptz >= NOW() - ($1 || ' hours')::interval
          AND delivery_state IS DISTINCT FROM 'archived'`,
      [String(recencyHours)]
    );
    report.v8_output_artifacts = artifacts.rows.filter((r) =>
      titleMatchesBrief(r.title_snapshot)
    );

    // ------------------------------------------------------------------
    // Report
    // ------------------------------------------------------------------
    const total =
      report.decisions.length +
      report.tasks.length +
      report.initiatives.length +
      report.notebook_pages.length +
      report.v8_output_artifacts.length;

    console.log(`\n[cleanup-demo-test-records] Matches found: ${total}\n`);

    const printRows = (label, rows, titleFn) => {
      if (!rows.length) return;
      console.log(`--- ${label} (${rows.length}) ---`);
      for (const r of rows) {
        console.log(
          `  id=${r.id || r.artifact_id} org=${r.organization_id} ` +
            `title="${titleFn(r)}" created_at=${r.created_at}`
        );
      }
      console.log('');
    };

    printRows('decisions', report.decisions, (r) => r.title);
    printRows('tasks', report.tasks, (r) => r.title);
    printRows('initiatives', report.initiatives, (r) => r.title || r.name);
    printRows('notebook_pages', report.notebook_pages, (r) => r.title);
    printRows('v8_output_artifacts', report.v8_output_artifacts, (r) => r.title_snapshot);

    if (total === 0) {
      console.log('[cleanup-demo-test-records] Nothing matched. Exiting.');
      return;
    }

    if (!execute) {
      console.log(
        `[cleanup-demo-test-records] DRY-RUN complete. ${total} record(s) would be archived. ` +
          `Re-run with --execute to apply.`
      );
      return;
    }

    console.log(`[cleanup-demo-test-records] EXECUTE: archiving ${total} record(s)...`);

    let archivedCount = 0;

    for (const r of report.decisions) {
      const res = await client.query(
        `UPDATE decisions SET status = 'cancelled', updated_at = NOW()
          WHERE id = $1 AND organization_id = $2 AND status IS DISTINCT FROM 'cancelled'`,
        [r.id, r.organization_id]
      );
      archivedCount += res.rowCount;
    }

    for (const r of report.tasks) {
      const res = await client.query(
        `UPDATE tasks SET status = 'archived', updated_at = NOW()
          WHERE id = $1 AND organization_id = $2 AND status IS DISTINCT FROM 'archived'`,
        [r.id, r.organization_id]
      );
      archivedCount += res.rowCount;
    }

    for (const r of report.initiatives) {
      const res = await client.query(
        `UPDATE initiatives SET status = 'archived', updated_at = NOW()
          WHERE id = $1 AND organization_id = $2 AND status IS DISTINCT FROM 'archived'`,
        [r.id, r.organization_id]
      );
      archivedCount += res.rowCount;
    }

    for (const r of report.notebook_pages) {
      const res = await client.query(
        `UPDATE notebook_pages
            SET title = '[ARCHIVED-TEST] ' || title, visibility = 'private', updated_at = NOW()
          WHERE id = $1 AND organization_id = $2 AND title NOT LIKE '[ARCHIVED-TEST]%'`,
        [r.id, r.organization_id]
      );
      archivedCount += res.rowCount;
    }

    for (const r of report.v8_output_artifacts) {
      const res = await client.query(
        `UPDATE v8_output_artifacts
            SET delivery_state = 'archived', last_transition_at = NOW()
          WHERE artifact_id = $1 AND organization_id = $2 AND delivery_state IS DISTINCT FROM 'archived'`,
        [r.artifact_id, r.organization_id]
      );
      archivedCount += res.rowCount;
    }

    console.log(`[cleanup-demo-test-records] Archived ${archivedCount}/${total} record(s).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[cleanup-demo-test-records] FAILED:', e.message);
  process.exit(1);
});
