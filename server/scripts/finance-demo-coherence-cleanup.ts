#!/usr/bin/env tsx
/**
 * FIN-005 — tenant-scoped quarantine of foreign Finance records in the demo org.
 *
 * PROBLEM
 * -------
 * The 2026-08-01 staging probe of `demo.consultify.ai` found the Atelier Toys
 * demo workspace showing other people's Finance records: `DBR77 Manufacturing`
 * (the only approved statement), `DBR77 Staging Financial Analysis`, and eight
 * models including Apator, an M16 seed and four identical
 * `DBR77 Staging Finance Model (kopia)` rows.
 *
 * PROVENANCE — stated honestly, because it changes what is safe to do.
 * No script in this repository at `c522a861` produces those names.
 * `seed-finance-surface.ts` targets a hard-coded `dbr77` org,
 * `reset-and-seed-finance-demo.ts` seeds `Fabryka Alfa` / `Nova Energia`, and
 * nothing emits the string `DBR77 Staging`. The `(kopia)` suffix is the PL
 * translation of `finance.preview.copySuffix`, i.e. the UI "Duplikuj" action.
 * The records were therefore created by an operator (UI or an unversioned
 * script) directly inside the demo tenant during earlier Finance probes.
 *
 * Because the provenance is not reproducible from code, this script does NOT
 * assume what should go. It reports what is actually there and lets a human
 * approve the list before anything moves.
 *
 * MECHANISM — quarantine, never delete.
 * Every Finance read is organization-scoped, so re-pointing a row's
 * `organization_id` at a quarantine organization removes it from the demo
 * workspace while preserving the row, its children and its history byte for
 * byte. Rollback is the same UPDATE in reverse, and the script writes a
 * manifest containing every id and its original organization so the reverse is
 * mechanical.
 *
 * Setting `status = 'archived'` was considered and REJECTED: `listModels()` and
 * `listStatementPacks()` do not filter on status, so an "archived" row would
 * still render in the demo lists — it would look fixed without being fixed. And
 * `financial_analyses.status` has a CHECK constraint of
 * ('DRAFT','REVIEW','APPROVED') with no archive value at all, so that path
 * cannot even be applied uniformly without a migration.
 *
 * CLASSIFICATION
 * A row is CANONICAL when its id carries the demo seed's stable-id prefix
 * `<orgId>--` (`makeId(orgId, entity, slug)` in `demoSeedService`/
 * `atelierFinanceSeed`). Everything else in the demo tenant was not produced by
 * the canonical seed. Name flags (DBR77 / Apator / staging / "(kopia)") are
 * reported alongside as corroboration, never as the sole criterion — a
 * name-only rule would miss an unnamed leftover and could catch a legitimate
 * record.
 *
 * SAFETY
 * - dry-run by default; `--write` additionally requires
 *   `FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE`;
 * - refuses to run against a non-demo organization unless `--force-org` is
 *   given, so it cannot be pointed at a customer tenant by accident;
 * - refuses to quarantine canonical rows;
 * - single transaction; a manifest is written BEFORE the write commits;
 * - never issues DELETE, never touches `production`.
 *
 * USAGE
 *   # 1. dry run — read-only, produces the report + rollback plan
 *   DATABASE_URL=... tsx server/scripts/finance-demo-coherence-cleanup.ts \
 *     --demo-org-id demo-org
 *
 *   # 2. after Codex/Piotr approve the printed list
 *   DATABASE_URL=... FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE \
 *     tsx server/scripts/finance-demo-coherence-cleanup.ts \
 *     --demo-org-id demo-org --write
 *
 *   # 3. rollback (ids come from the manifest written in step 2)
 *   DATABASE_URL=... FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE \
 *     tsx server/scripts/finance-demo-coherence-cleanup.ts \
 *     --rollback server/exports/<manifest>.json
 */

import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';

