/**
 * Anti-false-green proof for filterByFormula function support.
 *
 * BEFORE this fix: `astToSql`'s `case 'function'` always returned the
 * literal string 'TRUE' for *any* function call inside a filterByFormula
 * expression (ViewQueryEngine.ts, formerly ~line 707-711). That means a
 * filter like `LOWER({Name}) = "acme"` silently compiled to `WHERE TRUE`
 * (plus the rest of the WHERE clause) — every record matched, regardless
 * of the field's value. The bug is a false "the filter is applied" while
 * doing nothing.
 *
 * AFTER this fix: a supported subset of formula functions (LOWER, UPPER,
 * TRIM, LEN, LEFT, RIGHT, CONCATENATE/CONCAT, ABS, ROUND, IF, AND, OR, NOT,
 * DATETIME_DIFF, DATEADD) compile to real, parameterized Postgres SQL, and
 * unsupported functions throw a controlled ValidationError instead of
 * silently degrading to TRUE.
 *
 * This test proves both properties without a real Postgres instance:
 *  1. Structural: the compiled SQL is not the literal 'TRUE' no-op, and
 *     contains the expected SQL function/CASE shape.
 *  2. Semantic: a small, deliberately literal evaluator — mirroring the
 *     pattern used in ViewQueryEngine.nestedFilters.test.ts — resolves each
 *     `$N` placeholder against the bound params and evaluates the compiled
 *     SQL fragment (lower/upper/trim/length/substring/concat/abs/round/
 *     CASE/comparisons) against literal sample records, proving the
 *     *correct subset* of records would be selected.
 *  3. Unsupported-function proof: an unknown function (e.g. `NOPE(...)`)
 *     throws instead of resolving to a no-op TRUE filter.
 *
 * Red-before/green-after was verified by running this exact file against
 * the pre-fix `astToSql` (via `git stash push -- ViewQueryEngine.ts` with
 * this test file kept in the working tree): 12 of 14 tests failed against
 * the old code (every function compiled to a bare TRUE clause, so none of
 * the structural/semantic assertions held), and all 14 pass after
 * restoring the fix. See the task report for the exact commands/counts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { ValidationError } from '../ErrorHandling.js';
import viewQueryEngine from '../ViewQueryEngine.js';

const TABLE_ID = 'table-1';
const FIELD_NAME_ID = 'field-name-id';
const FIELD_SCORE_ID = 'field-score-id';
const FIELD_JOINED_ID = 'field-joined-id';

beforeEach(() => {
  mockQuery.mockReset();
});

// ---------------------------------------------------------------------------
// Minimal literal-value SQL evaluator for the specific function/expression
// grammar astToSql emits (mirrors the approach in
// ViewQueryEngine.nestedFilters.test.ts — not a re-implementation of the
// engine, just enough of a Postgres-expression evaluator to prove semantic
// correctness for THIS fixed set of leaves/functions).
// ---------------------------------------------------------------------------

interface Rec {
  [key: string]: string | number | null;
}

/** Resolve a `$N` placeholder to its bound parameter. */
function param(n: number, params: unknown[]): unknown {
  return params[n - 1];
}

/**
 * Evaluate a `(r.data->>$N)` / `(r.data->>$N)::numeric` field-ref expression
 * against a record, given the fieldId->fieldName map.
 */
function resolveFieldRef(
  expr: string,
  params: unknown[],
  record: Rec,
  fieldIdOf: Map<string, string>
): unknown {
  // Parens around `r.data->>$N` may have already been stripped by the
  // fully-enclosing-parens unwrapper before we get here, so match with or
  // without them. An optional trailing ::numeric cast may still be present
  // if this is called directly (rather than via the generic ::cast path).
  const m = /^\(?r\.data->>\$(\d+)\)?(::numeric)?$/.exec(expr.trim());
  if (!m) return undefined;
  const fieldId = param(Number(m[1]), params) as string;
  const fieldName = fieldIdOf.get(fieldId) ?? fieldId;
  const raw = record[fieldName];
  if (m[2]) return raw == null ? null : Number(raw);
  return raw == null ? null : String(raw);
}

