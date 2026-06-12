/** @vitest-environment node */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterAll, describe, expect, it } from 'vitest';

import { parseExpectedSchema } from '../../../../server/scripts/verify-schema-vs-migrations.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-schema-'));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('parseExpectedSchema', () => {
  it('extracts CREATE TABLE and ALTER TABLE ADD COLUMN, skipping comments', () => {
    fs.writeFileSync(
      path.join(tmpDir, '001_a.sql'),
      `
      CREATE TABLE IF NOT EXISTS foo_bar (id TEXT PRIMARY KEY);
      CREATE TABLE "quoted_table" (id TEXT);
      -- CREATE TABLE commented_out (id TEXT);
      ALTER TABLE foo_bar ADD COLUMN IF NOT EXISTS extra_col TEXT;
      ALTER TABLE IF EXISTS quoted_table ADD COLUMN "other_col" INTEGER;
      `
    );
    fs.writeFileSync(
      path.join(tmpDir, '002_b.sql'),
      `CREATE TABLE foo_bar (id TEXT); -- duplicate definition, first file wins`
    );

    const schema = parseExpectedSchema(tmpDir);

    expect(schema.tables.get('foo_bar')).toBe('001_a.sql');
    expect(schema.tables.get('quoted_table')).toBe('001_a.sql');
    expect(schema.tables.has('commented_out')).toBe(false);
    expect(schema.columns.get('foo_bar.extra_col')).toBe('001_a.sql');
    expect(schema.columns.get('quoted_table.other_col')).toBe('001_a.sql');
  });

  it('respects the onlyPrefix filter', () => {
    const schema = parseExpectedSchema(tmpDir, '002_');
    expect(schema.tables.get('foo_bar')).toBe('002_b.sql');
    expect(schema.tables.has('quoted_table')).toBe(false);
  });

  it('parses the real migrations dir without throwing and finds known tables', () => {
    const realDir = path.resolve(process.cwd(), 'server/migrations');
    const schema = parseExpectedSchema(realDir);
    expect(schema.tables.size).toBeGreaterThan(100);
    // W4 audit landmarks
    expect(schema.tables.has('v8_process_flow_nodes')).toBe(true);
    expect(schema.tables.has('my_idea_map_snapshots')).toBe(true);
    expect(schema.tables.has('v8_kpi_signals')).toBe(true);
  });
});
