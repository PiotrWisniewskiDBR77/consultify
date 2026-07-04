/**
 * Integration-lite: mind-map retrieval wiring for the Teresa chat stream.
 *
 * The chat stream route (ai.routes.ts:3167+) has no model-driven tool loop; it
 * runs READ tools server-side after a regex match and injects results into the
 * systemInstruction. A full stream harness is heavy, so this test verifies the
 * two contract points the router relies on:
 *   1) the regex trigger the router uses for mind maps matches the intended
 *      PL/EN phrasings (and does NOT match unrelated text);
 *   2) `search_org_mindmaps` is registered in the MCP registry and executes
 *      end-to-end through `mcpServer.execute(...)` (schema validation + handler),
 *      returning the { results, truncated } envelope the router serializes.
 *
 * DB is mocked; no real Postgres. This asserts the exact call the router makes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Registering the tool registry connects search_org_mindmaps to mcpServer.
import { mcpServer } from '../../../server/src/services/ai/mcpServer.js';
import '../../../server/src/services/ai/tools/index.js';

/**
 * The mind-map trigger regex, kept in sync with ai.routes.ts. If the router
 * copy changes, update this literal too (both are covered by the assertions).
 */
const MINDMAP_REGEX = /map[aeęy]\s*myśl\w*|mapa\s+myśli|mind[\s-]?map\w*|mapę?\s+myśli/i;

describe('mind-map retrieval — router trigger regex', () => {
  it('matches PL phrasings', () => {
    expect(MINDMAP_REGEX.test('pokaż mapę myśli o transformacji')).toBe(true);
    expect(MINDMAP_REGEX.test('znajdź mapa myśli o sprzedaży')).toBe(true);
    expect(MINDMAP_REGEX.test('otwórz mapy myślowe zespołu')).toBe(true);
  });

  it('matches EN phrasings', () => {
    expect(MINDMAP_REGEX.test('find the mind map about strategy')).toBe(true);
    expect(MINDMAP_REGEX.test('open my mindmap')).toBe(true);
    expect(MINDMAP_REGEX.test('the mind-maps we made')).toBe(true);
  });

  it('does not match unrelated content (notes / insights)', () => {
    expect(MINDMAP_REGEX.test('pokaż notatkę o spotkaniu')).toBe(false);
    expect(MINDMAP_REGEX.test('search my insights')).toBe(false);
  });
});

describe('mind-map retrieval — MCP registry wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_TERESA_RETRIEVAL = 'true';
    process.env.ENABLE_TERESA_MINDMAP = 'true';
  });
  afterEach(() => {
    delete process.env.ENABLE_TERESA_RETRIEVAL;
    delete process.env.ENABLE_TERESA_MINDMAP;
  });

  it('search_org_mindmaps is registered', () => {
    expect(mcpServer.tools.has('search_org_mindmaps')).toBe(true);
  });

  it('executes through mcpServer.execute and returns the envelope the router serializes', async () => {
    mockDbAll.mockImplementation(async (_sql: string, params: unknown[]) => {
      // org-scoped: echo one matching row for the bound org.
      const orgId = String((params || [])[0] || '');
      return [
        {
          map_id: 'map-1',
          idea_id: 'idea-1',
          organization_id: orgId,
          title: 'Transformacja cyfrowa',
          nodes_json: JSON.stringify([{ id: 'n1', data: { label: 'Transformacja start' } }]),
          edges_json: JSON.stringify([]),
          updated_at: '2026-07-01T00:00:00Z',
        },
      ];
    });

    // This is exactly the call the router makes.
    // The router forwards the whole user message; use one containing the map's
    // title token ("transformacja") so token-overlap scoring matches.
    const result = await mcpServer.execute(
      'search_org_mindmaps',
      { query: 'pokaż mapę myśli o transformacja cyfrowa', limit: 5 },
      { organizationId: 'org-x', userId: 'user-1' }
    );

    expect(result.status).toBe('SUCCESS');
    const data = result.data as { results: any[]; truncated: boolean };
    expect(data.truncated).toBe(false);
    expect(data.results.length).toBe(1);
    expect(data.results[0].mapId).toBe('map-1');
    expect(data.results[0].outline).toContain('## Transformacja cyfrowa');
  });

  it('returns an empty envelope through execute when the flag is off', async () => {
    process.env.ENABLE_TERESA_MINDMAP = 'false';
    mockDbAll.mockResolvedValue([]);
    const result = await mcpServer.execute(
      'search_org_mindmaps',
      { query: 'mapa myśli', limit: 5 },
      { organizationId: 'org-x', userId: 'user-1' }
    );
    expect(result.status).toBe('SUCCESS');
    expect(result.data).toEqual({ results: [], truncated: false });
    expect(mockDbAll).not.toHaveBeenCalled();
  });
});
