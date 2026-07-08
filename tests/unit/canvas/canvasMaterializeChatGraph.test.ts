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
 */

const dbGetMock = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGetMock(...args),
}));
vi.mock('../../../server/src/database/index.js', () => ({
  getDatabase: () => ({}),
}));

const insertDynamicMock = vi.fn();
vi.mock('../../../server/src/utils/dbDynamic.js', () => ({
  insertDynamic: (...args: any[]) => insertDynamicMock(...args),
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
  dbGetMock.mockResolvedValue(null);
  insertDynamicMock.mockReset();
  insertDynamicMock.mockResolvedValue(undefined);
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

    expect(insertDynamicMock).toHaveBeenCalledTimes(2);
    const [ideaCall, mapCall] = insertDynamicMock.mock.calls;

    expect(ideaCall[0]).toBe('my_ideas');
    expect(ideaCall[1]).toMatchObject({ source_type: 'teresa_chat', title: 'Kapitał na wzrost' });

    expect(mapCall[0]).toBe('my_idea_maps');
    const mapValues = mapCall[1];
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
    const mapCall = insertDynamicMock.mock.calls[1];
    const storedNodes = JSON.parse(mapCall[1].nodes_json);
    expect(storedNodes[0]).toMatchObject({ id: 'root', kind: 'idea' });
    expect(storedNodes[1]).toMatchObject({ id: 's0', label: 'Ryzyka' });
    // No graph passed → preferred_tool stays null (not forced to a canvas kind).
    expect(mapCall[1].preferred_tool).toBeNull();
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
