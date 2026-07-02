// @vitest-environment jsdom
/**
 * Regression: "Failed to load task" toast over a blank form.
 *
 * The personal-tasks LIST endpoint can surface a task that the detail endpoint
 * used to 404 (it required task_type='personal'). When the detail lookup 404s,
 * TaskDetailView renders an explicit "not found" state instead of a blank form
 * + error toast — but that branch depends on `Api.getPersonalTask` propagating
 * the HTTP status on the thrown error. This test locks that contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, API_URL } from '../../src/services/api';

describe('api.getPersonalTask', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the task JSON on success', async () => {
    const jsonMock = vi.fn().mockResolvedValue({ id: 't-1', title: 'Hi' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: jsonMock });
    vi.stubGlobal('fetch', fetchMock as any);

    const task = await api.getPersonalTask('t-1');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/my-work/personal-tasks/t-1`,
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(task).toEqual({ id: 't-1', title: 'Hi' });
  });

  it('throws an error carrying status=404 so the UI can show a not-found state', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, json: vi.fn() });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(api.getPersonalTask('ghost')).rejects.toMatchObject({ status: 404 });
  });

  it('throws an error carrying the status for non-404 failures too', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: vi.fn() });
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(api.getPersonalTask('x')).rejects.toMatchObject({ status: 500 });
  });
});