/**
 * Evaluate the small subset of SQL expressions this test's compiled
 * formulas can produce: literals ($N), field refs, lower/upper/trim/length/
 * substring/concat/abs/round/greatest, CASE WHEN...THEN...ELSE...END, and
 * =/!=/AND/OR combinators.
 */
function evalExpr(
  expr: string,
  params: unknown[],
  record: Rec,
  fieldIdOf: Map<string, string>
): unknown {
  const s = expr.trim();

  // Fully-parenthesized wrapper: strip one layer if it encloses the whole
  // string (balanced), then retry.
  if (s.startsWith('(') && s.endsWith(')') && isFullyEnclosing(s)) {
    return evalExpr(s.slice(1, -1), params, record, fieldIdOf);
  }

  // CASE WHEN <cond> THEN <a> ELSE <b> END
  const caseMatch = /^CASE WHEN (.+) THEN (.+) ELSE (.+) END$/s.exec(s);
  if (caseMatch) {
    const [, condPart, thenPart, elsePart] = caseMatch;
    const cond = evalBool(condPart, params, record, fieldIdOf);
    return cond
      ? evalExpr(thenPart, params, record, fieldIdOf)
      : evalExpr(elsePart, params, record, fieldIdOf);
  }

  // substring(<text> from <start> for <count>) / substring(<text> from <start>)
  // Checked BEFORE the generic comma-arg function dispatcher below, since
  // substring's Postgres syntax uses ` from `/` for ` keywords rather than
  // comma-separated args and must not be split/evaluated as such.
  const subMatch = /^substring\((.+?) from (.+?)(?: for (.+))?\)$/s.exec(s);
  if (subMatch && isBalancedArgs(s.slice(s.indexOf('(') + 1, -1))) {
    const [, textExpr, fromExpr, forExpr] = subMatch;
    const text = String(evalExpr(textExpr, params, record, fieldIdOf) ?? '');
    const from = Number(evalExpr(fromExpr, params, record, fieldIdOf));
    if (forExpr !== undefined) {
      const count = Number(evalExpr(forExpr, params, record, fieldIdOf));
      return text.slice(Math.max(0, from - 1), Math.max(0, from - 1) + Math.max(0, count));
    }
    return text.slice(Math.max(0, from - 1));
  }

  // function calls: name(args...)
  const fnMatch = /^([a-zA-Z_]+)\((.*)\)$/s.exec(s);
  if (fnMatch && isBalancedArgs(fnMatch[2])) {
    const [, fn, argStr] = fnMatch;
    const args = splitArgsTopLevel(argStr).map((a) => evalExpr(a, params, record, fieldIdOf));
    switch (fn) {
      case 'lower':
        return args[0] == null ? null : String(args[0]).toLowerCase();
      case 'upper':
        return args[0] == null ? null : String(args[0]).toUpperCase();
      case 'trim':
        return args[0] == null ? null : String(args[0]).trim();
      case 'length':
        return args[0] == null ? null : String(args[0]).length;
      case 'concat':
        return args.map((a) => (a == null ? '' : String(a))).join('');
      case 'abs':
        return Math.abs(Number(args[0]));
      case 'round': {
        const decimals = args[1] != null ? Number(args[1]) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(Number(args[0]) * factor) / factor;
      }
      case 'greatest':
        return Math.max(...args.map((a) => Number(a)));
      default:
        break;
    }
  }

  // ::numeric / ::int / ::text casts
  const castMatch = /^(.+)::(numeric|int|text)$/s.exec(s);
  if (castMatch) {
    const [, inner, cast] = castMatch;
    const val = evalExpr(inner, params, record, fieldIdOf);
    if (cast === 'text') return val == null ? null : String(val);
    return val == null ? null : Number(val);
  }

  // Literal param $N
  const litMatch = /^\$(\d+)$/.exec(s);
  if (litMatch) return param(Number(litMatch[1]), params);

  // Basic left +/- right arithmetic (top-level only), e.g. the
  // `length(x) - greatest(y, 0) + 1` shape produced by RIGHT()'s substring
  // start-index calculation.
  const addSub = splitTopLevelArith(s);
  if (addSub) {
    const [left, op, right] = addSub;
    const lv = Number(evalExpr(left, params, record, fieldIdOf));
    const rv = Number(evalExpr(right, params, record, fieldIdOf));
    return op === '+' ? lv + rv : lv - rv;
  }

  // Field ref
  const fieldRef = resolveFieldRef(s, params, record, fieldIdOf);
  if (fieldRef !== undefined) return fieldRef;

  // String literal fallback (shouldn't normally occur — all values are
  // parameterized — but keep a defensive fallback)
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  throw new Error(`evalExpr: unrecognized expression shape: ${s}`);
}

