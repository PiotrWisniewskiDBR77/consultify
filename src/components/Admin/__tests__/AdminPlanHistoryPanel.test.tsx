import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';

import { getPlanHistory } from '../../../services/adminBillingHistoryApi';
import { AdminPlanHistoryPanel } from '../AdminPlanHistoryPanel';


// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminBillingHistoryApi', () => ({ getPlanHistory: vi.fn() }));
const mockedGetPlanHistory = vi.mocked(getPlanHistory);

describe('AdminPlanHistoryPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders server history', async () => {
    mockedGetPlanHistory.mockResolvedValue([
      {
        id: 'h1',
        action: 'upgrade',
        from_plan: 'Starter',
        to_plan: 'Pro',
        reason: 'Growth',
        performed_by: 'owner-1',
        metadata: null,
        created_at: '2026-08-24T20:00:00.000Z',
      },
    ]);
    render(<AdminPlanHistoryPanel />);
    expect(await screen.findByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders an honest empty state', async () => {
    mockedGetPlanHistory.mockResolvedValue([]);
    render(<AdminPlanHistoryPanel />);
    expect(await screen.findByText('Brak historii zmian planu')).toBeInTheDocument();
  });

  it('renders the backend error', async () => {
    mockedGetPlanHistory.mockRejectedValue(new Error('history unavailable'));
    render(<AdminPlanHistoryPanel />);
    expect(await screen.findByText('history unavailable')).toBeInTheDocument();
  });
});
