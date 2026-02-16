#!/usr/bin/env tsx
/**
 * Compare SQLite vs Postgres inventory snapshots.
 *
 * Usage:
 *   tsx server/scripts/compare-inventories.ts --sqlite server/exports/inventory-sqlite-....json --postgres server/exports/inventory-postgres-....json
 *
 * Options:
 *   --only <t1,t2,...>  restrict comparison to these tables
 */

import fs from 'fs';

type CountsMode = 'exact' | 'estimate' | 'none';

type TableInventory = {
  table: string;
  rowCount?: number;
  estimatedRowCount?: number;
};

type Inventory = {
  engine: 'sqlite' | 'postgres';
  generatedAt: string;
  countsMode: CountsMode;
  tables: TableInventory[];
};

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

function splitCsv(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readInventory(p: string): Inventory {
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as Inventory;
}

// Avoid crashing when output is piped and the reader closes early (e.g. `| head`)
process.stdout.on('error', (err: any) => {
  if (err?.code === 'EPIPE') process.exit(0);
});

function tableCounts(inv: Inventory): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of inv.tables || []) {
    const name = String(t.table);
    const cnt =
      typeof t.rowCount === 'number'
        ? t.rowCount
        : typeof t.estimatedRowCount === 'number'
          ? t.estimatedRowCount
          : 0;
    m.set(name, cnt);
  }
  return m;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlitePath = args.sqlite;
  const postgresPath = args.postgres;
  if (!sqlitePath || !postgresPath) {
    throw new Error('Provide --sqlite <path> and --postgres <path>');
  }

  const only = new Set(splitCsv(args.only));
  const sqlite = readInventory(sqlitePath);
  const pg = readInventory(postgresPath);

  const s = tableCounts(sqlite);
  const p = tableCounts(pg);

  const tables = new Set<string>([...s.keys(), ...p.keys()]);
  const mismatches: Array<{ table: string; sqlite: number; postgres: number }> = [];
  const missingInPg: string[] = [];
  const missingInSqlite: string[] = [];

  for (const t of [...tables].sort()) {
    if (only.size && !only.has(t)) continue;
    const sc = s.get(t);
    const pc = p.get(t);
    if (sc === undefined) missingInSqlite.push(t);
    else if (pc === undefined) missingInPg.push(t);
    else if (sc !== pc) mismatches.push({ table: t, sqlite: sc, postgres: pc });
  }

  // eslint-disable-next-line no-console
  console.log('=== Inventory compare ===');
  // eslint-disable-next-line no-console
  console.log(`SQLite:   ${sqlitePath}`);
  // eslint-disable-next-line no-console
  console.log(`Postgres: ${postgresPath}`);
  // eslint-disable-next-line no-console
  console.log('');

  if (missingInPg.length) {
    console.log(`Missing in Postgres (${missingInPg.length}):`);
    for (const t of missingInPg.slice(0, 200)) console.log(`- ${t}`);
    if (missingInPg.length > 200) console.log(`... +${missingInPg.length - 200} more`);
    console.log('');
  }
  if (missingInSqlite.length) {
    console.log(`Missing in SQLite (${missingInSqlite.length}):`);
    for (const t of missingInSqlite.slice(0, 200)) console.log(`- ${t}`);
    if (missingInSqlite.length > 200) console.log(`... +${missingInSqlite.length - 200} more`);
    console.log('');
  }
  if (mismatches.length) {
    console.log(`Row-count mismatches (${mismatches.length}):`);
    for (const m of mismatches.slice(0, 200))
      console.log(`- ${m.table}: sqlite=${m.sqlite} postgres=${m.postgres}`);
    if (mismatches.length > 200) console.log(`... +${mismatches.length - 200} more`);
  } else {
    console.log('✅ No row-count mismatches found.');
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Compare failed:', e?.message || e);
  process.exit(1);
});
