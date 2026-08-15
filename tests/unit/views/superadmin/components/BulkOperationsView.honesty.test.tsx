import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

const t = (_key: string, fallback?: string | { defaultValue?: string }) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
import BulkOperationsView from '@/views/superadmin/components/BulkOperationsView';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('BulkOperationsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('Users API down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed bulk-user loads as an empty user list', async () => {
    render(<BulkOperationsView />);

    fireEvent.click(screen.getByRole('button', { name: /Bulk Roles/i }));
    fireEvent.click(screen.getByRole('button', { name: /Load users/i }));

    await waitFor(() => {
      expect(screen.getByText('Users API down')).toBeInTheDocument();
    });

    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  });
});
