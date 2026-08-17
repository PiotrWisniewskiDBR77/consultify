import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL ?? '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.ORG_UPLOAD_M16_CLEANUP === '1' &&
  url.startsWith('postgres');
const suite = enabled ? describe : describe.skip;
const migration = readFileSync(
  path.resolve('server/migrations/20261016_org_context_upload_idempotency.sql'),
  'utf8'
);

suite('migration16 organization-context upload idempotency — exact late-safe contract', () => {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const schemas: string[] = [];

  beforeAll(async () => {
    const db = await pool.query<{ name: string }>('SELECT current_database() AS name');
    expect(db.rows[0]?.name).toMatch(/^consultify_org_/);
    await pool.query(`SELECT pg_advisory_lock(hashtext('org-context-upload-m16'))`);
  });

  afterAll(async () => {
    for (const schema of schemas.reverse()) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.query(`SELECT pg_advisory_unlock(hashtext('org-context-upload-m16'))`);
    await pool.end();
  });

  const makeSchema = async (receiptDdl?: string) => {
    const schema = `org16_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    schemas.push(schema);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(`CREATE TABLE "${schema}".organizations(id text primary key)`);
    await pool.query(`CREATE TABLE "${schema}".knowledge_docs(id text primary key)`);
    if (receiptDdl) {
      await pool.query(`CREATE TABLE "${schema}".organization_context_upload_receipts (${receiptDdl})`);
    }
    return schema;
  };

  const canonicalDdl = (schema: string, hashCheck = `request_hash ~ '^[0-9a-f]{64}$'`) => `
    organization_id text NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE RESTRICT,
    idempotency_key text NOT NULL,
    request_hash text NOT NULL,
    status text NOT NULL DEFAULT 'PROCESSING',
    document_id text REFERENCES "${schema}".knowledge_docs(id) ON DELETE RESTRICT,
    response_json jsonb,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamptz,
    PRIMARY KEY(organization_id,idempotency_key),
    CONSTRAINT ck_org_context_upload_receipt_key CHECK(length(btrim(idempotency_key)) BETWEEN 1 AND 200),
    CONSTRAINT ck_org_context_upload_receipt_hash CHECK(${hashCheck}),
    CONSTRAINT ck_org_context_upload_receipt_status CHECK(status IN ('PROCESSING','COMPLETED')),
    CONSTRAINT ck_org_context_upload_receipt_completion CHECK(
      (status='PROCESSING' AND document_id IS NULL AND response_json IS NULL AND completed_at IS NULL)
      OR (status='COMPLETED' AND document_id IS NOT NULL AND response_json IS NOT NULL AND completed_at IS NOT NULL)
    )`;

  const sqlFor = (schema: string) =>
    `SET LOCAL search_path TO "${schema}";\n` +
    migration
      .replaceAll("to_regclass('public.organization_context_upload_receipts')", `to_regclass('${schema}.organization_context_upload_receipts')`)
      .replaceAll("n.nspname = 'public'", `n.nspname = '${schema}'`)
      .replaceAll("n.nspname='public'", `n.nspname='${schema}'`)
      .replaceAll("table_schema = 'public'", `table_schema = '${schema}'`);

  const apply = async (schema: string) => {
    await pool.query('BEGIN');
    try {
      await pool.query(sqlFor(schema));
      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  };

  const shape = async (schema: string) => {
    const columns = await pool.query(
      `SELECT column_name,data_type,is_nullable,column_default
         FROM information_schema.columns
        WHERE table_schema=$1 AND table_name='organization_context_upload_receipts'
        ORDER BY ordinal_position`,
      [schema]
    );
    const constraints = await pool.query(
      `SELECT c.conname,pg_get_constraintdef(c.oid) definition
         FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
         JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE n.nspname=$1 AND t.relname='organization_context_upload_receipts'
        ORDER BY c.conname`,
      [schema]
    );
    const triggers = await pool.query(
      `SELECT tgname,tgenabled FROM pg_trigger
        WHERE tgrelid=$1::regclass AND NOT tgisinternal ORDER BY tgname`,
      [`${schema}.organization_context_upload_receipts`]
    );
    return { columns: columns.rows, constraints: constraints.rows, triggers: triggers.rows };
  };

  it('creates the exact tenant-key ledger, constraints and immutable trigger, then repeats byte-equivalently', async () => {
    const schema = await makeSchema();
    await apply(schema);
    const first = await shape(schema);
    expect(first.columns.map((column) => column.column_name)).toEqual([
      'organization_id', 'idempotency_key', 'request_hash', 'status', 'document_id',
      'response_json', 'created_at', 'completed_at',
    ]);
    expect(first.constraints.map((constraint) => constraint.conname)).toEqual(
      expect.arrayContaining([
        'organization_context_upload_receipts_pkey',
        'ck_org_context_upload_receipt_key',
        'ck_org_context_upload_receipt_hash',
        'ck_org_context_upload_receipt_status',
        'ck_org_context_upload_receipt_completion',
      ])
    );
    expect(first.triggers).toEqual([
      { tgname: 'trg_org_context_upload_receipt_immutable', tgenabled: 'O' },
    ]);
    await pool.query(`INSERT INTO "${schema}".organizations VALUES ('org-behavior')`);
    await pool.query(`INSERT INTO "${schema}".knowledge_docs VALUES ('doc-behavior')`);
    await pool.query(`INSERT INTO "${schema}".organization_context_upload_receipts
      (organization_id,idempotency_key,request_hash) VALUES ('org-behavior','behavior-key',$1)`, ['b'.repeat(64)]);
    await pool.query(`UPDATE "${schema}".organization_context_upload_receipts
      SET status='COMPLETED',document_id='doc-behavior',response_json='{}',completed_at=clock_timestamp()
      WHERE organization_id='org-behavior' AND idempotency_key='behavior-key'`);
    await expect(pool.query(`UPDATE "${schema}".organization_context_upload_receipts
      SET response_json='{"changed":true}' WHERE organization_id='org-behavior'`)).rejects.toThrow(/terminal/i);
    await expect(pool.query(`DELETE FROM "${schema}".organization_context_upload_receipts
      WHERE organization_id='org-behavior'`)).rejects.toThrow(/immutable/i);
    await apply(schema);
    expect(await shape(schema)).toEqual(first);
  });

  it.each([
    ['wrong type', `organization_id text,idempotency_key text,request_hash integer`],
    ['wrong primary key', `organization_id text NOT NULL,idempotency_key text NOT NULL,request_hash text NOT NULL,status text NOT NULL,document_id text,response_json jsonb,created_at timestamptz NOT NULL,completed_at timestamptz,PRIMARY KEY(idempotency_key)`],
    ['missing checks', `organization_id text NOT NULL,idempotency_key text NOT NULL,request_hash text NOT NULL,status text NOT NULL,document_id text,response_json jsonb,created_at timestamptz NOT NULL,completed_at timestamptz,PRIMARY KEY(organization_id,idempotency_key)`],
  ])('rejects %s before mutating the historical shape', async (_label, ddl) => {
    const schema = await makeSchema(ddl);
    const before = await shape(schema);
    await expect(apply(schema)).rejects.toThrow(/incompatible|canonical check/i);
    expect(await shape(schema)).toEqual(before);
  });

  it('rejects a weakened same-named hash check before mutation', async () => {
    const schema = await makeSchema();
    await pool.query(`CREATE TABLE "${schema}".organization_context_upload_receipts (${canonicalDdl(schema, `length(request_hash)>0 OR true`)})`);
    const before = await shape(schema);
    await expect(apply(schema)).rejects.toThrow(/incompatible hash check/i);
    expect(await shape(schema)).toEqual(before);
  });

  it('converges a compatible nonempty late ledger without rewriting its row', async () => {
    const schema = await makeSchema();
    await pool.query(`CREATE TABLE "${schema}".organization_context_upload_receipts (${canonicalDdl(schema)})`);
    await pool.query(`INSERT INTO "${schema}".organizations VALUES ('org-late')`);
    await pool.query(`INSERT INTO "${schema}".organization_context_upload_receipts
      (organization_id,idempotency_key,request_hash) VALUES ('org-late','late-key',$1)`, ['a'.repeat(64)]);
    const beforeRow = await pool.query(`SELECT * FROM "${schema}".organization_context_upload_receipts`);
    await apply(schema);
    expect((await pool.query(`SELECT * FROM "${schema}".organization_context_upload_receipts`)).rows).toEqual(beforeRow.rows);
    expect((await shape(schema)).triggers).toEqual([{ tgname: 'trg_org_context_upload_receipt_immutable', tgenabled: 'O' }]);
  });

  it.each([
    ['wrong status default', (schema: string) => canonicalDdl(schema).replace(`DEFAULT 'PROCESSING'`, `DEFAULT 'COMPLETED'`)],
    ['wrong organization FK target', (schema: string) => canonicalDdl(schema).replace(`REFERENCES "${schema}".organizations(id) ON DELETE RESTRICT`, `REFERENCES "${schema}".knowledge_docs(id) ON DELETE RESTRICT`)],
    ['superset status check', (schema: string) => canonicalDdl(schema).replace(`status IN ('PROCESSING','COMPLETED')`, `status IN ('PROCESSING','COMPLETED','FAILED')`)],
  ])('rejects %s before changing schema or historical data', async (_label, ddlFor) => {
    const schema = await makeSchema();
    await pool.query(`CREATE TABLE "${schema}".organization_context_upload_receipts (${ddlFor(schema)})`);
    const before = await shape(schema);
    await expect(apply(schema)).rejects.toThrow(/incompatible/i);
    expect(await shape(schema)).toEqual(before);
    expect((await pool.query(`SELECT count(*)::int n FROM "${schema}".organization_context_upload_receipts`)).rows).toEqual([{ n: 0 }]);
  });

  it('rejects a wrong same-name trigger before replacing it', async () => {
    const schema = await makeSchema();
    await pool.query(`CREATE TABLE "${schema}".organization_context_upload_receipts (${canonicalDdl(schema)})`);
    await pool.query(`CREATE FUNCTION "${schema}".guard_org_context_upload_receipt_immutability() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER trg_org_context_upload_receipt_immutable BEFORE UPDATE ON "${schema}".organization_context_upload_receipts FOR EACH ROW EXECUTE FUNCTION "${schema}".guard_org_context_upload_receipt_immutability()`);
    const before = await shape(schema);
    await expect(apply(schema)).rejects.toThrow(/incompatible trigger/i);
    expect(await shape(schema)).toEqual(before);
  });
});
