import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { ExportDataSettings } from '@/components/settings/ExportDataSettings';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ExportDataSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('Export history down'));
  });

  it('does not render failed export history loads as an empty export history', async () => {
    render(<ExportDataSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('Export history unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No export requests yet')).not.toBeInTheDocument();
  });
});
