/**
 * Anti-false-green proof for nested filter groups (Airtable-style AND/OR-in-
 * AND/OR).
 *
 * This test is designed to be RED against the pre-nesting ViewQueryEngine
 * (flat `FilterGroup { logic, rules: FilterRule[] }`) and GREEN once
 * `buildFilterClause` supports `rules: Array<FilterRule | FilterGroup>`.
 *
 * Two independent lines of proof are used:
 *  1. Structural: the generated SQL parenthesizes the nested group correctly
 *     and the parameter list matches what the tree implies.
 *  2. Semantic: a tiny, deterministic boolean-expression evaluator (NOT a
 *     mock of the engine — a direct evaluator of the SQL string's `AND`/`OR`/
 *     parens structure) runs the generated clause against literal sample
 *     records to prove the *correct subset* is selected, not just that the
 *     SQL text "looks right".
 *
 * On the pre-nesting engine, a nested group passed inside `rules` has no
 * `fieldId`, so `buildFilterClause`'s `if (!rule.fieldId) continue;` guard
 * silently drops it — producing `(A=1)` instead of `(A=1 AND (B=2 OR C=3))`,
 * which over-matches and fails the semantic assertions below.
 */
import { describe, expect, it } from 'vitest';

import { buildFilterClause, type FilterGroup } from '../ViewQueryEngine.js';

// ---------------------------------------------------------------------------
// Minimal literal-value SQL boolean evaluator
// ---------------------------------------------------------------------------
// buildFilterClause() for equality rules on number/text/select fields emits
// leaves of the exact shape `(r.data->>$N = $N+1)` or the not-equals /
// IS NULL variants used below. We don't need a real Postgres to prove
// semantic correctness for this fixed set of operators: we simply resolve
// each `$N` placeholder to its bound param and evaluate the resulting
// boolean tree against a plain JS record. This function is intentionally
// dumb and literal — it is not a re-implementation of the query engine, it
// is a textbook recursive-descent evaluator for `(expr) AND/OR (expr)` with
// `col = val` / `col != val` leaves, which is all this test's rules produce.

interface Rec {
  [key: string]: string | number;
}

