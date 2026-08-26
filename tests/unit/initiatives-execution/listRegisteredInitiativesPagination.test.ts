import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listRegisteredInitiatives } from '../../../src/services/initiatives-execution/runtimeApi';

function mockInitiative(id: string) {
  return {
    initiative: {
      initiativeId: id,
      lifecycleState: 'REGISTERED_DRAFT',
      title: id,
      problem: 'Problem',
      proposedOutcome: null,
      projectId: 'project-1',
      initiativeOwnerId: 'owner-1',
      readiness: 'NOT_EVALUATED',
      source: {
        proposalId: `proposal-${id}`,
        proposalVersion: 1,
        sourceType: 'MANUAL_HUB',
        sourceId: `source-${id}`,
        sourceVersion: 1,
      },
    },
  };
}

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => body,
  } as Response;
}

describe('listRegisteredInitiatives client-side keyset pagination', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows nextCursor across pages, including an empty page in the middle, until exhausted', async () => {
    // Page 1: two rows, more remain.
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({
        initiatives: [mockInitiative('a'), mockInitiative('b')],
        nextCursor: 'cursor-1',
      })
    );
    // Page 2: authorization filtered every row out server-side, but more
    // pages remain — this MUST NOT stop the loop.
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({
        initiatives: [],
        nextCursor: 'cursor-2',
      })
    );
    // Page 3: final page, no more cursor.
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({
        initiatives: [mockInitiative('c')],
        nextCursor: null,
      })
    );

    const result = await listRegisteredInitiatives();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.initiatives.map((row) => row.initiative.initiativeId)).toEqual(['a', 'b', 'c']);
    expect(result.nextCursor).toBeNull();

    // Second call carried the cursor returned by the first page.
    expect(String(fetchMock.mock.calls[1][0])).toContain('cursor=cursor-1');
    expect(String(fetchMock.mock.calls[2][0])).toContain('cursor=cursor-2');
  });

  it('stops at the safety cap and warns instead of looping forever', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Always return a page with more available — simulates a pathological
    // org (or a server bug) that never terminates the cursor chain.
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input);
      const cursorMatch = url.match(/cursor=([^&]+)/);
      const nextIndex = cursorMatch ? Number(cursorMatch[1]) + 1 : 1;
      return jsonResponse({
        initiatives: [mockInitiative(`row-${nextIndex}`)],
        nextCursor: String(nextIndex),
      });
    });

    const result = await listRegisteredInitiatives();

    // 20-page safety cap.
    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(result.initiatives).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('safety limit reached');

    warnSpy.mockRestore();
  });

  it('supports an explicit single-page fetch without following nextCursor', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({
        initiatives: [mockInitiative('a')],
        nextCursor: 'cursor-1',
      })
    );

    const result = await listRegisteredInitiatives({ singlePage: true, limit: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('limit=1');
    expect(result.initiatives.map((row) => row.initiative.initiativeId)).toEqual(['a']);
    expect(result.nextCursor).toBe('cursor-1');
  });

  it('throws RuntimeApiError when a page request fails', async () => {
    fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ error: { code: 'AUTH_REQUIRED' } }, false)
    );

    await expect(listRegisteredInitiatives()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});