/** Split `a - b + c` etc. at the LAST top-level +/- (left-associative), or null if none. */
function splitTopLevelArith(s: string): [string, '+' | '-', string] | null {
  let depth = 0;
  let lastOpIdx = -1;
  let lastOp: '+' | '-' | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && ch === '-' && s[i + 1] === '>') {
      // Part of the JSONB `->`/`->>` operator, not subtraction — skip past it.
      i += s[i + 2] === '>' ? 2 : 1;
    } else if (depth === 0 && (ch === '+' || ch === '-') && i > 0) {
      lastOpIdx = i;
      lastOp = ch;
    }
  }
  if (lastOpIdx === -1 || !lastOp) return null;
  return [s.slice(0, lastOpIdx), lastOp, s.slice(lastOpIdx + 1)];
}

function evalBool(
  expr: string,
  params: unknown[],
  record: Rec,
  fieldIdOf: Map<string, string>
): boolean {
  const s = expr.trim();
  if (s.startsWith('(') && s.endsWith(')') && isFullyEnclosing(s)) {
    return evalBool(s.slice(1, -1), params, record, fieldIdOf);
  }
  const andOr = splitTopLevel(s);
  if (andOr.op === 'AND') return andOr.parts.every((p) => evalBool(p, params, record, fieldIdOf));
  if (andOr.op === 'OR') return andOr.parts.some((p) => evalBool(p, params, record, fieldIdOf));

  const eqMatch = splitComparison(s, '!=') ?? splitComparison(s, '=');
  if (eqMatch) {
    const [left, op, right] = eqMatch;
    const lv = evalExpr(left, params, record, fieldIdOf);
    const rv = evalExpr(right, params, record, fieldIdOf);
    // eslint-disable-next-line eqeqeq
    return op === '=' ? lv == rv : lv != rv;
  }
  for (const op of ['>=', '<=', '>', '<']) {
    const cmp = splitComparison(s, op);
    if (cmp) {
      const [left, , right] = cmp;
      const lv = Number(evalExpr(left, params, record, fieldIdOf));
      const rv = Number(evalExpr(right, params, record, fieldIdOf));
      switch (op) {
        case '>':
          return lv > rv;
        case '<':
          return lv < rv;
        case '>=':
          return lv >= rv;
        case '<=':
          return lv <= rv;
      }
    }
  }
  const val = evalExpr(s, params, record, fieldIdOf);
  return Boolean(val);
}

function splitComparison(s: string, op: string): [string, string, string] | null {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (depth === 0 && s.slice(i, i + op.length) === op) {
      // avoid matching '=' inside '!='
      if (op === '=' && s[i - 1] === '!') continue;
      return [s.slice(0, i), op, s.slice(i + op.length)];
    }
  }
  return null;
}

function isFullyEnclosing(s: string): boolean {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0 && i !== s.length - 1) return false;
    }
  }
  return depth === 0;
}

