/** @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { getMyRole, legacyGet } = vi.hoisted(() => ({
  getMyRole: vi.fn(),
  legacyGet: vi.fn(),
}));

vi.mock('@/services/api/v8', () => ({
  V8AssessmentApi: { getMyRole },
}));
vi.mock('@/services/api', () => ({
  Api: { get: legacyGet, post: vi.fn() },
}));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: { id: 'owner-1', role: 'OWNER' } }),
}));

import { useAssessmentPermissions } from '@/components/assessment/permissions/useAssessmentPermissions';

describe('Method Core permission ownership', () => {
  it('does not probe V8 or legacy assessment role endpoints for a Method Core session', async () => {
    const { result } = renderHook(() =>
      useAssessmentPermissions('method-session-active', { enabled: false })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getMyRole).not.toHaveBeenCalled();
    expect(legacyGet).not.toHaveBeenCalled();
    expect(result.current.role).toBe('viewer');
    expect(result.current.permissions.canEdit).toBe(false);
  });
});
