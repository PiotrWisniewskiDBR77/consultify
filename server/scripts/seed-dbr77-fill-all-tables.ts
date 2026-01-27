#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unused-vars */
/**
 * DBR77 Full SQLite Seeder (data/dev/consultinity.db)
 *
 * Goal:
 * - Ensure ALL existing tables in the SQLite DB have at least 1 row
 * - Add diverse, app-visible demo data for DBR77 tenant
 * - Verify by printing row counts before/after
 *
 * Safe by default:
 * - Only targets SQLite
 * - Requires SQLITE_PATH that includes `data/dev/consultinity.db` unless FORCE_SEED=true
 * - Never deletes existing data (only inserts into empty tables + adds small extra variety in key tables)
 *
 * Usage:
 *   cd server && DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity.db npx tsx scripts/seed-dbr77-fill-all-tables.ts
 */

import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../src/database/Database.js';

type Row = Record<string, unknown>;

type TableInfo = {
  name: string;
  sql: string | null;
};

type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};

type ForeignKeyInfo = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.dim}  → ${msg}${colors.reset}`),
};

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function safeSqlIdent(name: string) {
  // SQLite identifier quoting
  return `"${String(name).replace(/"/g, '""')}"`;
}

function requireSafeSqlitePath() {
  const dbType = process.env.DB_TYPE || 'sqlite';
  const sqlitePath = process.env.SQLITE_PATH;

  if (dbType !== 'sqlite') {
    throw new Error(`This seeder only supports SQLite. Current DB_TYPE=${dbType}`);
  }
  if (!sqlitePath) {
    throw new Error('SQLITE_PATH is required. Example: SQLITE_PATH=../data/dev/consultinity.db');
  }

  const resolved = path.resolve(process.cwd(), sqlitePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`SQLITE_PATH does not exist: ${resolved}`);
  }

  const looksLikeDev = resolved.includes(`${path.sep}data${path.sep}dev${path.sep}consultinity.db`);
  if (!looksLikeDev && process.env.FORCE_SEED !== 'true') {
    throw new Error(
      `Refusing to seed non-dev DB: ${resolved}\n` +
        `Set FORCE_SEED=true only if you really want to seed this file.`
    );
  }

  return resolved;
}

async function getTables(db: any): Promise<TableInfo[]> {
  const res = await db.query(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    []
  );
  return (res.rows || []) as TableInfo[];
}

async function getRowCount(db: any, table: string): Promise<number> {
  const res = await db.get(`SELECT COUNT(*) as c FROM ${safeSqlIdent(table)}`, []);
  const c = (res && (res.c ?? res.C ?? Object.values(res)[0])) as unknown;
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
}

async function getColumns(db: any, table: string): Promise<ColumnInfo[]> {
  const res = await db.query(`PRAGMA table_info(${safeSqlIdent(table)})`, []);
  return (res.rows || []) as ColumnInfo[];
}

async function getForeignKeys(db: any, table: string): Promise<ForeignKeyInfo[]> {
  const res = await db.query(`PRAGMA foreign_key_list(${safeSqlIdent(table)})`, []);
  return (res.rows || []) as ForeignKeyInfo[];
}

function parseAllowedValuesFromCreateSql(createSql: string | null, colName: string): string[] {
  if (!createSql) return [];
  // Common patterns:
  // - CHECK (status IN ('a','b'))
  // - CHECK ( "status" IN ('a','b') )
  const escaped = colName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`CHECK\\s*\\(\\s*${escaped}\\s+IN\\s*\\(([^\\)]*)\\)\\s*\\)`, 'i'),
    new RegExp(
      `CHECK\\s*\\(\\s*${safeSqlIdent(colName).replace(/"/g, '\\"')}\\s+IN\\s*\\(([^\\)]*)\\)\\s*\\)`,
      'i'
    ),
  ];

  for (const re of patterns) {
    const m = createSql.match(re);
    if (!m?.[1]) continue;
    const inner = m[1];
    const values: string[] = [];
    // Extract quoted strings or bare numbers
    const tokenRe = /'([^']*)'|"([^"]*)"|([0-9]+(?:\.[0-9]+)?)/g;
    let t: RegExpExecArray | null;
    while ((t = tokenRe.exec(inner))) {
      const v = (t[1] ?? t[2] ?? t[3])?.trim();
      if (v) values.push(v);
    }
    return Array.from(new Set(values));
  }
  return [];
}

