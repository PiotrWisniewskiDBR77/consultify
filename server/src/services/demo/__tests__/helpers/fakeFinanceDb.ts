/**
 * A tiny in-memory stand-in for `DbPromise`, good enough to make the FIN-005
 * two-phase seed testable WITHOUT a live Postgres.
 *
 * WHY IT EXISTS. The old harness mocked `DbPromise.run` as a write-only sink and
 * `DbPromise.all` as "always empty". That was fine while the seed asserted READY
 * in the same INSERT that created the row — there was nothing to read back. The
 * seed now EARNS ready by reading its own rows out of the database again, so a
 * mock that never returns a row can only ever prove "the seed refuses to
 * promote", never "the seed promotes correctly". This fake stores the rows and
 * answers the read-backs, so both halves are testable.
 *
 * It understands exactly the SQL shapes this seed emits:
 *   - `INSERT INTO t (cols) VALUES (?,…) ON CONFLICT(id) DO UPDATE SET … WHERE …`
 *   - `INSERT INTO t (cols) VALUES (?,…) ON CONFLICT(id) DO NOTHING`
 *   - `UPDATE t SET a=?, … WHERE id = ? AND (…)`
 *   - `SELECT a, b, c FROM t WHERE col = ?`
 *   - the two `information_schema` probes
 * Anything else returns empty, exactly like the previous mock, so the rest of
 * the demo seed keeps running untouched.
 */

export interface FakeRow {
  [column: string]: unknown;
}

export interface FakeCall {
  /** Caller-controlled label so a test can separate run #1 from run #2. */
  run: number;
  kind: 'insert' | 'update' | 'select' | 'other';
  table: string;
  sql: string;
  params: unknown[];
}

export interface FakeDbConfig {
  /**
   * Column names per table, as `information_schema.columns` would report them.
   * `null` (the default) means the probe answers NOTHING — the legacy harness
   * behaviour that makes `projectUpsert` fall back to writing every column.
   */
  schema?: Record<string, string[]> | null;
  /** Tables `information_schema.tables` should report as absent. */
  missingTables?: string[];
  /**
   * Tables whose SELECTs are actually served from the store. Everything else
   * answers empty, exactly like the legacy mock, so the ~40 other tables the
   * demo seed touches keep their previous, well-understood behaviour.
   */
  selectTables?: string[];
  /**
   * Last-moment tamper hook on read-back results, used to simulate a truncated
   * or corrupted write that the in-memory fixture cannot express.
   */
  onSelect?: (table: string, rows: FakeRow[]) => FakeRow[];
  /**
   * FAULT INJECTION on writes. Called before an INSERT/UPDATE touches the store;
   * return an error message to make the write throw exactly as Postgres would
   * (deadlock, constraint violation, connection reset), or `null`/`undefined` to
   * let it through.
   *
   * This is what makes the FIN-005 atomicity contract testable: the promotion
   * phase issues five UPDATEs, and a fixture that is honest only when all five
   * succeed is not atomic. The hook is a plain function, so a test can fail the
   * Nth write by closing over its own counter — and, crucially, let the
   * COMPENSATING ROLLBACK's writes through afterwards.
   */
  onWrite?: FakeWriteHook;
  /**
   * FAULT INJECTION on writes that HAVE ALREADY LANDED. Called AFTER the write
   * has been applied to the store; returning a message makes the call throw
   * anyway.
   *
   * WHY THIS EXISTS SEPARATELY FROM `onWrite`. `onWrite` fires before the store
   * is touched, so it can only model "the write was rejected AND never
   * applied". Postgres also produces the other outcome, and it is the dangerous
   * one: the UPDATE is applied by the server and the client never sees the
   * result — a connection reset, a `pg_terminate_backend`, a pool timeout, a
   * proxy hiccup. `pool.query` rejects, the caller concludes "not promoted",
   * and the row is confirmed/pass/ready on disk. A compensating rollback that
   * only undoes what it recorded as promoted cannot repair that row, and a
   * verification re-read scoped to the same list cannot even SEE it. This hook
   * is what makes that case expressible.
   */
  onWriteAfterApply?: FakeWriteHook;
}

