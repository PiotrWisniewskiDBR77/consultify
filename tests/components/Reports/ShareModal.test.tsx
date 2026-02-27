/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ShareModal } from '../../../src/components/Reports/ShareModal';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  entityType: 'ORG_REPORT' as const,
  entityId: 'r-1',
  entityTitle: 'Q4 Report',
};

describe('ShareModal', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns null when closed', () => {
    const { container } = render(<ShareModal {...baseProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders header and entity title when open', () => {
    render(<ShareModal {...baseProps} />);
    expect(screen.getByText('reports.shareReport')).toBeInTheDocument();
    expect(screen.getByText('Q4 Report')).toBeInTheDocument();
  });

  it('creates share link and renders URL', async () => {
    localStorage.setItem('token', 't-1');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shareUrl: '/shared/report/abc', expiresAt: '2026-02-01T00:00:00Z' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShareModal {...baseProps} />);
    await user.click(screen.getByText('reports.createLink'));

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual(
      expect.objectContaining({
        entityType: 'ORG_REPORT',
        entityId: 'r-1',
        expiresInHours: 7 * 24,
      })
    );

    const input = await screen.findByDisplayValue(`${window.location.origin}/shared/report/abc`);
    expect(input).toBeInTheDocument();
  });

  it('shows error when share link creation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Boom' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShareModal {...baseProps} />);
    await user.click(screen.getByText('reports.createLink'));

    expect(await screen.findByText('Boom')).toBeInTheDocument();
  });

  it('uses selected expiry (1 day)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shareUrl: '/shared/report/xyz', expiresAt: '2026-02-02T00:00:00Z' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShareModal {...baseProps} />);
    await user.click(screen.getByText('1 reports.day'));
    await user.click(screen.getByText('reports.createLink'));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.expiresInHours).toBe(24);
  });
});
