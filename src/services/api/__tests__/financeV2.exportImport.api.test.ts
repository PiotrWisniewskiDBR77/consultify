/**
 * @vitest-environment jsdom
 *
 * Klient `financeV2.api.ts` §AP-CLIENT ExportImport (Gate J) — `export-import.routes.ts`, 4
 * endpointy. `exportFinanceStatementPackXlsx` jest jedynym endpointem w tym pakiecie, który NIE
 * zwraca JSON `{data}` (binarny `.xlsx` + manifest w nagłówku) — testowany osobno, bez
 * `handleResponse`'owej ścieżki `{data}`.
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
import { applyFinanceImport, exportFinanceStatementPackXlsx, parseFinanceImportXlsx, previewFinanceImport } from '../financeV2.api';

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

const SAMPLE_MANIFEST = {
  manifestVersion: 1,
  source: 'consultify-finance-v3-ap02',
  exportId: 'exp-1',
  organizationId: 'org-1',
  artifactId: 'art-1',
  artifactType: 'STATEMENT_PACK',
  businessVersionId: 'bv-1',
  businessVersionStatus: 'DRAFT',
  businessVersionNo: 3,
  businessVersionCasVersion: 5,
  workingRevisionId: 'wr-1',
  asOf: '2026-08-12T00:00:00.000Z',
  defaultUnit: 'THOUSANDS',
  defaultPresentationCurrency: 'PLN',
  rowCount: 120,
};

beforeEach(() => {
  mockedFetch.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('financeV2.api — AP-CLIENT ExportImport', () => {
  it('exportFinanceStatementPackXlsx → GET binarny, manifest z nagłówka X-Finance-Export-Manifest', async () => {
    const fakeBlob = new Blob(['xlsx-bytes'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const headerMap = new Map<string, string>([
      ['X-Finance-Export-Manifest', JSON.stringify(SAMPLE_MANIFEST)],
      ['Content-Disposition', 'attachment; filename="art-1-v3.xlsx"'],
    ]);
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: (name: string) => headerMap.get(name) ?? null },
      blob: async () => fakeBlob,
    } as unknown as Response);

    const result = await exportFinanceStatementPackXlsx('art-1', 'bv-1');
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/export/statement-pack/art-1/bv-1');
    expect(init.method).toBe('GET');
    expect(result.manifest.businessVersionNo).toBe(3);
    expect(result.manifest.artifactId).toBe('art-1');
    expect(result.filename).toBe('art-1-v3.xlsx');
    expect(result.blob).toBe(fakeBlob);
  });

  it('KONTROLA NEGATYWNA: exportFinanceStatementPackXlsx → 404 NOT_FOUND (JSON, nie blob) trafia do .data.code', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(404, { error: 'not found', code: 'NOT_FOUND' }));
    await expect(exportFinanceStatementPackXlsx('missing', 'bv-1')).rejects.toMatchObject({
      status: 404,
      data: { code: 'NOT_FOUND' },
    });
  });

  it('parseFinanceImportXlsx → multipart POST /import/parse z polem "file"', async () => {
    mockedFetch.mockResolvedValueOnce(jsonResponse(200, { data: { manifest: SAMPLE_MANIFEST, manifestIssues: [], rows: [] }, meta: {} }));
    const file = new Blob(['fake-xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const result = await parseFinanceImportXlsx(file, 'plik.xlsx');
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/import/parse');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(result.manifest?.artifactId).toBe('art-1');
  });

  it('previewFinanceImport → POST /import/preview, read-only (nic nie zapisuje)', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          ok: true,
          manifestCheck: { ok: true, issues: [] },
          diff: { toAdd: [], toChange: [], toClear: [], unchangedCount: 5 },
          rowErrors: [],
          totalRows: 5,
        },
        meta: {},
      })
    );
    const result = await previewFinanceImport({ artifactId: 'art-1', businessVersionId: 'bv-1', manifest: SAMPLE_MANIFEST, rows: [] });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/import/preview');
    expect(JSON.parse(init.body)).toMatchObject({ artifactId: 'art-1', businessVersionId: 'bv-1' });
    expect(result.ok).toBe(true);
    expect(result.diff.unchangedCount).toBe(5);
  });

  it('applyFinanceImport → POST /import/apply, dołącza nagłówek Idempotency-Key = batchIdempotencyKey', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {
          businessVersionId: 'bv-1',
          newWorkingRevisionId: 'wr-2',
          newRevisionSeq: 2,
          appliedCount: { added: 1, changed: 2, cleared: 0 },
          idempotentReplay: false,
          reopened: false,
        },
        meta: {},
      })
    );
    const result = await applyFinanceImport({
      artifactId: 'art-1',
      businessVersionId: 'bv-1',
      expectedWorkingRevisionId: 'wr-1',
      manifest: SAMPLE_MANIFEST,
      rows: [],
      batchIdempotencyKey: 'idem-key-1',
    });
    const [url, init] = mockedFetch.mock.calls[0];
    expect(url).toBe('/api/v8/finance-v2/import/apply');
    expect(init.headers['Idempotency-Key']).toBe('idem-key-1');
    expect(result.appliedCount).toEqual({ added: 1, changed: 2, cleared: 0 });
  });

  it('KONTROLA NEGATYWNA: applyFinanceImport → 409 WORKING_REVISION_CONFLICT (CAS pin nieaktualny) trafia do .data.code, wynik nigdy częściowy', async () => {
    mockedFetch.mockResolvedValueOnce(
      jsonResponse(409, { error: 'stale revision', code: 'WORKING_REVISION_CONFLICT', currentWorkingRevisionId: 'wr-3' })
    );
    let caught: any;
    try {
      await applyFinanceImport({
        artifactId: 'art-1',
        businessVersionId: 'bv-1',
        expectedWorkingRevisionId: 'wr-stale',
        manifest: SAMPLE_MANIFEST,
        rows: [],
        batchIdempotencyKey: 'idem-key-2',
      });
    } catch (e) {
      caught = e;
    }
    expect(caught.status).toBe(409);
    expect(caught.code).toBeUndefined();
    expect(caught.data.code).toBe('WORKING_REVISION_CONFLICT');
    expect(caught.data.currentWorkingRevisionId).toBe('wr-3');
  });
});
