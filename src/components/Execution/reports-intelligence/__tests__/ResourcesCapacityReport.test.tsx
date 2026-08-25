import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResourcesCapacityReport } from '../ResourcesCapacityReport';

const api = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readOperationalAllocations: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => api);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, options?: { count?: number }) =>
      fallback.replace('{{count}}', String(options?.count ?? '')),
  }),
}));
vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ data }: any) => (
    <div data-testid="standard-table">
      {data.map((row: any) => (
        <span key={row.id}>
          {row.person} · {row.project} · {row.saturation}
        </span>
      ))}
    </div>
  ),
}));

describe('Resources Capacity report', () => {
  beforeEach(() => {
    api.listExecutionCases.mockReset();
    api.readOperationalAllocations.mockReset();
  });

  it('includes every allocated person even without a task in the base week', async () => {
    api.listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'c1', initiativeId: 'i1', initiativeTitle: 'Project A' }],
    });
    api.readOperationalAllocations.mockResolvedValue({
      items: [
        {
          allocationId: 'a1',
          assigneeId: 'p1',
          assigneeName: 'Anna',
          roleName: 'Engineer',
          availability: { knowledgeState: 'KNOWN', value: 32 },
          demand: { knowledgeState: 'KNOWN', value: 24 },
          load: { low: 0.7, high: 0.8 },
          timeBasis: { weekStart: '2026-08-24' },
          version: 4,
        },
      ],
    });
    render(<ResourcesCapacityReport />);
    expect(await screen.findByTestId('standard-table')).toHaveTextContent(
      'Anna · Project A · 0.7–0.8'
    );
    expect(screen.getByRole('heading', { name: 'Person × week load heatmap' })).toBeInTheDocument();
  });

  it('keeps saturation UNKNOWN rather than 0% without availability', async () => {
    api.listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'c1', initiativeId: 'i1' }],
    });
    api.readOperationalAllocations.mockResolvedValue({
      items: [
        {
          allocationId: 'a1',
          assigneeId: 'p1',
          assigneeName: 'Anna',
          demand: { knowledgeState: 'KNOWN', value: 20 },
        },
      ],
    });
    render(<ResourcesCapacityReport />);
    expect(await screen.findByTestId('standard-table')).toHaveTextContent('UNKNOWN');
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('preserves healthy allocations when one project endpoint fails', async () => {
    api.listExecutionCases.mockResolvedValue({
      cases: [
        { executionCaseId: 'ok', initiativeId: 'i1' },
        { executionCaseId: 'bad', initiativeId: 'i2' },
      ],
    });
    api.readOperationalAllocations.mockImplementation((id: string) =>
      id === 'bad'
        ? Promise.reject(new Error('HTTP 500'))
        : Promise.resolve({ items: [{ allocationId: 'a1', assigneeName: 'Healthy person' }] })
    );
    render(<ResourcesCapacityReport />);
    expect(await screen.findByRole('alert')).toHaveTextContent('1 source cases unavailable');
    expect(screen.getByTestId('standard-table')).toHaveTextContent('Healthy person');
  });

  it('renders honest error and empty states', async () => {
    api.listExecutionCases.mockRejectedValueOnce(new Error('HTTP 503'));
    const { unmount } = render(<ResourcesCapacityReport />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503');
    unmount();
    api.listExecutionCases.mockResolvedValueOnce({ cases: [] });
    render(<ResourcesCapacityReport />);
    expect(await screen.findByText('No allocations in scope')).toBeInTheDocument();
  });
});
