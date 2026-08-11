import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readSourceProposal,
  RuntimeApiError,
} from '../../../src/services/initiatives-execution/runtimeApi';

describe('historical Source Proposal runtime API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads exact encoded Proposal id with credentials', async () => {
    const proposal = {
      id: 'proposal/1',
      status: 'accepted',
      registeredInitiativeId: 'initiative-1',
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ proposal }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetch);
    await expect(readSourceProposal('proposal/1')).resolves.toMatchObject(proposal);
    expect(fetch).toHaveBeenCalledWith(
      '/api/initiatives/runtime-v1/source-proposals/proposal%2F1',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('preserves concealed 404 as a typed error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    await expect(readSourceProposal('foreign')).rejects.toEqual(
      expect.objectContaining<Partial<RuntimeApiError>>({ status: 404, code: 'NOT_FOUND' })
    );
  });
});