function guessValue({
  table,
  col,
  createSql,
  anchors,
  fkTargetValue,
}: {
  table: string;
  col: ColumnInfo;
  createSql: string | null;
  anchors: { orgId: string; userId: string; projectId: string };
  fkTargetValue?: unknown;
}) {
  const name = col.name;
  const type = (col.type || '').toLowerCase();

  if (fkTargetValue !== undefined) return fkTargetValue;

  // Anchors by common column naming
  if (name === 'organization_id' || name === 'org_id') return anchors.orgId;
  if (
    [
      'user_id',
      'actor_user_id',
      'owner_user_id',
      'created_by',
      'updated_by',
      'assignee_id',
      'reporter_id',
      'requested_by_id',
      'decision_owner_id',
      'owner_id',
    ].includes(name)
  )
    return anchors.userId;
  if (name === 'project_id') return anchors.projectId;

  // Timestamps / dates
  if (name === 'created_at' || name === 'updated_at' || name === 'ts' || name.endsWith('_ts'))
    return nowIso();
  if (name.endsWith('_at')) return nowIso();
  if (name.endsWith('_date') || name === 'date') return todayIsoDate();

  // IDs
  if (name === 'id') {
    if (type.includes('int') && col.pk === 1) return undefined; // let AUTOINCREMENT handle it
    return uuidv4();
  }
  if (name.endsWith('_id')) return uuidv4();

  // CHECK constraints: try to pick first allowed value
  const allowed = parseAllowedValuesFromCreateSql(createSql, name);
  if (allowed.length > 0) {
    // Prefer "active" if present for status-like columns
    if (name.includes('status')) {
      const active = allowed.find((v) => v.toLowerCase() === 'active');
      if (active) return active;
    }
    return allowed[0];
  }

  // Heuristics by column name
  const lower = name.toLowerCase();
  if (lower.includes('email')) return faker.internet.email().toLowerCase();
  if (lower.includes('first_name')) return faker.person.firstName();
  if (lower.includes('last_name')) return faker.person.lastName();
  if (lower.includes('name')) return faker.company.name();
  if (lower.includes('title')) return faker.lorem.sentence({ min: 3, max: 8 });
  if (lower.includes('description') || lower.includes('summary')) return faker.lorem.paragraph();
  if (lower.includes('url')) return faker.internet.url();
  if (lower.includes('ip')) return faker.internet.ip();
  if (lower.includes('country')) return faker.location.country();
  if (lower.includes('city')) return faker.location.city();
  if (lower.includes('currency')) return faker.finance.currencyCode();
  if (lower.includes('language')) return faker.helpers.arrayElement(['pl', 'en', 'de']);
  if (lower.includes('severity'))
    return faker.helpers.arrayElement(['INFO', 'WARNING', 'CRITICAL']);
  if (lower.includes('priority'))
    return faker.helpers.arrayElement(['low', 'medium', 'high', 'urgent']);
  if (lower.includes('role'))
    return faker.helpers.arrayElement(['USER', 'ADMIN', 'MANAGER', 'CONSULTANT']);
  if (lower.includes('plan')) return faker.helpers.arrayElement(['free', 'pro', 'enterprise']);

  // JSON-ish
  if (
    type.includes('json') ||
    lower.endsWith('_json') ||
    lower.includes('metadata') ||
    lower.endsWith('_data')
  ) {
    return JSON.stringify({ seeded: true, table, column: name, ts: nowIso() });
  }

  // Types
  if (type.includes('bool')) return faker.datatype.boolean() ? 1 : 0;
  if (type.includes('int')) return faker.number.int({ min: 0, max: 1000 });
  if (type.includes('real') || type.includes('float') || type.includes('double'))
    return Number(faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }));

  // Default to text
  return faker.lorem.words({ min: 2, max: 6 });
}

