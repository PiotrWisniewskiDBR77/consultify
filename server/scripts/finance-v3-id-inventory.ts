#!/usr/bin/env tsx
/** FIN-001: read-only legacy/v2/v3 identity coverage inventory. */
import { writeFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';

const LEGACY_TABLES = [
  'financial_statement_packs',
  'financial_analyses',
  'financial_models',
  'valuations',
] as const;

type LegacyTable = (typeof LEGACY_TABLES)[number];
type TableState = 'ABSENT' | 'MAPPED' | 'UNRESOLVED' | 'QUARANTINED' | 'DANGLING_ALIAS';

export interface FinanceIdInventoryRow {
  generation: 'legacy';
  table: LegacyTable;
  organizationId: string;
  legacyId: string;
  state: TableState;
  artifactId: string | null;
  businessVersionId: string | null;
  reason: string | null;
}

export interface FinanceIdInventoryReport {
  schemaVersion: 1;
  mode: 'READ_ONLY';
  canonicalGeneration: 'finance_artifacts/finance_business_versions';
  generatedAt: string;
  database: string;
  totals: Record<TableState, number>;
  rows: FinanceIdInventoryRow[];
}

function quoteIdentifier(value: LegacyTable): string {
  // The caller can only supply a member of the closed, compile-time allowlist.
  if (!(LEGACY_TABLES as readonly string[]).includes(value)) throw new Error('table outside FIN-001 allowlist');
  return `"${value}"`;
}

async function tableExists(client: PoolClient, table: LegacyTable): Promise<boolean> {
  const result = await client.query<{ present: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [`public.${table}`]
  );
  return result.rows[0]?.present === true;
}

async function columnExists(client: PoolClient, table: LegacyTable, column: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return result.rowCount === 1;
}

export async function buildFinanceIdInventory(client: PoolClient): Promise<FinanceIdInventoryReport> {
  await client.query('BEGIN READ ONLY');
  try {
    const database = (await client.query<{ name: string }>('SELECT current_database() AS name')).rows[0]?.name ?? 'unknown';
    const rows: FinanceIdInventoryRow[] = [];
    for (const table of LEGACY_TABLES) {
      if (!(await tableExists(client, table))) continue;
      const hasDeletedAt = await columnExists(client, table, 'deleted_at');
      const hasArchivedAt = await columnExists(client, table, 'archived_at');
      const active = [hasDeletedAt ? 'l.deleted_at IS NULL' : '', hasArchivedAt ? 'l.archived_at IS NULL' : '']
        .filter(Boolean)
        .join(' AND ');
      const result = await client.query<{
        organization_id: string; legacy_id: string; mapping_confidence: string | null;
        mapping_reason: string | null; artifact_id: string | null; business_version_id: string | null;
        canonical_present: boolean;
      }>(`
        SELECT l.organization_id::text, l.id::text AS legacy_id,
               a.mapping_confidence, a.mapping_reason, a.artifact_id,
               COALESCE(a.business_version_id, f.current_business_version_id) AS business_version_id,
               f.artifact_id IS NOT NULL AS canonical_present
          FROM ${quoteIdentifier(table)} l
          LEFT JOIN LATERAL (
            SELECT x.* FROM finance_artifact_aliases x
             WHERE x.organization_id = l.organization_id::text
               AND x.legacy_table = $1 AND x.legacy_id = l.id::text
             ORDER BY x.created_at DESC, x.alias_id DESC LIMIT 1
          ) a ON true
          LEFT JOIN finance_artifacts f
            ON f.artifact_id = a.artifact_id AND f.organization_id = l.organization_id::text
          ${active ? `WHERE ${active}` : ''}
         ORDER BY l.organization_id::text, l.id::text`, [table]);
      for (const item of result.rows) {
        const quarantined = item.mapping_confidence === 'QUARANTINE' || item.mapping_confidence === 'EXCLUDE_WITH_REASON';
        const state: TableState = !item.artifact_id
          ? 'UNRESOLVED'
          : quarantined
            ? 'QUARANTINED'
            : item.canonical_present
              ? 'MAPPED'
              : 'DANGLING_ALIAS';
        rows.push({ generation: 'legacy', table, organizationId: item.organization_id,
          legacyId: item.legacy_id, state, artifactId: item.artifact_id,
          businessVersionId: item.business_version_id,
          reason: item.mapping_reason ?? (state === 'UNRESOLVED' ? 'NO_ALIAS' : state === 'DANGLING_ALIAS' ? 'CANONICAL_ARTIFACT_MISSING' : null) });
      }
    }
    const totals = { ABSENT: 0, MAPPED: 0, UNRESOLVED: 0, QUARANTINED: 0, DANGLING_ALIAS: 0 };
    for (const row of rows) totals[row.state] += 1;
    return { schemaVersion: 1, mode: 'READ_ONLY', canonicalGeneration: 'finance_artifacts/finance_business_versions',
      generatedAt: new Date().toISOString(), database, totals, rows };
  } finally {
    await client.query('ROLLBACK');
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required; no database target is inferred');
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='));
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const client = await pool.connect();
    try {
      const report = await buildFinanceIdInventory(client);
      const json = `${JSON.stringify(report, null, 2)}\n`;
      if (outputArg) await writeFile(outputArg.slice('--output='.length), json, { flag: 'wx' });
      else process.stdout.write(json);
      if (report.totals.UNRESOLVED || report.totals.DANGLING_ALIAS) process.exitCode = 1;
    } finally { client.release(); }
  } finally { await pool.end(); }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
