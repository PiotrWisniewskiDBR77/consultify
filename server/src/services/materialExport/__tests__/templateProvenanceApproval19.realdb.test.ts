// MAT-POL / AMD-MAT-PROVENANCE-WRITER-002 — real-PostgreSQL proof for the
// 20261019_template_provenance_approval_receipts.sql migration itself: the
// append-only ledger's exact shape, its fail-before-mutation preflight over a
// late/pre-existing table, and its immutability trigger.
//
// SCOPE NOTE (worker S1): mounted-express/JWT authorization, idempotency
// concurrency, cross-tenant key independence and the quarantine list-visibility
// proof through the service live in a SEPARATE file owned by worker S2, to
// avoid two workers colliding on one file. This file proves only what the
// migration itself guarantees at the database level.
//
// Read the migration's own preflight DO $$ block
// (server/migrations/20261019_template_provenance_approval_receipts.sql)
// before touching this file — every assertion below mirrors one specific
// branch of that block, verified empirically against a live Postgres before
// being encoded here (not guessed from reading the SQL alone).
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATION_PATH = 'server/migrations/20261019_template_provenance_approval_receipts.sql';
const RECEIPTS_TABLE = 'template_provenance_approval_receipts';
const GUARD_FN = 'guard_template_provenance_receipt_immutability';
const TRIGGER_NAME = 'trg_template_provenance_receipt_immutable';

const rawUrl = process.env.DATABASE_URL ?? '';
const baseGate =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.TEMPLATE_PROVENANCE_M19_CLEANUP === '1' &&
  rawUrl.startsWith('postgres');

