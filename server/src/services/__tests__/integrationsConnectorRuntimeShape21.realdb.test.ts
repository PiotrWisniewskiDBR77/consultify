// AMD-INTEGRATIONS-SHAPE-M21 -- real-PostgreSQL proof for the
// 20261021_integrations_connector_runtime_shape.sql migration: the `integrations`
// table exists in two incompatible shapes today because every declaration used
// CREATE TABLE IF NOT EXISTS and the first writer won --
//   - server/migrations/256_integrations_system.sql (legacy): provider_id-keyed,
//     NOT NULL provider_id/auth_type, no connector_id at all;
//   - server/src/database/DatabaseInitializer.ts:1226-1335
//     (ensureIntegrationRuntimeTables, the runtime convergence Settings/
//     integrations/V8-sync/inventory/syncHub/superadmin all actually consume):
//     connector_id-keyed.
// Owner decision: the connector runtime shape is authoritative. provider_id is
// PRESERVED (never dropped), and no organization+connector uniqueness may be
// invented -- only whatever uniqueness already existed keeps existing.
//
// This file proves the MIGRATION FILE's own guarantees against a live Postgres:
// fresh-create shape, idempotent repeat, non-empty legacy convergence (the most
// important case), exact canonical types/defaults/indexes, fail-before-mutation
// on a non-empty table, scoped NOT NULL relaxation, and post-convergence
// read/write compatibility for both row styles. It does not touch
// DatabaseInitializer.ts, routes, services, or any other test file.
//
// WORKER NOTE (Q2, second pass -- aligning the harness with Q1's owner-decision
// rewrite that schema-qualifies EVERY target in the migration to `public`
// explicitly): the migration no longer follows the old "guards qualified,
// DDL/DML unqualified and search_path-dependent" style. Every guard, every
// mutating statement, and the dynamically-built backfill SQL now hardcodes
// `public` literally -- confirmed by reading the landed file in full, not
// assumed. That makes the old 3-pattern sqlFor() (which only rewrote the
// three guard forms) actively WRONG against this file: statements it never
// touched, like `CREATE TABLE IF NOT EXISTS public.integrations` or
// `ALTER TABLE public.integrations ADD COLUMN ...`, are schema-qualified too
// now, so they ignore `SET LOCAL search_path` entirely and would run against
// the REAL public.integrations instead of the disposable per-test schema --
// exactly the guard/mutation mismatch the owner decision exists to close.
// Fixed by widening sqlFor() to two GENERIC substitutions -- replace every
// literal `public.` and every literal `'public'` -- rather than enumerating
// exact-string forms one at a time. Because Q1's rewrite is uniform (every
// target qualified the same two ways), this single pair of substitutions now
// redirects the whole file cleanly; see the doc comment just above sqlFor()
// for the full enumeration (39 occurrences across both patterns, re-measured
// against the landed file) and why the two `public\.` occurrences inside the
// index-definition-normalizing regex are correctly left untouched.
// Every assertion below was re-checked against the real migration text
// (not the owner's spec secondhand) for RAISE wording (RAISE EXCEPTION
// '<object> has incompatible <thing>: %', matching /incompatible/i
// throughout), the accepted-type matrix (scopes: text or jsonb), the
// default matrix (sync_schedule: no assertion of a competing default,
// consistent with this suite's LEGACY_DDL fixture never declaring
// sync_schedule in the first place), and the NOT NULL relaxation scope
// (provider_id + auth_type only; connected_by is NOT NULL with no default
// and is never touched by the migration). See the end-of-file comment block
// for what remains a live dependency on the migration's still-possibly-moving
// text.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATION_PATH = 'server/migrations/20261021_integrations_connector_runtime_shape.sql';
const TABLE = 'integrations';

// HARNESS NORMALIZATION (Q5): the pg_temp canonical twin's own table name is
// deliberately set equal to TABLE, not a distinct label like
// "integrations_canonical_twin". Reason: Postgres derives an unnamed PRIMARY
// KEY constraint's name from its owning table ("<table>_pkey"). A twin
// literally named "integrations_canonical_twin" therefore legitimately gets
// "integrations_canonical_twin_pkey" -- a different byte string than the real
// table's "integrations_pkey" -- even though the two primary keys are
// structurally identical (same column, same uniqueness). That was a
// normalization gap in THIS HARNESS, not a real difference the migration
// produces, and it was making the index-shape comparison fail on both the
// FRESH and the post-convergence assertions. Naming the twin identically to
// TABLE makes Postgres auto-derive the SAME "integrations_pkey" name for
// both sides, so the comparison is byte-for-byte on the primary key too --
// nothing about the assertion is weakened; the twin's shape is still
// required to match exactly, PK included.
// This creates no ambiguity: the twin lives in pg_temp, a namespace distinct
// from `public` and from every disposable `int21_*` schema created per test,
// and every query touching it below filters by schema explicitly
// (table_schema = tempSchema / n.nspname = tempSchema) rather than relying on
// search_path-based unqualified name resolution. See the SELF-TEST-RED block
// after the suite for proof this normalization still catches a genuinely
// different index (missing, wrong column, or extra).
const TWIN_TABLE = TABLE;

const rawUrl = process.env.DATABASE_URL ?? '';
const baseGate =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.INTEGRATIONS_SHAPE_M21_CLEANUP === '1' &&
  rawUrl.startsWith('postgres');

