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
    const table = parseTableNameAfter(sql, 'CREATE\\s+TABLE') || null;
    if (!table) return false;
    if (!store.tables.has(table)) store.tables.set(table, []);

    // Best-effort: extract column names from CREATE TABLE (...) statement.
    const colsBlock = extractParenContentAfter(sql, 'create table');
    if (colsBlock) {
      const cols = colsBlock
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/--.*$/g, '').trim())
        .filter(Boolean)
        .map((l) => l.replace(/\s+/g, ' '))
        .filter((l) => !/^foreign key/i.test(l) && !/^unique\s*\(/i.test(l))
        .map((l) => l.split(' ')[0].replace(/["'`]/g, ''))
        .filter((v) => /^[a-zA-Z0-9_]+$/.test(v));
      if (cols.length) store.columns.set(table, cols);
    }
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
      if (tok.includes('?')) {
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

    // Upsert-ish behavior for tables using "id" primary key.
    const rows = store.tables.get(table)!;
    if (row.id != null) {
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

    // Only support WHERE id = ? patterns.
    const wherePart = normalizeSql(sql).slice(whereIdx + 7);
    const idMatch = wherePart.match(/\bid\s*=\s*\?/i);
    if (!idMatch) return false;
    const idParam = params?.[params.length - 1];
    if (idParam == null) return true;

    const rows = store.tables.get(table)!;
    const idx = rows.findIndex((r) => String(r.id) === String(idParam));
    if (idx < 0) return true;

    let pIdx = 0;
    const next = { ...rows[idx] };
    for (const a of assigns) {
      const mm = a.match(/^\s*([a-zA-Z0-9_]+)\s*=\s*(.+)\s*$/);
      if (!mm) continue;
      const col = mm[1];
      const rhs = mm[2];
      const rhsLower = rhs.toLowerCase();
      if (rhs.includes('?')) {
        next[col] = params?.[pIdx++];
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

    // Very small filter support: id = ?, is_active, organization_id scope.
    let rows = [...allRows];
    if (s.includes('where')) {
      if (s.match(/\bid\s*=\s*\?/i)) {
        const id = params?.[0];
        rows = rows.filter((r) => String(r.id) === String(id));
      }
      if (s.includes('is_active = true') || s.includes('is_active = 1')) {
        rows = rows.filter((r) => r.is_active === true || r.is_active === 1 || String(r.is_active) === 'true');
      }
      if (s.includes('organization_id = ?')) {
        const orgId = params?.[0];
        rows = rows.filter((r) => r.organization_id == null || String(r.organization_id) === String(orgId));
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

    return rows;
  };

  const mock: MockDatabase = {
    isMock: true,
    get: (_sql, _params, callback) => {
      // sqlite3 compatibility: support (sql, cb) and (sql, params, cb)
      if (typeof _params === 'function') {
        // @ts-ignore
        _params(null, null);
        return mock;
      }
      const sql = normalizeSql(_sql as any);
      const params = Array.isArray(_params) ? _params : [];

      const pragma = handlePragmaTableInfo(mock, sql);
      if (pragma) {
        if (callback) callback(null, (pragma as any)[0] || null);
        return mock;
      }

      const sqliteMaster = handleSelectSqliteMaster(mock, sql, params);
      if (sqliteMaster !== null) {
        if (callback) callback(null, sqliteMaster as any);
        return mock;
      }

      const rows = selectFromTable(mock, sql, params);
      if (rows) {
        if (callback) callback(null, (rows as any)[0] || null);
        return mock;
      }

      if (callback) callback(null, null);
      return mock;
    },
    all: (_sql, _params, callback) => {
      if (typeof _params === 'function') {
        // @ts-ignore
        _params(null, []);
        return mock;
      }
      const sql = normalizeSql(_sql as any);
      const params = Array.isArray(_params) ? _params : [];

      const pragma = handlePragmaTableInfo(mock, sql);
      if (pragma) {
        if (callback) callback(null, pragma as any);
        return mock;
      }

      const sqliteMaster = handleSelectSqliteMaster(mock, sql, params);
      if (sqliteMaster !== null) {
        if (callback) callback(null, sqliteMaster ? [sqliteMaster] : []);
        return mock;
      }

      const rows = selectFromTable(mock, sql, params);
      if (rows) {
        if (callback) callback(null, rows as any);
        return mock;
      }

      if (callback) callback(null, []);
      return mock;
    },
    run(_sql, _params, callback) {
      if (typeof _params === 'function') {
        // @ts-ignore
        _params.call({ lastID: 0, changes: 0 }, null);
        return mock;
      }
      const sql = normalizeSql(_sql as any);
      const params = Array.isArray(_params) ? _params : [];

      // DDL / indexes / alters
      if (/^\s*create\s+table/i.test(sql)) {
        applyCreateTable(mock, sql);
        if (callback) {
          // @ts-ignore
          callback.call({ lastID: 0, changes: 0 }, null);
        }
        return mock;
      }
      if (/^\s*create\s+index/i.test(sql) || /^\s*alter\s+table/i.test(sql)) {
        if (callback) {
          // @ts-ignore
          callback.call({ lastID: 0, changes: 0 }, null);
        }
        return mock;
      }

      // DML
      const didInsert = applyInsert(mock, sql, params);
      const didUpdate = didInsert ? false : applyUpdate(mock, sql, params);
      const didDelete = didInsert || didUpdate ? false : applyDelete(mock, sql, params);

      if (callback) {
        // @ts-ignore
        callback.call({ lastID: 0, changes: didInsert || didUpdate || didDelete ? 1 : 0 }, null);
      }
      return mock;
    },
    exec(_sql, callback) {
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
    console.log('[Database] Closing database handle...');
    (db as any).__CLOSED__ = true;
    if ((db as any).close) {
      await new Promise<void>((resolve) => {
        (db as any).close((err: any) => {
          if (err) console.error('[Database] Error closing DB handle', err);
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
