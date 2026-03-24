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
  usePresentations,
  useReports,
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
});
