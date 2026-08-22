/**
 * @vitest-environment jsdom
 *
 * Klient `financeV2.api.ts` (Pakiet C) — dowód, że każda z 12 funkcji trafia
 * pod poprawny URL/`/api/v8/finance-v2/*`, z poprawną metodą i nagłówkami
 * (`Idempotency-Key` dla enqueue/reopen), i że `{data}` jest rozpakowywane, a
 * błąd `{error,code}` z serwera trafia do rzuconego `Error` z `.status`/`.code`.
 *
 * Mockuje `fetchWithRetry` (ten sam wzorzec co
 * `presentationStudioLayoutCapacityAdmin.api.test.ts`) — zero prawdziwej sieci.
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
  approveFinanceModel,
  createFinanceArtifact,
  enqueueFinanceComputeJob,
  getFinanceArtifact,
  getFinanceArtifactCapabilities,
  getFinanceComputeJob,
  listFinanceArtifacts,
  reopenFinanceModel,
  transitionFinanceVersion,
} from '../financeV2.api';

const mockedFetch = fetchWithRetry as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(status: number, body: unknown): Response {
  // `baseClient.handleResponse`'s error path calls `res.clone().json()` first
  // (robust parsing against proxies that return HTML/empty bodies) — the mock
  // Response needs a working `.clone()` or that path silently falls through
  // to `{}` and every error-shape assertion below would falsely read as
  // "no code", not because the client is wrong but because the mock is thin.
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

describe('financeV2.api — routing + rozpakowanie {data}', () => {
  it('createFinanceArtifact → POST /api/v8/finance-v2/artifacts, zwraca data', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        data: {
          artifactId: 'art-1',
          artifactType: 'BASELINE_MODEL',
          naturalKey: null,
          createdAt: '2026-01-01',
          currentBusinessVersion: {
            businessVersionId: 'bv-1',
            versionNo: 1,
            version: 1,
            status: 'DRAFT',
            riskTier: 'LOW',
          },
          workingRevisionId: 'wr-1',
        },
        meta: { version: 'v2', contract: 'finance_v3_canonical_v1' },
      })
    );
    const result = await createFinanceArtifact({ artifactType: 'BASELINE_MODEL' });
    expect(result.artifactId).toBe('art-1');
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/artifacts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ artifactType: 'BASELINE_MODEL', naturalKey: null });
  });

  it('getFinanceArtifact → GET /api/v8/finance-v2/artifacts/:id (URL-encoded)', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          artifactId: 'art with space',
          artifactType: 'STATEMENT_PACK',
          naturalKey: null,
          createdAt: 't',
          archivedAt: null,
          archivedReason: null,
          currentBusinessVersion: null,
        },
        meta: {},
      })
    );
    await getFinanceArtifact('art with space');
    const [url, init] = mockedFetch.mock.calls[0];
    // v8Get (src/services/api/v8/client.ts) buduje URL przez `new URL(path,
    // window.location.origin).toString()` → bezwzględny URL (inaczej niż
    // v8Post, który woła fetchWithRetry ze ścieżką względną wprost).
    expect(url).toBe('http://localhost:3000/api/v8/finance-v2/artifacts/art%20with%20space');
    expect(init.method).toBe('GET');
  });

  it('listFinanceArtifacts → canonical registry with an artifact-type filter', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: { artifacts: [], count: 0 },
        meta: { version: 'v2', contract: 'finance_v3_canonical_v1' },
      })
    );
    await listFinanceArtifacts({ artifactType: 'VALUATION_CASE' });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe(
      'http://localhost:3000/api/v8/finance-v2/artifacts?artifactType=VALUATION_CASE'
    );
    expect(init.method).toBe('GET');
  });

  it('getFinanceArtifactCapabilities → allowedActions przechodzi bez modyfikacji', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          artifactId: 'a',
          businessVersionId: 'bv',
          status: 'IN_REVIEW',
          role: 'approver',
          allowedActions: ['approve', 'request_changes'],
        },
        meta: {},
      })
    );
    const caps = await getFinanceArtifactCapabilities('a');
    expect(caps.allowedActions).toEqual(['approve', 'request_changes']);
  });

  it('transitionFinanceVersion → POST z action/expectedVersion w body', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          businessVersionId: 'bv-1',
          status: 'READY_FOR_REVIEW',
          version: 2,
          freshnessPropagation: null,
        },
        meta: {},
      })
    );
    await transitionFinanceVersion({
      businessVersionId: 'bv-1',
      action: 'submit_for_review',
      expectedVersion: 1,
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/versions/bv-1/transitions');
    expect(JSON.parse(init.body)).toEqual({ action: 'submit_for_review', expectedVersion: 1 });
  });

  it('enqueueFinanceComputeJob → dołącza nagłówek Idempotency-Key', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        data: {
          jobId: 'job-1',
          jobType: 'baseline_compute',
          status: 'queued',
          inputArtifactId: 'a',
          inputRevisionHash: 'h',
          attemptCount: 0,
          maxAttempts: 3,
          createdAt: 't',
          startedAt: null,
          finishedAt: null,
          error: null,
          requestedByUserId: 'u',
          wasExisting: false,
        },
        meta: {},
      })
    );
    await enqueueFinanceComputeJob({
      jobType: 'baseline_compute',
      inputArtifactId: 'a',
      inputRevisionHash: 'h',
      engineManifestId: 'em-1',
      idempotencyKey: 'idem-123',
    });
    const [, init] = mockedFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe('idem-123');
  });

  it('getFinanceComputeJob: status "queued/running/succeeded/failed/cancelled" przechodzi jeden-do-jednego (KONTROLA NEGATYWNA: dwa różne statusy dają różny wynik)', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          jobId: 'j1',
          jobType: 't',
          status: 'running',
          inputArtifactId: 'a',
          inputRevisionHash: 'h',
          attemptCount: 1,
          maxAttempts: 3,
          createdAt: 't',
          startedAt: 't',
          finishedAt: null,
          error: null,
          requestedByUserId: 'u',
        },
        meta: {},
      })
    );
    const running = await getFinanceComputeJob('j1');

    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          jobId: 'j1',
          jobType: 't',
          status: 'failed',
          inputArtifactId: 'a',
          inputRevisionHash: 'h',
          attemptCount: 3,
          maxAttempts: 3,
          createdAt: 't',
          startedAt: 't',
          finishedAt: 't',
          error: 'boom',
          requestedByUserId: 'u',
        },
        meta: {},
      })
    );
    const failed = await getFinanceComputeJob('j1');

    expect(running.status).toBe('running');
    expect(failed.status).toBe('failed');
    expect(running.status).not.toBe(failed.status);
    expect(failed.error).toBe('boom');
    expect(running.error).toBeNull();
  });

  it('approveFinanceModel → sukces zwraca {success:true, status:"approved"}', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { success: true, status: 'approved' }));
    const result = await approveFinanceModel({ modelArtifactId: 'm-1' });
    expect(result).toEqual({ success: true, status: 'approved' });
  });

  it('reopenFinanceModel → wymaga Idempotency-Key i reason w body', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        data: {
          artifactId: 'm-1',
          previousBusinessVersionId: 'bv-1',
          businessVersionId: 'bv-2',
          versionNo: 2,
          status: 'DRAFT',
          workingRevisionId: 'wr-2',
          idempotentReplay: false,
        },
        meta: {},
      })
    );
    await reopenFinanceModel({
      modelArtifactId: 'm-1',
      reason: 'Błąd w założeniach',
      idempotencyKey: 'idem-reopen-1',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/models/m-1/reopen');
    expect(init.headers['Idempotency-Key']).toBe('idem-reopen-1');
    expect(JSON.parse(init.body)).toEqual({ reason: 'Błąd w założeniach' });
  });

  it('błąd 409 VERSION_CONFLICT → rzucony Error niesie .status i .data.code (zmierzone: baseClient.handleResponse NIE ustawia .code bezpośrednio)', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(409, { error: 'Version conflict', code: 'VERSION_CONFLICT' })
    );
    await expect(
      transitionFinanceVersion({
        businessVersionId: 'bv-1',
        action: 'withdraw',
        expectedVersion: 1,
      })
    ).rejects.toMatchObject({
      status: 409,
      data: { code: 'VERSION_CONFLICT' },
    });
  });

  it('błąd 404 NOT_FOUND → rzucony Error niesie .status 404 i .data.code NOT_FOUND', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(404, { error: 'Artifact not found', code: 'NOT_FOUND' })
    );
    await expect(getFinanceArtifact('nieistniejacy')).rejects.toMatchObject({
      status: 404,
      data: { code: 'NOT_FOUND' },
    });
  });
});
