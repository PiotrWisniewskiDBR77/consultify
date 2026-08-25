import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

import { getAdminDomains, verifyAdminDomain } from '../../../services/adminDomainsApi';
import { AdminDomainsPanel } from '../AdminDomainsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global react-i18next
// mock is key-agnostic by convention — see tests/setup.ts). This panel's own
// assertions check literal Polish strings, so it resolves against the real
// shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});
vi.mock('../../../services/adminDomainsApi', () => ({
  getAdminDomains: vi.fn(),
  createAdminDomain: vi.fn(),
  updateAdminDomain: vi.fn(),
  deleteAdminDomain: vi.fn(),
  verifyAdminDomain: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const get = vi.mocked(getAdminDomains);
const verify = vi.mocked(verifyAdminDomain);
const domain = {
  id: 'd1',
  domain: 'example.com',
  autoJoin: false,
  verified: false,
  verifiedAt: null,
  verificationMethod: 'dns',
  verificationToken: 'abc',
  addedAt: '2026-08-25T05:00:00.000Z',
};

describe('AdminDomainsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue([domain]);
  });

  it('renders domains from the backend', async () => {
    render(<AdminDomainsPanel />);
    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('Oczekuje')).toBeInTheDocument();
  });

  it('renders an honest empty state', async () => {
    get.mockResolvedValue([]);
    render(<AdminDomainsPanel />);
    expect(await screen.findByText('Brak zatwierdzonych domen')).toBeInTheDocument();
  });

  it('renders the API error state', async () => {
    get.mockRejectedValue(new Error('DNS API offline'));
    render(<AdminDomainsPanel />);
    expect(await screen.findByText('DNS API offline')).toBeInTheDocument();
  });

  it('shows a precise verification outcome after list readback', async () => {
    verify.mockResolvedValue({
      status: 'no_record',
      checkedNames: ['_consultify-verification.example.com', 'example.com'],
      foundRecordCount: 0,
      checkedAt: '2026-08-25T05:00:00.000Z',
    });
    render(<AdminDomainsPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Zweryfikuj' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nie znaleziono rekordu TXT. Zmiany w DNS mogą propagować się do 24 godzin.'
    );
  });
});
