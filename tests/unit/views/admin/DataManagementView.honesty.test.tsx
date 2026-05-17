import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataManagementView } from '@/views/admin/DataManagementView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
    currentUser: { id: 'user-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('DataManagementView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed data inventory loads as hard-coded record counts or exportable data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    render(<DataManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Data inventory unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Data export unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/15,420/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export All Data/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Export$/i })).not.toBeInTheDocument();
  });

  it('marks retention editing read-only because saved retention state is not loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          stats: {
            users: 1,
            projects: 2,
            tasks: 3,
            decisions: 4,
            documents: 5,
            audit: 6,
          },
        }),
      })
    );

    render(<DataManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Retention policy editing is read-only')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Save Retention Settings/i })).toBeDisabled();
    screen.getAllByRole('combobox').forEach((combobox) => {
      expect(combobox).toBeDisabled();
    });
    expect(screen.getByRole('checkbox', { name: /Auto-delete inactive user data/i })).toBeDisabled();
  });
});
