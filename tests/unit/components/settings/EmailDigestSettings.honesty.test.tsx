import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmailDigestSettings } from '@/components/settings/EmailDigestSettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

const email = {
  taskUpdates: true,
  projectAlerts: true,
  weeklyDigest: true,
  marketing: false,
};

const digest = {
  frequency: 'instant',
  content: 'summary',
  format: 'html',
};

describe('EmailDigestSettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed email digest loads as editable defaults', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/settings/notifications/email') throw new Error('Email settings API down');
      return digest;
    });

    render(<EmailDigestSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Email digest unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Email settings API down')).toBeInTheDocument();
    expect(screen.queryByText('Email Categories')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale email settings', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/settings/notifications/email') return email;
      return digest;
    });
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<EmailDigestSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await screen.findByText('Email Categories');
    // Regression (notyfikacje-audyt.md §3): the Save action now renders in
    // the screen header via a portal, ahead of the card body in DOM order,
    // so a positional `getAllByRole('button')[0]` silently hits the
    // (disabled, non-dirty) Save button instead of a category toggle and
    // this test never actually exercises the read-back-mismatch path.
    // Select the toggle by its accessible name instead.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Task Updates' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Email digest settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