async function getAnyValue(db: any, table: string, col: string): Promise<unknown | undefined> {
  try {
    const res = await db.get(
      `SELECT ${safeSqlIdent(col)} as v FROM ${safeSqlIdent(table)} WHERE ${safeSqlIdent(col)} IS NOT NULL LIMIT 1`,
      []
    );
    return res?.v;
  } catch {
    return undefined;
  }
}

function parseNotNullColumnFromError(msg: string): { table: string; col: string } | null {
  // SQLite: "NOT NULL constraint failed: table.col"
  const m = msg.match(/NOT NULL constraint failed:\s*([^.]+)\.([^\s]+)/i);
  if (!m) return null;
  return { table: m[1], col: m[2] };
}

function parseUniqueColumnFromError(msg: string): { table: string; col: string } | null {
  // SQLite: "UNIQUE constraint failed: table.col"
  const m = msg.match(/UNIQUE constraint failed:\s*([^.]+)\.([^\s]+)/i);
  if (!m) return null;
  return { table: m[1], col: m[2] };
}

async function seedOneRowForTable({
  db,
  table,
  tableSql,
  anchors,
  knownTables,
  columnsCache,
  fkCache,
  inProgress,
  seededTables,
}: {
  db: any;
  table: string;
  tableSql: string | null;
  anchors: { orgId: string; userId: string; projectId: string };
  knownTables: Set<string>;
  columnsCache: Map<string, ColumnInfo[]>;
  fkCache: Map<string, ForeignKeyInfo[]>;
  inProgress: Set<string>;
  seededTables: Set<string>;
}): Promise<{ ok: boolean; error?: string }> {
  // Some schemas contain broken FK references (table no longer exists).
  // If the table is not present in sqlite_master, skip it.
  if (!knownTables.has(table)) return { ok: true };
  if (seededTables.has(table)) return { ok: true };
  if (inProgress.has(table)) return { ok: true }; // avoid infinite loops on cycles
  inProgress.add(table);

  try {
    const existing = await getRowCount(db, table);
    if (existing > 0) {
      seededTables.add(table);
      return { ok: true };
    }

    const cols = columnsCache.get(table) || (await getColumns(db, table));
    columnsCache.set(table, cols);

    const fks = fkCache.get(table) || (await getForeignKeys(db, table));
    fkCache.set(table, fks);

    const fkValueByFromCol = new Map<string, unknown>();
    for (const fk of fks) {
      // Ensure referenced table has at least 1 row and use its first PK/value
      const refTable = fk.table;
      const refCol = fk.to;
      if (!knownTables.has(refTable)) {
        // Broken reference (e.g. access_codes_legacy). Ignore.
        continue;
      }
      const refCount = await getRowCount(db, refTable).catch(() => 0);
      if (refCount === 0) {
        await seedOneRowForTable({
          db,
          table: refTable,
          tableSql: null,
          anchors,
          knownTables,
          columnsCache,
          fkCache,
          inProgress,
          seededTables,
        });
      }
      const v = await getAnyValue(db, refTable, refCol);
      if (v !== undefined) fkValueByFromCol.set(fk.from, v);
    }

    const row: Row = {};
    for (const col of cols) {
      // omit INTEGER PKs to let autoincrement handle it
      if (col.pk === 1 && (col.type || '').toLowerCase().includes('int')) continue;
      // if default exists and nullable, prefer omitting to let default take effect
      if (!col.notnull && col.dflt_value != null) continue;

      const fkTarget = fkValueByFromCol.get(col.name);
      const value = guessValue({
        table,
        col,
        createSql: tableSql,
        anchors,
        fkTargetValue: fkTarget,
      });
      if (value === undefined) continue;
      row[col.name] = value;
    }

    const insert = async (attempt: number) => {
      const colsToInsert = Object.keys(row);
      if (colsToInsert.length === 0) {
        // Best effort: insert default row
        await db.run(`INSERT INTO ${safeSqlIdent(table)} DEFAULT VALUES`, []);
        return;
      }
      const placeholders = colsToInsert.map(() => '?').join(', ');
      const sql = `INSERT INTO ${safeSqlIdent(table)} (${colsToInsert
        .map(safeSqlIdent)
        .join(', ')}) VALUES (${placeholders})`;
      const params = colsToInsert.map((c) => row[c]);
      await db.run(sql, params);
    };

    // Retry loop for constraint errors
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        await insert(attempt);
        seededTables.add(table);
        return { ok: true };
      } catch (e: any) {
        const msg = String(e?.message || e);

        const nn = parseNotNullColumnFromError(msg);
        if (nn?.col && cols.some((c) => c.name === nn.col)) {
          const c = cols.find((x) => x.name === nn.col)!;
          row[nn.col] = guessValue({ table, col: c, createSql: tableSql, anchors });
          continue;
        }

        const uq = parseUniqueColumnFromError(msg);
        if (uq?.col && cols.some((c) => c.name === uq.col)) {
          const c = cols.find((x) => x.name === uq.col)!;
          // regenerate
          row[uq.col] =
            guessValue({ table, col: c, createSql: tableSql, anchors }) +
            '-' +
            faker.string.nanoid();
          continue;
        }

        if (msg.toLowerCase().includes('foreign key constraint failed')) {
          // Ensure all FK cols are set (if possible) and retry
          for (const fk of fks) {
            if (row[fk.from] != null) continue;
            const v = await getAnyValue(db, fk.table, fk.to);
            if (v !== undefined) row[fk.from] = v;
          }
          continue;
        }

        if (msg.toLowerCase().includes('check constraint failed')) {
          // Try to fix common "status"/"type"/boolean checks by setting allowed values
          for (const c of cols) {
            if (row[c.name] != null) continue;
            const allowed = parseAllowedValuesFromCreateSql(tableSql, c.name);
            if (allowed.length > 0) {
              row[c.name] = allowed[0];
            }
          }
          // For boolean-ish columns stored as INTEGER
          for (const c of cols) {
            const lower = c.name.toLowerCase();
            if (lower.startsWith('is_') || lower.startsWith('has_') || lower.endsWith('_flag')) {
              row[c.name] = 0;
            }
          }
          continue;
        }

        // Last resort: try DEFAULT VALUES if allowed
        if (attempt >= 8) {
          try {
            await db.run(`INSERT INTO ${safeSqlIdent(table)} DEFAULT VALUES`, []);
            seededTables.add(table);
            return { ok: true };
          } catch {
            // fallthrough to error
          }
        }

        if (attempt === 10) {
          return { ok: false, error: msg };
        }
      }
    }

    return { ok: false, error: 'Unknown error' };
  } finally {
    inProgress.delete(table);
  }
}

