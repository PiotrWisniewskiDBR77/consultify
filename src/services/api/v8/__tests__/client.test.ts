/**
 * @vitest-environment jsdom
 *
 * `v8Delete` (src/services/api/v8/client.ts) — Gate J fix pass, defect #2.
 *
 * Before this fix, `v8Delete` unconditionally read `.data` off whatever `handleResponse`
 * returned. `handleResponse` (src/services/api/baseClient.ts) returns `null` — not `{ data }` —
 * for a genuine `204 No Content`, which is a legal, empty-body success response for a DELETE, not
 * an error. Reading `.data` off `null` threw `Cannot read properties of null (reading 'data')`
 * on any endpoint that really answers 204 (e.g. `saved-views.routes.ts`'s
 * `DELETE /saved-views/:id`, `res.status(204).send()`). The AP-CLIENT package worked around this
 * locally in `financeV2.api.ts` (`v8DeleteExpectNoContent`) rather than touching the shared
 * client; that workaround is now removed because the root cause is fixed here.
 *
 * `fetchWithRetry`/`getHeaders` are mocked (network layer); `handleResponse` is the REAL
 * implementation from `baseClient.ts` (imported via `vi.importActual`) so this test exercises the
 * actual 204-handling logic the bug lived in, not a re-implementation of it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../baseClient', async () => {
  const actual = await vi.importActual<typeof import('../../baseClient')>('../../baseClient');
  return {
    ...actual,
    fetchWithRetry: vi.fn(),
    getHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' }),
  };
});

import { fetchWithRetry } from '../../baseClient';
import { v8Delete, v8Get } from '../client';

const mockedFetch = fetchWithRetry as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    url: 'https://example.test/mock',
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
    clone(): Response {
      return response as unknown as Response;
    },
  };
  return response as unknown as Response;
}

/** A 204 truly has no body — calling `.json()`/`.text()` on a real fetch Response would throw. */
function noContentResponse(): Response {
  const response = {
    ok: true,
    status: 204,
    statusText: 'No Content',
    url: 'https://example.test/mock',
    json: async () => {
      throw new Error('204 responses have no body — .json() must not be called');
    },
    text: async () => {
      throw new Error('204 responses have no body — .text() must not be called');
    },
    headers: new Headers(),
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

describe('v8Delete — 204 No Content regression + negative controls', () => {
  it('a genuine 204 No Content resolves to null instead of throwing', async () => {
    mockedFetch.mockResolvedValueOnce(noContentResponse());
    await expect(v8Delete<null>('/saved-views/view-1')).resolves.toBeNull();
  });

  it('NEGATIVE CONTROL: a normal 200 + {data} envelope still unwraps .data (no regression on the common path)', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, { data: { success: true, deleted: 'x-1' } })
    );
    const result = await v8Delete<{ success: boolean; deleted: string }>('/finance/events/x-1');
    expect(result).toEqual({ success: true, deleted: 'x-1' });
  });

  it('NEGATIVE CONTROL: a real error status still throws (204-handling must not swallow errors)', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(404, { error: 'Not found', code: 'NOT_FOUND' }));
    await expect(v8Delete('/finance/events/missing')).rejects.toThrow('Not found');
  });
});

describe('v8Get — live registry cache policy', () => {
  it('bypasses browser and proxy caches for operational registry reads', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: [{ id: 'case-1' }] }));

    await expect(v8Get<Array<{ id: string }>>('/case-workspace/cases')).resolves.toEqual([
      { id: 'case-1' },
    ]);
    expect(mockedFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v8/case-workspace/cases',
      expect.objectContaining({ method: 'GET', cache: 'no-store' })
    );
  });
});
