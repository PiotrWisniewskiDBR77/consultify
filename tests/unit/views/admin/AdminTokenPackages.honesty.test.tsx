import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AdminTokenPackages } from '@/views/admin/AdminTokenPackages';

vi.mock('@/services/api', () => ({
  Api: {
    getTokenPackages: vi.fn(),
    upsertTokenPackage: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AdminTokenPackages honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getTokenPackages).mockRejectedValue(new Error('Packages down'));
  });

  it('does not render failed token package loads as an empty editable catalog', async () => {
    render(<AdminTokenPackages />);

    await waitFor(() => {
      expect(screen.getByText('Token packages unavailable')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Create Package/i })).toBeDisabled();
  });
});