import {
  classifyFinanceDemoRows,
  type FinanceDemoClassification,
} from '../src/services/demo/financeDemoCoherencePolicy.js';
import { isDemoOrgId, resolveDemoOrgId } from './lib/organizationTargetPolicy.js';
import {
  logSelectedDatabaseTarget,
  requireConfirmation,
  resolveScriptDatabaseTarget,
} from './lib/scriptDatabaseTarget.js';

const LABEL = 'finance-demo-cleanup';
const CONFIRM_ENV = 'FINANCE_DEMO_CLEANUP_CONFIRM';
const CONFIRM_VALUE = 'QUARANTINE_FOREIGN_FINANCE';

/**
 * Finance tables that are organization-scoped and carry customer-visible rows.
 * Child tables (`financial_statement_values`, `financial_model_events`,
 * `financial_model_outputs`, …) have no `organization_id` — they hang off their
 * parent and follow it automatically, which is precisely why quarantine is safe.
 */
const SCOPED_TABLES = [
  { table: 'financial_statement_packs', nameColumns: ['entity_name', 'period_label'] },
  { table: 'financial_statements', nameColumns: ['entity_name', 'period_label'] },
  { table: 'financial_statement_ingest_runs', nameColumns: ['source_file_name'] },
  { table: 'financial_analyses', nameColumns: ['title'] },
  { table: 'financial_models', nameColumns: ['name'] },
] as const;

/** Reported for visibility, never written by this script. */
const OBSERVE_ONLY_TABLES = ['budgets', 'valuations'] as const;

type Args = Record<string, string>;

/** Classification comes from the unit-tested policy module, not from here. */
type CandidateRow = FinanceDemoClassification;

