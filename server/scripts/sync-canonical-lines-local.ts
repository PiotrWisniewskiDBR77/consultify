#!/usr/bin/env tsx
/**
 * Syncs canonical line definitions from financeCanonicalRegistry to the local PostgreSQL database.
 * Run this before importing statements to ensure FK constraints on financial_statement_lines are satisfied.
 */
import pg from 'pg';
import { resolveReachableDatabaseUrl } from '../src/config/databaseTargetResolver.js';
import { getCanonicalLineDefinitions, getCanonicalLineVersionTag } from '../src/services/financeCanonicalRegistry.js';

const DB_URL = (() => {
  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  if (!resolved.databaseUrl) {
    throw new Error('DATABASE_URL or DATABASE_PUBLIC_URL is required.');
  }
  return resolved.databaseUrl;
})();

async function main(): Promise<void> {
  const client = new pg.Client(DB_URL);
  await client.connect();
  console.log('Connected to', DB_URL.replace(/:[^@]+@/, ':***@'));

  const existing = await client.query<{ cnt: string }>('SELECT COUNT(*)::int as cnt FROM financial_statement_lines');
  console.log(`Current canonical lines in DB: ${existing.rows[0].cnt}`);

  const definitions = getCanonicalLineDefinitions();
  console.log(`Definitions in registry: ${definitions.length}`);

  const cols = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'financial_statement_lines' ORDER BY ordinal_position`,
  );
  const colSet = new Set(cols.rows.map((r) => r.column_name));
  const hasExtendedSchema = colSet.has('line_name_en');
  console.log(`Schema type: ${hasExtendedSchema ? 'extended' : 'basic'} (columns: ${colSet.size})`);

  let upserted = 0;
  for (const line of definitions) {
    if (hasExtendedSchema) {
      await client.query(
        `INSERT INTO financial_statement_lines (
          id, organization_id, statement_type, line_code, line_name, line_name_en, line_name_pl, parent_line_id,
          sort_order, is_system, aggregation_level, required_level, sign_convention, is_total, is_subtotal,
          is_computed, formula_json, deaggregation_ready, taxonomy_version, is_active
        ) VALUES (
          $1,NULL,$2,$3,$4,$5,$6,$7,
          $8,TRUE,$9,$10,$11,$12,$13,
          $14,$15,$16,$17,TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          statement_type = EXCLUDED.statement_type,
          line_code = EXCLUDED.line_code,
          line_name = EXCLUDED.line_name,
          line_name_en = EXCLUDED.line_name_en,
          line_name_pl = EXCLUDED.line_name_pl,
          parent_line_id = EXCLUDED.parent_line_id,
          sort_order = EXCLUDED.sort_order,
          is_system = TRUE`,
        [
          line.id,
          line.statementType,
          line.code,
          line.labelEn,
          line.labelEn,
          line.labelPl,
          line.parentId || null,
          line.sortOrder,
          line.aggregationLevel,
          line.requiredLevel,
          line.signConvention,
          !!line.isTotal,
          !!line.isSubtotal,
          !!line.isComputed,
          line.formulaJson ? JSON.stringify(line.formulaJson) : null,
          !!line.deaggregationReady,
          getCanonicalLineVersionTag(),
        ],
      );
    } else {
      await client.query(
        `INSERT INTO financial_statement_lines (
          id, organization_id, statement_type, line_code, line_name, line_name_pl, parent_line_id,
          sort_order, is_system
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          statement_type = EXCLUDED.statement_type,
          line_code = EXCLUDED.line_code,
          line_name = EXCLUDED.line_name,
          line_name_pl = EXCLUDED.line_name_pl,
          parent_line_id = EXCLUDED.parent_line_id,
          sort_order = EXCLUDED.sort_order,
          is_system = TRUE`,
        [
          line.id,
          line.statementType,
          line.code,
          line.labelEn,
          line.labelPl,
          line.parentId || null,
          line.sortOrder,
        ],
      );
    }
    upserted++;
  }

  const after = await client.query<{ cnt: string }>('SELECT COUNT(*)::int as cnt FROM financial_statement_lines');
  console.log(`Synced ${upserted} definitions. DB now has ${after.rows[0].cnt} lines.`);

  await client.end();
  console.log('Done.');
}

main().catch((error) => {
  console.error('Failed:', (error as Error).message);
  process.exit(1);
});
