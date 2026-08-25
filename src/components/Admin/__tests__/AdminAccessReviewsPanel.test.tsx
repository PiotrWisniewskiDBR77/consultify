import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getAccessReviewData } from '../../../services/adminAccessReviewsApi';
import { AdminAccessReviewsPanel } from '../AdminAccessReviewsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminAccessReviewsApi', () => ({ getAccessReviewData: vi.fn() }));
describe('AdminAccessReviewsPanel', () => {
  it('shows policy, privileged accounts and honest missing history', async () => {
    vi.mocked(getAccessReviewData).mockResolvedValue({
      policy: { accessReviewsEnabled: true, accessReviewCadenceDays: 90 },
      members: [{ userId: 'u1', email: 'owner@example.com', role: 'OWNER', status: 'ACTIVE' }],
    });
    render(
      <MemoryRouter>
        <AdminAccessReviewsPanel />
      </MemoryRouter>
    );
    expect((await screen.findAllByText('owner@example.com')).length).toBeGreaterThan(0);
    expect(screen.getByText('Kadencja: 90 dni')).toBeInTheDocument();
    expect(
      screen.getByText(/Rejestr kampanii przeglądów nie jest jeszcze prowadzony/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('renders an honest empty state when there are no privileged accounts', async () => {
    vi.mocked(getAccessReviewData).mockResolvedValue({
      policy: { accessReviewsEnabled: false, accessReviewCadenceDays: 90 },
      members: [],
    });
    render(
      <MemoryRouter>
        <AdminAccessReviewsPanel />
      </MemoryRouter>
    );
    expect(await screen.findByText('Brak kont uprzywilejowanych')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getAccessReviewData).mockRejectedValue(new Error('access review service down'));
    render(
      <MemoryRouter>
        <AdminAccessReviewsPanel />
      </MemoryRouter>
    );
    expect(await screen.findByText('access review service down')).toBeInTheDocument();
  });
});
