import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { RecoveryOptionsSettings } from '@/components/settings/RecoveryOptionsSettings';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('RecoveryOptionsSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('Recovery API down'));
  });

  it('does not render failed recovery loads as configured defaults from the current user', async () => {
    render(<RecoveryOptionsSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('Recovery options unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText(/us\*\*\*@example\.com/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate/i })).toBeDisabled();
  });
});
