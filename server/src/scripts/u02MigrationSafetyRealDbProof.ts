import fs from 'node:fs';
import path from 'node:path';

import { Pool } from 'pg';

/**
 * U02 migration safety contract — both paths, on a real PostgreSQL database.
 *
 * A) CLEAN: applying the migration twice is idempotent and creates both
 *    immutable-version unique indexes.
 * B) LEGACY DUPLICATES: the migration ABORTS with an actionable diagnostic that
 *    names the affected owner IDs and version numbers, creates NEITHER index,
 *    and — the property that matters most — leaves every pre-existing row
 *    untouched. Version history is user data; a migration must never resolve a
 *    duplicate by deleting one side.
 *
 * Run against a disposable database:
 *   DATABASE_URL=postgresql://localhost/<throwaway> \
 *     npx tsx server/src/scripts/u02MigrationSafetyRealDbProof.ts
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });

const MIGRATION = fs.readFileSync(
  path.resolve(process.cwd(), 'server/migrations/20260810_t01_u02_native_final_outputs.sql'),
  'utf8'
);

/** Only the tables the migration touches — this proof is about the DDL contract. */
async function resetSchema() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`
    CREATE TABLE transformation_final_output_runs (
      run_id TEXT PRIMARY KEY,
      transformation_case_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      case_version INTEGER NOT NULL,
      facts_digest TEXT NOT NULL,
      docx_path TEXT NOT NULL,
      docx_sha256 TEXT NOT NULL,
      pptx_path TEXT NOT NULL,
      pptx_sha256 TEXT NOT NULL
    );
    CREATE TABLE report_builder_reports (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL);
    CREATE TABLE report_builder_versions (
      id TEXT PRIMARY KEY, report_id TEXT NOT NULL, version_number INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL
    );
    CREATE TABLE presentation_decks (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL);
    CREATE TABLE presentation_deck_versions (
      id TEXT PRIMARY KEY, deck_id TEXT NOT NULL, version INTEGER NOT NULL,
      deck_json_snapshot TEXT NOT NULL
    );
  `);
}

async function indexes(): Promise<string[]> {
  const rows = (
    await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname='public'
          AND indexname IN ('report_builder_versions_report_version_uq',
                            'presentation_deck_versions_deck_version_uq')
        ORDER BY indexname`
    )
  ).rows;
  return rows.map((r) => r.indexname);
}

async function manifestColumns(): Promise<string[]> {
  const rows = (
    await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='transformation_final_output_runs'
          AND column_name LIKE 'native_%' OR (table_name='transformation_final_output_runs'
          AND table_schema='public' AND column_name LIKE '%registry_artifact_id')
        ORDER BY column_name`
    )
  ).rows;
  return rows.map((r) => r.column_name);
}

/** Every row currently in both version tables, as a stable fingerprint. */
async function versionRowFingerprint(): Promise<string> {
  const rows = (
    await pool.query(
      `SELECT 'r:'||id||':'||report_id||':'||version_number AS k FROM report_builder_versions
       UNION ALL
       SELECT 'd:'||id||':'||deck_id||':'||version FROM presentation_deck_versions
       ORDER BY k`
    )
  ).rows as Array<{ k: string }>;
  return rows.map((r) => r.k).join('|');
}