export type FakeWriteHook = (write: {
  kind: 'insert' | 'update';
  table: string;
  /** Primary key the statement targets, when it can be determined. */
  id: string | null;
  sql: string;
  params: unknown[];
  /** Column -> bound value, as this statement would apply it. */
  values: Record<string, unknown>;
}) => string | null | undefined | void;

const IDENTIFIER = '[a-zA-Z0-9_]+';

/** The tables whose read-backs the FIN-005 promotion gate depends on. */
const DEFAULT_SELECT_TABLES = [
  'financial_statement_packs',
  'financial_statements',
  'financial_statement_values',
  'financial_analyses',
];

export class FakeFinanceDb {
  private readonly tables = new Map<string, Map<string, FakeRow>>();
  private autoKey = 0;

  readonly calls: FakeCall[] = [];
  run = 1;
  config: FakeDbConfig = {};

  reset(config: FakeDbConfig = {}): void {
    this.tables.clear();
    this.calls.length = 0;
    this.autoKey = 0;
    this.run = 1;
    this.config = config;
  }

  rows(table: string): FakeRow[] {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  row(table: string, id: string): FakeRow | undefined {
    return this.tables.get(table)?.get(id);
  }

  callsFor(run: number, kind?: FakeCall['kind']): FakeCall[] {
    return this.calls.filter((call) => call.run === run && (!kind || call.kind === kind));
  }

  // -- schema probes -------------------------------------------------------

  private tableIsMissing(name: string): boolean {
    return (this.config.missingTables ?? []).includes(name);
  }

  /**
   * `null` = "this table's column list is unknown", which is what the legacy
   * harness simulated. Only tables the test explicitly describes are validated,
   * so an unrelated table (e.g. the shared canonical line registry) is never
   * accidentally reported as column-less.
   */
  private columnsOf(table: string): string[] | null {
    const schema = this.config.schema;
    if (!schema) return null;
    return schema[table] ?? null;
  }

  private isServedBySelect(table: string): boolean {
    const served = this.config.selectTables ?? DEFAULT_SELECT_TABLES;
    return served.includes(table);
  }

  // -- statement execution -------------------------------------------------

  private store(table: string): Map<string, FakeRow> {
    let rows = this.tables.get(table);
    if (!rows) {
      rows = new Map<string, FakeRow>();
      this.tables.set(table, rows);
    }
    return rows;
  }

  private record(kind: FakeCall['kind'], table: string, sql: string, params: unknown[]): void {
    this.calls.push({ run: this.run, kind, table, sql, params });
  }

  /**
   * Give the fault-injection hooks their say; throw what they ask us to throw.
   * `phase` selects which hook runs: `before` = the write is rejected and never
   * reaches the store; `after` = the write HAS landed and the caller is told it
   * failed anyway.
   */
  private maybeFail(
    phase: 'before' | 'after',
    write: {
      kind: 'insert' | 'update';
      table: string;
      id: string | null;
      sql: string;
      params: unknown[];
      values: Record<string, unknown>;
    }
  ): void {
    const hook = phase === 'before' ? this.config.onWrite : this.config.onWriteAfterApply;
    const message = hook?.(write);
    if (message) throw new Error(message);
  }

  async execRun(sql: string, params: unknown[]): Promise<{ success: boolean; changes: number }> {
    const insert = sql.match(
      new RegExp(`INSERT\\s+INTO\\s+(${IDENTIFIER})\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\(([^)]*)\\)`, 'i')
    );
    if (insert) {
      const table = insert[1];
      this.record('insert', table, sql, params);
      if (this.tableIsMissing(table)) throw new Error(`relation "${table}" does not exist`);

      const columns = insert[2]
        .split(',')
        .map((column) => column.trim())
        .filter(Boolean);
      const placeholders = insert[3].split(',').map((token) => token.trim());

      // Map column -> value, honouring inline literals (e.g. CURRENT_TIMESTAMP)
      // that consume a column slot but no bound parameter.
      const incoming: FakeRow = {};
      let paramIndex = 0;
      columns.forEach((column, position) => {
        const placeholder = placeholders[position];
        if (placeholder === '?') {
          incoming[column] = params[paramIndex++];
        } else {
          incoming[column] = placeholder === 'CURRENT_TIMESTAMP' ? '<<now>>' : placeholder;
        }
      });

      const known = this.columnsOf(table);
      if (known) {
        const unknownColumn = columns.find(
          (column) => !known.some((candidate) => candidate.toLowerCase() === column.toLowerCase())
        );
        if (unknownColumn) {
          throw new Error(`column "${unknownColumn}" of relation "${table}" does not exist`);
        }
      }

      const store = this.store(table);
      const id = String(incoming.id ?? `__auto-${++this.autoKey}`);
      const write = { kind: 'insert' as const, table, id, sql, params, values: incoming };
      this.maybeFail('before', write);
      const existing = store.get(id);
      if (!existing) {
        store.set(id, { ...incoming });
        this.maybeFail('after', write);
        return { success: true, changes: 1 };
      }

      // ON CONFLICT ... DO UPDATE SET a=excluded.a, ... (with the IS DISTINCT
      // FROM guard applied semantically: only really-different values land).
      const doUpdate = sql.match(/DO\s+UPDATE\s+SET\s+([\s\S]*?)(?:\s+WHERE\s|$)/i);
      if (!doUpdate) {
        this.maybeFail('after', write);
        return { success: true, changes: 0 };
      }
      let changed = false;
      for (const assignment of doUpdate[1].split(',')) {
        const [rawColumn, rawValue] = assignment.split('=');
        if (!rawColumn || !rawValue) continue;
        const column = rawColumn.trim();
        const source = rawValue.trim();
        if (!source.toLowerCase().startsWith('excluded.')) continue;
        const next = incoming[column];
        if (!Object.is(existing[column], next)) {
          existing[column] = next;
          changed = true;
        }
      }
      if (changed && /updated_at\s*=\s*CURRENT_TIMESTAMP/i.test(doUpdate[1])) {
        existing.updated_at = '<<now>>';
      }
      this.maybeFail('after', write);
      return { success: true, changes: changed ? 1 : 0 };
    }

    const update = sql.match(
      new RegExp(`UPDATE\\s+(${IDENTIFIER})\\s+SET\\s+([\\s\\S]*?)\\s+WHERE\\s+([\\s\\S]*)$`, 'i')
    );
    if (update) {
      const table = update[1];
      this.record('update', table, sql, params);
      if (this.tableIsMissing(table)) throw new Error(`relation "${table}" does not exist`);

      const assignments = update[2]
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      const bound: Array<[string, unknown]> = [];
      const literals: string[] = [];
      let paramIndex = 0;
      for (const assignment of assignments) {
        const [rawColumn, rawValue] = assignment.split('=');
        const column = rawColumn.trim();
        if (rawValue.trim() === '?') bound.push([column, params[paramIndex++]]);
        else if (rawValue.trim().toUpperCase() === 'CURRENT_TIMESTAMP') literals.push(column);
      }
      const id = String(params[paramIndex]);

      const write = {
        kind: 'update' as const,
        table,
        id,
        sql,
        params,
        values: Object.fromEntries(bound),
      };
      this.maybeFail('before', write);

      const store = this.store(table);
      const existing = store.get(id);
      if (!existing) {
        this.maybeFail('after', write);
        return { success: true, changes: 0 };
      }

      let changed = false;
      for (const [column, value] of bound) {
        if (!Object.is(existing[column], value)) {
          existing[column] = value;
          changed = true;
        }
      }
      if (changed) {
        for (const column of literals) existing[column] = '<<now>>';
      }
      this.maybeFail('after', write);
      return { success: true, changes: changed ? 1 : 0 };
    }

    this.record('other', '', sql, params);
    return { success: true, changes: 0 };
  }

  async execAll(sql: string, params: unknown[]): Promise<FakeRow[]> {
    if (/information_schema\.columns/i.test(sql)) {
      // `SELECT EXISTS (... WHERE table_name = $1 AND column_name = $2)` — the
      // single-column probe used by `demoSeedService.columnExists`.
      if (/EXISTS/i.test(sql) && params.length >= 2) {
        const known = this.columnsOf(String(params[0]));
        const exists = known
          ? known.some((column) => column.toLowerCase() === String(params[1]).toLowerCase())
          : true;
        return [{ exists }];
      }
      // The seed's own column-list probe, which binds a table name.
      if (params.length === 0) return [];
      const known = this.columnsOf(String(params[0]));
      if (!known) return [];
      return known.map((column) => ({ column_name: column.toLowerCase() }));
    }
    if (/information_schema\.tables/i.test(sql)) {
      return [{ exists: !this.tableIsMissing(String(params[0])) }];
    }

    const select = sql.match(
      new RegExp(`SELECT\\s+([\\s\\S]*?)\\s+FROM\\s+(${IDENTIFIER})([\\s\\S]*)$`, 'i')
    );
    if (!select) return [];
    const columns = select[1]
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean);
    const table = select[2];
    this.record('select', table, sql, params);
    if (this.tableIsMissing(table)) throw new Error(`relation "${table}" does not exist`);
    if (!this.isServedBySelect(table)) return [];
    if (!this.tables.has(table)) return [];

    const known = this.columnsOf(table);
    if (known) {
      const unknownColumn = columns.find(
        (column) => !known.some((candidate) => candidate.toLowerCase() === column.toLowerCase())
      );
      if (unknownColumn) {
        throw new Error(`column "${unknownColumn}" does not exist`);
      }
    }

    const wherePart = select[3].match(/WHERE\s+([\s\S]*)$/i);
    const predicates: Array<[string, unknown]> = [];
    if (wherePart) {
      const conditions = wherePart[1].split(/\s+AND\s+/i);
      let paramIndex = 0;
      for (const condition of conditions) {
        const match = condition.match(new RegExp(`(${IDENTIFIER})\\s*=\\s*\\?`));
        if (match) predicates.push([match[1], params[paramIndex++]]);
      }
    }

    let rows = this.rows(table).filter((row) =>
      predicates.every(([column, value]) => String(row[column] ?? '') === String(value ?? ''))
    );
    if (this.config.onSelect) rows = this.config.onSelect(table, rows);

    return rows.map((row) => {
      const projected: FakeRow = {};
      for (const column of columns) projected[column] = row[column];
      return projected;
    });
  }