// Namespace guard, per house mandate (weekend-completion "GUC nie jest
// autoryzacja" / "subagent zmutowal baze testowa" lessons): every realdb
// suite must independently prove it is pointed at ITS OWN disposable
// database before doing anything else — never trust the env var alone.
// This runs as top-level await (ESM, supported by this project's vitest
// config — see server/src/services/deliverables/__tests__/
// deliverablesMetricsService.test.ts:13 for existing precedent) specifically
// so a namespace mismatch can `describe.skip` the whole suite rather than
// throw mid-collection.
let namespaceOk = false;
let expectedDbName = '';
if (baseGate) {
  try {
    expectedDbName = new URL(rawUrl).pathname.replace(/^\//, '');
    const probe = new pg.Pool({ connectionString: rawUrl, max: 1 });
    const { rows } = await probe.query<{ name: string }>('SELECT current_database() AS name');
    const actualName = String(rows[0]?.name ?? '');
    namespaceOk = actualName === expectedDbName && /^mat_provenance_/.test(actualName);
    await probe.end();
  } catch {
    namespaceOk = false;
  }
}
const enabled = baseGate && namespaceOk;
const suite = enabled ? describe : describe.skip;

const migration = readFileSync(path.resolve(MIGRATION_PATH), 'utf8');

suite('migration19 template_provenance_approval_receipts — exact late-safe contract', () => {
  // max:1 deliberately (house pattern — see
  // server/src/services/organizationContext/__tests__/
  // orgContextUploadIdempotencyMigration16.realdb.test.ts:21): a session-level
  // pg_advisory_lock only serializes correctly if every query in this file
  // rides the SAME physical connection, which a max:1 pool guarantees without
  // needing an explicit dedicated client.
  const pool = new pg.Pool({ connectionString: rawUrl, max: 1 });
  const schemas: string[] = [];

  beforeAll(async () => {
    await pool.query(`SELECT pg_advisory_lock(hashtext('template-provenance-m19'))`);
  });

  afterAll(async () => {
    // CLEANUP MECHANISM (append-only table): template_provenance_approval_
    // receipts rejects DELETE via its own trigger (that IS the point of the
    // ledger — see the migration's header comment). We never attempt to
    // delete a receipt row and never touch the trigger. Instead every
    // fixture — organizations, the receipts table, its rows, its function,
    // its trigger — lives inside a disposable per-test schema created here,
    // and cleanup is `DROP SCHEMA ... CASCADE`. DROP is DDL, not a DML
    // DELETE: it removes the table (and every row in it) without ever
    // invoking the BEFORE DELETE row trigger, so nothing here "deletes rows
    // the trigger forbids" — the schema the rows lived in simply stops
    // existing. "Residue 0" below is checked by re-querying
    // information_schema for our own schema names, not by asserting on the
    // (deliberately un-deletable) receipts table itself.
    for (const schema of schemas.reverse()) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    if (schemas.length) {
      const residue = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = ANY($1)`,
        [schemas]
      );
      expect(residue.rows[0]?.n).toBe(0);
    }
    // Unlock unconditionally, not asserted strictly: `pg.Pool#query` destroys
    // and replaces its pooled connection whenever a query it ran rejects
    // (`client.release(err)` discards the client) — and this suite's negative
    // tests reject `apply()` on purpose, many times. That silently drops the
    // session-scoped advisory lock onto a now-defunct backend well before
    // afterAll runs (verified empirically; the same pool.query BEGIN/ROLLBACK
    // pattern is house convention — see
    // orgContextUploadIdempotencyMigration16.realdb.test.ts:31 — which is why
    // no sibling migration test asserts a lock-held invariant either).
    // Unlocking a lock this session no longer holds is a harmless no-op
    // (returns false, does not throw), so this stays safe either way.
    await pool.query(`SELECT pg_advisory_unlock(hashtext('template-provenance-m19'))`);
    await pool.end();
  });

  const makeSchema = async () => {
    const schema = `m19_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    schemas.push(schema);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    // organizations lives INSIDE the disposable schema too — the receipt
    // table's FK never reaches into shared/public data, so DROP SCHEMA
    // CASCADE is sufficient cleanup with no ON DELETE RESTRICT entanglement.
    await pool.query(`CREATE TABLE "${schema}".organizations(id text primary key)`);
    return schema;
  };

  /** Apply the real migration file, verbatim, inside one disposable schema. */
  const apply = async (schema: string) => {
    await pool.query('BEGIN');
    try {
      await pool.query(`SET LOCAL search_path TO "${schema}"`);
      await pool.query(migration);
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
        WHERE table_schema=$1 AND table_name=$2
        ORDER BY ordinal_position`,
      [schema, RECEIPTS_TABLE]
    );
    const constraints = await pool.query(
      `SELECT c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE n.nspname=$1 AND t.relname=$2
        ORDER BY c.conname`,
      [schema, RECEIPTS_TABLE]
    );
    const triggers = await pool.query(
      `SELECT tg.tgname,tg.tgenabled,pg_get_triggerdef(tg.oid) AS definition
         FROM pg_trigger tg JOIN pg_class t ON t.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace
        WHERE n.nspname=$1 AND t.relname=$2 AND NOT tg.tgisinternal
        ORDER BY tg.tgname`,
      [schema, RECEIPTS_TABLE]
    );
    const fn = await pool.query(
      `SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname=$1 AND p.proname=$2`,
      [schema, GUARD_FN]
    );
    return {
      columns: columns.rows,
      constraints: constraints.rows,
      triggers: triggers.rows,
      guardFunctionSrc: fn.rows[0]?.prosrc ?? null,
    };
  };

  const validProvenanceJson = () =>
    JSON.stringify({ source: 's', licenseBasis: 'l', authority: 'a', actor: 'ac', version: 'v', evidence: 'e' });

  const insertRow = (
    schema: string,
    overrides: Partial<{
      organizationId: string;
      idempotencyKey: string;
      registry: string;
      templateId: string;
      requestFingerprint: string;
      provenanceVersion: string;
      approvedBy: string;
      approvedByRole: string;
      provenanceJson: string;
    }> = {}
  ) => {
    const row = {
      organizationId: 'org-x',
      idempotencyKey: 'key-1',
      registry: 'document_studio_templates',
      templateId: 'tpl-1',
      requestFingerprint: 'a'.repeat(64),
      provenanceVersion: 'v1',
      approvedBy: 'user-1',
      approvedByRole: 'OWNER',
      provenanceJson: validProvenanceJson(),
      ...overrides,
    };
    return pool.query(
      `INSERT INTO "${schema}".${RECEIPTS_TABLE}
         (organization_id,idempotency_key,registry,template_id,request_fingerprint,
          provenance_version,approved_by,approved_by_role,provenance_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        row.organizationId,
        row.idempotencyKey,
        row.registry,
        row.templateId,
        row.requestFingerprint,
        row.provenanceVersion,
        row.approvedBy,
        row.approvedByRole,
        row.provenanceJson,
      ]
    );
  };

  /** Fresh apply (table doesn't exist yet -> preflight is a no-op RETURN),
   *  then seed one canonical row, so every negative test below starts from a
   *  genuinely NON-EMPTY, byte-correct table — matching the DoD's "each
   *  refusal must leave a non-empty table byte-identical" requirement. */
  const freshSchemaWithRow = async (): Promise<string> => {
    const schema = await makeSchema();
    await apply(schema);
    await pool.query(`INSERT INTO "${schema}".organizations VALUES ('org-x')`);
    await insertRow(schema);
    return schema;
  };

  const rowsOf = (schema: string) => pool.query(`SELECT * FROM "${schema}".${RECEIPTS_TABLE}`);

  /** Break ONE piece of an otherwise-canonical, non-empty, already-existing
   *  table via `breakSql`, then assert the migration's late-apply preflight
   *  rejects BEFORE touching anything: same error class every sibling m15-19
   *  migration test uses (see 20261017_material_export_policy_provenance.sql
   *  preflight, mirrored here), proven empirically against this exact
   *  migration before being encoded (see scratchpad probe19*.mjs — every
   *  message asserted below was observed, not guessed). */
  const expectRejectAfterBreak = async (breakSql: string, matcher: RegExp) => {
    const schema = await freshSchemaWithRow();
    await pool.query(breakSql.replaceAll('__SCHEMA__', `"${schema}"`));
    const before = await shape(schema);
    const rowsBefore = await rowsOf(schema);
    expect(rowsBefore.rowCount).toBe(1); // sanity: this refusal protects a NON-EMPTY table
    await expect(apply(schema)).rejects.toThrow(matcher);
    expect(await shape(schema)).toEqual(before);
    expect((await rowsOf(schema)).rows).toEqual(rowsBefore.rows);
  };

  it(
    'creates the exact ledger (columns/PK/FK/UNIQUE/8 named CHECKs/guard trigger) on a ' +
      'fresh apply, then repeats byte-identically on an idempotent re-apply over the now ' +
      'pre-existing table, and enforces immutability on a real row',
    async () => {
      const schema = await makeSchema();

      // FRESH APPLY / "dry-run" no-op preflight: to_regclass(...) IS NULL for
      // a schema that has never seen this table, so the entire preflight DO
      // block RETURNs immediately (migration file, right after `BEGIN`) and
      // only the unconditional CREATE TABLE IF NOT EXISTS / CREATE FUNCTION /
      // DROP+CREATE TRIGGER below it ever run.
      await apply(schema);
      const first = await shape(schema);

      expect(first.columns.map((c) => c.column_name)).toEqual([
        'organization_id',
        'idempotency_key',
        'registry',
        'template_id',
        'request_fingerprint',
        'provenance_version',
        'approved_by',
        'approved_by_role',
        'provenance_json',
        'created_at',
      ]);
      expect(first.constraints.map((c) => c.conname).sort()).toEqual(
        [
          'ck_template_provenance_receipt_actor',
          'ck_template_provenance_receipt_evidence',
          'ck_template_provenance_receipt_fingerprint',
          'ck_template_provenance_receipt_key',
          'ck_template_provenance_receipt_registry',
          'ck_template_provenance_receipt_role',
          'ck_template_provenance_receipt_template',
          'ck_template_provenance_receipt_version',
          'template_provenance_approval_receipts_organization_id_fkey',
          'template_provenance_approval_receipts_pkey',
          'uq_template_provenance_receipt_target',
        ].sort()
      );
      expect(first.triggers).toHaveLength(1);
      expect(first.triggers[0]).toMatchObject({ tgname: TRIGGER_NAME, tgenabled: 'O' });
      expect(String(first.triggers[0]?.definition)).toContain(GUARD_FN);
      expect(first.guardFunctionSrc).toContain('template provenance approval receipts are immutable');

      // Seed a real, non-empty row through the ACTUAL ledger (not a synthetic
      // fixture row inserted straight into a mock) before re-applying.
      await pool.query(`INSERT INTO "${schema}".organizations VALUES ('org-behavior')`);
      await insertRow(schema, { organizationId: 'org-behavior', idempotencyKey: 'behavior-key' });
      const rowBeforeReapply = await rowsOf(schema);
      expect(rowBeforeReapply.rowCount).toBe(1);

      // IDEMPOTENT RE-APPLY == a genuine LATE APPLY over a pre-existing table:
      // by this second call the table objectively already exists (this same
      // migration created it), so the preflight validates for real against
      // what it just wrote, and must converge as a no-op without rewriting
      // the row.
      await apply(schema);
      expect(await shape(schema)).toEqual(first);
      expect((await rowsOf(schema)).rows).toEqual(rowBeforeReapply.rows);

      // IMMUTABILITY: direct UPDATE and DELETE on an existing receipt row are
      // both rejected by the trigger, and the row survives byte-identically.
      await expect(
        pool.query(
          `UPDATE "${schema}".${RECEIPTS_TABLE} SET provenance_version='tampered' WHERE organization_id='org-behavior'`
        )
      ).rejects.toThrow(/immutable/i);
      await expect(
        pool.query(`DELETE FROM "${schema}".${RECEIPTS_TABLE} WHERE organization_id='org-behavior'`)
      ).rejects.toThrow(/immutable/i);
      expect((await rowsOf(schema)).rows).toEqual(rowBeforeReapply.rows);

      // Trigger present and ENABLED at the end too, re-queried independently
      // (not reused from `first`) so this genuinely proves "at start AND end".
      const finalTrigger = await pool.query(
        `SELECT tg.tgenabled FROM pg_trigger tg JOIN pg_class t ON t.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace
          WHERE n.nspname=$1 AND t.relname=$2 AND tg.tgname=$3 AND NOT tg.tgisinternal`,
        [schema, RECEIPTS_TABLE, TRIGGER_NAME]
      );
      expect(finalTrigger.rows).toEqual([{ tgenabled: 'O' }]);
    }
  );

  it.each(['key', 'fingerprint', 'registry', 'role', 'actor', 'template', 'version', 'evidence'])(
    'rejects a late-apply table missing the %s CHECK, before mutating a non-empty table',
    async (name) => {
      await expectRejectAfterBreak(
        `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE} DROP CONSTRAINT ck_template_provenance_receipt_${name}`,
        new RegExp(`ck_template_provenance_receipt_${name}.*<missing>`, 's')
      );
    }
  );

  it.each([
    [
      'primary key',
      `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE} DROP CONSTRAINT template_provenance_approval_receipts_pkey`,
      /incompatible primary key/,
    ],
    [
      'foreign key',
      `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE} DROP CONSTRAINT template_provenance_approval_receipts_organization_id_fkey`,
      /incompatible foreign keys/,
    ],
    [
      'target uniqueness (organization_id,registry,template_id)',
      `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE} DROP CONSTRAINT uq_template_provenance_receipt_target`,
      /incompatible target uniqueness/,
    ],
  ])('rejects a late-apply table missing its %s, before mutating a non-empty table', async (_label, sql, matcher) => {
    await expectRejectAfterBreak(sql, matcher);
  });

  it(
    'rejects a late-apply table whose FK relaxes ON DELETE RESTRICT to CASCADE, before mutation',
    async () => {
      await expectRejectAfterBreak(
        `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE}
           DROP CONSTRAINT template_provenance_approval_receipts_organization_id_fkey,
           ADD CONSTRAINT template_provenance_approval_receipts_organization_id_fkey
             FOREIGN KEY (organization_id) REFERENCES __SCHEMA__.organizations(id) ON DELETE CASCADE`,
        /incompatible foreign keys/
      );
    }
  );

  // OR-TRUE escape hatches and supersets: the preflight compares CANONICAL
  // SEMANTICS (via a throwaway twin, same technique as
  // 20261017_material_export_policy_provenance.sql:96-121), not mere
  // presence of a same-named constraint — a check that still EXISTS but was
  // quietly widened must be rejected exactly like a missing one.
  it.each([
    [
      'registry (superset re-admits legacy report_builder_templates)',
      'registry',
      `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE}
         DROP CONSTRAINT ck_template_provenance_receipt_registry,
         ADD CONSTRAINT ck_template_provenance_receipt_registry
           CHECK (registry IN ('document_studio_templates','presentation_templates','tp_base_templates','report_builder_templates'))`,
    ],
    [
      'role (superset re-admits MEMBER)',
      'role',
      `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE}
         DROP CONSTRAINT ck_template_provenance_receipt_role,
         ADD CONSTRAINT ck_template_provenance_receipt_role
           CHECK (approved_by_role IN ('OWNER','ADMIN','MEMBER'))`,
    ],
    [
      'fingerprint (OR TRUE escape hatch)',
      'fingerprint',
      `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE}
         DROP CONSTRAINT ck_template_provenance_receipt_fingerprint,
         ADD CONSTRAINT ck_template_provenance_receipt_fingerprint
           CHECK (request_fingerprint ~ '^[0-9a-f]{64}$' OR TRUE)`,
    ],
    [
      'evidence (drops the mandatory evidence sub-field)',
      'evidence',
      `ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE}
         DROP CONSTRAINT ck_template_provenance_receipt_evidence,
         ADD CONSTRAINT ck_template_provenance_receipt_evidence
           CHECK (jsonb_typeof(provenance_json) = 'object'
             AND nullif(btrim(provenance_json->>'source'), '') IS NOT NULL
             AND nullif(btrim(provenance_json->>'licenseBasis'), '') IS NOT NULL
             AND nullif(btrim(provenance_json->>'authority'), '') IS NOT NULL
             AND nullif(btrim(provenance_json->>'actor'), '') IS NOT NULL
             AND nullif(btrim(provenance_json->>'version'), '') IS NOT NULL)`,
    ],
  ])('rejects the %s CHECK weakened to a superset/escape-hatch, before mutation', async (_label, name, sql) => {
    await expectRejectAfterBreak(sql, new RegExp(`ck_template_provenance_receipt_${name}`));
  });

  it.each([
    ['type (provenance_version widened to varchar)', `ALTER COLUMN provenance_version TYPE VARCHAR(64)`],
    ['nullability (approved_by made nullable)', `ALTER COLUMN approved_by DROP NOT NULL`],
    ['default (created_at defaults to now() instead of CURRENT_TIMESTAMP)', `ALTER COLUMN created_at SET DEFAULT now()`],
  ])('rejects a late-apply table with wrong column %s, before mutation', async (_label, alterClause) => {
    await expectRejectAfterBreak(`ALTER TABLE __SCHEMA__.${RECEIPTS_TABLE} ${alterClause}`, /incompatible columns/);
  });

  it(
    'rejects a late-apply table whose guard function+trigger were both dropped, before mutation',
    async () => {
      // DROP FUNCTION ... CASCADE necessarily also removes the trigger (a
      // trigger cannot reference a function that no longer exists) — this
      // exercises the function-missing branch, which fires FIRST (see next
      // test's comment on evaluation order).
      await expectRejectAfterBreak(
        `DROP FUNCTION __SCHEMA__.${GUARD_FN}() CASCADE`,
        new RegExp(`${GUARD_FN} has incompatible definition`)
      );
    }
  );

  it(
    'rejects a late-apply table whose trigger alone was dropped, guard function intact, before mutation',
    async () => {
      await expectRejectAfterBreak(
        `DROP TRIGGER ${TRIGGER_NAME} ON __SCHEMA__.${RECEIPTS_TABLE}`,
        /incompatible immutability trigger/
      );
    }
  );

  it(
    'rejects a late-apply table whose guard function was replaced with a no-op body, before mutation',
    async () => {
      await expectRejectAfterBreak(
        `CREATE OR REPLACE FUNCTION __SCHEMA__.${GUARD_FN}() RETURNS TRIGGER LANGUAGE plpgsql AS $guard$ BEGIN RETURN NULL; END; $guard$`,
        new RegExp(`${GUARD_FN} has incompatible definition`)
      );
    }
  );

  it(
    'rejects a canonically-wired trigger narrowed to UPDATE-only (missing DELETE) even with an intact ' +
      'guard function, before mutation — and this specific ordering (function checked BEFORE trigger) is ' +
      'the OPPOSITE of migration16 (20261016_org_context_upload_idempotency.sql, where a mismatched trigger ' +
      'short-circuits and its function is never even inspected): here a canonical-but-narrowed trigger still ' +
      'reaches (and fails) the trigger-shape comparison because the function check passed first',
    async () => {
      await expectRejectAfterBreak(
        `DROP TRIGGER ${TRIGGER_NAME} ON __SCHEMA__.${RECEIPTS_TABLE};
         CREATE TRIGGER ${TRIGGER_NAME} BEFORE UPDATE ON __SCHEMA__.${RECEIPTS_TABLE}
           FOR EACH ROW EXECUTE FUNCTION __SCHEMA__.${GUARD_FN}()`,
        /incompatible immutability trigger/
      );
    }
  );
});