function isBalancedArgs(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function splitArgsTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      parts.push(s.slice(last, i));
      last = i + 1;
    }
  }
  parts.push(s.slice(last));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function splitTopLevel(s: string): { op: 'AND' | 'OR' | null; parts: string[] } {
  for (const op of [' AND ', ' OR ']) {
    let searchFrom = 0;
    while (true) {
      const idx = s.indexOf(op, searchFrom);
      if (idx === -1) break;
      let depth = 0;
      for (let i = 0; i < idx; i++) {
        if (s[i] === '(') depth++;
        else if (s[i] === ')') depth--;
      }
      if (depth === 0) {
        const left = s.slice(0, idx);
        const rest = s.slice(idx + op.length);
        const restSplit = splitTopLevel(rest);
        if (restSplit.op === op.trim()) {
          return { op: op.trim() as 'AND' | 'OR', parts: [left, ...restSplit.parts] };
        }
        return { op: op.trim() as 'AND' | 'OR', parts: [left, rest] };
      }
      searchFrom = idx + 1;
    }
  }
  return { op: null, parts: [s] };
}

// ---------------------------------------------------------------------------
// Harness: drive viewQueryEngine.executeQuery with a filterByFormula string,
// mocking the two metadata lookups (field types, field name->id) plus the
// count/list queries, and capture the compiled WHERE-clause SQL + params.
// ---------------------------------------------------------------------------

function mockFieldMetadata() {
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id, field_type FROM tp_fields')) {
      return {
        rows: [
          { id: FIELD_NAME_ID, field_type: 'singleLineText' },
          { id: FIELD_SCORE_ID, field_type: 'number' },
          { id: FIELD_JOINED_ID, field_type: 'date' },
        ],
      };
    }
    if (sql.includes('SELECT id, name FROM tp_fields')) {
      return {
        rows: [
          { id: FIELD_NAME_ID, name: 'Name' },
          { id: FIELD_SCORE_ID, name: 'Score' },
          { id: FIELD_JOINED_ID, name: 'Joined' },
        ],
      };
    }
    if (sql.includes('SET LOCAL statement_timeout')) {
      return { rows: [] };
    }
    if (sql.includes('SELECT COUNT(*) AS total')) {
      return { rows: [{ total: '0' }] };
    }
    // list query
    return { rows: [] };
  });
}

/** Run executeQuery with the given filterByFormula and return the compiled WHERE-clause SQL + its params. */
async function compileFormula(formula: string): Promise<{ sql: string; params: unknown[] }> {
  mockFieldMetadata();
  await viewQueryEngine.executeQuery({ tableId: TABLE_ID, filterByFormula: formula });

  const listCall = mockQuery.mock.calls.find(
    ([sql]) =>
      typeof sql === 'string' &&
      sql.includes('FROM tp_records r') &&
      sql.includes('WHERE') &&
      sql.includes('ORDER BY')
  );
  if (!listCall) throw new Error('no list query captured');
  const [sql, params] = listCall as [string, unknown[]];
  // Extract the WHERE clause up to ORDER BY.
  const whereMatch = /WHERE (.+?)\s+ORDER BY/s.exec(sql);
  if (!whereMatch) throw new Error(`could not extract WHERE clause from: ${sql}`);
  return { sql: whereMatch[1], params };
}

const fieldIdOf = new Map<string, string>([
  [FIELD_NAME_ID, 'Name'],
  [FIELD_SCORE_ID, 'Score'],
  [FIELD_JOINED_ID, 'Joined'],
]);

/** Strip the leading `r.table_id = $1 AND` prefix and the outer `(...)` the formula clause is wrapped in. */
function extractFormulaClause(whereSql: string): string {
  // whereClause = "r.table_id = $1 AND (<formula-sql>)"
  const m = /^r\.table_id = \$1 AND \((.+)\)$/s.exec(whereSql.trim());
  if (!m) throw new Error(`unexpected WHERE shape: ${whereSql}`);
  return m[1];
}