  async execGet(sql: string, params: unknown[]): Promise<FakeRow | null> {
    if (/information_schema\.tables/i.test(sql)) {
      return { exists: !this.tableIsMissing(String(params[0])) };
    }
    const rows = await this.execAll(sql, params);
    return rows[0] ?? null;
  }
}

/** One instance per test module — `vi.mock` and the test file share it. */
export const fakeDb = new FakeFinanceDb();

/** The object a `vi.mock('../../../utils/DbPromise.js', …)` factory should return. */
export function createDbPromiseMock(vi: {
  fn: <T extends (...args: never[]) => unknown>(implementation: T) => T;
}): Record<string, unknown> {
  return {
    get: vi.fn((async (sql: string, params: unknown[] = []) =>
      fakeDb.execGet(sql, params)) as never),
    all: vi.fn((async (sql: string, params: unknown[] = []) =>
      fakeDb.execAll(sql, params)) as never),
    run: vi.fn((async (sql: string, params: unknown[] = []) =>
      fakeDb.execRun(sql, params)) as never),
    transaction: vi.fn((async () => ({ success: true, results: [] })) as never),
    tableExists: vi.fn((async () => true) as never),
    columnExists: vi.fn((async () => true) as never),
    exec: vi.fn((async () => ({ success: true })) as never),
    safeAll: vi.fn((async () => []) as never),
    count: vi.fn((async () => 0) as never),
    DbPromise: {},
    default: {},
  };
}
