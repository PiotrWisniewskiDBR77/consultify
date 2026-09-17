import { createRequire } from 'node:module';

type Callback<T = void> = (error: Error | null, value?: T) => void;

/** Minimal sqlite3 callback facade for the two legacy route suites. Node 24
 * ships SQLite itself, so these tests no longer depend on an ABI-specific
 * node_sqlite3.node binary. */
export class NodeSqliteCompatDatabase {
  private readonly database: {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    };
    close(): void;
  };

  constructor() {
    const require = createRequire(import.meta.url);
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (path: string) => NodeSqliteCompatDatabase['database'];
    };
    this.database = new DatabaseSync(':memory:');
  }

  exec(sql: string, callback?: Callback): void {
    try {
      this.database.exec(sql);
      callback?.(null);
    } catch (error) {
      if (callback) callback(error as Error);
      else throw error;
    }
  }

  get(sql: string, params: unknown[], callback: Callback<unknown>): void {
    try {
      callback(null, this.database.prepare(sql).get(...params));
    } catch (error) {
      callback(error as Error);
    }
  }

  all(sql: string, params: unknown[], callback: Callback<unknown[]>): void {
    try {
      callback(null, this.database.prepare(sql).all(...params));
    } catch (error) {
      callback(error as Error);
    }
  }

  run(
    sql: string,
    paramsOrCallback?: unknown[] | ((this: { changes: number; lastID?: number }, error: Error | null) => void),
    maybeCallback?: (this: { changes: number; lastID?: number }, error: Error | null) => void
  ): void {
    const params = Array.isArray(paramsOrCallback) ? paramsOrCallback : [];
    const callback = typeof paramsOrCallback === 'function' ? paramsOrCallback : maybeCallback;
    try {
      const result = this.database.prepare(sql).run(...params);
      callback?.call(
        { changes: Number(result.changes), lastID: Number(result.lastInsertRowid) },
        null
      );
    } catch (error) {
      if (callback) callback.call({ changes: 0 }, error as Error);
      else throw error;
    }
  }

  close(callback: Callback): void {
    try {
      this.database.close();
      callback(null);
    } catch (error) {
      callback(error as Error);
    }
  }
}

export function createTestSqliteDatabase(): NodeSqliteCompatDatabase | unknown {
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) return new NodeSqliteCompatDatabase();
  const require = createRequire(import.meta.url);
  const sqlite3 = require('sqlite3') as { Database: new (path: string) => unknown };
  return new sqlite3.Database(':memory:');
}
