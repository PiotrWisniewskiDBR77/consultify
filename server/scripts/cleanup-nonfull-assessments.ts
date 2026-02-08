#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Cleanup non-full assessments (SQLite/Postgres via Database factory).
 *
 * Default behavior: dry-run (no deletes).
 * Run with: --apply  to perform deletion.
 *
 * Definition of "full audit" (DoD-aligned):
 * - completion_percent >= 100 AND confidence_avg >= 3
 *   OR (fallback) computed completion == 100 AND confidenceAvg >= 3
 *
 * Usage (dev sqlite example):
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/cleanup-nonfull-assessments.ts
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/cleanup-nonfull-assessments.ts --apply
 */

import { createDatabase } from '../src/database/Database.js';

type Row = Record<string, any>;

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const TARGET_ORG_ID =
  (process.env.TARGET_ORG_ID || process.env.ORG_ID || process.env.ORGANIZATION_ID || '').trim() ||
  null;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const log = {
  info: (msg: string) => console.log(`${colors.dim}ℹ${colors.reset} ${msg}`),
  ok: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  err: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function hasColumn(db: any, table: string, column: string): Promise<boolean> {
  try {
    const res = await db.query(`PRAGMA table_info(${table})`, []);
    const rows = (res as any)?.rows || [];
    return rows.some((r: any) => String(r?.name || r?.column_name || '').toLowerCase() === column);
  } catch {
    return false;
  }
}

function safeJsonParse<T>(value: any, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function calcDrdCompletionPercent(answers: any): number {
  // We don't import DRD_STRUCTURE here to keep this script dependency-light and runtime-safe.
  // Instead, infer "answered" from keys in drd.areas (34 expected, but we compute percent based on present keys).
  const areas = answers?.drd?.areas || {};
  const keys = Object.keys(areas);
  if (keys.length === 0) return 0;
  // Treat area as answered if it has achievedLevel/targetLevel/decisions/notes/links.
  let answered = 0;
  for (const k of keys) {
    const s = areas[k];
    const hasAchieved = Number(s?.achievedLevel || 0) > 0;
    const hasTarget = Number(s?.targetLevel || 0) > 0;
    const hasDecisions = s?.levelDecisions && Object.keys(s.levelDecisions || {}).length > 0;
    const hasNotes =
      s?.levelNotes && Object.values(s.levelNotes || {}).some((v: any) => String(v || '').trim());
    const hasLinks =
      s?.levelLinks &&
      Object.values(s.levelLinks || {}).some((arr: any) => Array.isArray(arr) && arr.length > 0);
    if (hasAchieved || hasTarget || hasDecisions || hasNotes || hasLinks) answered += 1;
  }
  // Heuristic: if at least 34 areas exist, normalize to 34; else normalize to current keys length.
  const total = Math.max(1, keys.length >= 34 ? 34 : keys.length);
  return Math.round((answered / total) * 100);
}

async function tryDeleteByAssessmentId(
  db: any,
  table: string,
  column: string,
  assessmentId: string
) {
  try {
    await db.query(`DELETE FROM ${table} WHERE ${column} = ?`, [assessmentId]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  log.info(`Cleanup mode: ${APPLY ? 'APPLY (will delete)' : 'DRY-RUN (no deletes)'}`);
  const db = await createDatabase();

  // Determine org to operate on.
  // Prefer explicit env override, otherwise pick the org with the most assessments.
  const orgCountsRes = await db.query(
    `SELECT organization_id as orgId, COUNT(*) as count
     FROM assessments
     GROUP BY organization_id
     ORDER BY count DESC`,
    []
  );
  const orgCounts: Array<{ orgId: string; count: number }> = (orgCountsRes as any)?.rows || [];
  if (!orgCounts.length) {
    log.ok('No assessments found in DB (table is empty).');
    return;
  }

  const orgId = TARGET_ORG_ID ? TARGET_ORG_ID : String(orgCounts[0]?.orgId || '').trim() || null;
  if (!orgId) {
    log.err('Could not determine organization_id to clean up.');
    process.exit(1);
  }

  log.info(
    `Organizations with assessments: ${orgCounts
      .slice(0, 5)
      .map((o) => `${o.orgId}(${o.count})`)
      .join(', ')}${orgCounts.length > 5 ? ` … +${orgCounts.length - 5}` : ''}`
  );
  log.info(`Target organization: ${orgId}${TARGET_ORG_ID ? ' (from env)' : ' (auto)'}`);

  const hasCompletion = await hasColumn(db, 'assessments', 'completion_percent');
  const hasConfidence = await hasColumn(db, 'assessments', 'confidence_avg');
  const hasAnswers = await hasColumn(db, 'assessments', 'answers_json');
  const hasFrameworkData = await hasColumn(db, 'assessments', 'framework_data');

  const assessmentsRes = await db.query(
    `SELECT id, name, status,
            ${hasCompletion ? 'completion_percent as completionPercent,' : 'NULL as completionPercent,'}
            ${hasConfidence ? 'confidence_avg as confidenceAvg,' : 'NULL as confidenceAvg,'}
            ${hasAnswers ? 'answers_json as answersJson,' : 'NULL as answersJson,'}
            ${hasFrameworkData ? 'framework_data as frameworkData,' : 'NULL as frameworkData,'}
            created_at as createdAt,
            updated_at as updatedAt
     FROM assessments
     WHERE organization_id = ?
     ORDER BY updated_at DESC`,
    [orgId]
  );

  const rows: Row[] = (assessmentsRes as any)?.rows || [];
  if (!rows.length) {
    log.ok(`No assessments found for organization_id=${orgId}.`);
    return;
  }

  const classified = rows.map((r) => {
    const completionPercentRaw =
      typeof r.completionPercent === 'number' ? r.completionPercent : null;
    const confidenceAvgRaw = typeof r.confidenceAvg === 'number' ? r.confidenceAvg : null;
    const answers = safeJsonParse<any>(r.answersJson, {});
    const legacy = safeJsonParse<any>(r.frameworkData, {});

    const computedCompletion = hasAnswers ? calcDrdCompletionPercent(answers) : 0;
    const completion =
      completionPercentRaw ??
      (typeof legacy.progress === 'number' ? legacy.progress : computedCompletion);
    const confidence = confidenceAvgRaw ?? 0;

    const isFull = Number(completion || 0) >= 100 && Number(confidence || 0) >= 3;
    return {
      id: String(r.id),
      name: String(r.name || ''),
      status: String(r.status || '').toUpperCase(),
      completion: clamp(Number(completion || 0), 0, 100),
      confidence: Math.round(Number(confidence || 0) * 10) / 10,
      isFull,
    };
  });

  const keep = classified.filter((x) => x.isFull);
  const del = classified.filter((x) => !x.isFull);

  log.info(`Assessments total: ${classified.length}`);
  log.ok(`Full audits (kept): ${keep.length}`);
  log.warn(`Non-full (candidates to delete): ${del.length}`);

  if (del.length) {
    console.log('\nCandidates to delete:');
    for (const x of del) {
      console.log(`- ${x.id} | ${x.status} | ${x.completion}% | conf ${x.confidence} | ${x.name}`);
    }
  }

  if (!APPLY) {
    console.log(
      `\nDry-run complete. Re-run with ${colors.yellow}--apply${colors.reset} to delete the items listed above.`
    );
    return;
  }

  if (!del.length) {
    log.ok('Nothing to delete.');
    return;
  }

  log.warn('Applying deletion (best-effort across related tables)...');

  const relatedDeletes: Array<{ table: string; col: string }> = [
    { table: 'assessment_reports', col: 'assessment_id' },
    { table: 'assessment_decisions', col: 'assessment_id' },
    { table: 'assessment_sessions', col: 'assessment_id' },
    { table: 'assessment_user_state', col: 'assessment_id' },
    { table: 'assessment_area_assignments', col: 'assessment_id' },
    { table: 'assessment_initiative_links', col: 'assessment_id' },
    { table: 'assessment_initiative_batches', col: 'assessment_id' },
    { table: 'assessment_roles', col: 'assessment_id' },
    { table: 'assessment_access_requests', col: 'assessment_id' },
    { table: 'assessment_gate_decisions', col: 'assessment_id' },
    { table: 'assessment_level_attachments', col: 'assessment_id' },
  ];

  let deletedAssessments = 0;
  for (const x of del) {
    log.step(`Deleting assessment ${x.id} (${x.name})`);
    for (const d of relatedDeletes) {
      await tryDeleteByAssessmentId(db, d.table, d.col, x.id);
    }
    // Primary row
    try {
      await db.query(`DELETE FROM assessments WHERE id = ? AND organization_id = ?`, [x.id, orgId]);
      deletedAssessments += 1;
    } catch (e: any) {
      log.err(`Failed to delete assessment ${x.id}: ${String(e?.message || e)}`);
    }
  }

  log.ok(`Deleted assessments: ${deletedAssessments}/${del.length}`);
}

main().catch((e) => {
  log.err(String(e?.message || e));
  process.exit(1);
});
