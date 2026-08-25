import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkIntelligenceReport } from '../WorkIntelligenceReport';
import { buildWorkReportModel, type WorkReportItem } from '../workReportModel';

const api = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionWork: vi.fn(),
  readExecutionMilestones: vi.fn(),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => api);
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback: string, options?: { count?: number }) =>
      fallback.replace('{{count}}', String(options?.count ?? '')),
  }),
}));
vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ data, onRowDoubleClick }: any) => (
    <div data-testid="standard-table">
      {data.map((row: any) => (
        <button key={row.id} type="button" onDoubleClick={() => onRowDoubleClick?.(row)}>
          {row.title}
        </button>
      ))}
    </div>
  ),
}));

const stateDate = new Date('2026-08-25T12:00:00.000Z');
const item = (overrides: Partial<WorkReportItem>): WorkReportItem => ({
  id: 'task-1',
  executionCaseId: 'case-1',
  initiativeId: 'initiative-1',
  title: 'Governed task',
  kind: 'TASK',
  status: 'OPEN',
  ownerId: 'owner-1',
  dueAt: '2026-08-24T12:00:00.000Z',
  slaAt: '2026-08-24T12:00:00.000Z',
  dependencies: [],
  evidenceRefs: ['evidence-1'],
  definitionOfDone: 'Accepted evidence',
  sourceVersion: 3,
  ...overrides,
});

describe('Work Intelligence report', () => {
  beforeEach(() => {
    api.listExecutionCases.mockReset();
    api.readExecutionWork.mockReset();
    api.readExecutionMilestones.mockReset();
  });

  it('reconciles overdue KPI numerator to its exact drill-down population', () => {
    const model = buildWorkReportModel(
      [
        item({ id: 'task-overdue' }),
        item({ id: 'task-future', dueAt: '2026-09-10T12:00:00.000Z' }),
      ],
      stateDate
    );
    const metric = model.metrics.find((candidate) => candidate.id === 'overdueTasks');

    expect(metric?.value.kind).toBe('CALCULATED');
    expect(metric?.drilldown.map((row) => row.id)).toEqual(['task-overdue']);
    if (metric?.value.kind === 'CALCULATED')
      expect(metric.value.numerator).toBe(metric.drilldown.length);
  });

  it('keeps undated work as amber data-risk, never overdue or green', () => {
    const model = buildWorkReportModel([item({ id: 'undated', dueAt: null })], stateDate);
    const overdue = model.metrics.find((candidate) => candidate.id === 'overdueTasks');
    const undated = model.metrics.find((candidate) => candidate.id === 'undatedRisk');

    expect(overdue?.drilldown).toHaveLength(0);
    expect(overdue?.severity).toBe('neutral');
    expect(undated?.drilldown).toHaveLength(1);
    expect(undated?.severity).toBe('amber');
    expect(undated?.severity).not.toBe('neutral');
  });

  it('does not label zero overdue or approaching populations as red or amber', () => {
    const model = buildWorkReportModel([], stateDate);

    expect(
      model.metrics
        .filter((metric) => ['overdueTasks', 'overdueDecisions', 'due7'].includes(metric.id))
        .map((metric) => metric.severity)
    ).toEqual(['neutral', 'neutral', 'neutral']);
  });

  it('renders all nine management sections in contract order from real runtime reads', async () => {
    api.listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'case-1', initiativeId: 'initiative-1' }],
    });
    api.readExecutionWork.mockResolvedValue({
      tasks: [
        {
          taskId: 'task-1',
          title: 'Governed task',
          status: 'OPEN',
          assigneeId: 'owner',
          dueAt: '2026-08-24T12:00:00Z',
          version: 2,
        },
      ],
      decisions: [],
    });
    api.readExecutionMilestones.mockResolvedValue({ items: [] });

    render(<WorkIntelligenceReport />);

    await screen.findByRole('heading', { name: 'Work Intelligence Report' });
    const orders = Array.from(document.querySelectorAll('[data-section-order]')).map((node) =>
      node.getAttribute('data-section-order')
    );
    expect(orders).toEqual([
      'context',
      'pulse',
      'hurts',
      'approaching',
      'stake',
      'why',
      'trend',
      'actions',
      'register',
    ]);
    expect(api.readExecutionWork).toHaveBeenCalledWith('case-1');
    expect(screen.getByTestId('standard-table')).toHaveTextContent('Governed task');
  });

  it('keeps healthy source cases visible when one case read fails', async () => {
    api.listExecutionCases.mockResolvedValue({
      cases: [
        { executionCaseId: 'ok', initiativeId: 'i-1' },
        { executionCaseId: 'bad', initiativeId: 'i-2' },
      ],
    });
    api.readExecutionWork.mockImplementation((caseId: string) =>
      caseId === 'bad'
        ? Promise.reject(new Error('HTTP 503'))
        : Promise.resolve({
            tasks: [{ taskId: 'task-ok', title: 'Healthy record', status: 'OPEN' }],
            decisions: [],
          })
    );
    api.readExecutionMilestones.mockResolvedValue({ items: [] });

    render(<WorkIntelligenceReport />);

    expect(await screen.findByRole('alert')).toHaveTextContent('1 source cases unavailable');
    expect(screen.getByTestId('standard-table')).toHaveTextContent('Healthy record');
  });

  it('renders an honest empty state when runtime returns no cases', async () => {
    api.listExecutionCases.mockResolvedValue({ cases: [] });

    render(<WorkIntelligenceReport />);

    expect(
      await screen.findByText('No work records are available for the selected scope.')
    ).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN · BRAK_API_HISTORY')).toBeInTheDocument();
  });

  it('opens the governed task tool from the exact register row', async () => {
    const onOpenDocument = vi.fn();
    api.listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'case-1', initiativeId: 'initiative-1' }],
    });
    api.readExecutionWork.mockResolvedValue({
      tasks: [{ taskId: 'task-1', title: 'Governed task', status: 'OPEN' }],
      decisions: [],
    });
    api.readExecutionMilestones.mockResolvedValue({ items: [] });

    render(<WorkIntelligenceReport onOpenDocument={onOpenDocument} />);
    const table = await screen.findByTestId('standard-table');
    fireEvent.doubleClick(within(table).getByRole('button', { name: 'Governed task' }));

    await waitFor(() =>
      expect(onOpenDocument).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1', kind: 'TASK', executionCaseId: 'case-1' })
      )
    );
  });
});