interface ManifestEntry {
  table: string;
  id: string;
  fromOrganizationId: string;
  toOrganizationId: string;
  displayName: string;
  /** Prior `statement_pack_id`, cleared on quarantine and restored on rollback. */
  statementPackId?: string | null;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current?.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function exportsDir(): string {
  const dir = path.resolve(process.cwd(), 'server/exports');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Single-quoted SQL literal with quotes doubled. */
function sqlLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Escape LIKE metacharacters so an org id cannot alter the pattern. */
function escapeLike(value: string): string {
  return value.replace(/[!%_]/g, (char) => `!${char}`);
}

/**
 * Tables whose row also carries a link INTO the demo tenant's pack.
 *
 * Moving a statement's `organization_id` without clearing `statement_pack_id`
 * would leave it hanging off a canonical Atelier pack. `getStatementPackDetail`
 * now filters its nested statements by organization, but clearing the link is
 * the belt to that braces: the quarantined row keeps no reference into the
 * tenant it was removed from. The prior value is recorded in the manifest.
 */
function clearsPackLink(table: string): boolean {
  return table === 'financial_statements';
}

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS present`,
    [table]
  );
  return Boolean(result.rows?.[0]?.present);
}

async function existingColumns(pool: pg.Pool, table: string): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set((result.rows || []).map((row) => String(row.column_name)));
}

/**
 * Verify against the DATABASE that the target org really is a demo tenant.
 *
 * SECURITY (review 2026-08-01): `isDemoOrgId()` only compares the id STRING to
 * `DEMO_ORG_ID` (or the literal `demo-org`, accepted in every environment). It
 * says nothing about which database is connected, and `.env.production.example`
 * documents `DEMO_ORG_ID` as a supported production setting — so the string
 * check alone would happily let
 *
 *   DATABASE_URL=<production> ... --demo-org-id demo-org --write
 *
 * re-point every production Finance row whose id lacks the seed prefix. The
 * seed marks demo organizations with `organization_type = 'DEMO'`
 * (`demoSeedService.upsertOrg`), so require that marker on the live row before
 * touching anything.
 */
async function assertTargetIsDemoTenant(
  pool: pg.Pool,
  demoOrgId: string,
  allowForeignOrg: boolean
): Promise<void> {
  const columns = await existingColumns(pool, 'organizations');
  const org = await pool.query(
    `SELECT id::text AS id${columns.has('organization_type') ? ', organization_type::text AS organization_type' : ''}
     FROM organizations WHERE id = $1 LIMIT 1`,
    [demoOrgId]
  );
  if (!org.rowCount) {
    throw new Error(`[${LABEL}] Organization "${demoOrgId}" does not exist in the target database.`);
  }
  if (!columns.has('organization_type')) {
    if (!allowForeignOrg) {
      throw new Error(
        `[${LABEL}] The target database has no organizations.organization_type column, so a demo tenant cannot be verified. Pass --force-org to override.`
      );
    }
    return;
  }
  const type = String(org.rows[0]?.organization_type || '').toUpperCase();
  if (type !== 'DEMO' && !allowForeignOrg) {
    throw new Error(
      `[${LABEL}] Organization "${demoOrgId}" has organization_type="${type || '<null>'}", not "DEMO". This script only cleans a demo tenant. Pass --force-org if this is genuinely intentional.`
    );
  }
}

async function collectCandidates(pool: pg.Pool, demoOrgId: string): Promise<CandidateRow[]> {
  const rows: Array<{ table: string; id: string; displayName: string }> = [];

  for (const spec of SCOPED_TABLES) {
    if (!(await tableExists(pool, spec.table))) {
      console.warn(`[${LABEL}] table ${spec.table} not present — skipped.`);
      continue;
    }
    const columns = await existingColumns(pool, spec.table);
    if (!columns.has('organization_id')) {
      console.warn(`[${LABEL}] table ${spec.table} has no organization_id — skipped.`);
      continue;
    }
    const nameColumns = spec.nameColumns.filter((column) => columns.has(column));
    const nameExpression = nameColumns.length
      ? `COALESCE(${nameColumns.map((column) => `NULLIF("${column}"::text, '')`).join(', ')}, id)`
      : 'id';

    const result = await pool.query(
      `SELECT id::text AS id, organization_id::text AS organization_id,
              ${nameExpression} AS display_name
       FROM "${spec.table}"
       WHERE organization_id = $1
       ORDER BY id ASC`,
      [demoOrgId]
    );

    for (const row of result.rows || []) {
      const id = String(row.id);
      rows.push({ table: spec.table, id, displayName: String(row.display_name ?? id) });
    }
  }

  return classifyFinanceDemoRows(rows, demoOrgId).all;
}

async function observeOnlyCounts(
  pool: pg.Pool,
  demoOrgId: string
): Promise<Array<{ table: string; count: number }>> {
  const out: Array<{ table: string; count: number }> = [];
  for (const table of OBSERVE_ONLY_TABLES) {
    if (!(await tableExists(pool, table))) continue;
    const columns = await existingColumns(pool, table);
    if (!columns.has('organization_id')) continue;
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM "${table}" WHERE organization_id = $1`,
      [demoOrgId]
    );
    out.push({ table, count: Number(result.rows?.[0]?.count || 0) });
  }
  return out;
}

