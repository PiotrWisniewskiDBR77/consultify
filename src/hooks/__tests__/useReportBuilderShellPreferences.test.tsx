/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { get: apiGet, put: apiPut },
}));

import { useReportBuilderShellPreferences } from '../useReportBuilderShellPreferences';

describe('RB-3 user-scoped shell preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({
      report_builder_nav_v2: {
        tocExpanded: false,
        rightPanelExpanded: true,
        lastMode: 'review',
      },
    });
    apiPut.mockResolvedValue({ success: true });
  });

  it('loads and updates the existing user_preferences key', async () => {
    const { result } = renderHook(() => useReportBuilderShellPreferences(true));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(apiGet).toHaveBeenCalledWith('/preferences');
    expect(result.current.preferences).toEqual({
      tocExpanded: false,
      rightPanelExpanded: true,
      lastMode: 'review',
    });

    act(() => result.current.updatePreferences({ rightPanelExpanded: false }));
    expect(apiPut).toHaveBeenCalledWith('/preferences', {
      report_builder_nav_v2: {
        tocExpanded: false,
        rightPanelExpanded: false,
        lastMode: 'review',
      },
    });
  });

  it('does not read or write preferences while the release flag is off', async () => {
    const { result } = renderHook(() => useReportBuilderShellPreferences(false));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.updatePreferences({ tocExpanded: false }));
    expect(apiGet).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
  });
});
