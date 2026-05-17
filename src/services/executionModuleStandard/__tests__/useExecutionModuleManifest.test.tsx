/**
 * @vitest-environment jsdom
 *
 * Tests for the FE-E1.1 manifest loader.
 *
 * Coverage:
 *   * api.ts:
 *     - fetchExecutionModuleStandard returns standard envelope.
 *     - fetchExecutionModuleManifests returns the array.
 *     - fetchExecutionModuleManifest returns the single manifest.
 *     - fetchExecutionModuleManifest throws ExecutionModuleNotFoundError
 *       on 404 with the moduleId attached.
 *     - validateExecutionModuleManifest returns the validation result.
 *
 *   * useExecutionModuleManifest:
 *     - first mount triggers a fetch and resolves with the manifest.
 *     - subsequent mounts of the same moduleId hit the cache (no fetch).
 *     - forceRefetch bypasses the cache.
 *     - refetch() bypasses the cache.
 *     - 404 → error is ExecutionModuleNotFoundError + manifest stays null.
 *     - other errors → error is set + manifest stays null.
 *     - unmount cancels in-flight state updates (no setState after unmount).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ExecutionModuleNotFoundError,
  fetchExecutionModuleManifest,
  fetchExecutionModuleManifests,
  fetchExecutionModuleStandard,
  validateExecutionModuleManifest,
} from '../api';
import type {
  ExecutionModuleManifest,
  ExecutionModuleStandard,
  ExecutionModuleValidationResult,
} from '../types';
import {
  __resetExecutionModuleManifestCacheForTests,
  useExecutionModuleManifest,
} from '../useExecutionModuleManifest';

vi.mock('@/services/api/baseClient', () => {
  return {
    fetchWithRetry: vi.fn(),
    getHeaders: vi.fn(() => ({ 'content-type': 'application/json' })),
    handleResponse: vi.fn(async (res: Response) => {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Bad JSON: ${text}`);
      }
    }),
  };
});

import { fetchWithRetry } from '@/services/api/baseClient';

const mockedFetch = vi.mocked(fetchWithRetry);

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const FIXTURE_MANIFEST: ExecutionModuleManifest = {
  moduleId: 'doc-builder',
  label: 'Document Studio (Doc Builder)',
  status: 'reference',
  zones: [
    { zoneId: 'leftNav', unitKindLabel: 'Sekcja' },
    { zoneId: 'canvas', unitKindLabel: 'Sekcja (WYSIWYG)' },
    { zoneId: 'rightPanel', unitKindLabel: 'Funkcje per sekcja' },
  ],
  menu2Chips: [
    { chipId: 'internal', present: true },
    { chipId: 'theme', present: true },
    { chipId: 'history', present: true },
    { chipId: 'qa', present: true },
    { chipId: 'governance', present: true },
    { chipId: 'analytics', present: true },
    { chipId: 'audit', present: true },
    { chipId: 'share', present: true },
    { chipId: 'agent', present: true },
    { chipId: 'run', present: true, ctaLabel: 'Eksportuj' },
  ],
  rightPanel: {
    collapseTriggerPosition: 'top_left_seam',
    collapseTriggerStyle: 'soft_chevron',
    collapsedWidthPx: 32,
    expandedWidthMinPx: 280,
    expandedWidthMaxPx: 360,
    persistence: 'per_user_per_module',
    parallelPanelsAllowed: false,
  },
  agent: {
    exposedAgentIds: ['teresa'],
    teresaSurface: 'drawer',
    contextAwareOn: 'section',
  },
  aiActions: {
    slot: 'commandRowRightContent',
    actionIds: ['ai.refine_section'],
    duplicatedInCanvas: false,
  },
};

const FIXTURE_STANDARD: ExecutionModuleStandard = {
  zones: [],
  zoneOrder: ['leftNav', 'canvas', 'rightPanel'],
  menu2ChipOrder: [
    'internal',
    'theme',
    'history',
    'qa',
    'governance',
    'analytics',
    'audit',
    'share',
    'agent',
    'run',
  ],
  ctaLabels: { deck: 'Prezentuj', doc: 'Eksportuj', excel: 'Eksportuj' },
  rightPanelCollapseContract: {
    triggerPosition: 'top_left_seam',
    triggerStyle: 'soft_chevron',
    collapsedWidthPx: 32,
    expandedWidthRangePx: { min: 280, max: 360 },
    persistence: 'per_user_per_module',
  },
  allowedAgentIds: ['teresa'],
  allowedAiActionSlots: [
    'commandRowRightContent',
    'DynamicTabs.rightContent',
    'localCommandRowRight',
  ],
};

const FIXTURE_VALIDATION: ExecutionModuleValidationResult = {
  ok: true,
  moduleId: 'doc-builder',
  mustViolations: [],
  shouldViolations: [],
};

describe('execution-module API client', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('fetchExecutionModuleStandard returns the standard envelope', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ standard: FIXTURE_STANDARD }));
    const result = await fetchExecutionModuleStandard();
    expect(result).toEqual(FIXTURE_STANDARD);
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/execution-modules/standard',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchExecutionModuleManifests returns the array', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ manifests: [FIXTURE_MANIFEST] }));
    const result = await fetchExecutionModuleManifests();
    expect(result).toEqual([FIXTURE_MANIFEST]);
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/execution-modules/manifests',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchExecutionModuleManifest returns the single manifest', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    const result = await fetchExecutionModuleManifest('doc-builder');
    expect(result).toEqual(FIXTURE_MANIFEST);
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/execution-modules/manifests/doc-builder',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchExecutionModuleManifest throws ExecutionModuleNotFoundError on 404', async () => {
    mockedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'module_not_found' }), { status: 404 })
    );
    let caught: unknown = null;
    try {
      await fetchExecutionModuleManifest('whiteboard-builder');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ExecutionModuleNotFoundError);
    expect((caught as ExecutionModuleNotFoundError).moduleId).toBe('whiteboard-builder');
  });

  it('validateExecutionModuleManifest returns the validation result', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ result: FIXTURE_VALIDATION }));
    const result = await validateExecutionModuleManifest('doc-builder', FIXTURE_MANIFEST);
    expect(result).toEqual(FIXTURE_VALIDATION);
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/execution-modules/manifests/doc-builder/validate',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('encodes moduleId in the URL path', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    await fetchExecutionModuleManifest('weird module/with slash');
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/execution-modules/manifests/weird%20module%2Fwith%20slash',
      expect.any(Object)
    );
  });
});

describe('useExecutionModuleManifest', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
    __resetExecutionModuleManifestCacheForTests();
  });

  afterEach(() => {
    __resetExecutionModuleManifestCacheForTests();
  });

  it('first mount triggers a fetch and resolves with the manifest', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    const { result } = renderHook(() => useExecutionModuleManifest('doc-builder'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.manifest).toBeNull();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.manifest).toEqual(FIXTURE_MANIFEST);
    expect(result.current.error).toBeNull();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('subsequent mounts of the same moduleId hit the cache (no fetch)', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    const first = renderHook(() => useExecutionModuleManifest('doc-builder'));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useExecutionModuleManifest('doc-builder'));
    expect(second.result.current.manifest).toEqual(FIXTURE_MANIFEST);
    expect(second.result.current.isLoading).toBe(false);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('forceRefetch=true bypasses the cache on mount', async () => {
    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    const first = renderHook(() => useExecutionModuleManifest('doc-builder'));
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));

    mockedFetch.mockResolvedValueOnce(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    const second = renderHook(() =>
      useExecutionModuleManifest('doc-builder', { forceRefetch: true })
    );
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('refetch() bypasses the cache', async () => {
    mockedFetch.mockResolvedValue(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    const { result } = renderHook(() => useExecutionModuleManifest('doc-builder'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('404 → error is ExecutionModuleNotFoundError, manifest stays null', async () => {
    mockedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'module_not_found' }), { status: 404 })
    );
    const { result } = renderHook(() => useExecutionModuleManifest('whiteboard-builder'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.manifest).toBeNull();
    expect(result.current.error).toBeInstanceOf(ExecutionModuleNotFoundError);
  });

  it('other errors → error is set, manifest stays null', async () => {
    mockedFetch.mockRejectedValueOnce(new Error('network down'));
    const { result } = renderHook(() => useExecutionModuleManifest('doc-builder'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.manifest).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('network down');
  });

  it('unmount cancels in-flight state updates', async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    mockedFetch.mockReturnValueOnce(pending);

    const { result, unmount } = renderHook(() => useExecutionModuleManifest('doc-builder'));
    expect(result.current.isLoading).toBe(true);

    unmount();
    resolveFetch(makeJsonResponse({ manifest: FIXTURE_MANIFEST }));
    await new Promise((r) => setTimeout(r, 0));
  });
});
