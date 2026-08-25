import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { getAdminJobs } from '../../../services/adminJobsApi';
import { AdminJobsPanel } from '../AdminJobsPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

vi.mock('../../../services/adminJobsApi', () => ({ getAdminJobs: vi.fn() }));
describe('AdminJobsPanel', () => {
  it('renders tenant jobs without mutation actions', async () => {
    vi.mocked(getAdminJobs).mockResolvedValue([
      {
        id: 'j1',
        job_type: 'role-change',
        status: 'failed',
        attempt_count: 3,
        max_attempts: 3,
        last_error: 'timeout',
        available_at: '2026-08-24T10:00:00Z',
        created_at: '2026-08-24T09:00:00Z',
      },
    ]);
    render(<AdminJobsPanel />);
    expect(await screen.findByText('role-change')).toBeInTheDocument();
    expect(screen.queryByText(/Ponów|Anuluj/)).not.toBeInTheDocument();
  });

  it('renders an honest empty state when there are no jobs', async () => {
    vi.mocked(getAdminJobs).mockResolvedValue([]);
    render(<AdminJobsPanel />);
    expect(await screen.findByText('Brak zadań')).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getAdminJobs).mockRejectedValue(new Error('jobs service down'));
    render(<AdminJobsPanel />);
    expect((await screen.findAllByText('jobs service down')).length).toBeGreaterThan(0);
  });
});
