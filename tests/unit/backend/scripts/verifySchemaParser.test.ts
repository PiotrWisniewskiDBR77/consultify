/** @vitest-environment node */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  isSqliteOnlyMigration,
  parseExpectedSchema,
} from '../../../../server/scripts/verify-schema-vs-migrations.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-schema-'));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('parseExpectedSchema', () => {
  it('extracts CREATE TABLE and ALTER TABLE ADD COLUMN, skipping comments', () => {
    // Versions >= 500 so the Postgres-runner exclusion (legacy <500 = sqlite-first)
    // does not drop them.
    fs.writeFileSync(
      path.join(tmpDir, '700_a.sql'),
      `
      CREATE TABLE IF NOT EXISTS foo_bar (id TEXT PRIMARY KEY);
      CREATE TABLE "quoted_table" (id TEXT);
      -- CREATE TABLE commented_out (id TEXT);
      ALTER TABLE foo_bar ADD COLUMN IF NOT EXISTS extra_col TEXT;
      ALTER TABLE IF EXISTS quoted_table ADD COLUMN "other_col" INTEGER;
      `
    );
    fs.writeFileSync(
      path.join(tmpDir, '701_b.sql'),
      `CREATE TABLE foo_bar (id TEXT); -- duplicate definition, first file wins`
    );

    const schema = parseExpectedSchema(tmpDir);

    expect(schema.tables.get('foo_bar')).toBe('700_a.sql');
    expect(schema.tables.get('quoted_table')).toBe('700_a.sql');
    expect(schema.tables.has('commented_out')).toBe(false);
    expect(schema.columns.get('foo_bar.extra_col')).toBe('700_a.sql');
    expect(schema.columns.get('quoted_table.other_col')).toBe('700_a.sql');
  });

  it('respects the onlyPrefix filter', () => {
    const schema = parseExpectedSchema(tmpDir, '701_');
    expect(schema.tables.get('foo_bar')).toBe('701_b.sql');
    expect(schema.tables.has('quoted_table')).toBe(false);
  });

  it('handles public-qualified tables, ignores dynamic SQL and honors dropped columns', () => {
    fs.writeFileSync(
      path.join(tmpDir, '702_lifecycle.sql'),
      `
      CREATE TABLE IF NOT EXISTS public.qualified_table (id TEXT);
      ALTER TABLE public.qualified_table ADD COLUMN IF NOT EXISTS legacy_value TEXT;
      ALTER TABLE public.qualified_table DROP COLUMN IF EXISTS legacy_value;
      DO $$ BEGIN EXECUTE 'CREATE TABLE IF NOT EXISTS dynamic_backup AS SELECT 1'; END $$;
      `
    );

    const schema = parseExpectedSchema(tmpDir);
    expect(schema.tables.has('qualified_table')).toBe(true);
    expect(schema.tables.has('public')).toBe(false);
    expect(schema.tables.has('if')).toBe(false);
    expect(schema.tables.has('dynamic_backup')).toBe(false);
    expect(schema.columns.has('qualified_table.legacy_value')).toBe(false);
  });

  it('excludes sqlite-only / Postgres-skipped migrations from expected schema', () => {
    // These mirror migrate.postgres.ts isSqliteOnlyMigration and must NOT count.
    fs.writeFileSync(
      path.join(tmpDir, '027_legacy.sql.sql'),
      `CREATE TABLE legacy_sqlite_only (id TEXT);`
    );
    fs.writeFileSync(
      path.join(tmpDir, '042_old_prebaseline.sql'),
      `CREATE TABLE prebaseline_skip (id TEXT);`
    );
    const schema = parseExpectedSchema(tmpDir);
    expect(schema.tables.has('legacy_sqlite_only')).toBe(false);
    expect(schema.tables.has('prebaseline_skip')).toBe(false);
  });

  it('isSqliteOnlyMigration matches the runner exclusion rules', () => {
    expect(isSqliteOnlyMigration('027_email_verification.sql.sql')).toBe(true);
    expect(isSqliteOnlyMigration('281_knowledge_hub.sql')).toBe(true); // <500
    expect(isSqliteOnlyMigration('000_initdb_core_tables.sql')).toBe(true);
    expect(isSqliteOnlyMigration('123_seed_demo.sql')).toBe(true);
    expect(isSqliteOnlyMigration('700_real_postgres.sql')).toBe(false);
    expect(isSqliteOnlyMigration('20260611_recent.sql')).toBe(false);
    expect(isSqliteOnlyMigration('000_z_core_baseline.sql')).toBe(false);
  });

  it('parses the real migrations dir without throwing and finds known tables', () => {
    const realDir = path.resolve(process.cwd(), 'server/migrations');
    const schema = parseExpectedSchema(realDir);
    expect(schema.tables.size).toBeGreaterThan(100);
    // W4 audit landmarks
    expect(schema.tables.has('v8.v8_process_flow_nodes')).toBe(true);
    expect(schema.tables.has('my_idea_map_snapshots')).toBe(true);
    expect(schema.tables.has('v8_kpi_signals')).toBe(true);
  });
});
