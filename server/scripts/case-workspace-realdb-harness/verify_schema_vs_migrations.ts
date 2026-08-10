#!/usr/bin/env tsx
/**
 * Case Workspace — schema verification (Task 3 of the real-DB harness).
 *
 * What this does:
 *   1. Parses the 11 `server/migrations/20260809_case_workspace_*.sql` files
 *      with a narrow regex-based extractor (NOT a real SQL parser) to list
 *      every `CREATE TABLE IF NOT EXISTS <name> (...)` block each one
 *      declares, plus the column names inside each block and any
 *      PRIMARY KEY / FOREIGN KEY·REFERENCES / UNIQUE constraint lines.
 *   2. Queries `information_schema.tables` / `.columns` / `.table_constraints`
 *      / `.key_column_usage` directly against DATABASE_URL for every table
 *      name found in step 1.
 *   3. Cross-checks: every column/table the migration files declare must be
 *      present in the live catalog; reports anything declared-but-missing
 *      or present-but-undeclared (the latter is expected/OK — other
 *      migrations may also touch these tables — but is surfaced for
 *      visibility, not treated as a failure).
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@host:port/db \
 *     npx tsx server/scripts/case-workspace-realdb-harness/verify_schema_vs_migrations.ts
 *
 * This script only ever runs read-only SELECTs against information_schema.
 * It never writes to the target database.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'server/migrations');

const CASE_WORKSPACE_FILES = [
  '20260809_case_workspace_case_core.sql',
  '20260809_case_workspace_case_plan_version.sql',
  '20260809_case_workspace_capability_registry.sql',
  '20260809_case_workspace_run_binding.sql',
  '20260809_case_workspace_proposals_approvals.sql',
  '20260809_case_workspace_wait_subscription.sql',
  '20260809_case_workspace_history_value.sql',
  '20260809_case_workspace_plays.sql',
  '20260809_case_workspace_artifact_links.sql',
  '20260809_case_workspace_execution_graph.sql',
  '20260809_case_workspace_migration_readiness.sql',
];

interface DeclaredTable {
  file: string;
  table: string;
  columns: string[];
  primaryKey: string[] | null;
  foreignKeys: { columns: string[]; refTable: string }[];
  uniques: string[][];
}

/** Extract balanced-paren `CREATE TABLE IF NOT EXISTS name ( ... );` blocks from raw SQL text. */
function extractCreateTableBlocks(sql: string, file: string): DeclaredTable[] {
  const out: DeclaredTable[] = [];
  const re = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1];
    const startParen = re.lastIndex - 1; // index of the opening '('
    let depth = 0;
    let i = startParen;
    for (; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    // Strip `-- ...` line comments from the WHOLE body before splitting on
    // top-level commas. Splitting first and stripping per-clause after (the
    // original approach here) is wrong: prose inside a comment can itself
    // contain a comma (e.g. "-- per V8, never rewritten"), and a raw comma
    // inside not-yet-stripped comment text sits at paren-depth 0 just like a
    // real column separator, so splitTopLevel would cut the clause there and
    // manufacture a fake "column" out of a comment word.
    const bodyNoComments = sql
      .slice(startParen + 1, i)
      .replace(/--.*$/gm, '');
    out.push({
      file,
      table,
      columns: extractColumnNames(bodyNoComments),
      primaryKey: extractPrimaryKey(bodyNoComments),
      foreignKeys: extractForeignKeys(bodyNoComments),
      uniques: extractUniques(bodyNoComments),
    });
    re.lastIndex = i;
  }
  return out;
}

