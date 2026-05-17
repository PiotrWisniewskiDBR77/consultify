import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { UserGroupsView } from '@/views/admin/UserGroupsView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getUsers: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('UserGroupsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getUsers).mockResolvedValue([]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed team loads as no teams with create actions', async () => {
    render(<UserGroupsView />);

    await waitFor(() => {
      expect(screen.getByText('Teams unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Team list unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No Teams')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search teams...')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Create Team/i })).toBeDisabled();
  });
});