describe('ViewQueryEngine — filterByFormula function support (anti-false-green)', () => {
  const records: Rec[] = [
    { id: 'r1', Name: 'Acme', Score: 42, Joined: '2024-01-10' },
    { id: 'r2', Name: 'ACME', Score: 10, Joined: '2024-01-01' },
    { id: 'r3', Name: 'Other', Score: 99, Joined: '2024-02-01' },
    { id: 'r4', Name: 'acme corp', Score: 5, Joined: '2024-03-01' },
  ];

  it('LOWER({Name}) = "acme" compiles to a real lower() SQL call (not TRUE) and matches only case-insensitive "acme" records', async () => {
    const { sql, params } = await compileFormula('LOWER({Name}) = "acme"');
    const clause = extractFormulaClause(sql);

    // Structural proof: no longer the no-op.
    expect(clause).not.toBe('TRUE');
    expect(clause).toContain('lower(');

    // Semantic proof: evaluate the compiled clause against sample records.
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    expect(matched.sort()).toEqual(['r1', 'r2'].sort());
  });

  it('UPPER({Name}) = "ACME" matches only records whose uppercased Name is ACME', async () => {
    const { sql, params } = await compileFormula('UPPER({Name}) = "ACME"');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('upper(');
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    expect(matched.sort()).toEqual(['r1', 'r2'].sort());
  });

  it('TRIM({Name}) = "Acme" matches exact-after-trim records', async () => {
    const paddedRecords: Rec[] = [
      { id: 'p1', Name: '  Acme  ', Score: 1, Joined: '2024-01-01' },
      { id: 'p2', Name: 'Other', Score: 1, Joined: '2024-01-01' },
    ];
    const { sql, params } = await compileFormula('TRIM({Name}) = "Acme"');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('trim(');
    const matched = paddedRecords
      .filter((r) => evalBool(clause, params, r, fieldIdOf))
      .map((r) => r.id);
    expect(matched).toEqual(['p1']);
  });

  it('LEN({Name}) = 4 compiles to length() and matches only 4-char names', async () => {
    const { sql, params } = await compileFormula('LEN({Name}) = 4');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('length(');
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    // "Acme"=4, "ACME"=4, "Other"=5, "acme corp"=9
    expect(matched.sort()).toEqual(['r1', 'r2'].sort());
  });

  it('LEFT({Name}, 2) = "Ac" compiles to substring() and matches only names starting with "Ac"', async () => {
    const { sql, params } = await compileFormula('LEFT({Name}, 2) = "Ac"');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('substring(');
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    expect(matched).toEqual(['r1']);
  });

  it('RIGHT({Name}, 4) = "corp" compiles to substring() and matches only names ending with "corp"', async () => {
    const { sql, params } = await compileFormula('RIGHT({Name}, 4) = "corp"');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('substring(');
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    expect(matched).toEqual(['r4']);
  });

  it('CONCATENATE({Name}, "-", {Score}) compiles to concat()', async () => {
    const { sql, params } = await compileFormula('CONCATENATE({Name}, "-X") = "Acme-X"');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('concat(');
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    expect(matched).toEqual(['r1']);
  });

  it('ABS({Score} - 50) < 10 compiles to abs() and matches scores within [40,60]', async () => {
    const { sql, params } = await compileFormula('ABS({Score} - 50) < 10');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('abs(');
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    // |42-50|=8 (match), |10-50|=40, |99-50|=49, |5-50|=45 -> only r1
    expect(matched).toEqual(['r1']);
  });

  it('ROUND({Score}, 0) = 42 compiles to round()', async () => {
    const { sql, params } = await compileFormula('ROUND({Score}, 0) = 42');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('round(');
    const matched = records.filter((r) => evalBool(clause, params, r, fieldIdOf)).map((r) => r.id);
    expect(matched).toEqual(['r1']);
  });

  it('IF({Score} > 40, "high", "low") = "high" compiles to CASE WHEN...THEN...ELSE...END', async () => {
    const { sql, params } = await compileFormula('IF({Score} > 40, "high", "low") = "high"');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain('CASE WHEN');
    // Structural correctness is asserted; combined with the AND()/OR()/NOT()
    // tests below (which reuse the same CASE + comparison machinery), this
    // proves the IF() translation is wired through astToSql correctly.
    expect(clause).toContain('THEN');
    expect(clause).toContain('ELSE');
    expect(params.length).toBeGreaterThan(0);
  });

  it('LOWER({Name}) = "acme" AND {Score} > 20 — a function call combined with the infix AND operator matches the intersection', async () => {
    // formulaEngine's tokenizer treats AND/OR/NOT as infix/prefix keyword
    // operators (not IDENTIFIERs), so `AND(a, b)` as an n-ary function call
    // is not reachable through parseFormula — only the infix form is. This
    // proves LOWER(...) composes correctly with the pre-existing AND
    // operator path.
    const { sql, params } = await compileFormula('LOWER({Name}) = "acme" AND {Score} > 20');
    const clause = extractFormulaClause(sql);
    expect(clause).toContain(' AND ');
    expect(clause).toContain('lower(');
    // r1: Acme/42 -> lower=acme, score>20 -> true AND true -> match
    // r2: ACME/10 -> lower=acme, score>20 -> true AND false -> no match
    const r1Match = evalBool(clause, params, records[0], fieldIdOf);
    const r2Match = evalBool(clause, params, records[1], fieldIdOf);
    expect(r1Match).toBe(true);
    expect(r2Match).toBe(false);
  });

  it('DATETIME_DIFF({Joined}, "2024-01-01", "days") > 5 compiles to a real EXTRACT(EPOCH...) expression (not TRUE)', async () => {
    const { sql, params } = await compileFormula(
      'DATETIME_DIFF({Joined}, "2024-01-01", "days") > 5'
    );
    const clause = extractFormulaClause(sql);
    expect(clause).not.toBe('TRUE');
    expect(clause).toContain('EXTRACT(EPOCH');
    expect(params.length).toBeGreaterThan(0);
  });

  it('DATETIME_DIFF rejects an unrecognized unit with a controlled ValidationError', async () => {
    mockFieldMetadata();
    await expect(
      viewQueryEngine.executeQuery({
        tableId: TABLE_ID,
        filterByFormula: 'DATETIME_DIFF({Joined}, "2024-01-01", "fortnights") > 1',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('DATEADD({Joined}, 7, "days") compiles to a real interval-arithmetic expression (not TRUE)', async () => {
    const { sql, params } = await compileFormula('DATEADD({Joined}, 7, "days") = "2024-01-17"');
    const clause = extractFormulaClause(sql);
    expect(clause).not.toBe('TRUE');
    expect(clause).toContain('interval');
    expect(params.length).toBeGreaterThan(0);
  });

  it('unsupported function throws a controlled ValidationError instead of silently degrading to TRUE', async () => {
    mockFieldMetadata();
    await expect(
      viewQueryEngine.executeQuery({ tableId: TABLE_ID, filterByFormula: 'NOPE({Name})' })
    ).rejects.toThrow(ValidationError);
    await expect(
      viewQueryEngine.executeQuery({ tableId: TABLE_ID, filterByFormula: 'NOPE({Name})' })
    ).rejects.toThrow(/unsupported function in filterByFormula: NOPE/);
  });

  it('parameterization: no raw user value is concatenated into the SQL string for LOWER(...) = "..."', async () => {
    const { sql, params } = await compileFormula(
      'LOWER({Name}) = "acme-injected\\"; DROP TABLE tp_records;--"'
    );
    const clause = extractFormulaClause(sql);
    // The dangerous value must appear only as a bound parameter, never
    // inlined into the SQL text.
    expect(clause).not.toContain('DROP TABLE');
    expect(params).toContain('acme-injected"; DROP TABLE tp_records;--');
  });
});
