// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, API_URL } from '../../src/services/api';

describe('src/services/api', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('adds Authorization header when token exists (downloadReportImportFile)', async () => {
    localStorage.setItem('token', 'test-token');

    const blobMock = vi.fn().mockResolvedValue(new Blob(['x']));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: blobMock });
    vi.stubGlobal('fetch', fetchMock as any);

    await api.downloadReportImportFile('imp-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/report-import/imp-1/download`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(blobMock).toHaveBeenCalled();
  });

  it('omits Authorization header when token does not exist (downloadReportImportFile)', async () => {
    const blobMock = vi.fn().mockResolvedValue(new Blob(['x']));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: blobMock });
    vi.stubGlobal('fetch', fetchMock as any);

    await api.downloadReportImportFile('imp-2');

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/report-import/imp-2/download`, {
      headers: {},
    });
  });
});
