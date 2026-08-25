import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getAccessReviewData } from '../../../services/adminAccessReviewsApi';
import { AdminAccessReviewsPanel } from '../AdminAccessReviewsPanel';
vi.mock('../../../services/adminAccessReviewsApi', () => ({ getAccessReviewData: vi.fn() }));
describe('AdminAccessReviewsPanel', () => {
  it('shows policy, privileged accounts and honest missing history', async () => {
    vi.mocked(getAccessReviewData).mockResolvedValue({
      policy: { accessReviewsEnabled: true, accessReviewCadenceDays: 90 },
      members: [{ userId: 'u1', email: 'owner@example.com', role: 'OWNER', status: 'ACTIVE' }],
    });
    render(<AdminAccessReviewsPanel />);
    expect((await screen.findAllByText('owner@example.com')).length).toBeGreaterThan(0);
    expect(screen.getByText('Kadencja: 90 dni')).toBeInTheDocument();
    expect(
      screen.getByText(/Rejestr kampanii przeglądów nie jest jeszcze prowadzony/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
