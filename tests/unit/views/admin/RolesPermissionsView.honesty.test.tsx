import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RolesPermissionsView } from '@/views/admin/RolesPermissionsView';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('RolesPermissionsView honest UI', () => {
  it('does not present custom project role edits as persisted functionality', async () => {
    render(<RolesPermissionsView />);

    await waitFor(() => {
      expect(screen.getByText('Custom project roles are read-only')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Create Custom Role/i })).toBeDisabled();
    expect(screen.queryByText('Create Custom Project Role')).not.toBeInTheDocument();
  });
});
