/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTemplates } from '../../../src/components/ReportsAndPresentations/useRapData';

vi.mock('../../../src/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({ Authorization: 'Bearer test-token' }),
  shouldAllowDemoData: () => false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

describe('useTemplates (canonical artifacts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads templates from canonical /api/artifacts (artifactFamily=template) for report + presentation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      if (!url.startsWith('/api/artifacts')) {
        throw new Error(`Unexpected fetch URL: ${url}`);
      }
      const u = new URL(url, 'http://localhost');
      const outputType = u.searchParams.get('outputType');
      const artifactFamily = u.searchParams.get('artifactFamily');
      if (artifactFamily !== 'template') {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        } as Response;
      }

      if (outputType === 'report') {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                artifactId: 'tmpl-report-1',
                outputType: 'report',
                artifactFamily: 'template',
                resolvedTitle: 'Steering report template',
                createdBy: 'user-1',
                lastTransitionAt: '2026-03-30T10:00:00.000Z',
                originSummary: {
                  template: {
                    scope: 'org',
                    status: 'published',
                    description: 'A board-ready steering cadence report.',
                    reportType: 'R2',
                    structureBlueprint: {
                      sections: [
                        { key: 'exec_summary', title: 'Executive summary' },
                        { key: 'delivery', title: 'Delivery status' },
                      ],
                    },
                    metadata: {
                      createdBy: 'user-1',
                      updatedAt: '2026-03-30T10:00:00.000Z',
                    },
                  },
                },
              },
            ],
          }),
        } as Response;
      }

      if (outputType === 'presentation') {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                artifactId: 'tmpl-deck-1',
                outputType: 'presentation',
                artifactFamily: 'template',
                resolvedTitle: 'Executive update deck',
                createdBy: 'user-2',
                lastTransitionAt: '2026-03-30T11:00:00.000Z',
                originSummary: {
                  template: {
                    scope: 'app',
                    status: 'published',
                    description: 'A concise executive update deck.',
                    deckType: 'executive_update',
                    structureBlueprint: {
                      outline: [{ intent: 'title' }, { intent: 'key_findings' }, { intent: 'next_steps' }],
                    },
                    metadata: {
                      createdBy: 'system',
                      updatedAt: '2026-03-30T11:00:00.000Z',
                    },
                  },
                },
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    const { result } = renderHook(() => useTemplates());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/artifacts?limit=200&artifactFamily=template&outputType=report',
      { headers: { Authorization: 'Bearer test-token' } }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/artifacts?limit=200&artifactFamily=template&outputType=presentation',
      { headers: { Authorization: 'Bearer test-token' } }
    );

    expect(result.current.error).toBeNull();
    expect(result.current.templates).toEqual([
      // Kontrakt `src/types/materials.ts`: 'app' → 'system' (nigdy 'application'),
      // 'published' zostaje 'published' (nie jest spłaszczane do 'active').
      expect.objectContaining({
        id: 'tmpl-deck-1',
        artifactIndexId: 'tmpl-deck-1',
        title: 'Executive update deck',
        type: 'presentation',
        category: 'executive_update',
        scope: 'system',
        status: 'published',
        slideCount: 3,
      }),
      expect.objectContaining({
        id: 'tmpl-report-1',
        artifactIndexId: 'tmpl-report-1',
        title: 'Steering report template',
        type: 'report',
        category: 'R2',
        scope: 'organization',
        status: 'published',
        sectionCount: 2,
      }),
    ]);
  });

  it('sets error when both template fetches fail (P24-D: U11 error handling)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as Response;
    });

    const { result } = renderHook(() => useTemplates());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Canonical artifact registry failed to load templates.');
    expect(result.current.templates).toEqual([]);
  });

  it('opts the canonical Template Library queries into draft visibility on refresh', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    const { result } = renderHook(() => useTemplates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetchMock.mockClear();

    await act(async () => {
      await result.current.fetchTemplates(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url] of fetchMock.mock.calls) {
      const parsed = new URL(String(url), 'http://localhost');
      expect(parsed.pathname).toBe('/api/artifacts');
      expect(parsed.searchParams.get('artifactFamily')).toBe('template');
      expect(parsed.searchParams.get('include')).toBe('drafts');
    }
  });

  it('preserves deprecated status distinctly from archived (P24-D: G4 deprecation)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = String(input);
      const u = new URL(url, 'http://localhost');
      const outputType = u.searchParams.get('outputType');

      if (outputType === 'report') {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                artifactId: 'tmpl-deprecated-1',
                outputType: 'report',
                artifactFamily: 'template',
                resolvedTitle: 'Old steering template',
                createdBy: 'user-1',
                lastTransitionAt: '2026-04-01T10:00:00.000Z',
                originSummary: {
                  template: {
                    scope: 'org',
                    status: 'deprecated',
                    description: 'Replaced by new steering template.',
                    reportType: 'R2',
                    deprecationReason: 'Superseded by v2 template',
                    migrationHint: 'Use tmpl-report-v2 instead',
                    structureBlueprint: { sections: [{ key: 's1', title: 'Summary' }] },
                    metadata: { createdBy: 'user-1', updatedAt: '2026-04-01T10:00:00.000Z' },
                  },
                },
              },
            ],
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    const { result } = renderHook(() => useTemplates());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0]).toEqual(
      expect.objectContaining({
        id: 'tmpl-deprecated-1',
        status: 'deprecated',
        deprecationReason: 'Superseded by v2 template',
        migrationHint: 'Use tmpl-report-v2 instead',
      })
    );
  });
});
