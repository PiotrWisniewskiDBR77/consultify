// @ts-nocheck
/**
 * Database Factory
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * PostgreSQL only. SQLite has been fully removed.
 */

import { databaseConfig } from '../config/DatabaseConfig.js';
import logger from '../utils/Logger.js';
import type { IDatabase } from './IDatabase.js';
import PostgresDatabase from './PostgresDatabase.js';

const GLOBAL_DB_KEY = '__CONSULTIFY_GLOBAL_DB_INSTANCE__';

// local cache
let dbInstance: IDatabase | null = null;
let schemaInitPromise: Promise<void> | null = null;
let creatingDbPromise: Promise<IDatabase> | null = null;
const SCHEMA_INIT_GUARD_KEY = '__CONSULTIFY_SCHEMA_INIT_IN_PROGRESS__';

async function ensureSchemaInitialized(db: IDatabase): Promise<void> {
  // Skip schema work for mock DBs
  if ((db as any)?.isMock) return;
  // Postgres schema is initialized/verified explicitly during server startup via DatabaseInitializer.
  // Calling DatabaseInitializer from here creates re-entrant initialization (and can crash the dev server).
  if (databaseConfig.type === 'postgres') return;
  // Avoid deadlocks: DatabaseInitializer calls getDatabaseAsync() internally.
  if ((globalThis as any)[SCHEMA_INIT_GUARD_KEY]) return;

  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      (globalThis as any)[SCHEMA_INIT_GUARD_KEY] = true;
      try {
        // Lazy import to avoid eager circular deps at module load time
        const mod = await import('./DatabaseInitializer.js');
        if (typeof mod.initializeDatabase === 'function') {
          await mod.initializeDatabase();
        }
      } catch (e) {
        // Don't hard-crash here; callers may handle missing schema elsewhere.
        logger.warn('[Database] Schema initialization skipped/failed:', (e as any)?.message || e);
      } finally {
        (globalThis as any)[SCHEMA_INIT_GUARD_KEY] = false;
      }
    })();
  }

  await schemaInitPromise;
}

/**
 * Ensures we have a single global instance across all module loads
 */
function getFromGlobal(): IDatabase | null {
  return (process as any)[GLOBAL_DB_KEY] || (globalThis as any)[GLOBAL_DB_KEY] || null;
}

function setToGlobal(db: IDatabase) {
  (process as any)[GLOBAL_DB_KEY] = db;
  (globalThis as any)[GLOBAL_DB_KEY] = db;
  dbInstance = db;
}

/**
 * Create database instance. PostgreSQL only.
 */
export async function createDatabase(): Promise<IDatabase> {
  const existing = getFromGlobal();
  if (existing && !(existing as any).__CLOSED__) {
    dbInstance = existing;
    return existing;
  }

  if (creatingDbPromise) {
    return creatingDbPromise;
  }

  creatingDbPromise = (async (): Promise<IDatabase> => {
    if (
      process.env.MOCK_DB === 'true' ||
      (process.env.NODE_ENV === 'test' &&
        process.env.RUN_DB_TESTS !== '1' &&
        process.env.MOCK_DB !== 'false')
    ) {
      const mockDb = (global as any).__TEST_DB_MOCK__ || createMockDatabase();
      setToGlobal(mockDb);
      return mockDb;
    }

    const db = PostgresDatabase as unknown as IDatabase;
    setToGlobal(db);
    return db;
  })();

  try {
    return await creatingDbPromise;
  } finally {
    creatingDbPromise = null;
  }
}

/**
 * Get database singleton instance (async)
 */
export async function getDatabaseAsync(): Promise<IDatabase> {
  const existing = getFromGlobal();
  if (existing && !(existing as any).__CLOSED__) {
    await ensureSchemaInitialized(existing);
    return existing;
  }
  const db = await createDatabase();
  await ensureSchemaInitialized(db);
  return db;
}

/**
 * Get internal database singleton instance (synchronous)
 */
