import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Canvas persistence fix (2026-07-08) — Teresa's chat-generated mindmap /
 * process_flow / table / whiteboard used to hand the frontend a placeholder
 * id (`chat-<kind>-<ts>`) and rely ENTIRELY on IdeaMapWorkspace's mount effect
 * (createMyIdea + syncMyIdeaMap) to persist it — if that FE code never ran
 * (or ran and failed silently), the artifact was never saved. This locks the
 * new `target:'idea'` + `graph` contract in canvasMaterialize.ts: a real
 * my_ideas/my_idea_maps row is written server-side, BEFORE any FE code runs,
 * carrying the actual LLM-built graph (not the crude heading-splitter used by
 * the existing Canvas save-to-workspace callers that only pass `sections`).
 *
 * FIX (M01-P08R): this file predates M01-P07C's atomic-transaction rewrite
 * of the `target:'idea'` path (real read-your-writes atomicity — see
 * `server/src/services/__tests__/canvasIdeaMaterializeAtomicity.p07c.pg.test.ts`
 * for the dedicated real-Postgres coverage of that atomicity itself). Two
 * things changed underneath this file and were never updated here, which is
 * exactly why M01-PTEST's red-closure report flagged all 3 tests as red and
 * explicitly left them unfixed as "P07C territory": (1) an
 * `information_schema` schema-preflight (`assertCanvasIdeaReceiptSchema`)
 * now runs before any write and this file's blanket `dbGetMock` default of
 * `null` failed it before a single test's own scenario ran; (2) the actual
 * write moved from plain `insertDynamic(table, values, returning)` to
 * `insertDynamicTx(query, table, values, returning)` inside
 * `withPgTransaction`, so the old mock of `insertDynamic` was asserting
 * against a function the module under test no longer even imports.
 * This file's own purpose per the docstring above — graph
 * validation/normalization shape, not transaction atomicity — is
 * unaffected by the rewrite, so it is re-pointed at the new contract with a
 * minimal stateful fake `query()` (same "record what was inserted, answer
 * the read-back from it" shape already used elsewhere in this repo for
 * `withPgTransaction`-style mocks), not a deep reimplementation of Postgres.
 */

const dbGetMock = vi.fn();
const dbAllMock = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
  all: (...args: any[]) => dbAllMock(...args),
}));
vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => ({}),
}));

// Records of the two rows `insertDynamicTx` was asked to write, keyed by
// table name — `fakeQuery`'s read-back SELECTs answer from these, so the
// final `ideaReadBack`/`mapReadBack` in canvasMaterialize.ts sees exactly
// what this test's own scenario produced, not a fabricated success.
let insertedByTable: Record<string, Record<string, unknown>> = {};

const insertDynamicTxMock = vi.fn(
  async (_query: unknown, table: string, values: Record<string, unknown>) => {
    insertedByTable[table] = values;
    return undefined;
  }
);
vi.mock('../../../server/src/utils/dbDynamic.js', () => ({
  insertDynamicTx: (...args: any[]) => (insertDynamicTxMock as any)(...args),
}));

async function fakeQuery<R = unknown>(sql: string, params: unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
  if (sql.includes('SAVEPOINT') || sql.startsWith('INSERT INTO canvas_idea_materialization_receipts')) {
    return { rows: [], rowCount: 0 };
  }
  if (sql.includes('FROM canvas_idea_materialization_receipts')) {
    // Idempotency-key fast path / unique-violation replay — not exercised by
    // any scenario in this file (none of the three tests pass an
    // idempotencyKey), so "no existing receipt" is always the honest answer.
    return { rows: [], rowCount: 0 };
  }
  if (sql.includes('FROM my_ideas')) {
    const row = insertedByTable['my_ideas'];
    return { rows: (row ? [{ id: row.id, title: row.title }] : []) as R[], rowCount: row ? 1 : 0 };
  }
  if (sql.includes('FROM my_idea_maps')) {
    const row = insertedByTable['my_idea_maps'];
    return { rows: (row ? [{ id: row.id }] : []) as R[], rowCount: row ? 1 : 0 };
  }
  return { rows: [], rowCount: 0 };
}

vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  withPgTransaction: async (fn: (query: typeof fakeQuery) => Promise<unknown>) => fn(fakeQuery),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { materializeWorkspaceTarget } = await import(
  '../../../server/src/services/canvasMaterialize.js'
);

const baseInput = {
  organizationId: 'org-1',
  actorUserId: 'user-1',
  target: 'idea' as const,
  title: 'Kapitał na wzrost',
  contentMd: 'Zbuduj plan pozyskania kapitału',
  summary: 'Zbuduj plan pozyskania kapitału',
  projectId: null,
  sourceDraftId: 'conv-1',
  sourceConversationId: 'conv-1',
};

