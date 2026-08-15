import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({ Api: { get: apiGet } }));
vi.mock('@/store/useAppStore', () => ({ useAppStore: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || key,
  }),
}));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_target, tag) => tag }),
}));

import { WorkloadView } from '@/components/MyWork/WorkloadView';

describe('WorkloadView workload assessment', () => {
  it('joins the canonical team rows with the assessment endpoint and labels AI provenance', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url.includes('ai-assessment')) {
        return {
          aiUsed: true,
          users: [
            {
              userId: 'u1',
              status: 'overloaded',
              assessment: 'Calendar and task pressure exceed capacity.',
              recommendation: 'Move one task to Tomasz.',
              meetingHours: 8,
            },
          ],
        };
      }
      return [
        {
          id: 'u1',
          name: 'Anna Kowalska',
          initials: 'AK',
          role: 'Consultant',
          capacity: 120,
          tasksAssigned: 8,
          tasksCompleted: 3,
        },
      ];
    });

    render(<WorkloadView />);

    await waitFor(() => expect(screen.getByText('Anna Kowalska')).toBeInTheDocument());
    expect(screen.getByText('AI assessment')).toBeInTheDocument();
    expect(screen.getByText('Calendar and task pressure exceed capacity.')).toBeInTheDocument();
    expect(screen.getByText(/Move one task to Tomasz/)).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/my-work/team-workload/ai-assessment');
  });
});
