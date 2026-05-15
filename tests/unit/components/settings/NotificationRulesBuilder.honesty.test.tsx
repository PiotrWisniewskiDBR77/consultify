import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import NotificationRulesBuilder from '@/components/settings/NotificationRulesBuilder';

vi.mock('@/services/api', () => ({
  Api: {
    getProjects: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('NotificationRulesBuilder honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getProjects).mockResolvedValue([]);
  });

  it('does not present notification rules as persisted editable settings', async () => {
    render(
      <NotificationRulesBuilder
        currentUser={{ id: 'user-1', email: 'user@example.com' } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Notification rules are read-only')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Add Project Rule/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled();
  });
});
