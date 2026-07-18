/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useArtifactOutputsList } from '../../../src/components/ReportsAndPresentations/useRapData';

vi.mock('../../../src/services/api', () => ({
  API_URL: '/api',
  getHeaders: () => ({ Authorization: 'Bearer test-token' }),
  shouldAllowDemoData: () => false,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

describe('useArtifactOutputsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads canonical outputs from /api/artifacts and maps mixed kinds', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              artifactId: 'art-doc',
              artifactFamily: 'document',
              originRuntime: 'report',
              originRecordId: 'report-1',
              resolvedTitle: 'Board update',
              deliveryState: 'ready',
              ownerUserId: 'user-1',
              createdBy: 'user-1',
              lastTransitionAt: '2026-03-24T12:00:00.000Z',
              reportType: 'R2',
              exportFormat: 'pdf',
              visibilityScope: 'private',
            },
            {
              artifactId: 'art-sheet',
              artifactFamily: 'sheet',
              originRuntime: 'sheet',
              originRecordId: 'table-1',
              resolvedTitle: 'Operating model',
              deliveryState: 'generated',
              ownerUserId: 'user-2',
              createdBy: 'user-2',
              lastTransitionAt: '2026-03-24T13:00:00.000Z',
              exportFormat: 'xlsx',
              visibilityScope: 'project',
            },
          ],
        }),
      } as Response);

    const { result } = renderHook(() => useArtifactOutputsList('mine'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/artifacts?limit=200&view=mine', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(result.current.error).toBeNull();
    expect(result.current.rows).toEqual([
      expect.objectContaining({
        kind: 'document',
        artifactId: 'art-doc',
        originRecordId: 'report-1',
        title: 'Board update',
        statusKey: 'ready',
      }),
      expect.objectContaining({
        kind: 'sheet',
        artifactId: 'art-sheet',
        originRecordId: 'table-1',
        title: 'Operating model',
        statusKey: 'generated',
        exportFormats: ['xlsx'],
      }),
    ]);
  });

  it('surfaces canonical registry failure without legacy fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useArtifactOutputsList('review'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBe('Canonical artifact registry failed to load outputs.');
  });
});
