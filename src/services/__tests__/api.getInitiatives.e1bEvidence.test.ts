import { afterEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/services/api');

import { Api, clearGlobalTransportFailure, resetAuthLoopGuard } from '@/services/api';

describe('E1b getInitiatives execution evidence query', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opts Execution Hub into controlled evidence without changing ordinary list URLs', async () => {
    localStorage.clear();
    clearGlobalTransportFailure();
    resetAuthLoopGuard();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await Api.getInitiatives();
    await Api.getInitiatives(undefined, {
      asOf: '2026-09-12T12:00:00.000Z',
      includeExecutionEvidence: true,
    });

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/initiatives$/);
    const evidenceUrl = new URL(String(fetchMock.mock.calls[1][0]), 'http://local.test');
    expect(evidenceUrl.pathname).toMatch(/\/initiatives$/);
    expect(evidenceUrl.searchParams.get('includeExecutionEvidence')).toBe('1');
    expect(evidenceUrl.searchParams.get('asOf')).toBe('2026-09-12T12:00:00.000Z');
  });
});