/** Split a CREATE TABLE body into top-level comma-separated clauses (respecting nested parens). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

const CLAUSE_KEYWORDS = new Set([
  'PRIMARY',
  'FOREIGN',
  'UNIQUE',
  'CHECK',
  'CONSTRAINT',
]);

function extractColumnNames(body: string): string[] {
  const clauses = splitTopLevel(body);
  const cols: string[] = [];
  for (const clause of clauses) {
    const stripped = clause.trim();
    if (!stripped) continue;
    const firstWord = stripped.split(/\s+/)[0].toUpperCase();
    if (CLAUSE_KEYWORDS.has(firstWord)) continue;
    const nameMatch = stripped.match(/^([a-zA-Z0-9_]+)\s/);
    if (nameMatch) cols.push(nameMatch[1]);
  }
  return cols;
}

function extractPrimaryKey(body: string): string[] | null {
  // Table-level: PRIMARY KEY (col1, col2)
  const tableLevel = body.match(/PRIMARY KEY\s*\(([^)]+)\)/i);
  if (tableLevel) {
    return tableLevel[1].split(',').map((s) => s.trim());
  }
  // Column-level: `col_name TYPE ... PRIMARY KEY`
  const clauses = splitTopLevel(body);
  for (const clause of clauses) {
    const stripped = clause.trim();
    if (/\bPRIMARY KEY\b/i.test(stripped) && !/^PRIMARY\b/i.test(stripped)) {
      const nameMatch = stripped.match(/^([a-zA-Z0-9_]+)\s/);
      if (nameMatch) return [nameMatch[1]];
    }
  }
  return null;
}

function extractForeignKeys(body: string): { columns: string[]; refTable: string }[] {
  const out: { columns: string[]; refTable: string }[] = [];
  const clauses = splitTopLevel(body);
  for (const clause of clauses) {
    const stripped = clause.trim();
    // Table-level: FOREIGN KEY (col) REFERENCES table(col)
    const tableLevel = stripped.match(
      /^FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+([a-zA-Z0-9_]+)/i
    );
    if (tableLevel) {
      out.push({
        columns: tableLevel[1].split(',').map((s) => s.trim()),
        refTable: tableLevel[2],
      });
      continue;
    }
    // Column-level: col_name TYPE ... REFERENCES table(col)
    const colLevel = stripped.match(/^([a-zA-Z0-9_]+)\s[\s\S]*?REFERENCES\s+([a-zA-Z0-9_]+)/i);
    if (colLevel && !CLAUSE_KEYWORDS.has(colLevel[1].toUpperCase())) {
      out.push({ columns: [colLevel[1]], refTable: colLevel[2] });
    }
  }
  return out;
}

function extractUniques(body: string): string[][] {
  const out: string[][] = [];
  const clauses = splitTopLevel(body);
  for (const clause of clauses) {
    const stripped = clause.trim();
    // Table-level, unnamed: UNIQUE (col1, col2)
    const tableLevel = stripped.match(/^UNIQUE\s*\(([^)]+)\)/i);
    if (tableLevel) {
      out.push(tableLevel[1].split(',').map((s) => s.trim()));
      continue;
    }
    // Table-level, named: CONSTRAINT some_name UNIQUE (col1, col2)
    const namedConstraint = stripped.match(/^CONSTRAINT\s+[a-zA-Z0-9_]+\s+UNIQUE\s*\(([^)]+)\)/i);
    if (namedConstraint) {
      out.push(namedConstraint[1].split(',').map((s) => s.trim()));
      continue;
    }
    // Column-level: col_name TYPE ... UNIQUE
    if (/\bUNIQUE\b/i.test(stripped) && !/^UNIQUE\b/i.test(stripped) && !/^CONSTRAINT\b/i.test(stripped)) {
      const nameMatch = stripped.match(/^([a-zA-Z0-9_]+)\s/);
      if (nameMatch) out.push([nameMatch[1]]);
    }
  }
  return out;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  console.log(`Target database: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log('');

  // -------------------------------------------------------------------
  // Step 1 — parse declared tables from the 11 migration files.
  // -------------------------------------------------------------------
  const declared: DeclaredTable[] = [];
  for (const file of CASE_WORKSPACE_FILES) {
    const filepath = path.join(MIGRATIONS_DIR, file);
    if (!fs.existsSync(filepath)) {
      console.error(`MISSING MIGRATION FILE: ${file}`);
      process.exit(1);
    }
    const sql = fs.readFileSync(filepath, 'utf-8');
    declared.push(...extractCreateTableBlocks(sql, file));
  }

  console.log(`Parsed ${declared.length} CREATE TABLE declarations from ${CASE_WORKSPACE_FILES.length} migration files:`);
  for (const d of declared) {
    console.log(`  - ${d.table}  (${d.columns.length} columns, ${d.file})`);
  }
  console.log('');

  // -------------------------------------------------------------------
  // Step 2 — query the live catalog for each declared table.
  // -------------------------------------------------------------------
  const pool = new Pool({ connectionString, max: 4 });
  let exitCode = 0;

  try {
    for (const d of declared) {
      console.log(`=== ${d.table} (declared in ${d.file}) ===`);

      const existsRes = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1`,
        [d.table]
      );
      const exists = Number(existsRes.rows[0]?.n ?? 0) > 0;
      if (!exists) {
        console.log(`  TABLE MISSING FROM information_schema.tables`);
        exitCode = 1;
        console.log('');
        continue;
      }
      console.log('  table present: yes');

      const colsRes = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position`,
        [d.table]
      );
      const liveColumns = new Set(colsRes.rows.map((r) => String(r.column_name)));

      const missingCols = d.columns.filter((c) => !liveColumns.has(c));
      const extraCols = [...liveColumns].filter((c) => !d.columns.includes(c));

      console.log(`  declared columns: ${d.columns.length}  live columns: ${liveColumns.size}`);
      if (missingCols.length) {
        console.log(`  MISSING (declared, not in live catalog): ${missingCols.join(', ')}`);
        exitCode = 1;
      } else {
        console.log('  all declared columns present: yes');
      }
      if (extraCols.length) {
        console.log(`  extra live columns not matched by this file's regex parse (informational, not a failure — may be added by other clauses/files): ${extraCols.join(', ')}`);
      }

      // Constraints: primary key
      if (d.primaryKey) {
        const pkRes = await pool.query(
          `SELECT kcu.column_name
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'`,
          [d.table]
        );
        const livePk = new Set(pkRes.rows.map((r) => String(r.column_name)));
        const declaredPk = new Set(d.primaryKey);
        const pkMatches =
          livePk.size === declaredPk.size && [...declaredPk].every((c) => livePk.has(c));
        console.log(
          `  primary key declared=(${d.primaryKey.join(',')}) live=(${[...livePk].join(',')}) match=${pkMatches ? 'yes' : 'NO'}`
        );
        if (!pkMatches) exitCode = 1;
      }

      // Constraints: foreign keys
      if (d.foreignKeys.length) {
        const fkRes = await pool.query(
          `SELECT
              kcu.column_name,
              ccu.table_name AS foreign_table_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
           WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name = $1`,
          [d.table]
        );
        const liveFkPairs = new Set(
          fkRes.rows.map((r) => `${r.column_name}->${r.foreign_table_name}`)
        );
        for (const fk of d.foreignKeys) {
          for (const col of fk.columns) {
            const key = `${col}->${fk.refTable}`;
            const ok = liveFkPairs.has(key);
            console.log(`  FK ${key}: ${ok ? 'present' : 'MISSING'}`);
            if (!ok) exitCode = 1;
          }
        }
      }

      // Constraints: unique
      // NOTE: uses string_agg (not array_agg) — array_agg's result came back
      // from `pg` as the raw "{a,b}" literal string rather than a parsed JS
      // array in this environment (observed empirically against this same
      // container: `SELECT ARRAY['a','b']::text[]` parses fine, but
      // array_agg(...)'s aggregate-derived array type did not), which broke
      // every UNIQUE-constraint comparison below. string_agg avoids the
      // ambiguity entirely by returning a plain string to split ourselves.
      if (d.uniques.length) {
        const uqRes = await pool.query(
          `SELECT tc.constraint_name,
                  string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS cols
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'UNIQUE'
            GROUP BY tc.constraint_name`,
          [d.table]
        );
        const liveUniqueSets = uqRes.rows.map(
          (r) => new Set<string>(String(r.cols).split(','))
        );
        for (const uq of d.uniques) {
          const uqSet = new Set(uq);
          const ok = liveUniqueSets.some(
            (s) => s.size === uqSet.size && [...uqSet].every((c) => s.has(c))
          );
          console.log(`  UNIQUE(${uq.join(',')}): ${ok ? 'present' : 'MISSING'}`);
          if (!ok) exitCode = 1;
        }
      }

      console.log('');
    }

    console.log(exitCode === 0 ? 'RESULT: PASS — every declared table/column/constraint checked was found live.' : 'RESULT: FAIL — see MISSING lines above.');
  } finally {
    await pool.end().catch(() => undefined);
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('verify_schema_vs_migrations.ts crashed:', err);
  process.exit(1);
});
