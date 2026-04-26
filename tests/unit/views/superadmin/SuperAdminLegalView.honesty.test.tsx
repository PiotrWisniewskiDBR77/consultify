import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SuperAdminLegalView } from '@/views/superadmin/SuperAdminLegalView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminLegalDocs: vi.fn(),
    getSuperAdminLegalDocById: vi.fn(),
    publishSuperAdminLegalDoc: vi.fn(),
    toggleSuperAdminLegalDocActive: vi.fn(),
  },
}));

describe('SuperAdminLegalView honest data states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getSuperAdminLegalDocs).mockRejectedValue(new Error('Legal backend down'));
  });

  it('does not render legal document load failures as an empty document list', async () => {
    render(<SuperAdminLegalView />);

    await waitFor(() => {
      expect(screen.getByText('Legal documents unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Legal backend down')).toBeInTheDocument();
    expect(screen.queryByText(/No legal documents found/i)).not.toBeInTheDocument();
  });
});
