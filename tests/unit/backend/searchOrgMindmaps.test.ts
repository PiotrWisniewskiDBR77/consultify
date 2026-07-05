/**
 * Unit tests for search_org_mindmaps (ff_teresaMindmap / ENABLE_TERESA_MINDMAP).
 *
 * Covers:
 * - both-flags-off / mindmap-flag-off → empty envelope (no DB touched)
 * - org-scope: the SQL is parameterized with organizationId; the handler only
 *   returns rows the (mocked, org-scoped) DB hands back
 * - serialization through ideaMapToMarkdown (outline present, newline-preserving)
 * - 4KB envelope cap: many large maps → truncated:true and payload ≤ 4KB
 * - missing organizationId → empty
 *
 * The DB layer is mocked (no real Postgres). The mock enforces org-scope by
 * only returning rows whose organization_id equals the bound org param — this
 * is what asserts "search returns only its own org's maps".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the DB layer the tool imports.
const mockDbAll = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
}));

// Silence logger.
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { searchOrgMindmaps } from '../../../server/src/services/ai/tools/searchOrgMindmaps.js';
import { ORG_RETRIEVAL_MAX_PAYLOAD_CHARS } from '../../../server/src/services/ai/tools/orgRetrievalShared.js';

const ORG_A = 'org-aaaa';
const ORG_B = 'org-bbbb';

// A tiny fixture DB: 2 maps in ORG_A, 1 in ORG_B. The mock returns only the
// rows matching the org param the tool binds (org-scope enforced here).
const ALL_ROWS = [
  {
    map_id: 'map-a1',
    idea_id: 'idea-a1',
    organization_id: ORG_A,
    title: 'Transformacja cyfrowa Apator',
    nodes_json: JSON.stringify([
      { id: 'r', data: { label: 'Transformacja' } },
      { id: 'c1', data: { label: 'Automatyzacja procesów' } },
    ]),
    edges_json: JSON.stringify([{ source: 'r', target: 'c1' }]),
    updated_at: '2026-07-01T10:00:00Z',
  },
  {
    map_id: 'map-a2',
    idea_id: 'idea-a2',
    organization_id: ORG_A,
    title: 'Strategia sprzedaży',
    nodes_json: JSON.stringify([{ id: 'x', data: { label: 'Kanały sprzedaży' } }]),
    edges_json: JSON.stringify([]),
    updated_at: '2026-06-20T10:00:00Z',
  },
  {
    map_id: 'map-b1',
    idea_id: 'idea-b1',
    organization_id: ORG_B,
    title: 'Transformacja w innej firmie',
    nodes_json: JSON.stringify([{ id: 'z', data: { label: 'Coś obcego' } }]),
    edges_json: JSON.stringify([]),
    updated_at: '2026-07-02T10:00:00Z',
  },
];

/** Mock impl that honours the org param (2nd element = the SQL params array). */
function orgScopedDbMock() {
  return async (_sql: string, params: unknown[]) => {
    const orgParam = String((params || [])[0] || '');
    return ALL_ROWS.filter((r) => r.organization_id === orgParam);
  };
}

