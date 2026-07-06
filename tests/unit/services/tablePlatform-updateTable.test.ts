import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as TablePlatformApi from '@/services/api/tablePlatform.api';

describe('TablePlatformApi.updateTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('PATCHes /table-platform/tables/:id with the new name and returns the updated table', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/table-platform/tables/tbl-1') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({ id: 'tbl-1', name: body.name, description: null }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ error: `Unexpected URL ${url}` }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await TablePlatformApi.updateTable('tbl-1', { name: 'Renamed Table' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/table-platform/tables/tbl-1'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Renamed Table' }),
      })
    );
    expect(result).toMatchObject({ id: 'tbl-1', name: 'Renamed Table' });
  });

  it('rejects when the server responds with an error status', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'nope' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(TablePlatformApi.updateTable('tbl-1', { name: 'X' })).rejects.toThrow();
  });
});
