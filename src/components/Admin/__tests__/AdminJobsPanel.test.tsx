import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getAdminJobs } from '../../../services/adminJobsApi';
import { AdminJobsPanel } from '../AdminJobsPanel';
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
});