function evalLeaf(leaf: string, params: unknown[], record: Rec, fieldIdOf: Map<string, string>): boolean {
  // Leaf shapes emitted by buildSingleFilterClause for 'equals'/'notequals'
  // on number/text fields in this test:
  //   (r.data->>$N)::numeric = $M            [number equals]
  //   ((r.data->>$N)::numeric IS NULL OR (r.data->>$N)::numeric != $M)  [number not-equals]
  //   r.data->>$N = $M                        [text equals]
  //   (r.data->>$N IS NULL OR r.data->>$N != $M) [text not-equals]
  const paramRefs = [...leaf.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  if (paramRefs.length === 0) return leaf.trim() === 'TRUE';
  const fieldParamIdx = paramRefs[0];
  const fieldId = params[fieldParamIdx - 1] as string;
  const fieldName = fieldIdOf.get(fieldId) ?? fieldId;
  const recordValue = record[fieldName];

  if (leaf.includes('!=')) {
    const valueParamIdx = paramRefs[1];
    const expected = params[valueParamIdx - 1];
    if (recordValue === undefined || recordValue === null) return true; // IS NULL branch
    // eslint-disable-next-line eqeqeq
    return recordValue != expected;
  }

  const valueParamIdx = paramRefs[1];
  const expected = params[valueParamIdx - 1];
  // eslint-disable-next-line eqeqeq
  return recordValue == expected;
}

/**
 * Recursive-descent evaluator for the exact grammar buildFilterClause emits:
 *   expr := "(" expr ")"
 *         | expr " AND " expr
 *         | expr " OR " expr
 *         | leaf
 * We split on top-level ' AND '/' OR ' (depth-0 parens only), matching the
 * real precedence the engine encodes via explicit parens at every level.
 */
function evalSql(sql: string, params: unknown[], record: Rec, fieldIdOf: Map<string, string>): boolean {
  const trimmed = sql.trim();

  // Strip one fully-enclosing pair of parens if present.
  if (trimmed.startsWith('(') && trimmed.endsWith(')') && isFullyEnclosing(trimmed)) {
    return evalSql(trimmed.slice(1, -1), params, record, fieldIdOf);
  }

  const top = splitTopLevel(trimmed);
  if (top.op === 'AND') {
    return top.parts.every((p) => evalSql(p, params, record, fieldIdOf));
  }
  if (top.op === 'OR') {
    return top.parts.some((p) => evalSql(p, params, record, fieldIdOf));
  }
  return evalLeaf(trimmed, params, record, fieldIdOf);
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

function splitTopLevel(s: string): { op: 'AND' | 'OR' | null; parts: string[] } {
  let depth = 0;
  for (const op of [' AND ', ' OR ']) {
    let searchFrom = 0;
    while (true) {
      const idx = s.indexOf(op, searchFrom);
      if (idx === -1) break;
      // compute depth up to idx
      depth = 0;
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
// Fixture: A=1 AND (B=2 OR C=3)
// ---------------------------------------------------------------------------

const FIELD_A = 'field-a-id';
const FIELD_B = 'field-b-id';
const FIELD_C = 'field-c-id';

const fieldTypes = new Map<string, string>([
  [FIELD_A, 'number'],
  [FIELD_B, 'number'],
  [FIELD_C, 'number'],
]);

const fieldIdOf = new Map<string, string>([
  [FIELD_A, 'A'],
  [FIELD_B, 'B'],
  [FIELD_C, 'C'],
]);

function nestedFixture(): FilterGroup {
  return {
    logic: 'and',
    rules: [
      { fieldId: FIELD_A, operator: 'equals', value: 1 },
      {
        logic: 'or',
        rules: [
          { fieldId: FIELD_B, operator: 'equals', value: 2 },
          { fieldId: FIELD_C, operator: 'equals', value: 3 },
        ],
      },
    ],
  };
}

// Record set exercising every combination.
const records: Rec[] = [
  { id: 'r1', A: 1, B: 2, C: 9 }, // A=1, B=2 -> MATCH (A AND B)
  { id: 'r2', A: 1, B: 9, C: 3 }, // A=1, C=3 -> MATCH (A AND C)
  { id: 'r3', A: 1, B: 9, C: 9 }, // A=1, neither B nor C -> NO MATCH
  { id: 'r4', A: 5, B: 2, C: 3 }, // A!=1 -> NO MATCH regardless of OR branch
  { id: 'r5', A: 1, B: 2, C: 3 }, // A=1, B=2 AND C=3 -> MATCH
];

const EXPECTED_MATCHING_IDS = ['r1', 'r2', 'r5'];

describe('ViewQueryEngine — nested FilterGroup (A AND (B OR C))', () => {
  it('generates parenthesized SQL nesting the OR group inside the AND group', () => {
    const params: unknown[] = [];
    const { sql } = buildFilterClause(nestedFixture(), params, 1, fieldTypes);

    // Structural proof: nested group must appear as its own parenthesized
    // OR clause joined by AND to the sibling rule — not silently dropped.
    expect(sql).toContain(' AND ');
    expect(sql).toContain(' OR ');
    // The OR sub-expression must be fully parenthesized as a unit.
    expect(sql).toMatch(/\(\(.*\) OR \(.*\)\)/);
  });

  it('selects exactly the records matching A=1 AND (B=2 OR C=3)', () => {
    const params: unknown[] = [];
    const { sql } = buildFilterClause(nestedFixture(), params, 1, fieldTypes);

    const matched = records.filter((r) => evalSql(sql, params, r, fieldIdOf)).map((r) => r.id);

    expect(matched.sort()).toEqual([...EXPECTED_MATCHING_IDS].sort());
  });

  it('still supports a flat (non-nested) filter group unchanged', () => {
    const flat: FilterGroup = {
      logic: 'and',
      rules: [
        { fieldId: FIELD_A, operator: 'equals', value: 1 },
        { fieldId: FIELD_B, operator: 'equals', value: 2 },
      ],
    };
    const params: unknown[] = [];
    const { sql } = buildFilterClause(flat, params, 1, fieldTypes);

    const matched = records.filter((r) => evalSql(sql, params, r, fieldIdOf)).map((r) => r.id);
    // Only records with A=1 AND B=2: r1, r5
    expect(matched.sort()).toEqual(['r1', 'r5']);
  });

  it('supports 3-level nesting: A=1 AND (B=2 OR (C=3 AND A=1))', () => {
    const deep: FilterGroup = {
      logic: 'and',
      rules: [
        { fieldId: FIELD_A, operator: 'equals', value: 1 },
        {
          logic: 'or',
          rules: [
            { fieldId: FIELD_B, operator: 'equals', value: 2 },
            {
              logic: 'and',
              rules: [
                { fieldId: FIELD_C, operator: 'equals', value: 3 },
                { fieldId: FIELD_A, operator: 'equals', value: 1 },
              ],
            },
          ],
        },
      ],
    };
    const params: unknown[] = [];
    const { sql } = buildFilterClause(deep, params, 1, fieldTypes);
    const matched = records.filter((r) => evalSql(sql, params, r, fieldIdOf)).map((r) => r.id);
    expect(matched.sort()).toEqual(['r1', 'r2', 'r5'].sort());
  });

  it('throws a clear error when nesting exceeds the max depth instead of recursing unbounded', () => {
    // Build a group nested 7 levels deep (limit is 5).
    let innermost: FilterGroup = {
      logic: 'and',
      rules: [{ fieldId: FIELD_A, operator: 'equals', value: 1 }],
    };
    for (let i = 0; i < 7; i++) {
      innermost = { logic: 'and', rules: [innermost] };
    }

    const params: unknown[] = [];
    expect(() => buildFilterClause(innermost, params, 1, fieldTypes)).toThrow(/max(imum)? depth/i);
  });

  it('accepts nesting exactly at the max depth without throwing', () => {
    // Build a group nested to exactly the limit (5 levels total).
    let group: FilterGroup = {
      logic: 'and',
      rules: [{ fieldId: FIELD_A, operator: 'equals', value: 1 }],
    };
    for (let i = 0; i < 4; i++) {
      group = { logic: 'and', rules: [group] };
    }

    const params: unknown[] = [];
    expect(() => buildFilterClause(group, params, 1, fieldTypes)).not.toThrow();
  });
});
