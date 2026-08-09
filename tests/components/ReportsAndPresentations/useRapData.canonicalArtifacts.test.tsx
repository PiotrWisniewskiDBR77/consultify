/**
 * @vitest-environment jsdom
 *
 * Proves real useRapData hooks call canonical registry list endpoints and map
 * registry-shaped payloads into UI row models (Wave 2 Outputs Library data path).
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  normalizeReportActionTarget,
  useRapActions,
  useArtifactOutputsList,
  useArtifactOutputsForInitiative,
  useArtifactOutputsForInitiatives,
  useMyWorkArtifactOutputs,
  usePresentations,
  useReports,
  useSheetOutputs,
} from '../../../src/components/ReportsAndPresentations/useRapData';

const originalFetch = globalThis.fetch;
const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    }),
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
  },
}));

function jsonResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  }) as Promise<Response>;
}

describe('useRapData — canonical /api/artifacts consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('normalizes report action targets from both report rows and aggregate registry rows', () => {
    expect(
      normalizeReportActionTarget({
        id: 'report-1',
        artifactId: 'art-report-1',
        title: 'Weekly execution report',
      }),
    ).toEqual({
      originRecordId: 'report-1',
      artifactId: 'art-report-1',
      label: 'Weekly execution report',
    });

    expect(
      normalizeReportActionTarget({
        originRecordId: 'report-2',
        artifactId: 'art-report-2',
        title: 'Portfolio overview',
      }),
    ).toEqual({
      originRecordId: 'report-2',
      artifactId: 'art-report-2',
      label: 'Portfolio overview',
    });
  });

  it('useRapActions resolves report delete authority through /api/artifacts/:id/action-target', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method || 'GET';
      calls.push({ url, method });

      if (url.includes('/api/artifacts/art-report-1/action-target')) {
        return jsonResponse({
          data: {
            artifactId: 'art-report-1',
            originRuntime: 'report',
            originRecordId: 'report-1',
            openPath: '/reports/builder/report-1',
            exportPath: '/api/report-builder/report-1/export/pdf',
            deletePath: '/api/report-builder/report-1',
            reviewPath: '/api/artifacts/art-report-1/start-review',
            authority: 'report_builder',
          },
        });
      }

      if (url.includes('/api/report-builder/report-1') && method === 'DELETE') {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({}, false);
    }) as typeof fetch;

    const { result } = renderHook(() => useRapActions());
    const ok = await result.current.archiveReport({
      originRecordId: 'report-1',
      artifactId: 'art-report-1',
      title: 'Report 1',
    });

    expect(ok).toBe(true);
    expect(calls).toEqual([
      { url: '/api/artifacts/art-report-1/action-target', method: 'GET' },
      { url: '/api/report-builder/report-1', method: 'DELETE' },
    ]);
  });

  it('useRapActions resolves presentation delete authority through /api/artifacts/:id/action-target', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method || 'GET';
      calls.push({ url, method });

      if (url.includes('/api/artifacts/art-deck-1/action-target')) {
        return jsonResponse({
          data: {
            artifactId: 'art-deck-1',
            originRuntime: 'presentation',
            originRecordId: 'deck-1',
            openPath: '/presentations/builder/deck-1',
            exportPath: '/api/presentations/decks/deck-1/download',
            deletePath: '/api/presentations/decks/deck-1',
            reviewPath: '/api/artifacts/art-deck-1/start-review',
            authority: 'presentations_runtime',
          },
        });
      }

      if (url.includes('/api/presentations/decks/deck-1') && method === 'DELETE') {
        return jsonResponse({ ok: true });
      }

      return jsonResponse({}, false);
    }) as typeof fetch;

    const { result } = renderHook(() => useRapActions());
    const ok = await result.current.archiveDeck({
      originRecordId: 'deck-1',
      artifactId: 'art-deck-1',
      title: 'Deck 1',
    });

    expect(ok).toBe(true);
    expect(calls).toEqual([
      { url: '/api/artifacts/art-deck-1/action-target', method: 'GET' },
      { url: '/api/presentations/decks/deck-1', method: 'DELETE' },
    ]);
  });

  it('useArtifactOutputsList(all) requests GET /api/artifacts?limit=200 and maps registry rows', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('/api/artifacts?') && !url.includes('view=') && !url.includes('outputType=')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'report',
              originRecordId: 'reg-r1',
              artifactId: 'art-1',
              resolvedTitle: 'Registry Report',
              originStatus: 'ready',
              ownerUserId: 'user-a',
              lastTransitionAt: '2026-03-20T10:00:00Z',
              openPath: '/reports/builder/reg-r1',
              exportPath: '/api/report-builder/reg-r1/export/pdf',
              exportFormat: 'pdf',
              authority: 'report_builder',
            },
            {
              originRuntime: 'presentation',
              originRecordId: 'reg-p1',
              artifactId: 'art-2',
              resolvedTitle: 'Registry Deck',
              deliveryState: 'draft',
              ownerUserId: 'user-b',
              lastTransitionAt: '2026-03-21T11:00:00Z',
            },
            {
              originRuntime: 'sheet',
              originRecordId: 'reg-s1',
              artifactId: 'art-3',
              resolvedTitle: 'Registry Sheet',
              originStatus: 'generated',
              ownerUserId: 'user-c',
              lastTransitionAt: '2026-03-22T12:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useArtifactOutputsList('all'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(calls.some((u) => u.includes('/api/artifacts?') && u.includes('limit=200'))).toBe(true);
    expect(calls.some((u) => u.includes('view=mine'))).toBe(false);

    const kinds = result.current.rows.map((r) => r.kind).sort();
    expect(kinds).toEqual(['document', 'presentation', 'sheet']);
    const doc = result.current.rows.find((r) => r.kind === 'document');
    expect(doc?.title).toBe('Registry Report');
    expect(doc?.artifactId).toBe('art-1');
    expect(doc?.governance?.openPath).toBe('/reports/builder/reg-r1');
    expect(doc?.governance?.exportPath).toBe('/api/report-builder/reg-r1/export/pdf');
    expect(doc?.fileFormat).toBe('PDF');
  });

  // P0.2 (2026-07-26): a Document Studio document (originRuntime=native_artifact)
  // used to map to `null` in mapRegistryItemToUnified and vanish from the
  // Documents/All list even though the server indexed it correctly. This pins
  // that it now surfaces as a 'document' row and opens via the Document Studio
  // resume path the server assigns it (never /wordy).
  it('useArtifactOutputsList(all) includes Document Studio documents (originRuntime=native_artifact)', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('/api/artifacts?') && !url.includes('view=') && !url.includes('outputType=')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'native_artifact',
              originRecordId: 'doc-studio-42',
              artifactId: 'art-doc-1',
              resolvedTitle: 'Notatka z warsztatu',
              originStatus: 'ready',
              ownerUserId: 'user-a',
              lastTransitionAt: '2026-07-24T10:00:00Z',
              openPath: '/document-studio/doc-studio-42',
              exportPath: '/api/document-studio/doc-studio-42/export/pdf',
              exportFormat: 'docx',
              authority: 'document_studio',
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useArtifactOutputsList('all'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toEqual(
      expect.objectContaining({
        kind: 'document',
        originRecordId: 'doc-studio-42',
        artifactId: 'art-doc-1',
        title: 'Notatka z warsztatu',
        fileFormat: 'DOCX',
      }),
    );
    expect(result.current.rows[0]?.governance?.openPath).toBe('/document-studio/doc-studio-42');
  });

  it('useArtifactOutputsList(mine) appends view=mine', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      calls.push(typeof input === 'string' ? input : String(input));
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useArtifactOutputsList('mine'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.some((u) => u.includes('view=mine') && u.includes('limit=200'))).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('useArtifactOutputsList(review) appends view=review', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      calls.push(typeof input === 'string' ? input : String(input));
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useArtifactOutputsList('review'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.some((u) => u.includes('view=review') && u.includes('limit=200'))).toBe(true);
  });

  it('useReports prefers GET /api/artifacts?outputType=report&limit=200 and maps artifact rows', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('outputType=report')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'report',
              originRecordId: 'rb-99',
              artifactId: 'art-rb',
              resolvedTitle: 'From Registry',
              originStatus: 'ready',
              reportType: 'R1',
              ownerUserId: 'owner-1',
              lastTransitionAt: '2026-03-10T08:00:00Z',
              openPath: '/reports/builder/rb-99',
            },
          ],
        });
      }
      return jsonResponse({ reports: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.some((u) => u.includes('outputType=report') && u.includes('limit=200'))).toBe(true);
    expect(result.current.reports).toHaveLength(1);
    expect(result.current.reports[0]?.id).toBe('rb-99');
    expect(result.current.reports[0]?.title).toBe('From Registry');
    expect(result.current.reports[0]?.artifactId).toBe('art-rb');
    expect(result.current.reports[0]?.governance?.openPath).toBe('/reports/builder/rb-99');
    expect(result.current.error).toBeNull();
  });

  // P0.2 (2026-07-26): the Documents tab (useReports) previously filtered
  // strictly to originRuntime==='report', excluding every document created
  // directly in Document Studio (originRuntime='native_artifact') even though
  // both share outputType='report'/artifactFamily='document'.
  it('useReports includes Document Studio documents (originRuntime=native_artifact) alongside report_builder rows', async () => {
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('outputType=report')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'report',
              originRecordId: 'rb-1',
              artifactId: 'art-rb-1',
              resolvedTitle: 'Report Builder doc',
              originStatus: 'ready',
              ownerUserId: 'owner-1',
              lastTransitionAt: '2026-07-24T08:00:00Z',
              openPath: '/reports/builder/rb-1',
            },
            {
              originRuntime: 'native_artifact',
              originRecordId: 'doc-studio-42',
              artifactId: 'art-doc-1',
              resolvedTitle: 'Document Studio doc',
              originStatus: 'ready',
              ownerUserId: 'owner-1',
              lastTransitionAt: '2026-07-24T09:00:00Z',
              openPath: '/document-studio/doc-studio-42',
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reports).toHaveLength(2);
    const ids = result.current.reports.map((r) => r.id).sort();
    expect(ids).toEqual(['doc-studio-42', 'rb-1']);
    const docStudioRow = result.current.reports.find((r) => r.id === 'doc-studio-42');
    expect(docStudioRow?.governance?.openPath).toBe('/document-studio/doc-studio-42');
  });

  it('usePresentations prefers GET /api/artifacts?outputType=presentation&limit=200', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('outputType=presentation')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'presentation',
              originRecordId: 'deck-1',
              artifactId: 'art-p',
              resolvedTitle: 'Deck From Registry',
              sourceType: 'tool',
              originStatus: 'editing',
              ownerUserId: 'owner-p',
              lastTransitionAt: '2026-03-11T09:00:00Z',
              slideCount: 5,
              openPath: '/presentations/builder/deck-1',
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => usePresentations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.some((u) => u.includes('outputType=presentation') && u.includes('limit=200'))).toBe(
      true
    );
    expect(result.current.presentations).toHaveLength(1);
    expect(result.current.presentations[0]?.title).toBe('Deck From Registry');
    expect(result.current.presentations[0]?.artifactId).toBe('art-p');
    expect(result.current.presentations[0]?.governance?.openPath).toBe(
      '/presentations/builder/deck-1'
    );
    expect(result.current.error).toBeNull();
  });

  it('useSheetOutputs consumes GET /api/artifacts?outputType=sheet&limit=200', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('outputType=sheet')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'sheet',
              originRecordId: 'table-77',
              artifactId: 'art-sheet',
              resolvedTitle: 'Registry sheet',
              originStatus: 'generated',
              ownerUserId: 'owner-s',
              lastTransitionAt: '2026-03-11T09:00:00Z',
              exportFormat: 'xlsx',
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useSheetOutputs());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.some((u) => u.includes('outputType=sheet') && u.includes('limit=200'))).toBe(true);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toEqual(
      expect.objectContaining({
        kind: 'sheet',
        originRecordId: 'table-77',
        artifactId: 'art-sheet',
        title: 'Registry sheet',
      }),
    );
    expect(result.current.error).toBeNull();
  });

  it('useMyWorkArtifactOutputs consumes GET /api/artifacts/my-work and maps lane payloads', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('/api/artifacts/my-work?limit=8')) {
        return jsonResponse({
          mine: [
            {
              originRuntime: 'report',
              originRecordId: 'mine-r1',
              artifactId: 'art-mine-1',
              resolvedTitle: 'My weekly report',
              originStatus: 'draft',
              ownerUserId: 'user-a',
              lastTransitionAt: '2026-03-24T08:00:00Z',
            },
          ],
          review: [
            {
              originRuntime: 'presentation',
              originRecordId: 'review-p1',
              artifactId: 'art-review-1',
              resolvedTitle: 'Board review deck',
              originStatus: 'shared',
              ownerUserId: 'user-b',
              lastTransitionAt: '2026-03-24T09:00:00Z',
            },
          ],
          recent: [
            {
              originRuntime: 'sheet',
              originRecordId: 'recent-s1',
              artifactId: 'art-recent-1',
              resolvedTitle: 'Benefits tracker',
              originStatus: 'generated',
              ownerUserId: 'user-c',
              lastTransitionAt: '2026-03-24T10:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({ mine: [], review: [], recent: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useMyWorkArtifactOutputs());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls).toEqual([expect.stringContaining('/api/artifacts/my-work?limit=8')]);
    expect(result.current.mine[0]).toEqual(
      expect.objectContaining({ kind: 'document', originRecordId: 'mine-r1' }),
    );
    expect(result.current.review[0]).toEqual(
      expect.objectContaining({ kind: 'presentation', originRecordId: 'review-p1' }),
    );
    expect(result.current.recent[0]).toEqual(
      expect.objectContaining({ kind: 'sheet', originRecordId: 'recent-s1' }),
    );
    expect(result.current.error).toBeNull();
  });

  it('useArtifactOutputsForInitiative requests canonical rows linked to one initiative', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('/api/artifacts?sourceInitiativeId=init-1&limit=8')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'report',
              originRecordId: 'init-r1',
              artifactId: 'art-init-1',
              resolvedTitle: 'Initiative output',
              originStatus: 'draft',
              ownerUserId: 'user-a',
              sourceInitiativeId: 'init-1',
              lastTransitionAt: '2026-03-24T08:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useArtifactOutputsForInitiative('init-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls).toEqual([expect.stringContaining('/api/artifacts?sourceInitiativeId=init-1&limit=8')]);
    expect(result.current.rows[0]).toEqual(
      expect.objectContaining({
        kind: 'document',
        originRecordId: 'init-r1',
        sourceInitiativeId: 'init-1',
      }),
    );
  });

  it('useArtifactOutputsForInitiatives merges and deduplicates canonical rows across initiative backlinks', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('/api/artifacts?sourceInitiativeId=init-1&limit=8')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'report',
              originRecordId: 'init-r1',
              artifactId: 'art-shared',
              resolvedTitle: 'Shared initiative report',
              originStatus: 'draft',
              ownerUserId: 'user-a',
              sourceInitiativeId: 'init-1',
              lastTransitionAt: '2026-03-24T08:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/api/artifacts?sourceInitiativeId=init-2&limit=8')) {
        return jsonResponse({
          data: [
            {
              originRuntime: 'report',
              originRecordId: 'init-r1',
              artifactId: 'art-shared',
              resolvedTitle: 'Shared initiative report',
              originStatus: 'draft',
              ownerUserId: 'user-a',
              sourceInitiativeId: 'init-1',
              lastTransitionAt: '2026-03-24T08:00:00Z',
            },
            {
              originRuntime: 'presentation',
              originRecordId: 'deck-2',
              artifactId: 'art-deck-2',
              resolvedTitle: 'Executive deck',
              originStatus: 'shared',
              ownerUserId: 'user-b',
              sourceInitiativeId: 'init-2',
              lastTransitionAt: '2026-03-24T09:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({ data: [] });
    }) as typeof fetch;

    const { result } = renderHook(() => useArtifactOutputsForInitiatives(['init-2', 'init-1', 'init-1']));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls).toEqual([
      expect.stringContaining('/api/artifacts?sourceInitiativeId=init-1&limit=8'),
      expect.stringContaining('/api/artifacts?sourceInitiativeId=init-2&limit=8'),
    ]);
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows.map((row) => row.title)).toEqual([
      'Shared initiative report',
      'Executive deck',
    ]);
    expect(result.current.error).toBeNull();
  });

  it('useReports fails closed when canonical registry is unavailable', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      return Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      }) as Promise<Response>;
    }) as typeof fetch;

    const { result } = renderHook(() => useReports());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls).toEqual([expect.stringContaining('/api/artifacts?outputType=report&limit=200')]);
    expect(result.current.reports).toEqual([]);
    expect(result.current.error).toBe('Canonical artifact registry failed to load reports.');
  });

  it('usePresentations fails closed when canonical registry is unavailable', async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      return Promise.resolve({
        ok: false,
        status: 501,
        json: async () => ({}),
      }) as Promise<Response>;
    }) as typeof fetch;

    const { result } = renderHook(() => usePresentations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls).toEqual([expect.stringContaining('/api/artifacts?outputType=presentation&limit=200')]);
    expect(result.current.presentations).toEqual([]);
    expect(result.current.error).toBe('Canonical artifact registry failed to load presentations.');
  });

  it('useRapActions.exportReportPdf prefers canonical action-target exportPath', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const blobMock = new Blob(['pdf-data'], { type: 'application/pdf' });
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method || 'GET';
      calls.push({ url, method });
      if (url.includes('/api/artifacts/art-report-1/action-target')) {
        return jsonResponse({
          data: {
            artifactId: 'art-report-1',
            originRuntime: 'report',
            originRecordId: 'report-1',
            exportPath: '/api/report-builder/report-1/export/pdf',
          },
        });
      }
      if (url === '/api/report-builder/report-1/export/pdf') {
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: async () => blobMock,
        }) as Promise<Response>;
      }
      return jsonResponse({}, false);
    }) as typeof fetch;
    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://report');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { result } = renderHook(() => useRapActions());
    await result.current.exportReportPdf({
      originRecordId: 'report-1',
      artifactId: 'art-report-1',
      title: 'Report 1',
    });

    expect(calls).toEqual([
      { url: '/api/artifacts/art-report-1/action-target', method: 'GET' },
      { url: '/api/report-builder/report-1/export/pdf', method: 'GET' },
    ]);
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    revokeSpy.mockRestore();
    objectUrlSpy.mockRestore();
  });

  it('useRapActions.exportDeckPptx falls back to default download path when action-target missing', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const blobMock = new Blob(['pptx-data'], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : String(input);
      const method = init?.method || 'GET';
      calls.push({ url, method });
      if (url.includes('/api/artifacts/art-deck-1/action-target')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        }) as Promise<Response>;
      }
      if (url === '/api/presentations/decks/deck-1/download') {
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: async () => blobMock,
        }) as Promise<Response>;
      }
      return jsonResponse({}, false);
    }) as typeof fetch;
    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://deck');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { result } = renderHook(() => useRapActions());
    await result.current.exportDeckPptx({
      originRecordId: 'deck-1',
      artifactId: 'art-deck-1',
      title: 'Deck 1',
    });

    expect(calls).toEqual([
      { url: '/api/artifacts/art-deck-1/action-target', method: 'GET' },
      { url: '/api/presentations/decks/deck-1/download', method: 'GET' },
    ]);
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    revokeSpy.mockRestore();
    objectUrlSpy.mockRestore();
  });

  // ─── No silent demo fallback in the paid path (P0-1 / P1-2) ───────

  it('useReports returns an empty list (never demo rows) when the registry 404s', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response)
    ) as typeof fetch;

    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.reports).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });

  it('usePresentations returns an empty list (never demo rows) when the registry 501s', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 501,
        json: async () => ({}),
      } as Response)
    ) as typeof fetch;

    const { result } = renderHook(() => usePresentations());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.presentations).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });

  // ─── Approval-before-export client guard (P0-2) ───────────────────

  it('exportReportPdf blocks export on a draft artifact and never fetches the export URL', async () => {
    const fetchSpy = vi.fn(() => jsonResponse({}, false)) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;

    const { result } = renderHook(() => useRapActions());
    await result.current.exportReportPdf({
      originRecordId: 'report-draft',
      artifactId: 'art-report-draft',
      title: 'Draft report',
      governance: { publishState: 'draft' },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('Approve the artifact before exporting');
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('exportDeckPptx blocks export on an in_review artifact and never fetches the export URL', async () => {
    const fetchSpy = vi.fn(() => jsonResponse({}, false)) as unknown as typeof fetch;
    globalThis.fetch = fetchSpy;

    const { result } = renderHook(() => useRapActions());
    await result.current.exportDeckPptx({
      originRecordId: 'deck-review',
      artifactId: 'art-deck-review',
      title: 'Deck in review',
      governance: { publishState: 'in_review' },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('Approve the artifact before exporting');
  });

  it('exportReportPdf proceeds when the artifact is approved', async () => {
    const calls: string[] = [];
    const blobMock = new Blob(['pdf-data'], { type: 'application/pdf' });
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('/api/artifacts/art-report-approved/action-target')) {
        return jsonResponse({
          data: {
            artifactId: 'art-report-approved',
            originRuntime: 'report',
            originRecordId: 'report-approved',
            exportPath: '/api/report-builder/report-approved/export/pdf',
          },
        });
      }
      if (url === '/api/report-builder/report-approved/export/pdf') {
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: async () => blobMock,
        }) as Promise<Response>;
      }
      return jsonResponse({}, false);
    }) as typeof fetch;
    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://report');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useRapActions());
    await result.current.exportReportPdf({
      originRecordId: 'report-approved',
      artifactId: 'art-report-approved',
      title: 'Approved report',
      governance: { publishState: 'approved' },
    });

    expect(calls).toContain('/api/report-builder/report-approved/export/pdf');
    expect(clickSpy).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalled();

    clickSpy.mockRestore();
    revokeSpy.mockRestore();
    objectUrlSpy.mockRestore();
  });

  it('exportReportPdf proceeds when the target carries no governance (server gate is the backstop)', async () => {
    const calls: string[] = [];
    const blobMock = new Blob(['pdf-data'], { type: 'application/pdf' });
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      calls.push(url);
      if (url.includes('/action-target')) return jsonResponse({}, false);
      if (url === '/api/report-builder/report-nogov/export/pdf') {
        return Promise.resolve({
          ok: true,
          status: 200,
          blob: async () => blobMock,
        }) as Promise<Response>;
      }
      return jsonResponse({}, false);
    }) as typeof fetch;
    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://report');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useRapActions());
    await result.current.exportReportPdf({
      originRecordId: 'report-nogov',
      artifactId: 'art-report-nogov',
      title: 'Legacy report',
    });

    expect(calls).toContain('/api/report-builder/report-nogov/export/pdf');
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    revokeSpy.mockRestore();
    objectUrlSpy.mockRestore();
  });
});