function buildReport(params: {
  demoOrgId: string;
  quarantineOrgId: string;
  dryRun: boolean;
  host: string;
  database: string;
  candidates: CandidateRow[];
  observeOnly: Array<{ table: string; count: number }>;
}): string {
  const foreign = params.candidates.filter((row) => !row.canonical);
  const canonical = params.candidates.filter((row) => row.canonical);
  const lines: string[] = [];

  lines.push('# FIN-005 — Finance demo coherence report');
  lines.push('');
  lines.push(`- Generated: \`${new Date().toISOString()}\``);
  lines.push(`- Mode: \`${params.dryRun ? 'dry-run' : 'write'}\``);
  lines.push(`- Host: \`${params.host}\``);
  lines.push(`- Database: \`${params.database}\``);
  lines.push(`- Demo organization: \`${params.demoOrgId}\``);
  lines.push(`- Quarantine organization: \`${params.quarantineOrgId}\``);
  lines.push('');

  lines.push('## Canonical Atelier rows (KEPT — never touched)');
  lines.push('');
  if (canonical.length === 0) {
    lines.push(
      '> **None.** The canonical Atelier Finance fixture is not materialized in this tenant yet. Run the demo seed BEFORE quarantining, otherwise Finance is left empty.'
    );
  } else {
    for (const row of canonical) {
      lines.push(`- \`${row.table}\` · \`${row.id}\` — ${row.displayName}`);
    }
  }
  lines.push('');

  lines.push('## Foreign rows (candidates for quarantine)');
  lines.push('');
  if (foreign.length === 0) {
    lines.push('> None. The demo tenant contains only canonical Atelier Finance rows.');
  } else {
    lines.push('| table | id | name | flags |');
    lines.push('| --- | --- | --- | --- |');
    for (const row of foreign) {
      lines.push(
        `| \`${row.table}\` | \`${row.id}\` | ${row.displayName} | ${
          row.flags.length ? row.flags.join(', ') : '—'
        } |`
      );
    }
  }
  lines.push('');

  if (params.observeOnly.length) {
    lines.push('## Observed, NOT written by this script');
    lines.push('');
    for (const entry of params.observeOnly) {
      lines.push(`- \`${entry.table}\`: ${entry.count} row(s) in the demo tenant`);
    }
    lines.push('');
  }

  lines.push('## Validation queries (run before and after)');
  lines.push('');
  lines.push('```sql');
  // The report tells a human to paste these into psql, so any argument-derived
  // value must be SQL-escaped even though this script never executes them.
  const demoLiteral = sqlLiteral(params.demoOrgId);
  const quarantineLiteral = sqlLiteral(params.quarantineOrgId);
  for (const spec of SCOPED_TABLES) {
    lines.push(
      `SELECT '${spec.table}' AS table_name, COUNT(*) AS rows_in_demo,\n` +
        `       COUNT(*) FILTER (WHERE id LIKE ${demoLiteral} || '--%') AS canonical_rows\n` +
        `  FROM "${spec.table}" WHERE organization_id = ${demoLiteral};`
    );
  }
  lines.push('```');
  lines.push('');

  lines.push('## Rollback');
  lines.push('');
  lines.push(
    'Re-run this script with `--rollback <manifest.json>` (the manifest written by the write run), or apply the reverse UPDATE directly:'
  );
  lines.push('');
  lines.push('```sql');
  lines.push(
    `-- per table, restoring only the ids listed in the manifest\nUPDATE "financial_models" SET organization_id = ${demoLiteral}\n WHERE organization_id = ${quarantineLiteral} AND id = ANY($1);`
  );
  lines.push('```');

  return lines.join('\n');
}

