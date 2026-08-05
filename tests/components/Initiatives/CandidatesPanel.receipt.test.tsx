/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback }),
}));

vi.mock('@/services/api/baseClient', () => ({
  API_URL: '/api',
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

import { useCandidates } from '@/components/Initiatives/CandidatesPanel';

const candidate = {
  id: 'cand-1',
  organizationId: 'org-1',
  sourceType: 'interview',
  sourceId: 'insight-1',
  title: 'Candidate',
  rationale: 'Rationale',
  fitScore: 0.9,
  status: 'pending',
};

describe('useCandidates durable acceptance receipt', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => delete (global as any).fetch);

  it('does not remove a candidate after a false-success HTTP 200 response', async () => {
    (global as any).fetch = vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            url.includes('/accept')
              ? { accepted: false, receiptPersisted: false, initiativeId: 'init-1' }
              : { candidates: [candidate], total: 1 }
          ),
      } as Response)
    );

    const { result } = renderHook(() => useCandidates());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.candidates).toHaveLength(1);

    let payload: unknown;
    await act(async () => {
      payload = await result.current.accept(candidate.id);
    });

    expect(payload).toBeNull();
    expect(result.current.candidates).toHaveLength(1);
    expect(result.current.error).toContain('receipt');
  });

  it('removes a candidate only after the durable receipt is confirmed', async () => {
    (global as any).fetch = vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            url.includes('/accept')
              ? {
                  accepted: true,
                  receiptPersisted: true,
                  initiativeId: 'init-1',
                  payload: { candidateId: candidate.id, receiptPersisted: true },
                }
              : { candidates: [candidate], total: 1 }
          ),
      } as Response)
    );

    const { result } = renderHook(() => useCandidates());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let payload: any;
    await act(async () => {
      payload = await result.current.accept(candidate.id);
    });

    expect(payload?.initiativeId).toBe('init-1');
    expect(result.current.candidates).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
