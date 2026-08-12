/**
 * @vitest-environment jsdom
 *
 * Klient `financeV2.api.ts` §AP-CLIENT SavedViews (Gate J) — `saved-views.routes.ts`, 6
 * endpointów. Ten sam wzorzec mockowania `fetchWithRetry`.
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
import {
  createFinanceSavedView,
  deleteFinanceSavedView,
  getFinanceSavedView,
  getFinanceSharedSavedView,
  listFinanceSavedViews,
  updateFinanceSavedView,
} from '../financeV2.api';
import { emptyGridViewStateSnapshot } from '../financeV2.types';

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

const SAMPLE_VIEW = {
  id: 'view-1',
  artifactId: 'art-1',
  artifactType: 'HISTORICAL_ANALYSIS',
  scope: 'PERSONAL',
  ownerUserId: 'u-1',
  name: 'Mój widok',
  viewState: { schemaVersion: 1, gridViewState: emptyGridViewStateSnapshot(), filters: [] },
  shareToken: 'tok-1',
  createdBy: 'u-1',
  createdAt: 't',
  updatedAt: 't',
};

describe('financeV2.api — AP-CLIENT SavedViews', () => {
  it('createFinanceSavedView → POST /saved-views z scope/gridViewState/filters', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(201, { data: SAMPLE_VIEW, meta: {} }));
    const result = await createFinanceSavedView({
      artifactId: 'art-1',
      scope: 'PERSONAL',
      name: 'Mój widok',
      gridViewState: emptyGridViewStateSnapshot(),
      filters: [{ type: 'missing', onlyMissing: true }],
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/saved-views');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.scope).toBe('PERSONAL');
    expect(body.filters).toEqual([{ type: 'missing', onlyMissing: true }]);
    expect(result.id).toBe('view-1');
  });

  it('listFinanceSavedViews → GET /saved-views?artifactId=', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [SAMPLE_VIEW], meta: {} }));
    const result = await listFinanceSavedViews('art-1');
    const [url] = mockedFetch.mock.calls[0];
    // v8Get buduje bezwzględny URL przez `new URL(path, window.location.origin).toString()`
    // (ten sam pomiar co `getFinanceArtifact`'s test w financeV2.api.test.ts).
    expect(url).toBe('http://localhost:3000/api/v8/finance-v2/saved-views?artifactId=art-1');
    expect(result).toHaveLength(1);
  });

  it('getFinanceSharedSavedView → GET /saved-views/shared/:token', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: SAMPLE_VIEW, meta: {} }));
    await getFinanceSharedSavedView('tok-1');
    const [url] = mockedFetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v8/finance-v2/saved-views/shared/tok-1');
  });

  it('getFinanceSavedView → GET /saved-views/:id, 404 gdy nieznaleziony', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(404, { error: 'not found', code: 'NOT_FOUND' }));
    await expect(getFinanceSavedView('missing')).rejects.toMatchObject({ status: 404, data: { code: 'NOT_FOUND' } });
  });

  it('updateFinanceSavedView → PATCH /saved-views/:id z podanymi polami', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: { ...SAMPLE_VIEW, name: 'Nowa nazwa' }, meta: {} }));
    await updateFinanceSavedView('view-1', { name: 'Nowa nazwa' });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/saved-views/view-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'Nowa nazwa' });
  });

  it('deleteFinanceSavedView → DELETE /saved-views/:id, 204 → null (bez treści)', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(204, undefined));
    const result = await deleteFinanceSavedView('view-1');
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/saved-views/view-1');
    expect(init.method).toBe('DELETE');
    expect(result).toBeNull();
  });

  it('KONTROLA NEGATYWNA: updateFinanceSavedView → 403 FORBIDDEN (nie-owner) trafia do .data.code, nie do .code', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(403, { error: 'owner-only', code: 'FORBIDDEN' }));
    let caught: any;
    try {
      await updateFinanceSavedView('view-1', { name: 'x' });
    } catch (e) {
      caught = e;
    }
    expect(caught.status).toBe(403);
    expect(caught.code).toBeUndefined();
    expect(caught.data.code).toBe('FORBIDDEN');
  });
});