describe('search_org_mindmaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_TERESA_RETRIEVAL = 'true';
    process.env.ENABLE_TERESA_MINDMAP = 'true';
  });

  afterEach(() => {
    delete process.env.ENABLE_TERESA_RETRIEVAL;
    delete process.env.ENABLE_TERESA_MINDMAP;
  });

  it('returns empty when ENABLE_TERESA_MINDMAP is off (and never touches DB)', async () => {
    process.env.ENABLE_TERESA_MINDMAP = 'false';
    mockDbAll.mockImplementation(orgScopedDbMock());
    const out = await searchOrgMindmaps({ query: 'transformacja' }, { organizationId: ORG_A });
    expect(out).toEqual({ results: [], truncated: false });
    expect(mockDbAll).not.toHaveBeenCalled();
  });

  it('returns empty when ENABLE_TERESA_RETRIEVAL is off (co-gate)', async () => {
    process.env.ENABLE_TERESA_RETRIEVAL = 'false';
    mockDbAll.mockImplementation(orgScopedDbMock());
    const out = await searchOrgMindmaps({ query: 'transformacja' }, { organizationId: ORG_A });
    expect(out).toEqual({ results: [], truncated: false });
    expect(mockDbAll).not.toHaveBeenCalled();
  });

  it('returns empty when organizationId is missing', async () => {
    mockDbAll.mockImplementation(orgScopedDbMock());
    const out = await searchOrgMindmaps({ query: 'transformacja' }, {});
    expect(out).toEqual({ results: [], truncated: false });
    expect(mockDbAll).not.toHaveBeenCalled();
  });

  it('org-scope: returns only the caller org maps that match the query', async () => {
    mockDbAll.mockImplementation(orgScopedDbMock());
    const out = await searchOrgMindmaps({ query: 'transformacja' }, { organizationId: ORG_A });

    // ORG_A has one map matching "transformacja"; ORG_B's map must NOT appear.
    const ids = out.results.map((r) => r.mapId);
    expect(ids).toContain('map-a1');
    expect(ids).not.toContain('map-b1');
    // The DB was bound with the caller's org id.
    const boundParams = mockDbAll.mock.calls[0][1] as unknown[];
    expect(boundParams[0]).toBe(ORG_A);
  });

  it('serializes the graph through ideaMapToMarkdown (newline-preserving outline)', async () => {
    mockDbAll.mockImplementation(orgScopedDbMock());
    const out = await searchOrgMindmaps({ query: 'transformacja' }, { organizationId: ORG_A });
    const hit = out.results.find((r) => r.mapId === 'map-a1');
    expect(hit).toBeTruthy();
    expect(hit!.title).toContain('Transformacja cyfrowa Apator');
    // outline is markdown: contains the H2 title line and bullet nodes.
    expect(hit!.outline).toContain('## Transformacja cyfrowa Apator');
    expect(hit!.outline).toContain('- Transformacja');
    expect(hit!.outline).toContain('Automatyzacja procesów');
    expect(hit!.outline).toContain('\n'); // newlines preserved (not collapsed)
  });

  it('enforces the ~4KB envelope cap → truncated:true on many large maps', async () => {
    // Build 20 large maps in ORG_A all matching the query token.
    const bigLabel = 'transformacja ' + 'x'.repeat(600);
    const bigRows = Array.from({ length: 20 }, (_, i) => ({
      map_id: `big-${i}`,
      idea_id: `idea-big-${i}`,
      organization_id: ORG_A,
      title: `Duża mapa transformacja ${i}`,
      nodes_json: JSON.stringify([
        { id: 'a', data: { label: bigLabel } },
        { id: 'b', data: { label: bigLabel } },
      ]),
      edges_json: JSON.stringify([{ source: 'a', target: 'b' }]),
      updated_at: '2026-07-01T00:00:00Z',
    }));
    mockDbAll.mockImplementation(async () => bigRows);

    const out = await searchOrgMindmaps(
      { query: 'transformacja', limit: 10 },
      { organizationId: ORG_A }
    );

    expect(out.truncated).toBe(true);
    const payloadSize = JSON.stringify(out.results).length;
    expect(payloadSize).toBeLessThanOrEqual(ORG_RETRIEVAL_MAX_PAYLOAD_CHARS);
    expect(out.results.length).toBeGreaterThan(0);
  });

  it('empty query → empty envelope, no DB call', async () => {
    mockDbAll.mockImplementation(orgScopedDbMock());
    const out = await searchOrgMindmaps({ query: '   ' }, { organizationId: ORG_A });
    expect(out).toEqual({ results: [], truncated: false });
    expect(mockDbAll).not.toHaveBeenCalled();
  });
});