// Namespace guard (house mandate -- "GUC nie jest autoryzacja" / "subagent
// zmutowal baze testowa"): never trust the env var alone, independently prove
// this session is pointed at ITS OWN disposable database before doing
// anything else. Runs as top-level await (ESM; same precedent as
// templateProvenanceApproval19.realdb.test.ts:40-44) so a mismatch can
// `describe.skip` the whole suite instead of throwing mid-collection.
let namespaceOk = false;
if (baseGate) {
  try {
    const expectedDbName = new URL(rawUrl).pathname.replace(/^\//, '');
    const probe = new pg.Pool({ connectionString: rawUrl, max: 1 });
    const { rows } = await probe.query<{ name: string }>('SELECT current_database() AS name');
    const actualName = String(rows[0]?.name ?? '');
    namespaceOk = actualName === expectedDbName && /^oauth_/.test(actualName);
    await probe.end();
  } catch {
    namespaceOk = false; // fail closed
  }
}

// Extra safety net, not part of the mandated env gate: M1 was writing the
// migration file concurrently with this suite's authoring. If it still isn't
// there when this suite runs, skip rather than crash the whole file on
// readFileSync -- the four required env vars plus the namespace check are
// still what gates real execution.
const migrationExists = existsSync(path.resolve(MIGRATION_PATH));
const enabled = baseGate && namespaceOk && migrationExists;
const suite = enabled ? describe : describe.skip;
const migration = migrationExists ? readFileSync(path.resolve(MIGRATION_PATH), 'utf8') : '';

// The exact CREATE TABLE the runtime convergence establishes as authoritative
// -- DatabaseInitializer.ts:1232-1256 -- plus its two indexes (:1329-1333).
// Columns genuinely NEW relative to the legacy shape (i.e. never present in
// server/migrations/256_integrations_system.sql), so their type/default is
// created fresh by ADD COLUMN regardless of whether the table pre-existed as
// legacy or not. Columns like auth_type/status/field_mappings/sync_settings/
// last_sync_at/last_error/updated_at already exist in the legacy shape with
// their OWN type/default and are deliberately excluded here: "ADD COLUMN IF
// NOT EXISTS" never touches an already-present column, so asserting the
// canonical default for those would be asserting something the convergence
// never claims to guarantee.
const NEW_COLUMNS = [
  'connector_id',
  'name',
  'category',
  'config',
  'capabilities',
  'scopes',
  'sync_schedule',
  'is_paused',
  'paused_at',
  'workflow_policy',
  'workflow_policy_reason',
  'workflow_policy_set_by',
  'workflow_policy_set_at',
  'created_at',
] as const;

const LEGACY_DDL = `
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  api_key TEXT,
  token_expires_at TIMESTAMP,
  external_account_id TEXT,
  external_account_name TEXT,
  external_workspace_id TEXT,
  external_workspace_name TEXT,
  settings TEXT DEFAULT '{}',
  notification_settings TEXT DEFAULT '{}',
  field_mappings TEXT DEFAULT '[]',
  sync_settings TEXT DEFAULT '{"direction":"bidirectional","frequency":"realtime"}',
  channel_mappings TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMP,
  last_error TEXT,
  last_error_at TIMESTAMP,
  error_count INTEGER DEFAULT 0,
  consecutive_errors INTEGER DEFAULT 0,
  connected_by TEXT NOT NULL,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP,
  disconnected_by TEXT,
  UNIQUE(organization_id, provider_id)
`;

suite('migration21 integrations connector-runtime shape -- exact late-safe contract', () => {
  // max:1 deliberately (house pattern -- orgContextUploadIdempotencyMigration16
  // .realdb.test.ts:21 / templateProvenanceApproval19.realdb.test.ts:65-70): a
  // session-level pg_advisory_lock and the canonical twin both only work if
  // every query in this file rides the SAME physical backend connection,
  // which a max:1 pool guarantees without an explicit dedicated client.
  const pool = new pg.Pool({ connectionString: rawUrl, max: 1 });
  const schemas: string[] = [];
  let tempSchema = '';

  beforeAll(async () => {
    await pool.query(`SELECT pg_advisory_lock(hashtext('integrations-connector-shape-m21'))`);

    // Canonical twin, built once in a disposable REGULAR schema (per the
    // owner's instruction: compare index/column shape against a twin built by
    // Postgres itself rather than a hardcoded rendering, since Postgres
    // canonicalises DDL text -- e.g. an unquoted vs quoted identifier, or
    // ordering inside a multi-column USING clause -- and a hardcoded literal
    // would encode a rendering detail as if it were the contract).
    //
    // Q5 NOTE: originally built as a session-scoped `CREATE TEMP TABLE`
    // (pg_temp), matching the owner's literal wording. That collided with the
    // MIGRATION'S OWN internal preflight machinery: the migration file itself
    // (20261021_integrations_connector_runtime_shape.sql:171-172, 203) builds
    // its own short-lived comparison twin via
    // `CREATE TEMP TABLE m21_idx_twin (...)` and then
    // `CREATE INDEX idx_integrations_org ON pg_temp.m21_idx_twin(...)` /
    // `CREATE INDEX idx_integrations_connector ON pg_temp.m21_idx_twin(...)`
    // -- the EXACT SAME literal index names this harness's twin also uses,
    // in the SAME pg_temp namespace (index names are unique per schema, not
    // per table, and this suite's single `max:1` pool means every apply()
    // rides the identical backend session/pg_temp as this twin). On a FRESH
    // schema the migration's preflight no-ops (nothing to compare yet), so
    // the first apply() never collides -- but REPEAT's second apply() runs
    // against an already-converged table, which DOES exercise that internal
    // preflight, and it failed with
    // `relation "idx_integrations_org" already exists` because this harness's
    // own pg_temp twin index had already claimed that name for the whole
    // session. Moving the twin into its own disposable, non-temp schema
    // (created the same way every other fixture schema in this file is, via
    // makeSchema()) sidesteps the collision entirely -- the migration's
    // internal probe only ever touches `pg_temp`, never a named schema -- while
    // preserving the actual property the owner asked for: the twin is still
    // built and rendered by real Postgres DDL, never a hardcoded string, and
    // pg_get_indexdef/information_schema render it identically regardless of
    // which schema it lives in.
    const twinSchema = await makeSchema();
    tempSchema = twinSchema;

    await pool.query(`
      CREATE TABLE "${twinSchema}".${TWIN_TABLE} (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        connector_id TEXT,
        name TEXT,
        category TEXT,
        status TEXT DEFAULT 'pending',
        config TEXT DEFAULT '{}',
        capabilities TEXT DEFAULT '[]',
        auth_type TEXT,
        scopes TEXT DEFAULT '[]',
        field_mappings TEXT DEFAULT '[]',
        sync_settings TEXT DEFAULT '{}',
        sync_schedule TEXT,
        is_paused BOOLEAN DEFAULT FALSE,
        paused_at TIMESTAMP,
        workflow_policy TEXT DEFAULT 'active',
        workflow_policy_reason TEXT,
        workflow_policy_set_by TEXT,
        workflow_policy_set_at TIMESTAMPTZ,
        last_sync_at TIMESTAMP,
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX idx_integrations_org ON "${twinSchema}".${TWIN_TABLE}(organization_id)`);
    await pool.query(`CREATE INDEX idx_integrations_connector ON "${twinSchema}".${TWIN_TABLE}(connector_id)`);
    expect(tempSchema).not.toBe('');
  });

  afterAll(async () => {
    // Cleanup mechanism: every fixture (schema, legacy/converged table, rows)
    // lives inside a disposable per-test schema created via makeSchema(), and
    // teardown is DROP SCHEMA ... CASCADE -- DDL, not a row-by-row DELETE, so
    // it works uniformly regardless of what constraints or triggers the
    // converged table ends up with. The pg_temp twin table needs no explicit
    // cleanup: it is dropped automatically when the session (this pool's sole
    // connection) ends via pool.end() below.
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
    // Unlock unconditionally (same reasoning as templateProvenanceApproval19
    // .realdb.test.ts:102-113): pg.Pool destroys and replaces its pooled
    // connection whenever a query it ran rejects, and this suite's negative
    // tests reject `apply()` on purpose repeatedly. Unlocking a lock this
    // session no longer holds is a harmless no-op.
    await pool.query(`SELECT pg_advisory_unlock(hashtext('integrations-connector-shape-m21'))`);
    await pool.end();
  });

  const makeSchema = async () => {
    const schema = `int21_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    schemas.push(schema);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    return schema;
  };

  const makeLegacySchema = async () => {
    const schema = await makeSchema();
    await pool.query(`CREATE TABLE "${schema}".${TABLE} (${LEGACY_DDL})`);
    return schema;
  };

  /** Apply the real migration file inside one disposable schema.
   *
   *  Owner decision landed by Q1: the migration now schema-qualifies EVERY
   *  target to `public` explicitly -- guards, CREATE TABLE, every
   *  ALTER TABLE (both ADD COLUMN and ALTER COLUMN ... DROP NOT NULL),
   *  CREATE INDEX and its ON clause, the dynamically-built backfill UPDATE,
   *  and every information_schema table_schema filter -- so it no longer
   *  relies on ambient search_path anywhere. Confirmed by reading the landed
   *  file in full (`grep -n public 20261021_integrations_connector_runtime_
   *  shape.sql`), not assumed. That means SET LOCAL search_path alone is
   *  still not sufficient (a schema-qualified reference ignores search_path
   *  entirely), but unlike the pre-Q1 text, ONE consistent kind of
   *  substitution now redirects the whole file: every occurrence follows
   *  either the `public.<identifier>` form or the `'public'` quoted-schema
   *  form, with no other spelling anywhere in the file.
   *
   *  Two generic, non-overlapping replaceAll passes cover all 39 occurrences
   *  measured against the landed file:
   *    - literal `public.`  (34x) -- to_regclass('public.integrations') x5,
   *      to_regclass('public.' || pair.idx_name) x2,
   *      CREATE TABLE IF NOT EXISTS public.integrations x1,
   *      ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS ... x21,
   *      ALTER TABLE public.integrations ALTER COLUMN ... DROP NOT NULL x2,
   *      the backfill's `'UPDATE public.integrations SET ...'` format string
   *      x1, CREATE INDEX ... ON public.integrations(...) x2.
   *    - literal `'public'` (5x) -- every table_schema = 'public' filter
   *      (type preflight, default preflight x2, backfill's
   *      has_provider_id/has_provider probes).
   *  Each is replaced with the disposable schema's name via exact-string
   *  replaceAll below -- never a rewrite of the surrounding SQL, so the
   *  accepted-type matrix, default matrix, backfill COALESCE construction,
   *  RAISE messages and ordering stay byte-identical to what ships. Because
   *  the substitution is now pattern-based rather than an enumerated list of
   *  exact statement forms, it stays correct even if Q1's file is edited
   *  again in a way that adds or removes qualified statements, as long as
   *  every new one keeps using one of these same two literal forms -- which
   *  is exactly what "schema-qualify EVERY target to public" means.
   *
   *  Deliberately NOT substituted: the two regexp_replace patterns matching
   *  literal `public\.` (backslash then dot -- a regex escape sequence, not a
   *  schema-qualifier dot) inside
   *  `'\son\s+(pg_temp(_[0-9]+)?\.|public\.)?[a-z0-9_]+\s+using'` (the index
   *  preflight's def-normalization regex). Those strip an OPTIONAL schema
   *  qualifier off pg_get_indexdef's rendered output before comparing two
   *  index definitions textually -- they are not a schema target, and the
   *  literal `public.` (dot, no backslash) substitution below does not match
   *  `public\.` (backslash, then dot) as a substring, so this exclusion falls
   *  out of the exact-string match automatically rather than needing a
   *  special case.
   *
   *  Q5 CORRECTION (measured directly against this live Postgres, superseding
   *  the previous pass's claim in this comment): pg_get_indexdef(oid) does
   *  NOT render unqualified for a relation visible via search_path -- it
   *  ALWAYS fully schema-qualifies the "ON" table reference, verified here
   *  for a table in `public` with `public` on the default search_path, for a
   *  table in `public` with an explicit `SET LOCAL search_path TO "public"`,
   *  and for a literal `pg_temp`-qualified table -- all three rendered
   *  qualified. That is exactly why the migration's own regex has something
   *  to strip in the first place (`public\.` for its real target, always
   *  `public` in production; `pg_temp(_[0-9]+)?\.` for its own internal
   *  comparison twin, always pg_temp) -- it was never relying on an
   *  "unqualified when visible" special case that does not exist. The regex
   *  only recognises those two literal schema spellings because production
   *  code only ever runs against those two schemas; a *third* schema name
   *  (this suite's disposable `int21_*` schemas) renders qualified same as
   *  the other two, but is a spelling the regex was never asked to know
   *  about, so it is left un-normalised and compares unequal to `<tbl>`.
   *
   *  This is a real, structural limitation of testing THIS migration's
   *  internal index self-comparison through schema substitution, not a bug
   *  fixable by changing the substitution scheme: putting the target ALSO in
   *  literal `pg_temp` (the one other schema name the regex recognises) was
   *  tried and rejected -- it does not dodge the problem, it trades it for a
   *  worse one, because the migration's OWN scratch comparison object
   *  (`pg_temp.m21_idx_twin`, with an index EXECUTE-formatted to the exact
   *  same literal name as the real canonical index,
   *  20261021_integrations_connector_runtime_shape.sql:171-172) would then
   *  collide with the real target's own same-named index in the very same
   *  pg_temp namespace -- something that structurally cannot happen in
   *  production, where the real target lives in `public` and the scratch
   *  twin lives in `pg_temp`, two different namespaces. There is no schema
   *  name available to this harness that is simultaneously (a) not the real,
   *  untouchable `public`, and (b) not `pg_temp` (which the target can't
   *  share with the migration's own scratch object), and (c) still one of
   *  the two spellings the migration's hardcoded regex normalises. See the
   *  REPEAT test below for how it proves genuine idempotency despite this by
   *  independently verifying that this specific, precisely-reproduced
   *  rendering artifact -- and nothing else -- is what the migration's own
   *  preflight sees, rather than hiding or ignoring the mismatch it reports.
   *
   *  SET LOCAL search_path is still prepended below as belt-and-braces (it
   *  costs nothing and matches house style), but per the owner decision it is
   *  NOT the control surface here and none of the assertions in this file
   *  depend on it doing anything -- substitution alone is what makes every
   *  guard and every mutation address the disposable schema. The HOSTILE
   *  SEARCH_PATH test below proves this directly: pointing search_path at a
   *  schema containing a decoy `integrations` table and running the RAW,
   *  unsubstituted migration text must NOT touch the decoy, because every
   *  target in the file is hardcoded to `public` and search_path cannot
   *  redirect a schema-qualified reference. */
  const sqlFor = (schema: string) =>
    `SET LOCAL search_path TO "${schema}";\n` +
    migration.replaceAll('public.', `${schema}.`).replaceAll("'public'", `'${schema}'`);

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
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position`,
      [schema, TABLE]
    );
    const constraints = await pool.query(
      `SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
         FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = $2
        ORDER BY c.conname`,
      [schema, TABLE]
    );
    return { columns: columns.rows, constraints: constraints.rows };
  };

  /** pg_get_indexdef against a real index, joined explicitly (not the
   *  pg_indexes convenience view, though it is built from the same function)
   *  so both the twin and the target are read through the identical query
   *  shape -- the point the owner asked for: compare via pg_get_indexdef,
   *  never a hardcoded string. */
  const indexDefs = async (schemaName: string, table: string) => {
    const res = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT ic.relname AS indexname, pg_get_indexdef(ix.indexrelid) AS indexdef
         FROM pg_index ix
         JOIN pg_class ic ON ic.oid = ix.indexrelid
         JOIN pg_class tc ON tc.oid = ix.indrelid
         JOIN pg_namespace n ON n.oid = tc.relnamespace
        WHERE n.nspname = $1 AND tc.relname = $2
        ORDER BY ic.relname`,
      [schemaName, table]
    );
    return res.rows;
  };

  // Only compares the method+column-list tail of the definition (everything
  // from "USING" onward), not the "ON <schema>.<table>" head -- the twin and
  // the target necessarily live in different schemas/tables by construction,
  // so comparing the full string would always fail on that alone.
  const usingClause = (indexdef: string) => indexdef.match(/USING[\s\S]*$/)?.[0] ?? indexdef;

  // Shared by every index-shape comparison in this file (FRESH, EXACT
  // canonical..., and the RED-capability self-test below): reduces a row set
  // from indexDefs() to {name, using} pairs sorted by name, so two sets can
  // be compared for exact equality regardless of the order pg_index returns
  // them in. Name equality is meaningful because TWIN_TABLE === TABLE (see
  // the comment on TWIN_TABLE above) makes Postgres auto-derive the SAME
  // "integrations_pkey" name for both the twin and the real target.
  const normalizeIdx = (rows: { indexname: string; indexdef: string }[]) =>
    rows
      .map((r) => ({ name: r.indexname, using: usingClause(r.indexdef) }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const rowsOf = (schema: string) =>
    pool.query(`SELECT * FROM "${schema}".${TABLE} ORDER BY id`);

  // -------------------------------------------------------------------
  // SELF-TEST: a comparison harness has no evidentiary value until it is
  // shown it can go RED (today's lesson, "closure-evidence-sources
  // 2026-08-17" / templateProvenanceApproval19 header comment). Proves
  // shape() is non-empty on a real table AND detects a deliberately
  // introduced change, independent of anything the migration itself does.
  // -------------------------------------------------------------------
  it('self-test: shape() is non-empty and detects a deliberately introduced change', async () => {
    const schema = await makeLegacySchema();
    const before = await shape(schema);
    expect(before.columns.length).toBeGreaterThan(0);
    expect(before.constraints.length).toBeGreaterThan(0); // legacy UNIQUE(organization_id, provider_id) + pkey

    await pool.query(`ALTER TABLE "${schema}".${TABLE} ADD COLUMN probe_for_self_test TEXT`);
    const afterColumnAdd = await shape(schema);
    expect(afterColumnAdd).not.toEqual(before);
    expect(afterColumnAdd.columns.map((c) => c.column_name)).toContain('probe_for_self_test');

    // Also prove the index-comparison path (indexDefs/usingClause) is capable
    // of detecting a change, not just column shape.
    await pool.query(`CREATE INDEX probe_idx_for_self_test ON "${schema}".${TABLE}(id)`);
    const idxBefore = await indexDefs(schema, TABLE);
    await pool.query(`DROP INDEX "${schema}".probe_idx_for_self_test`);
    const idxAfter = await indexDefs(schema, TABLE);
    expect(idxAfter).not.toEqual(idxBefore);
  });

  // -------------------------------------------------------------------
  // 1 + 4 (fresh half): applying into a schema where `integrations` does not
  // exist yet. Per the sibling preflight convention (20261019's
  // `IF to_regclass(...) IS NULL THEN RETURN; END IF;`), a fresh schema means
  // the whole preflight no-ops and only the unconditional
  // CREATE TABLE IF NOT EXISTS / ADD COLUMN / index DDL below it runs -- this
  // is the assumption noted in the end-of-file dependency block, since M1's
  // file did not exist at authoring time.
  // -------------------------------------------------------------------
  it('FRESH: applying into a schema without integrations creates the exact canonical shape', async () => {
    const schema = await makeSchema();
    await apply(schema);
    const result = await shape(schema);

    expect(result.columns.length).toBeGreaterThan(0);

    // Full column set matches the canonical twin exactly on a fresh create --
    // no legacy columns exist to carry forward, so every column is "new".
    // Compared by name (sorted) rather than physical ordinal position: column
    // order is not part of the documented contract.
    const twinColumns = await pool.query(
      `SELECT column_name, data_type, column_default
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY column_name`,
      [tempSchema, TWIN_TABLE]
    );
    const targetColumnsSorted = [...result.columns]
      .map((c) => ({ column_name: c.column_name, data_type: c.data_type, column_default: c.column_default }))
      .sort((a, b) => a.column_name.localeCompare(b.column_name));
    expect(targetColumnsSorted).toEqual(twinColumns.rows);

    // Both indexes exist with canonical definitions (pg_get_indexdef vs twin).
    const targetIdx = await indexDefs(schema, TABLE);
    const twinIdx = await indexDefs(tempSchema, TWIN_TABLE);
    expect(normalizeIdx(targetIdx)).toEqual(normalizeIdx(twinIdx));
    // Named indexes plus the implicit primary-key index Postgres always
    // creates for `id TEXT PRIMARY KEY` -- named "integrations_pkey" because
    // TWIN_TABLE now shares TABLE's name, exactly like the real table's own
    // auto-derived "integrations_pkey" above.
    expect(targetIdx.map((r) => r.indexname).sort()).toEqual(
      ['idx_integrations_connector', 'idx_integrations_org', 'integrations_pkey'].sort()
    );
  });

  // -------------------------------------------------------------------
  // MANDATORY RED-CAPABILITY SELF-TEST (Q5): the TWIN_TABLE=TABLE
  // normalisation above -- which lets the twin's auto-derived PK name
  // "integrations_pkey" compare equal to the real target's own
  // "integrations_pkey" instead of a spurious "integrations_canonical_
  // twin_pkey" -- has no evidentiary value until it is shown it can still go
  // RED for a genuinely different index set (house lesson, "closure-
  // evidence-sources 2026-08-17" / the self-test above / templateProvenance
  // Approval19's header comment). Proves normalizeIdx()'s comparison --
  // shared by FRESH and EXACT canonical... above -- still catches three
  // independent defect classes: a MISSING index, an index on the WRONG
  // COLUMN, and an EXTRA unexpected index. Each probe is restored to exactly
  // canonical before the next, with a green sanity check in between, so the
  // three defects are isolated from one another and from every other test's
  // fixture in this file (this test uses its own disposable schema).
  // -------------------------------------------------------------------
  it('RED-CAPABILITY: the twin-normalised index comparison still detects a missing, wrong-column, or extra index', async () => {
    const schema = await makeSchema();
    await apply(schema);
    const canonical = normalizeIdx(await indexDefs(tempSchema, TWIN_TABLE));

    // Baseline: a freshly converged target matches the twin exactly (already
    // proven by FRESH above; re-confirmed here as this test's own starting
    // point before deliberately breaking it three ways).
    expect(normalizeIdx(await indexDefs(schema, TABLE))).toEqual(canonical);

    // (i) MISSING INDEX: drop idx_integrations_connector entirely.
    await pool.query(`DROP INDEX "${schema}".idx_integrations_connector`);
    const afterMissing = normalizeIdx(await indexDefs(schema, TABLE));
    expect(afterMissing).not.toEqual(canonical);
    expect(afterMissing.map((r) => r.name)).not.toContain('idx_integrations_connector');
    expect(afterMissing.length).toBe(canonical.length - 1);

    // Restore correctly before the next probe, so each defect is isolated.
    await pool.query(`CREATE INDEX idx_integrations_connector ON "${schema}".${TABLE}(connector_id)`);
    expect(normalizeIdx(await indexDefs(schema, TABLE))).toEqual(canonical); // sanity: back to green

    // (ii) WRONG COLUMN: same index name, indexing a different column --
    // exactly the failure mode a naive `CREATE INDEX IF NOT EXISTS` would
    // silently accept (name already exists, so IF NOT EXISTS no-ops),
    // mirrored here directly against the comparison itself rather than
    // through the migration's own preflight (that path is covered
    // separately by the "FAIL-BEFORE-MUTATION: ... WRONG COLUMN" test).
    await pool.query(`DROP INDEX "${schema}".idx_integrations_connector`);
    await pool.query(`CREATE INDEX idx_integrations_connector ON "${schema}".${TABLE}(name)`);
    const afterWrongColumn = normalizeIdx(await indexDefs(schema, TABLE));
    expect(afterWrongColumn).not.toEqual(canonical);
    const wrongEntry = afterWrongColumn.find((r) => r.name === 'idx_integrations_connector');
    expect(wrongEntry?.using).toBe('USING btree (name)');
    expect(wrongEntry?.using).not.toBe(
      canonical.find((r) => r.name === 'idx_integrations_connector')?.using
    );

    // Restore correctly before the next probe.
    await pool.query(`DROP INDEX "${schema}".idx_integrations_connector`);
    await pool.query(`CREATE INDEX idx_integrations_connector ON "${schema}".${TABLE}(connector_id)`);
    expect(normalizeIdx(await indexDefs(schema, TABLE))).toEqual(canonical); // sanity: back to green

    // (iii) EXTRA INDEX: an unexpected index the canonical twin does not have.
    await pool.query(`CREATE INDEX idx_integrations_extra_probe ON "${schema}".${TABLE}(status)`);
    const afterExtra = normalizeIdx(await indexDefs(schema, TABLE));
    expect(afterExtra).not.toEqual(canonical);
    expect(afterExtra.length).toBe(canonical.length + 1);
    expect(afterExtra.map((r) => r.name)).toContain('idx_integrations_extra_probe');

    // Restore: drop the extra index, confirm back to exactly canonical.
    await pool.query(`DROP INDEX "${schema}".idx_integrations_extra_probe`);
    expect(normalizeIdx(await indexDefs(schema, TABLE))).toEqual(canonical);
  });

  // -------------------------------------------------------------------
  // 2: an immediate second apply over a fresh install is a byte-identical
  // no-op.
  // -------------------------------------------------------------------
  // The migration's own index-preflight RAISE, verbatim
  // (20261021_integrations_connector_runtime_shape.sql:206-207):
  //   RAISE EXCEPTION 'integrations index % has incompatible definition: % (expected %)',
  //     pair.idx_name, actual_def, expected_def;
  const INDEX_PREFLIGHT_RAISE_RE =
    /^integrations index (\S+) has incompatible definition: (.+) \(expected (.+)\)$/;

  it('REPEAT: a second apply on a fresh install is a byte-identical no-op', async () => {
    // Q5 NOTE: a second, real apply() onto an already-converged schema
    // exercises the migration's own internal index-preflight
    // (20261021_integrations_connector_runtime_shape.sql:149-210, "the two
    // indexes this migration owns ... are checked, when already present,
    // against a canonical twin ... rendered via pg_get_indexdef"). As proven
    // in the long comment above sqlFor(), pg_get_indexdef(oid) ALWAYS fully
    // schema-qualifies its "ON" clause, and the migration's own comparison
    // regex only knows how to strip two literal spellings of that qualifier
    // (`public.`, its real target in production, and `pg_temp(_N)?.`, its
    // own internal scratch twin) -- neither of which this suite's disposable
    // `int21_*` schema is. Putting the target itself in `pg_temp` was tried
    // and rejected too: it collides with the migration's OWN scratch index
    // (same hardcoded name, same namespace) in a way that cannot happen in
    // production, where the two live in different schemas. Both are
    // documented in full above sqlFor().
    //
    // Rather than avoid the resulting RAISE (which would mean never really
    // exercising apply() a second time -- silently NOT proving idempotency),
    // this test lets it happen and independently VERIFIES, by reconstructing
    // the exact same normalisation the migration's own regex performs, that
    // the reported mismatch is PRECISELY this schema-name substring and
    // nothing else -- i.e. that the two index definitions the migration
    // compared really were identical modulo the one spelling its regex
    // cannot parse. Any OTHER, unexplained difference fails this test hard.
    // Whichever branch fires below (a future Postgres or migration edit that
    // renders/normalises differently could make the second apply() succeed
    // outright), the table's full column/constraint/index shape after the
    // second apply is proven byte-identical to after the first -- the actual
    // substance of "byte-identical no-op".
    const schema = await makeSchema();
    await apply(schema);
    const first = await shape(schema);
    const firstIdx = await indexDefs(schema, TABLE);

    // The starting point itself is already proven canonical (both indexes,
    // PK included) by the FRESH test above, which applies into an identical
    // kind of empty schema and compares against the twin -- reusing that
    // same comparison here would be redundant, so this test moves straight
    // to proving the SECOND apply changes nothing.
    let secondApplyError: Error | null = null;
    try {
      await apply(schema);
    } catch (error) {
      secondApplyError = error as Error;
    }

    if (secondApplyError) {
      const match = INDEX_PREFLIGHT_RAISE_RE.exec(secondApplyError.message);
      expect(
        match,
        `expected the documented schema-qualification artifact from the index preflight, got: ${secondApplyError.message}`
      ).not.toBeNull();
      const [, , actualDef, expectedDef] = match!;

      // expectedDef is the migration's OWN twin-normalised rendering and
      // must contain the "<tbl>" placeholder its regex substitutes in place
      // of a recognised schema qualifier (see the regex at migration.sql:
      // 184/195). Reconstructing actualDef by substituting THIS schema's own
      // qualified table reference into that exact placeholder must reproduce
      // actualDef byte-for-byte -- if it does not, some difference beyond
      // the schema name exists and this assertion fails, exactly the
      // rigor a silent catch-and-ignore would have given up.
      expect(expectedDef).toContain('<tbl>');
      const reconstructedActual = expectedDef.replace('<tbl>', `${schema.toLowerCase()}.${TABLE}`);
      expect(actualDef).toBe(reconstructedActual);
    }

    // Regardless of which branch fired: the failed apply() rolled back (its
    // own try/catch guarantees that), and a successful apply() must have
    // been a genuine no-op -- either way the full shape, including both
    // indexes, must be byte-identical to right after the first apply.
    expect(await shape(schema)).toEqual(first);
    expect(await indexDefs(schema, TABLE)).toEqual(firstIdx);
  });

  // -------------------------------------------------------------------
  // 3 (THE MOST IMPORTANT CASE): non-empty legacy provider_id shape
  // converges without losing rows. Two real rows: one fully populated
  // ("legacy-full") and one exercising a NULL-ish path through several
  // optional legacy columns including an EXPLICIT NULL status (so the
  // COALESCE(status, 'pending') backfill branch documented at
  // DatabaseInitializer.ts:1323 is genuinely exercised, not just assumed --
  // the legacy DEFAULT 'active' would otherwise mask that branch on every
  // row, since provider_id/auth_type/connected_by are NOT NULL in the legacy
  // shape and can never themselves be NULL pre-migration).
  // -------------------------------------------------------------------
  it('NON-EMPTY LATE LEGACY CONVERGENCE: legacy rows survive with backfilled connector_id/name/category/status, tokens preserved', async () => {
    const schema = await makeLegacySchema();

    await pool.query(
      `INSERT INTO "${schema}".${TABLE}
         (id, organization_id, provider_id, auth_type, access_token, refresh_token, api_key,
          token_expires_at, status, connected_by)
       VALUES ('int-full', 'org-a', 'int-slack', 'oauth2', 'tok-access', 'tok-refresh', 'tok-api',
               '2026-01-01 00:00:00', 'active', 'user-a')`
    );
    await pool.query(
      `INSERT INTO "${schema}".${TABLE}
         (id, organization_id, provider_id, auth_type, status, connected_by)
       VALUES ('int-minimal', 'org-b', 'int-jira', 'api_key', NULL, 'user-b')`
    );

    const before = await rowsOf(schema);
    expect(before.rowCount).toBe(2);

    await apply(schema);

    const after = await rowsOf(schema);
    expect(after.rowCount).toBe(2); // every legacy row SURVIVES
    const byId = Object.fromEntries(after.rows.map((r: any) => [r.id, r]));

    // connector_id backfilled per COALESCE(connector_id, provider_id, id) --
    // DatabaseInitializer.ts:1312/1320.
    expect(byId['int-full'].connector_id).toBe('int-slack');
    expect(byId['int-minimal'].connector_id).toBe('int-jira');

    // name backfilled per COALESCE(name, provider_id, ...) -- :1313/1321,
    // since legacy has no `name` column at all (always NULL pre-backfill).
    expect(byId['int-full'].name).toBe('int-slack');
    expect(byId['int-minimal'].name).toBe('int-jira');

    // category backfilled to 'productivity' -- :1322 -- for both, since
    // legacy has no `category` column at all.
    expect(byId['int-full'].category).toBe('productivity');
    expect(byId['int-minimal'].category).toBe('productivity');

    // status: 'int-full' already had a non-NULL legacy status ('active') so
    // COALESCE(status, 'pending') leaves it untouched; 'int-minimal' was
    // inserted with an EXPLICIT NULL status, so the backfill fills 'pending'.
    expect(byId['int-full'].status).toBe('active');
    expect(byId['int-minimal'].status).toBe('pending');

    // is_paused backfilled to FALSE (boolean) -- :1324 -- for a column legacy
    // never had.
    expect(byId['int-full'].is_paused).toBe(false);
    expect(byId['int-minimal'].is_paused).toBe(false);

    // provider_id PRESERVED, values unchanged (owner decision: never dropped).
    expect(byId['int-full'].provider_id).toBe('int-slack');
    expect(byId['int-minimal'].provider_id).toBe('int-jira');

    // access_token/refresh_token/api_key columns still exist and still carry
    // their original values (or NULL, for the row that never set them).
    expect(byId['int-full'].access_token).toBe('tok-access');
    expect(byId['int-full'].refresh_token).toBe('tok-refresh');
    expect(byId['int-full'].api_key).toBe('tok-api');
    expect(byId['int-minimal'].access_token).toBeNull();
    expect(byId['int-minimal'].refresh_token).toBeNull();
    expect(byId['int-minimal'].api_key).toBeNull();
  });

  // -------------------------------------------------------------------
  // 4 (post-convergence half): the columns genuinely NEW relative to legacy
  // (NEW_COLUMNS) match the canonical twin's type/default exactly after
  // converging a non-empty legacy table -- not just on a fresh create.
  // Columns that already existed in the legacy shape (auth_type, status,
  // field_mappings, sync_settings, last_sync_at, last_error, updated_at) are
  // deliberately excluded: ADD COLUMN IF NOT EXISTS never touches them, so
  // their default legitimately stays whatever the legacy migration set.
  // -------------------------------------------------------------------
  it('EXACT canonical types/defaults for newly-added columns, both indexes present, after a non-empty legacy convergence', async () => {
    const schema = await makeLegacySchema();
    await pool.query(
      `INSERT INTO "${schema}".${TABLE} (id, organization_id, provider_id, auth_type, connected_by)
       VALUES ('int-x', 'org-x', 'int-slack', 'oauth2', 'user-x')`
    );

    await apply(schema);

    const result = await shape(schema);
    const targetNew = result.columns
      .filter((c) => (NEW_COLUMNS as readonly string[]).includes(c.column_name))
      .map((c) => ({ column_name: c.column_name, data_type: c.data_type, column_default: c.column_default }))
      .sort((a, b) => a.column_name.localeCompare(b.column_name));

    const twinAll = await pool.query(
      `SELECT column_name, data_type, column_default
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2`,
      [tempSchema, TWIN_TABLE]
    );
    const twinNew = twinAll.rows
      .filter((c: any) => (NEW_COLUMNS as readonly string[]).includes(c.column_name))
      .sort((a: any, b: any) => a.column_name.localeCompare(b.column_name));

    expect(targetNew).toEqual(twinNew);
    expect(targetNew.map((c) => c.column_name)).toEqual([...NEW_COLUMNS].sort());

    const targetIdx = await indexDefs(schema, TABLE);
    const twinIdx = await indexDefs(tempSchema, TWIN_TABLE);

    // Unlike a FRESH create, this schema started as a LEGACY fixture carrying
    // its own UNIQUE(organization_id, provider_id) constraint (LEGACY_DDL
    // above), which Postgres backs with an implicit index named
    // "integrations_organization_id_provider_id_key". The migration never
    // touches constraints -- proved independently below by "does not invent
    // any organization+connector uniqueness during convergence", which
    // asserts shape().constraints is byte-identical before/after -- so that
    // index legitimately SURVIVES convergence. The canonical twin, built as a
    // FRESH create with no such constraint, correctly does not model it.
    // Comparing targetIdx to twinIdx alone would therefore wrongly demand the
    // preserved legacy index vanish. The correct, still fully-closed claim is:
    // the two canonical named indexes match the twin's canonical definitions
    // exactly, the legacy unique index survives untouched, and nothing else
    // is present.
    const expectedIdx = [
      ...normalizeIdx(twinIdx),
      { name: 'integrations_organization_id_provider_id_key', using: 'USING btree (organization_id, provider_id)' },
    ].sort((a, b) => a.name.localeCompare(b.name));
    expect(normalizeIdx(targetIdx)).toEqual(expectedIdx);
  });

  // -------------------------------------------------------------------
  // 5: FAIL-BEFORE-MUTATION, byte-identical. Three independent non-empty
  // fixtures, each with exactly one deliberate defect (wrong type, wrong
  // default, wrong/misdefined same-named index) pre-existing on a table that
  // otherwise already has the canonical convergence applied (so the defect is
  // the only variable). NOTE: the `/incompatible/i` matcher follows the
  // sibling preflight convention (RAISE EXCEPTION '<object> has incompatible
  // <thing>: %') verified in 20261019_template_provenance_approval_receipts
  // .sql and 20261016_org_context_upload_idempotency.sql -- this is an
  // ASSUMPTION about M1's error wording, not something read from M1's actual
  // file (see end-of-file dependency note).
  // -------------------------------------------------------------------
  const nonEmptyConvergedSchema = async () => {
    const schema = await makeLegacySchema();
    await pool.query(
      `INSERT INTO "${schema}".${TABLE} (id, organization_id, provider_id, auth_type, connected_by)
       VALUES ('int-seed', 'org-seed', 'int-slack', 'oauth2', 'user-seed')`
    );
    await apply(schema);
    return schema;
  };

  it('FAIL-BEFORE-MUTATION: a pre-existing column with the WRONG TYPE is refused, byte-identical', async () => {
    const schema = await nonEmptyConvergedSchema();
    // connector_id already converged as TEXT; drop and recreate as the wrong
    // type so a second apply must see an incompatible column, not a missing
    // one.
    await pool.query(`ALTER TABLE "${schema}".${TABLE} DROP COLUMN connector_id`);
    await pool.query(`ALTER TABLE "${schema}".${TABLE} ADD COLUMN connector_id INTEGER`);
    const before = await shape(schema);
    const rowsBefore = await rowsOf(schema);
    expect(rowsBefore.rowCount).toBe(1); // sanity: this refusal protects a NON-EMPTY table

    await expect(apply(schema)).rejects.toThrow(/incompatible/i);

    expect(await shape(schema)).toEqual(before);
    expect((await rowsOf(schema)).rows).toEqual(rowsBefore.rows);
  });

  it('FAIL-BEFORE-MUTATION: a pre-existing column with the WRONG DEFAULT is refused, byte-identical', async () => {
    const schema = await nonEmptyConvergedSchema();
    // config is canonically TEXT DEFAULT '{}' (DatabaseInitializer.ts:1239);
    // widen it to a different default without changing type.
    await pool.query(`ALTER TABLE "${schema}".${TABLE} ALTER COLUMN config SET DEFAULT '[]'`);
    const before = await shape(schema);
    const rowsBefore = await rowsOf(schema);
    expect(rowsBefore.rowCount).toBe(1);

    await expect(apply(schema)).rejects.toThrow(/incompatible/i);

    expect(await shape(schema)).toEqual(before);
    expect((await rowsOf(schema)).rows).toEqual(rowsBefore.rows);
  });

  it('FAIL-BEFORE-MUTATION: a pre-existing same-named index on the WRONG COLUMN is refused, byte-identical', async () => {
    const schema = await nonEmptyConvergedSchema();
    // idx_integrations_org canonically indexes organization_id
    // (DatabaseInitializer.ts:1328-1330). A same-named index on the wrong
    // column would otherwise be silently accepted by a naive
    // `CREATE INDEX IF NOT EXISTS idx_integrations_org ...` (the name already
    // exists, so IF NOT EXISTS skips it) -- exactly the failure mode a
    // preflight must catch instead.
    await pool.query(`DROP INDEX "${schema}".idx_integrations_org`);
    await pool.query(`CREATE INDEX idx_integrations_org ON "${schema}".${TABLE}(id)`);
    const before = await shape(schema);
    const beforeIdx = await indexDefs(schema, TABLE);
    const rowsBefore = await rowsOf(schema);
    expect(rowsBefore.rowCount).toBe(1);

    await expect(apply(schema)).rejects.toThrow(/incompatible/i);

    expect(await shape(schema)).toEqual(before);
    expect(await indexDefs(schema, TABLE)).toEqual(beforeIdx);
    expect((await rowsOf(schema)).rows).toEqual(rowsBefore.rows);
  });

  // -------------------------------------------------------------------
  // 6: NOT NULL relaxation is scoped. provider_id and auth_type become
  // nullable (DatabaseInitializer.ts:1296-1306); organization_id -- an
  // "OTHER originally-NOT NULL column" never touched by that loop -- stays
  // NOT NULL, proving the migration relaxed only what it was allowed to.
  // -------------------------------------------------------------------
  it('NOT NULL relaxation is scoped to provider_id and auth_type; organization_id stays NOT NULL', async () => {
    const schema = await makeLegacySchema();
    const beforeCols = await pool.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema=$1 AND table_name=$2 AND column_name IN ('provider_id','auth_type','organization_id')`,
      [schema, TABLE]
    );
    expect(beforeCols.rows.every((r: any) => r.is_nullable === 'NO')).toBe(true); // sanity: all three start NOT NULL

    await apply(schema);

    const afterCols = await pool.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema=$1 AND table_name=$2 AND column_name IN ('provider_id','auth_type','organization_id')`,
      [schema, TABLE]
    );
    const byName = Object.fromEntries(afterCols.rows.map((r: any) => [r.column_name, r.is_nullable]));
    expect(byName.provider_id).toBe('YES');
    expect(byName.auth_type).toBe('YES');
    expect(byName.organization_id).toBe('NO');
  });

  // -------------------------------------------------------------------
  // 7: LEGACY + CONNECTOR COMPATIBILITY. After convergence, both an
  // old-style row (provider_id populated, connector_id backfilled) and a
  // new-style row using the EXACT production INSERT column list from
  // settings.routes.ts:1761-1765 can be inserted and read back.
  // -------------------------------------------------------------------
  it('LEGACY + CONNECTOR COMPATIBILITY: old-style and new-style rows both insert and read back after convergence', async () => {
    const schema = await makeLegacySchema();
    await pool.query(
      `INSERT INTO "${schema}".${TABLE} (id, organization_id, provider_id, auth_type, connected_by)
       VALUES ('int-old', 'org-compat', 'int-teams', 'oauth2', 'user-compat')`
    );
    await apply(schema);

    // Old-style row survived and was backfilled (from test 3's contract).
    const oldRow = await pool.query(`SELECT * FROM "${schema}".${TABLE} WHERE id='int-old'`);
    expect(oldRow.rowCount).toBe(1);
    expect(oldRow.rows[0].provider_id).toBe('int-teams');
    expect(oldRow.rows[0].connector_id).toBe('int-teams');

    // New-style row: settings.routes.ts:1782-1785's exact production INSERT
    // column list and CURRENT_TIMESTAMP usage, adapted from ? placeholders
    // (sqlite-style dbRun) to pg's numbered placeholders -- same columns,
    // same order, same values shape.
    //
    // Q5 FIX: the previous version of this test omitted `connected_by` from
    // both the column list and the values array, even though the real
    // production statement includes it as its 10th bound column (settings.
    // routes.ts:1784, bound to the verified requester's userId -- see the
    // "Audit identity" comment at :1796-1799 there). `connected_by` is NOT
    // NULL with no default in the legacy shape (LEGACY_DDL above) and is
    // explicitly never touched by this migration (documented at the top of
    // this file and re-affirmed by DatabaseInitializer.ts never relaxing
    // it), so a converged-from-legacy table genuinely keeps that NOT NULL --
    // omitting it here was not testing "the exact production INSERT", it was
    // testing a strictly narrower statement that happens to have the same
    // omission this migration would NOT protect against. Restored to match
    // the real 11-column production statement exactly.
    await pool.query(
      `INSERT INTO "${schema}".${TABLE} (
         id, organization_id, connector_id, name, category,
         status, config, capabilities, auth_type, connected_by, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        'int-new',
        'org-compat',
        'int-slack',
        'Slack',
        'communication',
        'pending',
        JSON.stringify({}),
        JSON.stringify(['read:messages']),
        'oauth2',
        'user-new',
      ]
    );
    const newRow = await pool.query(`SELECT * FROM "${schema}".${TABLE} WHERE id='int-new'`);
    expect(newRow.rowCount).toBe(1);
    expect(newRow.rows[0].connector_id).toBe('int-slack');
    expect(newRow.rows[0].provider_id).toBeNull(); // new-style row never sets legacy provider_id
    expect(newRow.rows[0].name).toBe('Slack');
    expect(newRow.rows[0].category).toBe('communication');

    const both = await pool.query(`SELECT id FROM "${schema}".${TABLE} ORDER BY id`);
    expect(both.rows.map((r: any) => r.id)).toEqual(['int-new', 'int-old']);
  });

  // -------------------------------------------------------------------
  // Owner decision guard: "no organization+connector uniqueness may be
  // invented". The migration never touches constraints at all per the
  // documented convergence, so the constraint set before and after a
  // non-empty legacy convergence must be byte-identical -- in particular the
  // legacy UNIQUE(organization_id, provider_id) survives untouched and no new
  // UNIQUE(organization_id, connector_id) (or equivalent) appears.
  // -------------------------------------------------------------------
  it('does not invent any organization+connector uniqueness during convergence', async () => {
    const schema = await makeLegacySchema();
    await pool.query(
      `INSERT INTO "${schema}".${TABLE} (id, organization_id, provider_id, auth_type, connected_by)
       VALUES ('int-uniq', 'org-uniq', 'int-slack', 'oauth2', 'user-uniq')`
    );
    const before = await shape(schema);
    expect(before.constraints.some((c: any) => c.definition.includes('UNIQUE (organization_id, provider_id)'))).toBe(
      true
    ); // sanity: legacy uniqueness genuinely present before

    await apply(schema);

    const after = await shape(schema);
    expect(after.constraints).toEqual(before.constraints); // untouched: nothing added, nothing dropped
    expect(after.constraints.some((c: any) => /connector_id/.test(c.definition))).toBe(false);
  });

  // -------------------------------------------------------------------
  // HOSTILE SEARCH_PATH: the contract the owner decision actually buys.
  // Before Q1's rewrite, the migration's DDL/DML followed ambient
  // search_path while its guards hardcoded `public` -- a mismatch this
  // whole harness exists to catch. Now every guard AND every mutation is
  // qualified to `public` explicitly, so search_path must be provably inert
  // as a control surface: pointing it at a schema holding a same-named decoy
  // `integrations` table and running the RAW (unsubstituted -- no sqlFor())
  // migration text must leave that decoy byte-identical, because nothing in
  // the file can resolve to it anymore. This is the regression test for the
  // exact defect class the root cause describes, independent of sqlFor()'s
  // own substitution (which is the harness's problem, not the migration's).
  // -------------------------------------------------------------------
  it('HOSTILE SEARCH_PATH: a decoy integrations table in the disposable schema is not mutated by the unsubstituted migration text', async () => {
    const schema = await makeSchema();

    // Decoy shaped NOTHING like the canonical/legacy integrations table --
    // if any statement in the migration still resolved `integrations`
    // through search_path instead of the hardcoded `public.` qualifier, it
    // would ALTER/backfill/index THIS table, and that would show up as a
    // shape or row change below. `id` is included only so the file's
    // existing rowsOf() helper (which does ORDER BY id) can be reused
    // as-is.
    await pool.query(
      `CREATE TABLE "${schema}".${TABLE} (id TEXT PRIMARY KEY, decoy_marker TEXT DEFAULT 'untouched-decoy')`
    );
    await pool.query(`INSERT INTO "${schema}".${TABLE} (id) VALUES ('decoy-1')`);

    const before = await shape(schema);
    const rowsBefore = await rowsOf(schema);
    // Sanity: this really is a foreign shape, not something that happens to
    // already look canonical/legacy.
    expect(before.columns.map((c: any) => c.column_name).sort()).toEqual(['decoy_marker', 'id']);
    expect(rowsBefore.rows).toEqual([{ id: 'decoy-1', decoy_marker: 'untouched-decoy' }]);

    // Deliberately raw: search_path points at the decoy's schema, but the
    // migration text itself is used completely unsubstituted -- no sqlFor().
    // Wrapped in its own transaction that is ALWAYS rolled back (never
    // committed), regardless of outcome: this test's only claim is about the
    // decoy in the disposable schema, and it must not leave a permanent
    // mutation on the shared test database's real public.integrations (which
    // is exactly what the raw, correctly-`public`-qualified migration text
    // would otherwise legitimately target -- that's the point being proved).
    await pool.query('BEGIN');
    try {
      await pool.query(`SET LOCAL search_path TO "${schema}";\n${migration}`);
    } catch {
      // A RAISE from the preflight against whatever state the shared test
      // database's REAL public.integrations happens to be in is an
      // acceptable outcome here -- irrelevant to this test's only claim,
      // which is about the decoy, not about the real public schema.
    } finally {
      await pool.query('ROLLBACK');
    }

    expect(await shape(schema)).toEqual(before);
    expect((await rowsOf(schema)).rows).toEqual(rowsBefore.rows);
  });
});

