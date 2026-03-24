/**
 * @vitest-environment jsdom
 *
 * Proves real useRapData hooks call canonical registry list endpoints and map
 * registry-shaped payloads into UI row models (Wave 2 Outputs Library data path).
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useArtifactOutputsList,
  useArtifactOutputsForInitiative,
  useArtifactOutputsForInitiatives,
  useMyWorkArtifactOutputs,
  usePresentations,
  useReports,
  useSheetOutputs,
} from '../../../src/components/ReportsAndPresentations/useRapData';

const originalFetch = globalThis.fetch;

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
    expect(result.current.error).toBeNull();
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
});
