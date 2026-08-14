/**
 * Tiny in-memory SQL-lite engine for method-core unit tests.
 *
 * WHY NOT THE APP-WIDE MOCK (server/src/database/Database.ts createMockDatabase):
 * that mock's SELECT WHERE-clause parser only evaluates predicates for a
 * fixed allow-list of column names (id, organization_id, user_id, pack_id,
 * idempotency_key, ...). `session_id` — the column every method-core table
 * filters by — is NOT on that list, so a bare `WHERE session_id = ?` would
 * silently return every row in the table under that mock, making these
 * tests unable to actually prove isolation/idempotency. Precedent for
 * swapping in a purpose-built fake instead of the app-wide mock already
 * exists in this repo (see
 * server/src/routes/v8/__tests__/execution-realization.contract.test.ts).
 *
 * This engine only needs to understand the exact SQL shapes MethodEventStore
 * / MethodSessionService / MethodPackRegistry / TeresaProposalService emit
 * (single-table INSERT/SELECT/UPDATE, `col = ?` / `col IS [NOT] NULL`
 * AND-only WHERE clauses, `col = col + 1` increments, and `ON CONFLICT
 * (col[, col...]) ... DO NOTHING` — including composite conflict targets,
 * which the app-wide mock does not support at all). It is intentionally not
 * a general SQL parser.
 */

type Row = Record<string, unknown>;

export interface RunResult {
  success: boolean;
  changes?: number;
  error?: string;
  lastID?: number;
}

export interface KernelTestDbHandle {
  all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[], options?: { fallback?: boolean }): Promise<RunResult>;
  /** Direct seed, bypassing SQL parsing — for test setup preconditions. */
  insertRow(table: string, row: Row): void;
  getRows(table: string): Row[];
  reset(): void;
}

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function extractParen(sql: string, fromIndex: number): { content: string; endIndex: number } {
  const start = sql.indexOf('(', fromIndex);
  if (start < 0) throw new Error(`kernelTestDb: expected "(" after index ${fromIndex} in: ${sql}`);
  let depth = 0;
  for (let i = start; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') {
      depth--;
      if (depth === 0) return { content: sql.slice(start + 1, i), endIndex: i + 1 };
    }
  }
  throw new Error(`kernelTestDb: unbalanced parens in: ${sql}`);
}

