import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { LegalSettings } from '@/components/settings/LegalSettings';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

describe('LegalSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('Legal API down'));
  });

  it('does not render failed legal document loads as no legal documents', async () => {
    render(
      <MemoryRouter>
        <LegalSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Legal documents unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No legal documents available.')).not.toBeInTheDocument();
  });
});
