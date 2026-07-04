/**
 * @vitest-environment jsdom
 *
 * useConnectors — regression coverage for M08 audit finding "Import/Connectors
 * → 404": the hook must call the real data-collection mount
 * (`/api/table-platform/connectors`, server/src/routes/data-collection.routes.ts),
 * not the nonexistent `/api/workspaces/:id/connectors`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useConnectors } from '../connectors/useConnectors';

const apiGetMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useConnectors', () => {
  it('lists connectors from the real table-platform mount, scoped by workspaceId', async () => {
    apiGetMock.mockResolvedValueOnce([{ id: 'conn-1', workspaceId: 'idea-1' }]);

    const { result } = renderHook(() => useConnectors('idea-1'), { wrapper });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    const path = String(apiGetMock.mock.calls[0]?.[0] ?? '');
    expect(path).toBe('/table-platform/connectors?workspaceId=idea-1');
    await waitFor(() => expect(result.current.connectors).toHaveLength(1));
  });

  it('degrades to an empty list instead of throwing when the list request fails', async () => {
    apiGetMock.mockRejectedValueOnce(new Error('500 Internal Server Error'));

    const { result } = renderHook(() => useConnectors('idea-1'), { wrapper });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.connectors).toEqual([]);
  });

  it('creates a connector against the real mount with server-shaped field names', async () => {
    apiGetMock.mockResolvedValue([]);
    apiPostMock.mockResolvedValueOnce({ id: 'conn-new' });

    const { result } = renderHook(() => useConnectors('idea-1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.create({
      type: 'csv',
      name: 'My CSV',
      tableId: 'tbl-1',
      config: { fileName: 'a.csv' },
      fieldMappings: [],
    });

    expect(apiPostMock).toHaveBeenCalledWith(
      '/table-platform/connectors',
      expect.objectContaining({
        workspaceId: 'idea-1',
        name: 'My CSV',
        connectorType: 'csv',
        targetTableId: 'tbl-1',
        fieldMapping: [],
      })
    );
  });
});