async function main() {
  // ── A) clean database, applied twice ────────────────────────────────────
  await resetSchema();
  await pool.query(`INSERT INTO report_builder_reports VALUES ('rep-1','org-1')`);
  await pool.query(`INSERT INTO presentation_decks VALUES ('deck-1','org-1')`);
  await pool.query(
    `INSERT INTO report_builder_versions VALUES ('rv-1','rep-1',1,'{}'),('rv-2','rep-1',2,'{}')`
  );
  await pool.query(
    `INSERT INTO presentation_deck_versions VALUES ('dv-1','deck-1',1,'{}'),('dv-2','deck-1',2,'{}')`
  );

  await pool.query(MIGRATION);
  const afterFirst = await indexes();
  const columnsAfterFirst = await manifestColumns();
  await pool.query(MIGRATION); // idempotent re-run
  const afterSecond = await indexes();
  const columnsAfterSecond = await manifestColumns();

  if (
    afterFirst.length !== 2 ||
    afterSecond.length !== 2 ||
    JSON.stringify(afterFirst) !== JSON.stringify(afterSecond) ||
    columnsAfterFirst.length !== 8 ||
    JSON.stringify(columnsAfterFirst) !== JSON.stringify(columnsAfterSecond)
  )
    throw new Error(
      `U02 clean path failed: ${JSON.stringify({ afterFirst, afterSecond, columnsAfterFirst, columnsAfterSecond })}`
    );

  // The constraint must actually bite once created.
  let duplicateRejected = '';
  try {
    await pool.query(`INSERT INTO report_builder_versions VALUES ('rv-3','rep-1',2,'{}')`);
  } catch (error) {
    duplicateRejected = String((error as { code?: string }).code || '');
  }
  if (duplicateRejected !== '23505')
    throw new Error(`U02 clean path did not enforce report version uniqueness: ${duplicateRejected}`);

  // ── B) legacy duplicates ────────────────────────────────────────────────
  await resetSchema();
  await pool.query(`INSERT INTO report_builder_reports VALUES ('rep-9','org-9')`);
  await pool.query(`INSERT INTO presentation_decks VALUES ('deck-9','org-9')`);
  await pool.query(
    `INSERT INTO report_builder_versions VALUES
       ('rv-a','rep-9',1,'{"keep":"a"}'),
       ('rv-b','rep-9',1,'{"keep":"b"}'),
       ('rv-c','rep-9',2,'{"keep":"c"}')`
  );
  await pool.query(
    `INSERT INTO presentation_deck_versions VALUES
       ('dv-a','deck-9',1,'{"keep":"a"}'),
       ('dv-b','deck-9',1,'{"keep":"b"}')`
  );
  const beforeFingerprint = await versionRowFingerprint();

  let failure = { message: '', hint: '', code: '' };
  try {
    await pool.query(MIGRATION);
  } catch (error) {
    const e = error as { message?: string; hint?: string; code?: string };
    failure = { message: String(e.message || ''), hint: String(e.hint || ''), code: String(e.code || '') };
  }

  const afterFingerprint = await versionRowFingerprint();
  const duplicateIndexes = await indexes();
  const rowCounts = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM report_builder_versions) report_versions,
      (SELECT COUNT(*)::int FROM presentation_deck_versions) deck_versions`)
  ).rows[0];

  if (!/U02_DUPLICATE_REPORT_VERSIONS/.test(failure.message))
    throw new Error(`U02 duplicate path did not fail closed: ${JSON.stringify(failure)}`);
  if (!/report_id=rep-9 version_number=1 rows=2/.test(failure.message))
    throw new Error(`U02 duplicate diagnostic did not name the affected rows: ${failure.message}`);
  if (!/re-run this migration/.test(failure.hint))
    throw new Error(`U02 duplicate diagnostic lacks a reconciliation hint: ${JSON.stringify(failure)}`);
  if (duplicateIndexes.length !== 0)
    throw new Error(`U02 duplicate path created an index anyway: ${JSON.stringify(duplicateIndexes)}`);
  if (beforeFingerprint !== afterFingerprint || rowCounts.report_versions !== 3 || rowCounts.deck_versions !== 2)
    throw new Error(
      `U02 duplicate path mutated version history: ${JSON.stringify({ beforeFingerprint, afterFingerprint, rowCounts })}`
    );

  // ── C) reconcile, then re-run: the constraint lands ──────────────────────
  await pool.query(`UPDATE report_builder_versions SET version_number=3 WHERE id='rv-b'`);
  await pool.query(`UPDATE presentation_deck_versions SET version=2 WHERE id='dv-b'`);
  await pool.query(MIGRATION);
  const afterReconciliation = await indexes();
  const reconciledCounts = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM report_builder_versions) report_versions,
      (SELECT COUNT(*)::int FROM presentation_deck_versions) deck_versions`)
  ).rows[0];
  if (
    afterReconciliation.length !== 2 ||
    reconciledCounts.report_versions !== 3 ||
    reconciledCounts.deck_versions !== 2
  )
    throw new Error(
      `U02 post-reconciliation re-run failed: ${JSON.stringify({ afterReconciliation, reconciledCounts })}`
    );

  console.log(
    JSON.stringify({
      proof: 'U02_MIGRATION_SAFETY_REALDB_GREEN',
      cleanPath: {
        indexesAfterFirstApply: afterFirst,
        indexesAfterSecondApply: afterSecond,
        idempotent: true,
        manifestColumnsAdded: columnsAfterFirst.length,
        duplicateInsertRejectedWith: duplicateRejected,
      },
      duplicatePath: {
        failedClosed: true,
        errorCode: failure.code,
        message: failure.message,
        hint: failure.hint,
        indexesCreated: duplicateIndexes,
        rowsPreserved: beforeFingerprint === afterFingerprint,
        rowCounts,
      },
      afterReconciliation: { indexes: afterReconciliation, rowCounts: reconciledCounts },
    })
  );
}

main().then(
  async () => {
    await pool.end();
    process.exit(0);
  },
  async (error) => {
    await pool.end();
    process.stderr.write(`${String((error as Error)?.stack || error)}\n`);
    process.exit(1);
  }
);
