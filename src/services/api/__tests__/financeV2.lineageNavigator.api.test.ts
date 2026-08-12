/**
 * @vitest-environment jsdom
 *
 * Klient `financeV2.api.ts` §AP-CLIENT LineageNavigator (Gate J) —
 * `lineage-navigator.routes.ts`, 2 endpointy. Priorytet #1 wg zlecenia (zamyka
 * OWN-FIN-007/022). Ten sam wzorzec mockowania `fetchWithRetry` co
 * `financeV2.api.test.ts` — zero prawdziwej sieci.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../baseClient', async () => {
  const actual = await vi.importActual<typeof import('../baseClient')>('../baseClient');
  return {
    ...actual,
    fetchWithRetry: vi.fn(),
    getHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }),
  };
});

import { fetchWithRetry } from '../baseClient';
import { createFinanceLineageEdge, getFinanceLineageNavigator } from '../financeV2.api';

const mockedFetch = fetchWithRetry as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: 'https://example.test/mock',
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone(): Response {
      return response as unknown as Response;
    },
  };
  return response as unknown as Response;
}

beforeEach(() => {
  mockedFetch.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

const SAMPLE_NAVIGATOR = {
  businessVersionId: 'bv-focus',
  trail: {
    items: [
      {
        kind: 'node',
        metadata: {
          versionId: 'bv-focus',
          artifactId: 'art-1',
          artifactType: 'VALUATION_CASE',
          name: 'Valuation v1',
          versionLabel: 'v1',
          periodLabel: null,
          status: 'DRAFT',
          freshness: 'CURRENT',
          variantLabel: null,
        },
        displayName: 'Valuation v1',
        isFocus: true,
        outgoingEdgeType: null,
        staleBadge: null,
        stateBadge: null,
        isDimmed: false,
      },
    ],
    totalNodeCount: 1,
    hasAlternatePaths: false,
    unresolvedVersionIds: [],
    cycleVersionIds: [],
  },
  relatedPanel: {
    focus: {
      versionId: 'bv-focus',
      artifactId: 'art-1',
      artifactType: 'VALUATION_CASE',
      name: 'Valuation v1',
      versionLabel: 'v1',
      periodLabel: null,
      status: 'DRAFT',
      freshness: 'CURRENT',
      variantLabel: null,
    },
    parents: [],
    indirectAncestors: [],
    children: [],
    indirectDescendants: [],
    siblings: [],
    createNew: [],
    createNewBlockedReason: 'NO_DOWNSTREAM_TYPE',
    createNewBlockedLabel: { key: 'finance.lineage.createNew.blocked.noDownstream', pl: 'Brak typu docelowego' },
    focusBadges: [],
    terminalVisibility: 'dim',
    hiddenTerminalCount: 0,
    cycleVersionIds: [],
  },
  fullGraphView: { id: 'finance.lineage.fullGraph', label: { key: 'finance.lineage.fullGraph', pl: 'Pełny graf powiązań' }, auxiliary: true, defaultVisible: false },
};

describe('financeV2.api — AP-CLIENT LineageNavigator', () => {
  it('getFinanceLineageNavigator → GET .../versions/:id/lineage-navigator, bez query gdy brak opcji', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: SAMPLE_NAVIGATOR, meta: {} }));
    const result = await getFinanceLineageNavigator('bv-focus');
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v8/finance-v2/versions/bv-focus/lineage-navigator');
    expect(init.method).toBe('GET');
    expect(result.trail.items).toHaveLength(1);
    expect(result.relatedPanel.createNewBlockedLabel?.pl).toBe('Brak typu docelowego');
  });

  it('getFinanceLineageNavigator → dołącza maxDepth/maxTrailNodes/terminalVisibility jako query', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: SAMPLE_NAVIGATOR, meta: {} }));
    await getFinanceLineageNavigator('bv-focus', { maxDepth: 3, maxTrailNodes: 5, terminalVisibility: 'hide' });
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toContain('maxDepth=3');
    expect(url).toContain('maxTrailNodes=5');
    expect(url).toContain('terminalVisibility=hide');
  });

  it('getFinanceLineageNavigator → 404 NOT_FOUND (obcy business_version_id) trafia do .data.code', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(404, { error: 'Business version not found', code: 'NOT_FOUND' }));
    await expect(getFinanceLineageNavigator('foreign-bv')).rejects.toMatchObject({
      status: 404,
      data: { code: 'NOT_FOUND' },
    });
  });

  it('createFinanceLineageEdge → POST /versions/lineage-edges z pełnym body', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        data: {
          edgeId: 'edge-1',
          sourceVersionId: 'bv-src',
          sourceArtifactType: 'STATEMENT_PACK',
          targetVersionId: 'bv-tgt',
          targetArtifactType: 'HISTORICAL_ANALYSIS',
          edgeType: 'STATEMENT_TO_ANALYSIS',
          transformationKind: 'COMPUTE',
          assumptionSnapshotHash: null,
          authorId: 'u-1',
          createdAt: '2026-08-12T00:00:00.000Z',
        },
        meta: {},
      })
    );
    const result = await createFinanceLineageEdge({
      sourceVersionId: 'bv-src',
      sourceArtifactType: 'STATEMENT_PACK',
      targetVersionId: 'bv-tgt',
      targetArtifactType: 'HISTORICAL_ANALYSIS',
      edgeType: 'STATEMENT_TO_ANALYSIS',
      transformationKind: 'COMPUTE',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/versions/lineage-edges');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ sourceVersionId: 'bv-src', targetVersionId: 'bv-tgt', edgeType: 'STATEMENT_TO_ANALYSIS' });
    expect(result.edgeId).toBe('edge-1');
  });

  it('KONTROLA NEGATYWNA: createFinanceLineageEdge → 409 LINEAGE_CYCLE_REJECTED trafia do .data.code, nie do .code', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(409, { error: 'Cycle rejected', code: 'LINEAGE_CYCLE_REJECTED' }));
    let caught: any;
    try {
      await createFinanceLineageEdge({
        sourceVersionId: 'bv-a',
        sourceArtifactType: 'STATEMENT_PACK',
        targetVersionId: 'bv-b',
        targetArtifactType: 'HISTORICAL_ANALYSIS',
        edgeType: 'STATEMENT_TO_ANALYSIS',
        transformationKind: 'COMPUTE',
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.code).toBeUndefined();
    expect(caught.data.code).toBe('LINEAGE_CYCLE_REJECTED');
  });
});