async function ensureQuarantineOrganization(
  client: pg.PoolClient,
  quarantineOrgId: string
): Promise<void> {
  // `financial_statements.organization_id` and `financial_analyses.organization_id`
  // are FK-constrained to `organizations`, so the quarantine tenant must exist as
  // a real (inactive, empty) row. It is additive and reversible.
  const columns = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'organizations'`
  );
  const present = new Set((columns.rows || []).map((row) => String(row.column_name)));

  const insertColumns = ['id'];
  const values: unknown[] = [quarantineOrgId];
  if (present.has('name')) {
    insertColumns.push('name');
    values.push('FIN-005 quarantine (foreign Finance records)');
  }
  if (present.has('slug')) {
    insertColumns.push('slug');
    values.push(quarantineOrgId);
  }
  // Set the lifecycle columns EXPLICITLY. Schema defaults would make this an
  // `active` / `TRIAL` organization, so it would be counted as a live tenant in
  // super-admin listings. It holds no users and no memberships, so it grants
  // nobody access either way — but it must not read as a customer org.
  if (present.has('organization_type')) {
    insertColumns.push('organization_type');
    values.push('DEMO');
  }
  if (present.has('status')) {
    insertColumns.push('status');
    values.push('inactive');
  }
  if (present.has('is_active')) {
    insertColumns.push('is_active');
    values.push(false);
  }

  await client.query(
    `INSERT INTO organizations (${insertColumns.map((c) => `"${c}"`).join(', ')})
     VALUES (${insertColumns.map((_, i) => `$${i + 1}`).join(', ')})
     ON CONFLICT (id) DO NOTHING`,
    values
  );
}

async function runQuarantine(
  pool: pg.Pool,
  params: { demoOrgId: string; quarantineOrgId: string; foreign: CandidateRow[] }
): Promise<ManifestEntry[]> {
  const manifest: ManifestEntry[] = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureQuarantineOrganization(client, params.quarantineOrgId);

    for (const spec of SCOPED_TABLES) {
      const ids = params.foreign.filter((row) => row.table === spec.table).map((row) => row.id);
      if (ids.length === 0) continue;

      // Read the pack link BEFORE the update: Postgres `RETURNING` yields the
      // NEW row, so it would hand back the NULL we are about to write and the
      // rollback would have nothing to restore.
      const priorPackLinks = new Map<string, string | null>();
      if (clearsPackLink(spec.table)) {
        const prior = await client.query(
          `SELECT id::text AS id, statement_pack_id::text AS statement_pack_id
           FROM "${spec.table}" WHERE id = ANY($1::text[])`,
          [ids]
        );
        for (const row of prior.rows || []) {
          priorPackLinks.set(String(row.id), row.statement_pack_id ?? null);
        }
      }

      const result = await client.query(
        `UPDATE "${spec.table}"
         SET organization_id = $1${clearsPackLink(spec.table) ? ', statement_pack_id = NULL' : ''}
         WHERE organization_id = $2
           AND id = ANY($3::text[])
           -- Canonical rows can never be moved. ESCAPE '!' so an org id
           -- containing `_` or `%` cannot widen or narrow the pattern.
           AND id NOT LIKE $4 ESCAPE '!'
         RETURNING id::text AS id`,
        [params.quarantineOrgId, params.demoOrgId, ids, `${escapeLike(params.demoOrgId)}--%`]
      );

      // Belt and braces: the `NOT LIKE` guard means a canonical row can never be
      // moved even if the caller hand-edited the candidate list.
      if ((result.rowCount ?? 0) !== ids.length) {
        throw new Error(
          `[${LABEL}] ${spec.table}: expected to quarantine ${ids.length} row(s), updated ${result.rowCount}. Rolled back.`
        );
      }

      for (const row of result.rows || []) {
        const candidate = params.foreign.find(
          (item) => item.table === spec.table && item.id === String(row.id)
        );
        manifest.push({
          table: spec.table,
          id: String(row.id),
          fromOrganizationId: params.demoOrgId,
          toOrganizationId: params.quarantineOrgId,
          displayName: candidate?.displayName ?? String(row.id),
          ...(clearsPackLink(spec.table)
            ? { statementPackId: priorPackLinks.get(String(row.id)) ?? null }
            : {}),
        });
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return manifest;
}

/**
 * Restore quarantined rows from a manifest.
 *
 * SECURITY (review 2026-08-01): a manifest is a FILE, therefore untrusted
 * input. An earlier version took `fromOrganizationId`/`toOrganizationId`
 * straight from the entries, which meant a hand-edited or stale manifest could
 * move ANY row in the scoped tables between ANY two organizations — with no
 * demo-org check, no canonical guard and no target verification. Every guard the
 * quarantine path has is now enforced here too:
 *
 * - the manifest header (not the entries) supplies the org pair, and every
 *   entry must match it exactly;
 * - the manifest's host/database must match the connected target, so a demo
 *   manifest cannot be replayed against another database;
 * - the destination must pass the same demo-org gate as the forward path;
 * - the restore is all-or-nothing: a partial match rolls the transaction back
 *   instead of reporting success.
 */
async function runRollback(
  pool: pg.Pool,
  manifestPath: string,
  target: { host: string; database: string },
  allowForeignOrg: boolean
): Promise<number> {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as {
    demoOrgId?: string;
    quarantineOrgId?: string;
    host?: string;
    database?: string;
    entries?: ManifestEntry[];
  };
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  if (entries.length === 0) {
    console.log(`[${LABEL}] Manifest contains no entries — nothing to roll back.`);
    return 0;
  }

  const demoOrgId = String(manifest.demoOrgId || '').trim();
  const quarantineOrgId = String(manifest.quarantineOrgId || '').trim();
  if (!demoOrgId || !quarantineOrgId) {
    throw new Error(`[${LABEL}] Manifest is missing demoOrgId/quarantineOrgId — refusing to run.`);
  }
  if (!isDemoOrgId(demoOrgId) && !allowForeignOrg) {
    throw new Error(
      `[${LABEL}] Manifest restores into "${demoOrgId}", which is not the configured demo organization. Pass --force-org if this is intentional.`
    );
  }
  if (manifest.host && manifest.host !== target.host) {
    throw new Error(
      `[${LABEL}] Manifest was produced against host "${manifest.host}" but the target is "${target.host}". Refusing to replay across databases.`
    );
  }
  if (manifest.database && manifest.database !== target.database) {
    throw new Error(
      `[${LABEL}] Manifest was produced against database "${manifest.database}" but the target is "${target.database}". Refusing to replay across databases.`
    );
  }

  const knownTables = new Set(SCOPED_TABLES.map((spec) => spec.table));
  for (const entry of entries) {
    if (!knownTables.has(entry.table)) {
      throw new Error(`[${LABEL}] Manifest references unknown table "${entry.table}".`);
    }
    if (entry.fromOrganizationId !== demoOrgId || entry.toOrganizationId !== quarantineOrgId) {
      throw new Error(
        `[${LABEL}] Manifest entry "${entry.id}" declares an organization pair that differs from the manifest header. Refusing to run.`
      );
    }
  }

  const client = await pool.connect();
  let restored = 0;
  try {
    await client.query('BEGIN');
    for (const spec of SCOPED_TABLES) {
      const rows = entries.filter((entry) => entry.table === spec.table);
      if (rows.length === 0) continue;
      const result = await client.query(
        `UPDATE "${spec.table}"
         SET organization_id = $1
         WHERE id = ANY($2::text[]) AND organization_id = $3`,
        [demoOrgId, rows.map((row) => row.id), quarantineOrgId]
      );
      restored += result.rowCount ?? 0;

      // Restore the pack link that quarantine cleared, row by row (each row had
      // its own prior value).
      if (clearsPackLink(spec.table)) {
        for (const entry of rows) {
          if (entry.statementPackId === undefined) continue;
          await client.query(
            `UPDATE "${spec.table}" SET statement_pack_id = $1 WHERE id = $2 AND organization_id = $3`,
            [entry.statementPackId, entry.id, demoOrgId]
          );
        }
      }
    }
    if (restored !== entries.length) {
      throw new Error(
        `[${LABEL}] Expected to restore ${entries.length} row(s) but matched ${restored}. The manifest no longer describes the database. Rolled back.`
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return restored;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.write !== 'true' && !args.rollback;
  const demoOrgId = String(args['demo-org-id'] || resolveDemoOrgId()).trim();
  const quarantineOrgId = String(
    args['quarantine-org-id'] || `${demoOrgId}-fin005-quarantine`
  ).trim();

  if (!demoOrgId) throw new Error(`[${LABEL}] Missing demo organization id.`);
  if (demoOrgId === quarantineOrgId) {
    throw new Error(`[${LABEL}] Demo and quarantine organizations must differ.`);
  }
  if (!isDemoOrgId(demoOrgId) && args['force-org'] !== 'true') {
    throw new Error(
      `[${LABEL}] "${demoOrgId}" is not the configured demo organization. This script only cleans the demo tenant. Pass --force-org if this is intentional.`
    );
  }

  const target = resolveScriptDatabaseTarget({
    label: LABEL,
    databaseUrl: args['database-url'] || process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
    requireExplicitTarget: true,
  });
  logSelectedDatabaseTarget(LABEL, target);

  const pool = new pg.Pool({ connectionString: target.connectionString });

  try {
    await assertTargetIsDemoTenant(pool, demoOrgId, args['force-org'] === 'true');

    if (args.rollback) {
      requireConfirmation(CONFIRM_ENV, CONFIRM_VALUE, LABEL);
      const restored = await runRollback(
        pool,
        String(args.rollback),
        { host: target.host, database: target.database },
        args['force-org'] === 'true'
      );
      console.log(`✅ Rollback complete — ${restored} row(s) returned to the demo tenant.`);
      return;
    }

    const candidates = await collectCandidates(pool, demoOrgId);
    const observeOnly = await observeOnlyCounts(pool, demoOrgId);
    const foreign = candidates.filter((row) => !row.canonical);

    const reportPath = path.join(
      exportsDir(),
      `fin005-finance-demo-${dryRun ? 'dry-run' : 'write'}-${stamp()}.md`
    );
    fs.writeFileSync(
      reportPath,
      buildReport({
        demoOrgId,
        quarantineOrgId,
        dryRun,
        host: target.host,
        database: target.database,
        candidates,
        observeOnly,
      }),
      'utf8'
    );

    console.log(
      `[${LABEL}] demo tenant "${demoOrgId}": ${candidates.length} Finance row(s), ${foreign.length} foreign.`
    );
    console.log(`- report: ${reportPath}`);

    if (dryRun) {
      console.log('✅ Dry run complete. Nothing was modified.');
      console.log(
        `   Review the report, then re-run with --write and ${CONFIRM_ENV}=${CONFIRM_VALUE}.`
      );
      return;
    }

    if (foreign.length === 0) {
      console.log('✅ Nothing to quarantine — the demo tenant is already coherent.');
      return;
    }

    requireConfirmation(CONFIRM_ENV, CONFIRM_VALUE, LABEL);

    // Say out loud what the write does beyond moving rows: it creates a real
    // (inactive, empty) organization row, which will appear in super-admin org
    // listings until somebody removes it.
    console.log(
      `[${LABEL}] Write mode. This will:\n` +
        `  - create organization "${quarantineOrgId}" if absent (inactive, type DEMO, no users);\n` +
        `  - re-point ${foreign.length} Finance row(s) from "${demoOrgId}" to it;\n` +
        `  - clear statement_pack_id on quarantined statements (recorded for rollback);\n` +
        `  - DELETE nothing.`
    );

    const manifestPath = path.join(exportsDir(), `fin005-finance-demo-manifest-${stamp()}.json`);
    // Written BEFORE the transaction commits so a crash mid-write still leaves a
    // complete rollback plan on disk.
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          label: LABEL,
          demoOrgId,
          quarantineOrgId,
          host: target.host,
          database: target.database,
          plannedEntries: foreign.map((row) => ({
            table: row.table,
            id: row.id,
            fromOrganizationId: demoOrgId,
            toOrganizationId: quarantineOrgId,
            displayName: row.displayName,
          })),
          entries: [] as ManifestEntry[],
        },
        null,
        2
      ),
      'utf8'
    );

    const entries = await runQuarantine(pool, { demoOrgId, quarantineOrgId, foreign });

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          label: LABEL,
          demoOrgId,
          quarantineOrgId,
          host: target.host,
          database: target.database,
          completedAt: new Date().toISOString(),
          entries,
        },
        null,
        2
      ),
      'utf8'
    );

    console.log(`✅ Quarantined ${entries.length} foreign Finance row(s). Nothing was deleted.`);
    console.log(`- manifest (rollback plan): ${manifestPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    `❌ ${LABEL} failed:`,
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
