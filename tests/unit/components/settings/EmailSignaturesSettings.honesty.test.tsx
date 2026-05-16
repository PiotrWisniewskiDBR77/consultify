import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailSignaturesSettings } from '@/components/settings/EmailSignaturesSettings';
import { Api } from '@/services/api';

const toastMock = vi.fn();
const tMock = (_key: string, fallback: string) => fallback;

vi.mock('@/hooks/useDemoSession', () => ({
  useDemoSession: () => ({ isDemo: false }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

describe('EmailSignaturesSettings honest UI', () => {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed signature loads as an empty editable list', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Signatures API down'));

    render(<EmailSignaturesSettings currentUser={user as any} />);

    await waitFor(() => {
      expect(screen.getByText('Email signatures unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Signatures API down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Signature/i })).toBeDisabled();
    expect(screen.queryByText('No signatures yet')).not.toBeInTheDocument();
  });

  it('does not claim signature creation success when read-back is stale', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ signatures: [] })
      .mockResolvedValueOnce({ signatures: [] });
    vi.mocked(Api.post).mockResolvedValue({ signature: { id: 'sig-1' } });

    render(<EmailSignaturesSettings currentUser={user as any} />);

    await screen.findByText('No signatures yet');

    fireEvent.click(screen.getByRole('button', { name: /Add Signature/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Professional, Casual'), {
      target: { value: 'Professional' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your signature...'), {
      target: { value: 'Best regards' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Email signature creation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Signature Created' })
    );
    expect(screen.getByText('Create Signature')).toBeInTheDocument();
  });

  it('does not claim delete success when read-back still contains the signature', async () => {
    const signature = {
      id: 'sig-1',
      name: 'Professional',
      content: 'Best regards',
      isDefault: true,
      createdAt: '2026-04-26T10:00:00.000Z',
    };
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ signatures: [signature] })
      .mockResolvedValueOnce({ signatures: [signature] });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });

    render(<EmailSignaturesSettings currentUser={user as any} />);

    await screen.findByText('Professional');

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(
        screen.getByText('Email signature deletion was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toastMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Signature Deleted' })
    );
  });
});
