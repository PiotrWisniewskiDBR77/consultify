import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AuditLogView } from '@/views/admin/AuditLogView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getAuditLogs: vi.fn(),
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

describe('AuditLogView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getAuditLogs).mockRejectedValue(new Error('Audit API down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed audit log loads as no activity found or exportable data', async () => {
    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Audit logs unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Audit activity unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No Activity Found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search logs...')).toBeDisabled();
    screen.getAllByRole('combobox').forEach((combobox) => {
      expect(combobox).toBeDisabled();
    });
  });
});