function splitTopLevelCsv(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseWhereClause(
  whereSql: string,
  params: unknown[],
  cursor: { i: number }
): (row: Row) => boolean {
  const clauses = whereSql
    .split(/\bAND\b/i)
    .map((c) => c.trim())
    .filter(Boolean);
  const tests: Array<(row: Row) => boolean> = [];
  for (const clause of clauses) {
    let m: RegExpMatchArray | null;
    if ((m = clause.match(/^([a-zA-Z0-9_.]+)\s*=\s*\?$/))) {
      const col = m[1].split('.').pop() as string;
      const value = params[cursor.i++];
      tests.push((row) => row[col] === value);
    } else if ((m = clause.match(/^([a-zA-Z0-9_.]+)\s+IS\s+NOT\s+NULL$/i))) {
      const col = m[1].split('.').pop() as string;
      tests.push((row) => row[col] != null);
    } else if ((m = clause.match(/^([a-zA-Z0-9_.]+)\s+IS\s+NULL$/i))) {
      const col = m[1].split('.').pop() as string;
      tests.push((row) => row[col] == null);
    } else {
      throw new Error(`kernelTestDb: unsupported WHERE clause "${clause}" in "${whereSql}"`);
    }
  }
  return (row) => tests.every((t) => t(row));
}

export function createKernelTestDb(): KernelTestDbHandle {
  const tables = new Map<string, Row[]>();

  function table(name: string): Row[] {
    const key = name.toLowerCase();
    let rows = tables.get(key);
    if (!rows) {
      rows = [];
      tables.set(key, rows);
    }
    return rows;
  }

  function applySelect(sql: string, params: unknown[]): Row[] {
    const s = normalize(sql);
    const fromMatch = s.match(/from\s+([a-zA-Z0-9_]+)/i);
    if (!fromMatch) throw new Error(`kernelTestDb: cannot find FROM table in: ${s}`);
    const rows = table(fromMatch[1]);
    const whereIdx = s.search(/\bwhere\b/i);
    if (whereIdx < 0) return rows.slice();
    const wherePart = s.slice(whereIdx + 5);
    const test = parseWhereClause(wherePart, params, { i: 0 });
    return rows.filter(test);
  }

  function applyInsert(sql: string, params: unknown[]): RunResult {
    const s = normalize(sql);
    const intoMatch = s.match(/insert into\s+([a-zA-Z0-9_]+)/i);
    if (!intoMatch) throw new Error(`kernelTestDb: cannot parse INSERT table in: ${s}`);
    const tableName = intoMatch[1];
    const afterInto = (intoMatch.index ?? 0) + intoMatch[0].length;
    const cols = extractParen(s, afterInto);
    const colNames = splitTopLevelCsv(cols.content);

    const valuesIdx = s.toLowerCase().indexOf('values', cols.endIndex);
    if (valuesIdx < 0) throw new Error(`kernelTestDb: no VALUES clause in: ${s}`);
    const values = extractParen(s, valuesIdx);
    const tokens = splitTopLevelCsv(values.content);

    let pi = 0;
    const row: Row = {};
    tokens.forEach((tokRaw, idx) => {
      const col = colNames[idx];
      const tok = tokRaw.trim();
      if (tok === '?') row[col] = params[pi++];
      else if (/^null$/i.test(tok)) row[col] = null;
      else row[col] = tok.replace(/^'(.*)'$/, '$1');
    });

    const rest = s.slice(values.endIndex);
    let conflictCols: string[] | null = null;
    const onConflictIdx = rest.search(/on conflict/i);
    if (onConflictIdx >= 0) {
      const conflictParen = extractParen(rest, onConflictIdx);
      conflictCols = splitTopLevelCsv(conflictParen.content);
    }

    const rows = table(tableName);
    if (conflictCols && conflictCols.length) {
      const newRowHasNull = conflictCols.some((c) => row[c] == null);
      if (!newRowHasNull) {
        const isDuplicate = rows.some((existing) =>
          conflictCols!.every((c) => existing[c] === row[c])
        );
        if (isDuplicate) return { success: true, changes: 0 };
      }
    }

    rows.push(row);
    return { success: true, changes: 1 };
  }

  function applyUpdate(sql: string, params: unknown[]): RunResult {
    const s = normalize(sql);
    const m = s.match(/^update\s+([a-zA-Z0-9_]+)\s+set\s+(.*?)\s+where\s+(.*)$/i);
    if (!m) throw new Error(`kernelTestDb: cannot parse UPDATE in: ${s}`);
    const tableName = m[1];
    const setPart = m[2];
    const wherePart = m[3];
    const rows = table(tableName);

    const assigns = splitTopLevelCsv(setPart);
    type AssignOp = { col: string; kind: 'param' | 'null' | 'increment' };
    const ops: AssignOp[] = [];
    let paramsConsumedBySet = 0;
    for (const a of assigns) {
      const mm = a.match(/^([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
      if (!mm) throw new Error(`kernelTestDb: cannot parse SET assignment "${a}"`);
      const col = mm[1];
      const rhs = mm[2].trim();
      if (rhs === '?') {
        ops.push({ col, kind: 'param' });
        paramsConsumedBySet++;
      } else if (/^null$/i.test(rhs)) {
        ops.push({ col, kind: 'null' });
      } else if (new RegExp(`^${col}\\s*\\+\\s*1$`, 'i').test(rhs)) {
        ops.push({ col, kind: 'increment' });
      } else {
        throw new Error(`kernelTestDb: unsupported SET rhs "${rhs}"`);
      }
    }

    const cursor = { i: paramsConsumedBySet };
    const test = parseWhereClause(wherePart, params, cursor);

    let changes = 0;
    rows.forEach((row) => {
      if (!test(row)) return;
      let ai = 0;
      ops.forEach((op) => {
        if (op.kind === 'param') row[op.col] = params[ai++];
        else if (op.kind === 'null') {
          row[op.col] = null;
          ai += 0;
        } else if (op.kind === 'increment') {
          row[op.col] = Number(row[op.col] ?? 0) + 1;
        }
      });
      changes++;
    });

    return { success: true, changes };
  }

  return {
    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
      return applySelect(sql, params) as T[];
    },
    async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
      const rows = applySelect(sql, params);
      return (rows[0] as T | undefined) ?? null;
    },
    async run(sql: string, params: unknown[] = []): Promise<RunResult> {
      const s = normalize(sql);
      try {
        if (/^insert into/i.test(s)) return applyInsert(s, params);
        if (/^update\s/i.test(s)) return applyUpdate(s, params);
        throw new Error(`kernelTestDb: unsupported run() statement: ${s}`);
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    insertRow(tableName: string, row: Row): void {
      table(tableName).push({ ...row });
    },
    getRows(tableName: string): Row[] {
      return table(tableName).slice();
    },
    reset(): void {
      tables.clear();
    },
  };
}
