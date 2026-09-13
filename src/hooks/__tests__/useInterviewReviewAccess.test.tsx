import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ get: vi.fn(), user: 'u', org: 'o' }));
vi.mock('@/services/api', () => ({ Api: { get: vi.fn() } }));
vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: { getAssignmentReviewAccess: f.get },
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: { id: f.user }, currentOrganization: { id: f.org } }),
}));
import { useInterviewReviewAccess } from '../useInterviewPermissions';
beforeEach(() => {
  f.get.mockReset();
  f.user = 'u';
  f.org = 'o';
});
describe('record-bound Interview review UI', () => {
  it('allows persisted A review and clears previous allow synchronously on B switch', async () => {
    f.get.mockResolvedValueOnce({ canReview: true }).mockResolvedValueOnce({ canReview: false });
    const h = renderHook(({ id }) => useInterviewReviewAccess(id), { initialProps: { id: 'A' } });
    await waitFor(() => expect(h.result.current.canReview).toBe(true));
    h.rerender({ id: 'B' });
    expect(h.result.current.canReview).toBe(false);
    await waitFor(() => expect(h.result.current.isLoading).toBe(false));
    expect(h.result.current.canReview).toBe(false);
    expect(f.get.mock.calls.map((x) => x[0])).toEqual(['A', 'B']);
  });
  it('late A response cannot authorize B and errors deny', async () => {
    let resolve!: (x: unknown) => void;
    f.get
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolve = r;
          })
      )
      .mockRejectedValueOnce(Error('denied'));
    const h = renderHook(({ id }) => useInterviewReviewAccess(id), { initialProps: { id: 'A' } });
    h.rerender({ id: 'B' });
    await waitFor(() => expect(h.result.current.isLoading).toBe(false));
    await act(async () => resolve({ canReview: true }));
    expect(h.result.current.canReview).toBe(false);
  });
  it('organization/user change clears allow until fresh response', async () => {
    f.get
      .mockResolvedValueOnce({ canReview: true })
      .mockImplementation(() => new Promise(() => {}));
    const h = renderHook(() => useInterviewReviewAccess('A'));
    await waitFor(() => expect(h.result.current.canReview).toBe(true));
    f.org = 'other';
    h.rerender();
    expect(h.result.current.canReview).toBe(false);
    expect(h.result.current.isLoading).toBe(true);
    f.user = 'other';
    h.rerender();
    expect(h.result.current.canReview).toBe(false);
  });
  it('refresh after rejected action removes previous allow', async () => {
    f.get.mockResolvedValueOnce({ canReview: true }).mockResolvedValueOnce({ canReview: false });
    const h = renderHook(() => useInterviewReviewAccess('A'));
    await waitFor(() => expect(h.result.current.canReview).toBe(true));
    act(() => h.result.current.refresh());
    expect(h.result.current.canReview).toBe(false);
    await waitFor(() => expect(h.result.current.isLoading).toBe(false));
    expect(h.result.current.canReview).toBe(false);
  });
  it('missing assignment never authorizes or fetches', () => {
    const h = renderHook(() => useInterviewReviewAccess(null));
    expect(h.result.current.canReview).toBe(false);
    expect(f.get).not.toHaveBeenCalled();
  });
});