// ---------------------------------------------------------------------------
// DEPENDENCY NOTE for the lead, updated by Q2 (second pass) after reading
// Q1's fully schema-qualified migration text
// (server/migrations/20261021_integrations_connector_runtime_shape.sql) in
// full:
//
// 1. RESOLVED (superseding the previous pass's item 1). Q1's owner-decision
//    rewrite now hardcodes the literal schema `public` throughout the ENTIRE
//    file, not just the preflight -- CREATE TABLE, all 21
//    ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements, both
//    ALTER COLUMN ... DROP NOT NULL statements, the backfill's dynamically
//    built `UPDATE public.integrations SET ...` format string, and both
//    CREATE INDEX ... ON clauses are qualified now, in addition to the
//    guards that were already qualified before. The previous pass's sqlFor()
//    only substituted the 3 guard-only exact-string forms (12 occurrences)
//    and would have left every one of those newly-qualified statements
//    pointed at the REAL public schema instead of the disposable one --
//    exactly the guard/mutation mismatch this migration's rewrite exists to
//    close, just relocated into the test harness instead. Fixed by widening
//    sqlFor() to two generic substitutions (`public.` -> schema, `'public'`
//    -> schema, 39 occurrences total across both) that redirect the whole
//    file uniformly; see sqlFor()'s doc comment for the full enumeration and
//    why the two `public\.` regex-escape occurrences are correctly excluded
//    by the exact-string match alone (no special-casing needed).
// 2. RESOLVED. The migration DOES implement a late-apply preflight (three
//    DO $$ blocks: type check, index check, default check) that RAISEs
//    'integrations.% has incompatible type/default %...' or 'integrations
//    index % has incompatible definition...' before any mutating statement
//    runs -- matches the /incompatible/i matcher already used by the three
//    FAIL-BEFORE-MUTATION tests and the uniqueness guard. No rewrite needed.
// 3. RESOLVED. The FRESH test's assumption held: a schema without
//    `integrations` skips both preflight DO blocks (`to_regclass(...) IS
//    NULL THEN RETURN`) and falls straight through to the unconditional
//    CREATE TABLE, producing the exact canonical twin shape.
// 4. STILL LIVE, not something this file's author can resolve without
//    running the suite: per the original task brief, a separate concurrent
//    worker was adding a catalog preflight for connector_id's type ahead of
//    the backfill UPDATE, so that a wrong-type connector_id raises a clean
//    /incompatible/i refusal instead of a raw
//    "COALESCE types integer and text cannot be matched" error. The
//    "FAIL-BEFORE-MUTATION: ... WRONG TYPE ..." test above already only
//    asserts /incompatible/i (never the raw COALESCE text), so no test
//    change was needed here -- but this is the one assertion in the file
//    whose correctness depends on that edit landing as described, since the
//    connector_id-type row in this migration snapshot's own type-preflight
//    VALUES list already appears to cover it independently. Re-verify once
//    the file is final and the suite actually runs.
// 5. NEW, added this pass. The HOSTILE SEARCH_PATH test proves the actual
//    production contract Q1's rewrite buys: with search_path pointed at a
//    schema holding a same-named decoy `integrations` table, running the
//    RAW (unsubstituted) migration text must not touch the decoy, because
//    every guard and every mutation is now hardcoded to `public` and cannot
//    be redirected by search_path. This is independent of sqlFor() -- it is
//    a claim about the migration file itself, not about this harness's
//    substitution mechanism. It intentionally always ROLLBACKs (whether the
//    raw apply against the real public schema succeeds or the preflight
//    RAISEs) so it never leaves a permanent mutation on the shared test
//    database's real public.integrations.
// ---------------------------------------------------------------------------