async function seedKeyDbr77Data(
  db: any,
  anchors: { orgId: string; userId: string; projectId: string }
) {
  // Notifications often drive UI — ensure a diverse set for the DBR77 org.
  try {
    const nCount = await getRowCount(db, 'notifications');
    if (nCount < 10) {
      const types = [
        'TASK_ASSIGNED',
        'TASK_OVERDUE',
        'DECISION_REQUIRED',
        'AI_RECOMMENDATION',
        'GATE_PENDING_APPROVAL',
        'MILESTONE_COMPLETED',
        'RISK_DETECTED',
      ];
      for (let i = 0; i < 12; i += 1) {
        await db.run(
          `INSERT INTO notifications (id, user_id, organization_id, type, title, message, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
          [
            uuidv4(),
            anchors.userId,
            anchors.orgId,
            faker.helpers.arrayElement(types),
            faker.lorem.sentence({ min: 3, max: 7 }),
            faker.lorem.paragraph(),
            faker.datatype.boolean() ? 1 : 0,
            `-${faker.number.int({ min: 1, max: 240 })} hours`,
          ]
        );
      }
      log.step('Added DBR77 notifications diversity');
    }
  } catch {
    // table shape varies across versions, ignore
  }

  // Assessments: ensure multiple framework types & statuses exist for the DBR77 org.
  try {
    const aCount = await db.get(`SELECT COUNT(*) as c FROM assessments WHERE organization_id = ?`, [
      anchors.orgId,
    ]);
    const c = Number(aCount?.c || 0);
    if (c < 8) {
      const frameworks = ['DRD', 'ADMA', 'CMMI', 'LEAN', 'SIRI'];
      const statuses = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'COMPLETED'];
      for (let i = 0; i < 10; i += 1) {
        const framework_type = faker.helpers.arrayElement(frameworks);
        const status = faker.helpers.arrayElement(statuses);
        const progress = status === 'COMPLETED' ? 100 : faker.number.int({ min: 5, max: 95 });
        const overallScore = Number(faker.number.float({ min: 1.8, max: 4.6, fractionDigits: 1 }));
        await db.run(
          `INSERT INTO assessments (id, organization_id, name, description, status, created_at, updated_at, framework_type, framework_data)
           VALUES (?, ?, ?, ?, ?, datetime('now', ?), datetime('now', ?), ?, ?)`,
          [
            uuidv4(),
            anchors.orgId,
            `${framework_type} • ${faker.company.buzzPhrase()}`,
            faker.lorem.paragraph(),
            status,
            `-${faker.number.int({ min: 20, max: 400 })} days`,
            `-${faker.number.int({ min: 0, max: 30 })} days`,
            framework_type,
            JSON.stringify({ progress, overallScore, seeded: true }),
          ]
        );
      }
      log.step('Added DBR77 assessments diversity');
    }
  } catch {
    // ignore if schema differs
  }
}

async function main() {
  console.log('\n🧩 DBR77: Fill All Tables Seeder (SQLite)\n');

  const resolvedDb = requireSafeSqlitePath();
  log.info(`Target DB: ${resolvedDb}`);

  // Use the global proxy so .get/.run/.all are Promise-wrapped for SQLite callbacks
  const db = getDatabase();

  // SQLite-specific PRAGMAs (best effort)
  try {
    await db.run('PRAGMA foreign_keys = ON');
  } catch {
    // ignore
  }

  // Determine DBR77 anchors
  const piotr = await db.get(`SELECT id, organization_id FROM users WHERE email = ? LIMIT 1`, [
    'piotr.wisniewski@dbr77.com',
  ]);
  const anyUser = piotr || (await db.get(`SELECT id, organization_id FROM users LIMIT 1`, []));
  if (!anyUser) {
    throw new Error(
      'No users found. This seeder expects an initialized DB with at least one user.'
    );
  }

  const orgId = anyUser.organization_id;
  const userId = anyUser.id;

  let project = await db.get(
    `SELECT id FROM projects WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
    [orgId]
  );
  if (!project) {
    const projectId = 'project-dbr77-seeded';
    await db.run(
      `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now', '-30 days'), datetime('now'))`,
      [projectId, orgId, 'DBR77 Seeded Project', 'active']
    );
    project = { id: projectId };
  }

  const anchors = { orgId, userId, projectId: project.id };
  log.info(`Anchors: org=${anchors.orgId}, user=${anchors.userId}, project=${anchors.projectId}`);

  // Key, app-visible data first
  await seedKeyDbr77Data(db, anchors);

  // Baseline table inventory (before fill)
  const tables = await getTables(db);
  const knownTables = new Set(tables.map((t) => t.name));
  const countsBefore = new Map<string, number>();
  for (const t of tables) {
    countsBefore.set(t.name, await getRowCount(db, t.name));
  }

  const emptyBefore = Array.from(countsBefore.entries())
    .filter(([, c]) => c === 0)
    .map(([n]) => n);
  log.info(`Tables: ${tables.length}, empty before: ${emptyBefore.length}`);

  const columnsCache = new Map<string, ColumnInfo[]>();
  const fkCache = new Map<string, ForeignKeyInfo[]>();
  const inProgress = new Set<string>();
  const seededTables = new Set<string>();
  const failures: Array<{ table: string; error: string }> = [];

  const tryFill = async (opts: { foreignKeys: 'ON' | 'OFF' }) => {
    try {
      await db.run(`PRAGMA foreign_keys = ${opts.foreignKeys}`);
    } catch {
      // ignore
    }

    const empties = tables
      .map((t) => t.name)
      .filter((name) => (countsBefore.get(name) ?? 0) === 0)
      .filter((name) => !seededTables.has(name));

    for (let i = 0; i < empties.length; i += 1) {
      const table = empties[i];
      const tableSql = tables.find((x) => x.name === table)?.sql ?? null;

      const res = await seedOneRowForTable({
        db,
        table,
        tableSql,
        anchors,
        knownTables,
        columnsCache,
        fkCache,
        inProgress,
        seededTables,
      });

      if (!res.ok && res.error) failures.push({ table, error: res.error });

      if ((i + 1) % 25 === 0) {
        log.step(`Progress: ${i + 1}/${empties.length} (mode FK=${opts.foreignKeys})`);
      }
    }
  };

  // Pass 1: keep FK checks ON (best integrity)
  await tryFill({ foreignKeys: 'ON' });

  // Recompute empties; Pass 2: FK OFF for hard cases (still respecting NOT NULL / CHECK)
  const countsAfterPass1 = new Map<string, number>();
  for (const t of tables) countsAfterPass1.set(t.name, await getRowCount(db, t.name));
  const emptiesAfterPass1 = Array.from(countsAfterPass1.entries())
    .filter(([, c]) => c === 0)
    .map(([n]) => n);

  if (emptiesAfterPass1.length > 0) {
    log.warn(`Still empty after FK=ON pass: ${emptiesAfterPass1.length}. Retrying with FK=OFF...`);
    await tryFill({ foreignKeys: 'OFF' });
  }

  // Final verification
  const countsAfter = new Map<string, number>();
  for (const t of tables) countsAfter.set(t.name, await getRowCount(db, t.name));
  const emptyAfter = Array.from(countsAfter.entries())
    .filter(([, c]) => c === 0)
    .map(([n]) => n);

  console.log('\n📊 Verification summary');
  console.log(`  • Tables total: ${tables.length}`);
  console.log(`  • Empty before: ${emptyBefore.length}`);
  console.log(`  • Empty after:  ${emptyAfter.length}`);
  console.log(`  • Seeded tables (was empty): ${seededTables.size}`);

  if (emptyAfter.length > 0) {
    log.warn('Some tables are still empty (showing first 60):');
    emptyAfter.slice(0, 60).forEach((t) => console.log(`  - ${t}`));
  } else {
    log.success('All tables have at least 1 row.');
  }

  if (failures.length > 0) {
    log.warn(`Insert failures encountered: ${failures.length} (showing first 25)`);
    failures.slice(0, 25).forEach((f) => {
      console.log(`  - ${f.table}: ${String(f.error).slice(0, 180)}`);
    });
  }

  // Extra: show counts for app-visible core tables
  const coreTables = [
    'organizations',
    'users',
    'projects',
    'initiatives',
    'tasks',
    'decisions',
    'notifications',
    'assessments',
  ];
  console.log('\n🔎 Core tables row counts');
  for (const t of coreTables) {
    try {
      console.log(`  • ${t}: ${await getRowCount(db, t)}`);
    } catch {
      console.log(`  • ${t}: (not found)`);
    }
  }

  log.success('Done.');
}

main().catch((err) => {
  log.error(String(err?.message || err));
  process.exit(1);
});