export function getDatabaseInstance(): IDatabase {
  const globalDb = getFromGlobal();
  if (globalDb && !(globalDb as any).__CLOSED__) {
    return globalDb;
  }

  if (dbInstance && !(dbInstance as any).__CLOSED__) {
    return dbInstance;
  }

  if (
    process.env.NODE_ENV === 'test' &&
    process.env.RUN_DB_TESTS !== '1' &&
    process.env.MOCK_DB !== 'false' &&
    true
  ) {
    const mockDb = createMockDatabase();
    setToGlobal(mockDb);
    return mockDb;
  }

  if (!databaseConfig.type || databaseConfig.type === 'postgres') {
    const db = PostgresDatabase as unknown as IDatabase;
    setToGlobal(db);
    return db;
  }

  throw new Error('Database not initialized. Call getDatabaseAsync() first.');
}

/**
 * Mock database for tests
 */
export interface MockDatabase extends IDatabase {
  _mockData?: Record<string, unknown[]>;
  isMock: boolean;
}

function createMockDatabase(): MockDatabase {
  type TableRow = Record<string, any>;
  type MockStore = {
    tables: Map<string, TableRow[]>;
    columns: Map<string, string[]>;
  };
  const ensureStore = (mock: MockDatabase): MockStore => {
    const anyMock = mock as any;
    if (!anyMock.__STORE__) {
      anyMock.__STORE__ = {
        tables: new Map<string, TableRow[]>(),
        columns: new Map<string, string[]>(),
      } satisfies MockStore;
    }
    return anyMock.__STORE__ as MockStore;
  };

  const normalizeSql = (sql: string) => String(sql || '').trim();
  const lowerSql = (sql: string) => normalizeSql(sql).toLowerCase();

  const nowIso = () => new Date().toISOString();

  const splitCsv = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const countPlaceholders = (value: string) => {
    const s = String(value || '');
    const q = (s.match(/\?/g) || []).length;
    const pg = (s.match(/\$\d+/g) || []).length;
    return q + pg;
  };

  const parseTableNameAfter = (sql: string, keyword: string): string | null => {
    const s = normalizeSql(sql);
    const re = new RegExp(`${keyword}\\s+IF\\s+NOT\\s+EXISTS\\s+([a-zA-Z0-9_]+)`, 'i');
    const m = s.match(re);
    if (m && m[1]) return m[1].toLowerCase();
    const re2 = new RegExp(`${keyword}\\s+([a-zA-Z0-9_]+)`, 'i');
    const m2 = s.match(re2);
    if (m2 && m2[1]) return m2[1].toLowerCase();
    return null;
  };

  const extractParenContentAfter = (sql: string, marker: string): string | null => {
    const idx = lowerSql(sql).indexOf(marker.toLowerCase());
    if (idx < 0) return null;
    const after = sql.slice(idx + marker.length);
    const start = after.indexOf('(');
    if (start < 0) return null;
    let depth = 0;
    for (let i = start; i < after.length; i++) {
      const ch = after[i];
      if (ch === '(') depth++;
      if (ch === ')') {
        depth--;
        if (depth === 0) return after.slice(start + 1, i);
      }
    }
    return null;
  };

  const handleSelectSqliteMaster = (mock: MockDatabase, sql: string, params: any[]) => {
    const store = ensureStore(mock);
    const s = lowerSql(sql);
    if (!s.includes('from sqlite_master')) return null;
    const name = params?.[0] ? String(params[0]).toLowerCase() : '';
    if (!name) return null;
    const exists = store.tables.has(name);
    return exists ? { name } : null;
  };

  const handlePragmaTableInfo = (mock: MockDatabase, sql: string) => {
    const store = ensureStore(mock);
    const m = normalizeSql(sql).match(/pragma\s+table_info\(["']?([a-zA-Z0-9_]+)["']?\)/i);
    if (!m?.[1]) return null;
    const t = m[1].toLowerCase();
    const cols = store.columns.get(t) || [];
    return cols.map((name, idx) => ({
      cid: idx,
      name,
      type: 'TEXT',
      notnull: 0,
      dflt_value: null,
      pk: name === 'id' ? 1 : 0,
    }));
  };

  const applyCreateTable = (mock: MockDatabase, sql: string) => {
    const store = ensureStore(mock);
    const tableMatch = normalizeSql(sql).match(
      /create\s+table(?:\s+if\s+not\s+exists)?\s+["'`]?([a-zA-Z0-9_]+)["'`]?/i
    );
    const table = tableMatch?.[1]?.toLowerCase() || null;
    if (!table) return false;
    if (!store.tables.has(table)) store.tables.set(table, []);

    // Best-effort: extract column names from CREATE TABLE definition.
    const cols = Array.from(
      normalizeSql(sql).matchAll(/(?:\(|,)\s*["'`]?([a-zA-Z0-9_]+)["'`]?\s+[a-zA-Z]+/g)
    )
      .map((match) => String(match[1] || '').trim())
      .filter(
        (name) =>
          !!name &&
          !['foreign', 'primary', 'unique', 'constraint', 'check'].includes(name.toLowerCase())
      );
    if (cols.length) store.columns.set(table, Array.from(new Set(cols)));
    return true;
  };

  const applyInsert = (mock: MockDatabase, sql: string, params: any[]) => {
    const store = ensureStore(mock);
    const s = lowerSql(sql);
    if (!s.startsWith('insert into')) return false;

    const tableMatch = normalizeSql(sql).match(/insert\s+into\s+([a-zA-Z0-9_]+)/i);
    const table = tableMatch?.[1]?.toLowerCase();
    if (!table) return false;

    if (!store.tables.has(table)) store.tables.set(table, []);

    const colsBlock = extractParenContentAfter(sql, `insert into ${tableMatch?.[1]}`) || '';
    const cols = colsBlock ? splitCsv(colsBlock).map((c) => c.replace(/["'`]/g, '')) : [];
    if (cols.length && !store.columns.get(table)) store.columns.set(table, cols);

    const valuesBlock = extractParenContentAfter(sql, 'values') || '';
    const valueTokens = valuesBlock ? splitCsv(valuesBlock) : [];

    const row: TableRow = {};
    let pIdx = 0;
    const n = Math.max(cols.length, valueTokens.length);
    for (let i = 0; i < n; i++) {
      const col = cols[i] || `col_${i}`;
      const tok = valueTokens[i] || '?';
      const tokLower = tok.toLowerCase();
      if (tok.includes('?') || /^\$\d+(::[a-zA-Z0-9_]+)*$/.test(tok.trim())) {
        row[col] = params?.[pIdx++];
      } else if (tokLower.includes('current_timestamp') || tokLower.includes('now()')) {
        row[col] = nowIso();
      } else if (tokLower.includes("datetime('now'") || tokLower.includes('datetime("now"')) {
        row[col] = nowIso();
      } else if (tokLower === 'null') {
        row[col] = null;
      } else if (/^['"].*['"]$/.test(tok.trim())) {
        row[col] = tok.trim().slice(1, -1);
      } else {
        row[col] = tok;
      }
    }

    // Normalize commonly used timestamp fields if present.
    if (row.created_at == null && cols.includes('created_at')) row.created_at = nowIso();
    if (row.updated_at == null && cols.includes('updated_at')) row.updated_at = nowIso();

    // Upsert behavior: prefer the ON CONFLICT column when specified,
    // otherwise fall back to `id`. This lets tables with non-id PKs
    // (e.g. share_link_id, pack_id, template_id) upsert correctly.
    const rows = store.tables.get(table)!;
    const conflictMatch = normalizeSql(sql).match(/on\s+conflict\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
    const conflictCol = conflictMatch?.[1]?.toLowerCase() ?? 'id';
    const conflictVal = row[conflictCol];
    if (conflictVal != null) {
      const idx = rows.findIndex((r) => String(r[conflictCol]) === String(conflictVal));
      if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
      else rows.push(row);
    } else if (row.id != null) {
      const idx = rows.findIndex((r) => String(r.id) === String(row.id));
      if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
      else rows.push(row);
    } else {
      rows.push(row);
    }
    return true;
  };

  const applyUpdate = (mock: MockDatabase, sql: string, params: any[]) => {
    const store = ensureStore(mock);
    const s = lowerSql(sql);
    if (!s.startsWith('update ')) return false;

    const m = normalizeSql(sql).match(/update\s+([a-zA-Z0-9_]+)/i);
    const table = m?.[1]?.toLowerCase();
    if (!table) return false;
    if (!store.tables.has(table)) store.tables.set(table, []);

    const setIdx = s.indexOf(' set ');
    const whereIdx = s.indexOf(' where ');
    if (setIdx < 0 || whereIdx < 0) return false;
    const setPart = normalizeSql(sql).slice(setIdx + 5, whereIdx);
    const assigns = splitCsv(setPart);

    const wherePart = normalizeSql(sql).slice(whereIdx + 7);
    const rows = store.tables.get(table)!;
    const whereMatches = Array.from(wherePart.matchAll(/\b([a-zA-Z0-9_]+)\s*=\s*(\?|\$\d+)/gi));
    const whereLiteralMatches = Array.from(
      wherePart.matchAll(/\b([a-zA-Z0-9_]+)\s*=\s*['"]([^'"]*)['"]/gi)
    );
    if (!whereMatches.length) return false;

    let setParamCount = 0;
    for (const a of assigns) {
      const mm = a.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*(.+)\s*$/);
      if (!mm) continue;
      setParamCount += countPlaceholders(mm[2]);
    }

    const idx = rows.findIndex((row) => {
      let sequentialWhereParamIndex = setParamCount;
      return (
        whereMatches.every((match) => {
          const column = String(match[1] || '').toLowerCase();
          const placeholder = String(match[2] || '');
          const expected = placeholder.startsWith('$')
            ? params?.[Number.parseInt(placeholder.slice(1), 10) - 1]
            : params?.[sequentialWhereParamIndex++];
          const actual = row[column];
          return actual != null && String(actual) === String(expected);
        }) &&
        whereLiteralMatches.every((match) => {
          const column = String(match[1] || '').toLowerCase();
          return String(row[column]) === String(match[2] || '');
        })
      );
    });
    // Match SQLite/Postgres semantics: a syntactically valid UPDATE that did not
    // match a row reports zero changed rows. Returning a truthy value here made
    // optimistic-locking routes report success even though no state was saved.
    if (idx < 0) return false;

    let pIdx = 0;
    const resolvePlaceholder = (token: string) => {
      const trimmed = String(token || '').trim();
      if (trimmed === '?') return params?.[pIdx++];
      if (/^\$\d+$/.test(trimmed)) {
        const absoluteIndex = Number.parseInt(trimmed.slice(1), 10);
        return params?.[absoluteIndex - 1];
      }
      return undefined;
    };
    const next = { ...rows[idx] };
    for (const a of assigns) {
      const mm = a.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*(.+)\s*$/);
      if (!mm) continue;
      const col = mm[1];
      const rhs = mm[2];
      const rhsLower = rhs.toLowerCase();
      const placeholderMatch = rhs.match(/(\?|\$\d+)/);
      if (placeholderMatch) {
        next[col] = resolvePlaceholder(placeholderMatch[1]);
      } else if (rhsLower.includes('current_timestamp') || rhsLower.includes('now()')) {
        next[col] = nowIso();
      } else if (rhsLower === 'null') {
        next[col] = null;
      } else {
        next[col] = rhs;
      }
    }

    rows[idx] = next;
    return true;
  };

  const applyDelete = (mock: MockDatabase, sql: string, params: any[]) => {
    const store = ensureStore(mock);
    const s = lowerSql(sql);
    if (!s.startsWith('delete from')) return false;
    const m = normalizeSql(sql).match(/delete\s+from\s+([a-zA-Z0-9_]+)/i);
    const table = m?.[1]?.toLowerCase();
    if (!table) return false;
    // No WHERE clause → full table truncate (used by test-reset helpers).
    if (!s.includes(' where ')) {
      store.tables.set(table, []);
      return true;
    }
    const id = params?.[0];
    if (id == null) return true;
    const rows = store.tables.get(table) || [];
    store.tables.set(
      table,
      rows.filter((r) => String(r.id) !== String(id))
    );
    return true;
  };

  const selectFromTable = (mock: MockDatabase, sql: string, params: any[]) => {
    const store = ensureStore(mock);
    const s = lowerSql(sql);
    const fromMatch = normalizeSql(sql).match(/\bfrom\s+([a-zA-Z0-9_]+)/i);
    const table = fromMatch?.[1]?.toLowerCase();
    if (!table) return null;
    const allRows = store.tables.get(table) || [];

    // Very small filter support for simple equality predicates with positional params.
    let rows = [...allRows];
    if (s.includes('where')) {
      const wherePart = normalizeSql(sql).split(/\bwhere\b/i)[1] || '';
      const allowed = new Set([
        'id',
        'idea_id',
        'user_id',
        'organization_id',
        'run_id',
        'slug',
        'status',
        'article_id',
        'category_id',
        'language',
        // Auth lookups use `WHERE LOWER(email) = LOWER(?)`; without `email` here the
        // predicate was dropped and the SELECT returned ALL users → register-demo's
        // "email already in use" check matched the first row for every fresh email,
        // 400-ing every E2E run that registers a unique account (M06 harness, 2026-06-21).
        'email',
        'jti',
        'token',
        // Share-link hash-based lookup (`WHERE token_hash = $1`).
        'token_hash',
        // Document Studio cross-table lookups keyed by artifact or pack id.
        'artifact_id',
        'share_link_id',
        'pack_id',
        'version_id',
      ]);

      // Match bare `col = ?` AND case-folded `LOWER(col) = LOWER(?)` / `LOWER(col) = ?`.
      // The original regex only handled the bare form, so any LOWER()-wrapped predicate
      // (all case-insensitive email lookups) silently matched nothing → no filtering.
      const predicateRe =
        /(lower\s*\(\s*)?\b([a-zA-Z0-9_]+)\b\s*\)?\s*=\s*(lower\s*\(\s*)?(\?|\$\d+)\s*\)?/gi;
      const equalityMatches = Array.from(wherePart.matchAll(predicateRe))
        .map((m) => ({
          column: String(m[2] || '').toLowerCase(),
          placeholder: String(m[4] || '?').trim(),
          ci: !!(m[1] || m[3]),
        }))
        .filter((p) => allowed.has(p.column));

      let sequentialParamIndex = 0;
      const resolveExpected = (placeholder: string) => {
        if (placeholder === '?') return params?.[sequentialParamIndex++];
        if (/^\$\d+$/.test(placeholder)) {
          const idx = Number.parseInt(placeholder.slice(1), 10);
          return params?.[idx - 1];
        }
        return undefined;
      };

      equalityMatches.forEach((pred) => {
        const expected = resolveExpected(pred.placeholder);
        rows = rows.filter((row) => {
          const actual = row[pred.column];
          if (actual == null || expected == null) return false;
          return pred.ci
            ? String(actual).toLowerCase() === String(expected).toLowerCase()
            : String(actual) === String(expected);
        });
      });

      if (
        !equalityMatches.length &&
        (s.includes('organization_id = ?') || s.includes('organization_id = $1'))
      ) {
        const orgId = params?.[0];
        rows = rows.filter(
          (r) => r.organization_id != null && String(r.organization_id) === String(orgId)
        );
      }
      if (s.includes('is_active = true') || s.includes('is_active = 1')) {
        rows = rows.filter(
          (r) => r.is_active === true || r.is_active === 1 || String(r.is_active) === 'true'
        );
      }
    }

    // Basic order: priority asc then created_at desc if present.
    if (rows.length && (s.includes('order by') || table === 'llm_routing_rules')) {
      rows.sort((a, b) => {
        const pa = Number(a.priority || 0);
        const pb = Number(b.priority || 0);
        if (pa !== pb) return pa - pb;
        const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
        const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return cb - ca;
      });
    }

    const selectMatch = normalizeSql(sql).match(/^\s*select\s+(.+?)\s+from\b/i);
    const selectPart = selectMatch?.[1] || '';
    const aliasSpecs = Array.from(
      selectPart.matchAll(/\b([a-zA-Z0-9_.]+)\s+as\s+"?([a-zA-Z0-9_]+)"?/gi)
    ).map((match) => ({
      source:
        String(match[1] || '')
          .split('.')
          .pop() || '',
      alias: String(match[2] || ''),
    }));

    if (!aliasSpecs.length) return rows;

    return rows.map((row) => {
      const next = { ...row };
      for (const spec of aliasSpecs) {
        if (!spec.alias || !spec.source) continue;
        if (Object.prototype.hasOwnProperty.call(row, spec.source)) {
          next[spec.alias] = row[spec.source];
        }
      }
      return next;
    });
  };

  const mock: MockDatabase = {
    isMock: true,
    get: (_sql, _params, callback) => {
      const sql = normalizeSql(_sql as any);
      const cb = typeof _params === 'function' ? (_params as any) : callback;
      const params = Array.isArray(_params) ? _params : [];

      const pragma = handlePragmaTableInfo(mock, sql);
      if (pragma) {
        if (cb) cb(null, (pragma as any)[0] || null);
        return mock;
      }

      const sqliteMaster = handleSelectSqliteMaster(mock, sql, params);
      if (sqliteMaster !== null) {
        if (cb) cb(null, sqliteMaster as any);
        return mock;
      }

      const rows = selectFromTable(mock, sql, params);
      if (rows) {
        if (cb) cb(null, (rows as any)[0] || null);
        return mock;
      }

      if (cb) cb(null, null);
      return mock;
    },
    all: (_sql, _params, callback) => {
      const sql = normalizeSql(_sql as any);
      const cb = typeof _params === 'function' ? (_params as any) : callback;
      const params = Array.isArray(_params) ? _params : [];

      const pragma = handlePragmaTableInfo(mock, sql);
      if (pragma) {
        if (cb) cb(null, pragma as any);
        return mock;
      }

      const sqliteMaster = handleSelectSqliteMaster(mock, sql, params);
      if (sqliteMaster !== null) {
        if (cb) cb(null, sqliteMaster ? [sqliteMaster] : []);
        return mock;
      }

      const rows = selectFromTable(mock, sql, params);
      if (rows) {
        if (cb) cb(null, rows as any);
        return mock;
      }

      if (cb) cb(null, []);
      return mock;
    },
    run(_sql, _params, callback) {
      const sql = normalizeSql(_sql as any);
      const cb = typeof _params === 'function' ? (_params as any) : callback;
      const params = Array.isArray(_params) ? _params : [];

      // DDL / indexes / alters
      if (/^\s*create\s+table/i.test(sql)) {
        applyCreateTable(mock, sql);
        if (cb) {
          // @ts-ignore
          cb.call({ lastID: 0, changes: 0 }, null);
        }
        return mock;
      }
      if (/^\s*create\s+index/i.test(sql) || /^\s*alter\s+table/i.test(sql)) {
        if (cb) {
          // @ts-ignore
          cb.call({ lastID: 0, changes: 0 }, null);
        }
        return mock;
      }

      // DML
      const didInsert = applyInsert(mock, sql, params);
      const didUpdate = didInsert ? false : applyUpdate(mock, sql, params);
      const didDelete = didInsert || didUpdate ? false : applyDelete(mock, sql, params);

      if (cb) {
        // @ts-ignore
        cb.call({ lastID: 0, changes: didInsert || didUpdate || didDelete ? 1 : 0 }, null);
      }
      return mock;
    },
    exec(_sql, callback) {
      const sql = normalizeSql(_sql as any);
      const statements = sql
        .split(';')
        .map((part) => normalizeSql(part))
        .filter(Boolean);

      for (const statement of statements) {
        if (/^\s*create\s+table/i.test(statement)) {
          applyCreateTable(mock, statement);
          continue;
        }
        if (/^\s*create\s+index/i.test(statement) || /^\s*alter\s+table/i.test(statement)) {
          continue;
        }
        const didInsert = applyInsert(mock, statement, []);
        const didUpdate = didInsert ? false : applyUpdate(mock, statement, []);
        if (!didInsert && !didUpdate) {
          applyDelete(mock, statement, []);
        }
      }

      if (callback) callback(null);
      return mock;
    },
    serialize: (cb) => cb(),
    close: (callback) => {
      if (callback) callback(null);
      return Promise.resolve();
    },
    async query(_text, _params) {
      return { rows: [], rowCount: 0 };
    },
  };

  return mock;
}

/**
 * Global Database Instance Proxy
 */
function createProxyMethod(prop: string) {
  return (...args: any[]) => {
    const callWithRetry = (retryCount = 0): any => {
      const currentDb = getDatabaseInstance();
      const fn = (currentDb as any)[prop];

      if (!fn) {
        throw new Error(`Database instance does not have method: ${String(prop)}`);
      }

      const lastArgIndex = args.length - 1;
      const lastArg = args[lastArgIndex];

      if (typeof lastArg === 'function') {
        const originalCallback = lastArg;
        const wrappedArgs = [...args];
        wrappedArgs[lastArgIndex] = function (this: any, err: any, ...results: any[]) {
          if (err && err.message && err.message.includes('Database is closed') && retryCount < 1) {
            resetConnectionLocally();
            return callWithRetry(retryCount + 1);
          }
          return originalCallback.apply(this, [err, ...results]);
        };
        return fn.apply(currentDb, wrappedArgs);
      }

      if (['get', 'all', 'run', 'exec'].includes(prop)) {
        return new Promise((resolve, reject) => {
          const callback = function (this: any, err: any, result: any) {
            if (err) {
              if (err.message && err.message.includes('Database is closed') && retryCount < 1) {
                resetConnectionLocally();
                return resolve(callWithRetry(retryCount + 1));
              }
              return reject(err);
            }
            if (prop === 'run') {
              return resolve({ lastID: this.lastID, changes: this.changes });
            }
            return resolve(result);
          };
          fn.apply(currentDb, [...args, callback]);
        });
      }

      try {
        const result = fn.apply(currentDb, args);
        if (result instanceof Promise) {
          return result.catch((err: any) => {
            if (err.message && err.message.includes('Database is closed') && retryCount < 1) {
              resetConnectionLocally();
              return callWithRetry(retryCount + 1);
            }
            throw err;
          });
        }
        return result;
      } catch (err: any) {
        if (err.message && err.message.includes('Database is closed') && retryCount < 1) {
          resetConnectionLocally();
          return callWithRetry(retryCount + 1);
        }
        throw err;
      }
    };

    return callWithRetry();
  };
}

const dbProxyTarget = {
  get: createProxyMethod('get'),
  all: createProxyMethod('all'),
  run: createProxyMethod('run'),
  exec: createProxyMethod('exec'),
} as IDatabase;

export const dbProxy = new Proxy(dbProxyTarget, {
  get(_, prop) {
    if (prop === '__CLOSED__') {
      const current = getFromGlobal();
      return current ? (current as any).__CLOSED__ : false;
    }

    if (typeof prop === 'string' && prop in dbProxyTarget) {
      return (dbProxyTarget as any)[prop];
    }

    const instance = getDatabaseInstance();
    const value = (instance as any)[prop];

    if (typeof value === 'function') {
      return createProxyMethod(String(prop));
    }
    return value;
  },
});

function resetConnectionLocally() {
  dbInstance = null;
  (process as any)[GLOBAL_DB_KEY] = null;
  (globalThis as any)[GLOBAL_DB_KEY] = null;
}

/**
 * Force close connection and reset singleton
 */
export async function resetConnection(): Promise<void> {
  const db = getFromGlobal();
  resetConnectionLocally();

  if (db) {
    logger.info('[Database] Closing database handle...');
    (db as any).__CLOSED__ = true;
    if ((db as any).close) {
      await new Promise<void>((resolve) => {
        (db as any).close((err: any) => {
          if (err) logger.error('[Database] Error closing DB handle', err);
          resolve();
        });
      });
    }
  }
}

export function getDatabase(): IDatabase {
  return dbProxy;
}

export default dbProxy;

declare global {
  var __TEST_DB_MOCK__: any;
}
