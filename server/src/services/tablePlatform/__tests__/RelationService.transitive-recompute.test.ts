/**
 * Transitive rollup/lookup cascade — regression tests for
 * RelationService.recomputeDependentsOfSource recursion.
 *
 * The method historically declared depth/maxDepth/visited but never recursed,
 * so a chain A → B → C (B rolls up A, C rolls up B) left C stale after an edit
 * to A. These tests drive the REAL RelationService against a faithful in-memory
 * Postgres-compatible pool that persists tp_records / tp_fields / tp_record_links
 * (same pattern as the cross-record-recompute contract test).
 *
 * Coverage:
 *  (1) 3-level chain A → B → C: editing a source cell on A updates C's rollup.
 *  (2) reciprocal cycle A ↔ B: terminates, values consistent, no infinite loop.
 *  (3) no value change on B ⇒ C is NOT recomputed (query-count guard).
 *  (4) date lookup propagated through two levels.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface RecordRow {
  id: string;
  table_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
interface FieldRow {
  id: string;
  table_id: string;
  field_type: string;
  options: Record<string, unknown>;
}
interface LinkRow {
  from_record_id: string;
  from_field_id: string;
  to_record_id: string;
  created_at: string;
}

const records = new Map<string, RecordRow>();
const fields: FieldRow[] = [];
const links: LinkRow[] = [];

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const fakePool = {
  query: vi.fn(async (sqlRaw: string, params: unknown[] = []) => {
    const s = sqlRaw.replace(/\s+/g, ' ').trim();

    // getFieldOptions: SELECT field_type, options FROM tp_fields WHERE id = $1
    if (s.startsWith('SELECT field_type, options FROM tp_fields WHERE id = $1')) {
      const f = fields.find((x) => x.id === params[0]);
      return {
        rows: f ? [{ field_type: f.field_type, options: clone(f.options) }] : [],
        rowCount: f ? 1 : 0,
      };
    }
    // recomputeComputedFields field scan (count/lookup/rollup) for a table
    if (
      s.startsWith('SELECT id, field_type FROM tp_fields WHERE table_id = $1') &&
      s.includes("IN ('count', 'lookup', 'rollup')")
    ) {
      const tableId = params[0] as string;
      const matched = fields.filter(
        (f) =>
          f.table_id === tableId &&
          (f.field_type === 'count' || f.field_type === 'lookup' || f.field_type === 'rollup')
      );
      return { rows: matched.map((f) => ({ id: f.id, field_type: f.field_type })), rowCount: matched.length };
    }
    // recomputeDependentsOfSource computed-field scan (rollup/lookup only)
    if (
      s.startsWith('SELECT id, field_type, options FROM tp_fields') &&
      s.includes("IN ('rollup', 'lookup')")
    ) {
      const tableId = params[0] as string;
      const matched = fields.filter(
        (f) => f.table_id === tableId && (f.field_type === 'rollup' || f.field_type === 'lookup')
      );
      return {
        rows: matched.map((f) => ({ id: f.id, field_type: f.field_type, options: clone(f.options) })),
        rowCount: matched.length,
      };
    }

    // recomputeDependentsOfSource back-ref: DISTINCT from_record_id, from_field_id WHERE to_record_id = $1
    if (
      s.startsWith('SELECT DISTINCT from_record_id, from_field_id FROM tp_record_links') &&
      s.includes('WHERE to_record_id = $1')
    ) {
      const toRec = params[0] as string;
      const seen = new Set<string>();
      const rows: Array<{ from_record_id: string; from_field_id: string }> = [];
      for (const l of links) {
        if (l.to_record_id !== toRec) continue;
        const key = `${l.from_record_id}|${l.from_field_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ from_record_id: l.from_record_id, from_field_id: l.from_field_id });
      }
      return { rows, rowCount: rows.length };
    }
    // computeCount: COUNT(*) WHERE from_record_id = $1 AND from_field_id = $2
    if (s.includes('SELECT COUNT(*)::int AS cnt FROM tp_record_links')) {
      const [fromRec, fromField] = params as [string, string];
      const cnt = links.filter(
        (l) => l.from_record_id === fromRec && l.from_field_id === fromField
      ).length;
      return { rows: [{ cnt }], rowCount: 1 };
    }
    // getLinkedRecords: JOIN tp_records ... WHERE from_record_id = $1 AND from_field_id = $2
    if (
      s.startsWith('SELECT r.* FROM tp_record_links l JOIN tp_records r') &&
      s.includes('l.from_record_id = $1 AND l.from_field_id = $2')
    ) {
      const [fromRec, fromField] = params as [string, string];
      const matched = links
        .filter((l) => l.from_record_id === fromRec && l.from_field_id === fromField)
        .map((l) => records.get(l.to_record_id))
        .filter((r): r is RecordRow => Boolean(r))
        .map(clone);
      return { rows: matched, rowCount: matched.length };
    }

    // tp_records: SELECT * WHERE id = $1
    if (s.startsWith('SELECT * FROM tp_records WHERE id = $1')) {
      const row = records.get(params[0] as string);
      return { rows: row ? [clone(row)] : [], rowCount: row ? 1 : 0 };
    }
    // tp_records: SELECT data WHERE id = $1 (before-snapshot for cascade diff)
    if (s.startsWith('SELECT data FROM tp_records WHERE id = $1')) {
      const row = records.get(params[0] as string);
      return { rows: row ? [{ data: clone(row.data) }] : [], rowCount: row ? 1 : 0 };
    }
    // tp_records by id list (recomputeDependentsOfSource table resolution)
    if (s.startsWith('SELECT id, table_id FROM tp_records WHERE id = ANY($1)')) {
      const ids = params[0] as string[];
      const rows = ids
        .map((id) => records.get(id))
        .filter((r): r is RecordRow => Boolean(r))
        .map((r) => ({ id: r.id, table_id: r.table_id }));
      return { rows, rowCount: rows.length };
    }
    // UPDATE tp_records SET data = $2 ... WHERE id = $1
    if (s.startsWith('UPDATE tp_records')) {
      const id = params[0] as string;
      const row = records.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      row.data = JSON.parse(params[1] as string);
      row.updated_at = new Date().toISOString();
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in fakePool: ${s}`);
  }),
};

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => fakePool,
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../AuditService.js', () => ({
  default: { logEvent: vi.fn(async () => undefined) },
}));

import relationService from '../RelationService.js';

// ---------------------------------------------------------------------------
// Helpers to build records/fields/links directly in the fake store.
// ---------------------------------------------------------------------------
function addRecord(id: string, tableId: string, data: Record<string, unknown>): void {
  const now = new Date().toISOString();
  records.set(id, { id, table_id: tableId, data, created_at: now, updated_at: now });
}
function addField(id: string, tableId: string, fieldType: string, options: Record<string, unknown> = {}): void {
  fields.push({ id, table_id: tableId, field_type: fieldType, options });
}
function addLink(fromRec: string, fromField: string, toRec: string): void {
  links.push({
    from_record_id: fromRec,
    from_field_id: fromField,
    to_record_id: toRec,
    created_at: new Date().toISOString(),
  });
}

beforeEach(() => {
  records.clear();
  fields.length = 0;
  links.length = 0;
  fakePool.query.mockClear();
});

describe('RelationService.recomputeDependentsOfSource — transitive cascade', () => {
  it('(1) 3-level chain A → B → C: editing A propagates through B to C', async () => {
    // Tables
    const T_A = 'tbl-a';
    const T_B = 'tbl-b';
    const T_C = 'tbl-c';
    // Fields
    const A_AMOUNT = 'fld-a-amount'; // number on A
    const B_LINK_A = 'fld-b-link-a'; // B → A linkedRecord
    const B_ROLLUP = 'fld-b-rollup'; // B: SUM(A.amount)
    const C_LINK_B = 'fld-c-link-b'; // C → B linkedRecord
    const C_ROLLUP = 'fld-c-rollup'; // C: SUM(B.rollup)

    addField(A_AMOUNT, T_A, 'number');
    addField(B_LINK_A, T_B, 'linkedRecord', { linkedTableId: T_A });
    addField(B_ROLLUP, T_B, 'rollup', {
      linkedFieldId: B_LINK_A,
      lookupFieldId: A_AMOUNT,
      aggregation: 'sum',
    });
    addField(C_LINK_B, T_C, 'linkedRecord', { linkedTableId: T_B });
    addField(C_ROLLUP, T_C, 'rollup', {
      linkedFieldId: C_LINK_B,
      lookupFieldId: B_ROLLUP,
      aggregation: 'sum',
    });

    // Records: A1(amount=2), A2(amount=3) → B → C
    addRecord('A1', T_A, { [A_AMOUNT]: 2 });
    addRecord('A2', T_A, { [A_AMOUNT]: 3 });
    addRecord('B', T_B, {});
    addRecord('C', T_C, {});
    addLink('B', B_LINK_A, 'A1');
    addLink('B', B_LINK_A, 'A2');
    addLink('C', C_LINK_B, 'B');

    // Materialize initial computed values bottom-up.
    await relationService.recomputeComputedFields('B'); // 2 + 3 = 5
    await relationService.recomputeComputedFields('C'); // SUM(B.rollup) = 5
    expect(records.get('B')?.data[B_ROLLUP]).toBe(5);
    expect(records.get('C')?.data[C_ROLLUP]).toBe(5);

    // Edit source A2: 3 → 10 (simulates RecordsService updating the cell).
    records.get('A2')!.data[A_AMOUNT] = 10;
    const affected = await relationService.recomputeDependentsOfSource('A2', [A_AMOUNT]);

    // B refreshed to 2 + 10 = 12, and C transitively to 12.
    expect(records.get('B')?.data[B_ROLLUP]).toBe(12);
    expect(records.get('C')?.data[C_ROLLUP]).toBe(12);

    // Returned set includes BOTH the direct dependent (B) and transitive (C).
    const ids = affected.map((d) => d.recordId).sort();
    expect(ids).toEqual(['B', 'C']);
  });

  it('(2) reciprocal cycle A ↔ B terminates and leaves consistent values', async () => {
    const T_A = 'tbl-a';
    const T_B = 'tbl-b';
    const A_AMOUNT = 'fld-a-amount';
    const A_LINK_B = 'fld-a-link-b';
    const A_ROLLUP = 'fld-a-rollup'; // A: SUM(B.amount)
    const B_AMOUNT = 'fld-b-amount';
    const B_LINK_A = 'fld-b-link-a';
    const B_ROLLUP = 'fld-b-rollup'; // B: SUM(A.amount)

    addField(A_AMOUNT, T_A, 'number');
    addField(A_LINK_B, T_A, 'linkedRecord', { linkedTableId: T_B });
    addField(A_ROLLUP, T_A, 'rollup', {
      linkedFieldId: A_LINK_B,
      lookupFieldId: B_AMOUNT,
      aggregation: 'sum',
    });
    addField(B_AMOUNT, T_B, 'number');
    addField(B_LINK_A, T_B, 'linkedRecord', { linkedTableId: T_A });
    addField(B_ROLLUP, T_B, 'rollup', {
      linkedFieldId: B_LINK_A,
      lookupFieldId: A_AMOUNT,
      aggregation: 'sum',
    });

    addRecord('A', T_A, { [A_AMOUNT]: 4 });
    addRecord('B', T_B, { [B_AMOUNT]: 7 });
    // Reciprocal links: A → B and B → A.
    addLink('A', A_LINK_B, 'B');
    addLink('B', B_LINK_A, 'A');

    await relationService.recomputeComputedFields('A'); // A.rollup = B.amount = 7
    await relationService.recomputeComputedFields('B'); // B.rollup = A.amount = 4
    expect(records.get('A')?.data[A_ROLLUP]).toBe(7);
    expect(records.get('B')?.data[B_ROLLUP]).toBe(4);

    // Edit A.amount 4 → 9. This must refresh B.rollup (→9) without looping
    // back to re-recompute A infinitely (visited-set guard).
    records.get('A')!.data[A_AMOUNT] = 9;
    const affected = await relationService.recomputeDependentsOfSource('A', [A_AMOUNT]);

    expect(records.get('B')?.data[B_ROLLUP]).toBe(9);
    // A itself is the origin (in visited) so it is never re-added.
    expect(affected.map((d) => d.recordId)).toEqual(['B']);
    // Consistency: A.rollup still reflects B.amount (unchanged = 7).
    expect(records.get('A')?.data[A_ROLLUP]).toBe(7);
  });

  it('(3) no value change on B ⇒ C is not recomputed (no wasted cascade)', async () => {
    const T_A = 'tbl-a';
    const T_B = 'tbl-b';
    const T_C = 'tbl-c';
    const A_AMOUNT = 'fld-a-amount';
    const A_NOTE = 'fld-a-note'; // unrelated field, not read by any rollup
    const B_LINK_A = 'fld-b-link-a';
    const B_ROLLUP = 'fld-b-rollup'; // B: MAX(A.amount)
    const C_LINK_B = 'fld-c-link-b';
    const C_ROLLUP = 'fld-c-rollup'; // C: SUM(B.rollup)

    addField(A_AMOUNT, T_A, 'number');
    addField(A_NOTE, T_A, 'text');
    addField(B_LINK_A, T_B, 'linkedRecord', { linkedTableId: T_A });
    addField(B_ROLLUP, T_B, 'rollup', {
      linkedFieldId: B_LINK_A,
      lookupFieldId: A_AMOUNT,
      aggregation: 'max',
    });
    addField(C_LINK_B, T_C, 'linkedRecord', { linkedTableId: T_B });
    addField(C_ROLLUP, T_C, 'rollup', {
      linkedFieldId: C_LINK_B,
      lookupFieldId: B_ROLLUP,
      aggregation: 'sum',
    });

    addRecord('A1', T_A, { [A_AMOUNT]: 8 });
    addRecord('A2', T_A, { [A_AMOUNT]: 3 });
    addRecord('B', T_B, {});
    addRecord('C', T_C, {});
    addLink('B', B_LINK_A, 'A1');
    addLink('B', B_LINK_A, 'A2');
    addLink('C', C_LINK_B, 'B');

    await relationService.recomputeComputedFields('B'); // MAX(8,3) = 8
    await relationService.recomputeComputedFields('C'); // SUM = 8
    expect(records.get('B')?.data[B_ROLLUP]).toBe(8);
    expect(records.get('C')?.data[C_ROLLUP]).toBe(8);

    // Change A2.amount 3 → 5. MAX(8,5) is still 8, so B does not move and the
    // cascade to C must stop. Count back-ref queries to prove C is not visited.
    records.get('A2')!.data[A_AMOUNT] = 5;
    fakePool.query.mockClear();
    const affected = await relationService.recomputeDependentsOfSource('A2', [A_AMOUNT]);

    // B was recomputed (it is a direct dependent) but its value is unchanged.
    expect(records.get('B')?.data[B_ROLLUP]).toBe(8);
    expect(records.get('C')?.data[C_ROLLUP]).toBe(8);

    // Only B is returned — no transitive push for C.
    expect(affected.map((d) => d.recordId)).toEqual(['B']);

    // The back-ref query is issued for the source (A2) but NOT for B, since B's
    // value did not change and no recursion was triggered.
    const backRefCalls = fakePool.query.mock.calls.filter(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].replace(/\s+/g, ' ').includes('DISTINCT from_record_id, from_field_id') &&
        (c[1] as unknown[])?.[0] === 'B'
    );
    expect(backRefCalls.length).toBe(0);
  });

  it('(4) date lookup propagates through two levels', async () => {
    const T_A = 'tbl-a';
    const T_B = 'tbl-b';
    const T_C = 'tbl-c';
    const A_DATE = 'fld-a-date'; // date value on A
    const B_LINK_A = 'fld-b-link-a';
    const B_LOOKUP = 'fld-b-lookup'; // B: lookup(A.date)
    const C_LINK_B = 'fld-c-link-b';
    const C_LOOKUP = 'fld-c-lookup'; // C: lookup(B.lookup)

    addField(A_DATE, T_A, 'date');
    addField(B_LINK_A, T_B, 'linkedRecord', { linkedTableId: T_A });
    addField(B_LOOKUP, T_B, 'lookup', { linkedFieldId: B_LINK_A, lookupFieldId: A_DATE });
    addField(C_LINK_B, T_C, 'linkedRecord', { linkedTableId: T_B });
    addField(C_LOOKUP, T_C, 'lookup', { linkedFieldId: C_LINK_B, lookupFieldId: B_LOOKUP });

    addRecord('A', T_A, { [A_DATE]: '2026-01-01' });
    addRecord('B', T_B, {});
    addRecord('C', T_C, {});
    addLink('B', B_LINK_A, 'A');
    addLink('C', C_LINK_B, 'B');

    await relationService.recomputeComputedFields('B'); // lookup → ['2026-01-01']
    await relationService.recomputeComputedFields('C'); // lookup → [['2026-01-01']]
    expect(records.get('B')?.data[B_LOOKUP]).toEqual(['2026-01-01']);
    expect(records.get('C')?.data[C_LOOKUP]).toEqual([['2026-01-01']]);

    // Change A.date and cascade.
    records.get('A')!.data[A_DATE] = '2026-12-31';
    const affected = await relationService.recomputeDependentsOfSource('A', [A_DATE]);

    expect(records.get('B')?.data[B_LOOKUP]).toEqual(['2026-12-31']);
    expect(records.get('C')?.data[C_LOOKUP]).toEqual([['2026-12-31']]);
    expect(affected.map((d) => d.recordId).sort()).toEqual(['B', 'C']);
  });
});
