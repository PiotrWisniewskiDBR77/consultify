import { readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.KNOWLEDGE_DOCS_HASH_MIGRATION_CLEANUP === '1' &&
  url.startsWith('postgres');
const suite = enabled ? describe : describe.skip;
const migration = readFileSync(
  path.resolve('server/migrations/20261015_knowledge_docs_file_hash.sql'),
  'utf8'
);

suite('migration15 knowledge_docs.file_hash — exact late-safe contract', () => {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const schemas: string[] = [];

  beforeAll(async () => {
    const db = await pool.query<{ name: string }>('SELECT current_database() AS name');
    expect(db.rows[0]?.name).toMatch(/^consultify_org_/);
    await pool.query(`SELECT pg_advisory_lock(hashtext('knowledge-docs-hash-m15'))`);
  });

  afterAll(async () => {
    for (const schema of schemas.reverse()) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await pool.query(`SELECT pg_advisory_unlock(hashtext('knowledge-docs-hash-m15'))`);
    await pool.end();
  });

  const makeSchema = async (ddl: string, rows = '') => {
    const schema = `org15_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    schemas.push(schema);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(`CREATE TABLE "${schema}".knowledge_docs (${ddl})`);
    if (rows) await pool.query(rows.replaceAll('__SCHEMA__', `"${schema}"`));
    return schema;
  };

  const sqlFor = (schema: string) =>
    migration
      .replaceAll("table_schema = 'public'", `table_schema = '${schema}'`)
      .replaceAll("n.nspname = 'public'", `n.nspname = '${schema}'`)
      .replaceAll('public.knowledge_docs', `"${schema}".knowledge_docs`);

  const shape = async (schema: string) => {
    const columns = await pool.query(
      `SELECT column_name,data_type,is_nullable FROM information_schema.columns
       WHERE table_schema=$1 AND table_name='knowledge_docs' ORDER BY ordinal_position`,
      [schema]
    );
    const constraints = await pool.query(
      `SELECT c.conname,pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
       JOIN pg_namespace n ON n.oid=t.relnamespace
       WHERE n.nspname=$1 AND t.relname='knowledge_docs' ORDER BY c.conname`,
      [schema]
    );
    const rows = await pool.query(`SELECT * FROM "${schema}".knowledge_docs ORDER BY id`);
    return { columns: columns.rows, constraints: constraints.rows, rows: rows.rows };
  };

  it('adds nullable text sha256 with the exact validated CHECK and preserves historical NULL', async () => {
    const schema = await makeSchema(
      'id text primary key, filename text',
      `INSERT INTO __SCHEMA__.knowledge_docs VALUES ('old','legacy.pdf')`
    );
    await pool.query(sqlFor(schema));
    const result = await shape(schema);
    expect(result.rows).toEqual([{ id: 'old', filename: 'legacy.pdf', file_hash: null }]);
    expect(result.columns.find((c) => c.column_name === 'file_hash')).toMatchObject({
      data_type: 'text',
      is_nullable: 'YES',
    });
    expect(
      result.constraints.find((c) => c.conname === 'ck_knowledge_docs_file_hash_sha256')?.definition
    ).toContain("file_hash ~ '^[0-9a-f]{64}$'::text");
  });

  it('accepts exact lowercase sha256 and is repeat-safe', async () => {
    const schema = await makeSchema(
      'id text primary key, file_hash text',
      `INSERT INTO __SCHEMA__.knowledge_docs VALUES ('ok','${'a'.repeat(64)}')`
    );
    await pool.query(sqlFor(schema));
    const before = await shape(schema);
    await pool.query(sqlFor(schema));
    expect(await shape(schema)).toEqual(before);
  });

  it('rejects an incompatible existing type before mutation', async () => {
    const schema = await makeSchema('id text primary key, file_hash integer');
    const before = await shape(schema);
    await expect(pool.query(sqlFor(schema))).rejects.toThrow(/must be text/);
    expect(await shape(schema)).toEqual(before);
  });

  it('rejects malformed historical values before adding a constraint', async () => {
    const schema = await makeSchema(
      'id text primary key, file_hash text',
      `INSERT INTO __SCHEMA__.knowledge_docs VALUES ('bad','NOT-A-HASH')`
    );
    const before = await shape(schema);
    await expect(pool.query(sqlFor(schema))).rejects.toThrow(/malformed historical/);
    expect(await shape(schema)).toEqual(before);
  });

  it('rejects a weakened same-named CHECK before mutation', async () => {
    const schema = await makeSchema(
      `id text primary key, file_hash text,
       CONSTRAINT ck_knowledge_docs_file_hash_sha256 CHECK (file_hash IS NULL OR length(file_hash) > 0)`
    );
    const before = await shape(schema);
    await expect(pool.query(sqlFor(schema))).rejects.toThrow(/incompatible definition/);
    expect(await shape(schema)).toEqual(before);
  });
});
