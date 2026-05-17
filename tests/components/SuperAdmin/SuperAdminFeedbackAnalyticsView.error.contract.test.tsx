/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFeedbackAnalyticsOverviewMock = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    getFeedbackAnalyticsOverview: (...args: unknown[]) => getFeedbackAnalyticsOverviewMock(...args),
  },
}));

import { SuperAdminFeedbackAnalyticsView } from '../../../src/views/superadmin/SuperAdminFeedbackAnalyticsView';

const validOverviewPayload = {
  sampleSize: 2,
  openCount: 1,
  totals: {
    byStatus: { NEW: 1, RESOLVED: 1 },
    byType: { BUG: 2 },
    bySeverity: { HIGH: 1, LOW: 1 },
    byEnv: { production: 2 },
  },
  aging: { under24h: 1, h24_48: 0, d2_7: 0, over7d: 0 },
  mttrLast30d: { medianHours: 2, p90Hours: 3, sampleSize: 1 },
  last30d: { created: 2, reopened: 0, reopenRatePct: 0 },
  generatedAt: new Date().toISOString(),
};

describe('SuperAdminFeedbackAnalyticsView error contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFeedbackAnalyticsOverviewMock.mockResolvedValue(validOverviewPayload);
  });

  it('renders fixed non-leaking copy and alert role on fetch failure', async () => {
    getFeedbackAnalyticsOverviewMock.mockRejectedValueOnce(
      new Error('internal: /var/app/secrets SQLSTATE[HY000]')
    );

    render(<SuperAdminFeedbackAnalyticsView />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Feedback analytics is temporarily unavailable.');
    expect(alert.textContent).not.toContain('/var/');
    expect(alert.textContent).not.toContain('SQLSTATE');
    expect(alert.textContent).not.toContain('internal:');
  });

  it('fails closed when API returns malformed successful payload', async () => {
    getFeedbackAnalyticsOverviewMock.mockResolvedValueOnce({});

    render(<SuperAdminFeedbackAnalyticsView />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Feedback analytics is temporarily unavailable.');
    expect(screen.queryByText(/NaN/i)).toBeNull();
  });
});
