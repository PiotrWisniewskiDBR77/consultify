import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrgContextSummaryBanner } from '@/components/Organization/OrgContextSummaryBanner';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    organizationContextGet: vi.fn(),
    organizationContextRebuild: vi.fn(),
  },
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, optionsOrFallback?: any) => {
      if (typeof optionsOrFallback === 'string') return optionsOrFallback;
      if (optionsOrFallback && typeof optionsOrFallback === 'object') {
        const dv = optionsOrFallback.defaultValue || _key;
        return String(dv)
          .replace('{{count}}', String(optionsOrFallback.count ?? ''))
          .replace('{{ago}}', String(optionsOrFallback.ago ?? ''));
      }
      return _key;
    },
    i18n: { language: 'en' },
  }),
}));

// Socket.IO is irrelevant to these smoke assertions — stub to a no-op client.
vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

describe('OrgContextSummaryBanner (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing without an organizationId', () => {
    const { container } = render(<OrgContextSummaryBanner organizationId={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls GET /api/organization-context on mount and shows the live claim count', async () => {
    vi.mocked(Api.organizationContextGet).mockResolvedValue({
      snapshotUpdatedAt: new Date().toISOString(),
      counts: { items: 5, claims: 12, conflicts: 0 },
    });

    render(<OrgContextSummaryBanner organizationId="org-1" />);

    await waitFor(() => {
      expect(Api.organizationContextGet).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText(/12 claims/)).toBeInTheDocument();
    });
  });

  it('shows the empty state when there are no claims', async () => {
    vi.mocked(Api.organizationContextGet).mockResolvedValue({
      snapshotUpdatedAt: null,
      counts: { items: 0, claims: 0, conflicts: 0 },
    });

    render(<OrgContextSummaryBanner organizationId="org-1" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Add org profile details to improve Teresa's answers/)
      ).toBeInTheDocument();
    });
  });

  it('renders nothing on fetch error (silent fallback)', async () => {
    vi.mocked(Api.organizationContextGet).mockRejectedValue(new Error('boom'));

    const { container } = render(<OrgContextSummaryBanner organizationId="org-1" />);

    await waitFor(() => {
      expect(Api.organizationContextGet).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('admin can trigger a rebuild via POST /api/organization-context/rebuild', async () => {
    vi.mocked(Api.organizationContextGet).mockResolvedValue({
      snapshotUpdatedAt: new Date().toISOString(),
      counts: { items: 5, claims: 12, conflicts: 0 },
    });
    vi.mocked(Api.organizationContextRebuild).mockResolvedValue({
      rebuiltAt: new Date().toISOString(),
      counts: { items: 5, claims: 13, conflicts: 0 },
    });

    render(<OrgContextSummaryBanner organizationId="org-1" isAdmin />);

    const rebuildBtn = await screen.findByRole('button', { name: /Rebuild/i });
    fireEvent.click(rebuildBtn);

    await waitFor(() => {
      expect(Api.organizationContextRebuild).toHaveBeenCalledTimes(1);
    });
  });

  it('does not render the rebuild button for non-admins', async () => {
    vi.mocked(Api.organizationContextGet).mockResolvedValue({
      snapshotUpdatedAt: new Date().toISOString(),
      counts: { items: 5, claims: 12, conflicts: 0 },
    });

    render(<OrgContextSummaryBanner organizationId="org-1" isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText(/12 claims/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Rebuild/i })).not.toBeInTheDocument();
  });
});
