import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPlanHistory } from '../../../services/adminBillingHistoryApi';
import { AdminPlanHistoryPanel } from '../AdminPlanHistoryPanel';

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