beforeEach(() => {
  dbGetMock.mockReset();
  // The `information_schema.tables` preflight `assertCanvasIdeaReceiptSchema()`
  // (M01-P07C) added ahead of any idea materialize is orthogonal to what
  // this file exercises (chat-graph normalization) — answer it truthfully
  // and let every other `get` call keep resolving null, same as before.
  dbGetMock.mockImplementation(async (sql: unknown) => {
    if (
      typeof sql === 'string' &&
      sql.includes('information_schema.tables') &&
      sql.includes('canvas_idea_materialization_receipts')
    ) {
      return { table_name: 'canvas_idea_materialization_receipts' };
    }
    return null;
  });
  dbAllMock.mockReset();
  dbAllMock.mockImplementation(async (sql: unknown) => {
    if (
      typeof sql === 'string' &&
      sql.includes('pg_indexes') &&
      sql.includes('canvas_idea_materialization_receipts')
    ) {
      return [
        { indexname: 'idx_canvas_idea_receipts_org_idem' },
        { indexname: 'idx_canvas_idea_receipts_idea_id' },
      ];
    }
    return [];
  });
  insertDynamicTxMock.mockClear();
  insertedByTable = {};
});

describe('canvasMaterialize — target:idea with a pre-built chat graph', () => {
  it('validates/normalizes the LLM graph and writes preferred_tool + is_canonical + extensions_json', async () => {
    const result = await materializeWorkspaceTarget({
      ...baseInput,
      preferredTool: 'mindmap',
      sourceType: 'teresa_chat',
      graph: {
        nodes: [
          { id: 'root', type: 'center', data: { label: 'Kapitał na wzrost' }, position: { x: 0, y: 0 } },
          { id: 'n1', type: 'branch', data: { label: 'Runda A' }, position: { x: 200, y: 0 } },
        ],
        edges: [{ id: 'e1', source: 'root', target: 'n1' }],
        extensions: { table: { columns: [] } },
      },
    });

    // Real materialized id, not a client-side `new-idea-<ts>`/`chat-<kind>-<ts>` placeholder.
    expect(result.type).toBe('idea');
    expect(result.id).toMatch(/^idea-\d+-[0-9a-f]+$/);

    expect(insertDynamicTxMock).toHaveBeenCalledTimes(2);
    const [ideaCall, mapCall] = insertDynamicTxMock.mock.calls;

    // insertDynamicTx(query, table, values, returning) — table/values are args 1/2.
    expect(ideaCall[1]).toBe('my_ideas');
    expect(ideaCall[2]).toMatchObject({ source_type: 'teresa_chat', title: 'Kapitał na wzrost' });

    expect(mapCall[1]).toBe('my_idea_maps');
    const mapValues = mapCall[2];
    expect(mapValues.preferred_tool).toBe('mindmap');
    expect(mapValues.is_canonical).toBe(true);
    expect(mapValues.last_editor_user_id).toBe('user-1');
    const storedNodes = JSON.parse(mapValues.nodes_json);
    const storedEdges = JSON.parse(mapValues.edges_json);
    expect(storedNodes).toHaveLength(2);
    expect(storedEdges).toHaveLength(1);
    // Real graph used, NOT the crude "one node per markdown H2" star map.
    expect(storedNodes.map((n: any) => n.id)).toEqual(['root', 'n1']);
    const extensions = JSON.parse(mapValues.extensions_json);
    expect(extensions.table).toEqual({ columns: [] });
    expect(extensions.source).toBe('teresa_chat');
  });

  it('falls back to the section-derived star map when no graph is provided (existing Canvas callers)', async () => {
    const result = await materializeWorkspaceTarget({
      ...baseInput,
      sections: [{ heading: 'Ryzyka', body: 'Opis ryzyk' }],
    });

    expect(result.id).toMatch(/^idea-\d+-[0-9a-f]+$/);
    const mapCall = insertDynamicTxMock.mock.calls[1];
    const storedNodes = JSON.parse(mapCall[2].nodes_json);
    expect(storedNodes[0]).toMatchObject({ id: 'root', kind: 'idea' });
    expect(storedNodes[1]).toMatchObject({ id: 's0', label: 'Ryzyka' });
    // No graph passed → preferred_tool stays null (not forced to a canvas kind).
    expect(mapCall[2].preferred_tool).toBeNull();
  });

  it('still creates the idea (never throws) when the graph contains garbage nodes/edges', async () => {
    // validateAndNormalizeGraph (the same normalizer the live PUT /map route
    // uses) is deliberately lenient — it coerces malformed items rather than
    // dropping the whole request. The point of this test is narrower: garbage
    // input must never make materializeWorkspaceTarget throw / abort the
    // my_ideas insert that already happened.
    await expect(
      materializeWorkspaceTarget({
        ...baseInput,
        preferredTool: 'mindmap',
        graph: { nodes: [{ totally: 'not a node' }], edges: [{ totally: 'not an edge' }] },
      })
    ).resolves.toMatchObject({ type: 'idea' });
  });
});
