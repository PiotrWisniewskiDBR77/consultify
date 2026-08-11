import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionReportsSurface } from '../../../src/components/Execution/ExecutionReportsSurface';
import {
  createExecutionTask,
  createReportDefinition,
  createReportRun,
  getReportDefinition,
  listExecutionCases,
  listReportDefinitions,
  listReportRuns,
  readExecutionCase,
  transitionReportDefinition,
  transitionReportRun,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  createExecutionTask: vi.fn(),
  createReportDefinition: vi.fn(),
  createReportRun: vi.fn(),
  getReportDefinition: vi.fn(),
  listExecutionCases: vi.fn(),
  listReportDefinitions: vi.fn(),
  listReportRuns: vi.fn(),
  readExecutionCase: vi.fn(),
  transitionReportDefinition: vi.fn(),
  transitionReportRun: vi.fn(),
}));
const run = {
  version: 5,
  reportRunId: 'run-1',
  status: 'APPROVED',
  definitionRef: { definitionId: 'weekly', version: 2 },
  parentRunRef: null,
  audience: ['SteerCo'],
  scopeRefs: ['case-1'],
  period: { start: '2026-08-01', end: '2026-08-07' },
  asOf: '2026-08-08',
  contentHash: 'hash-1',
  sources: [
    {
      sourceType: 'execution_case',
      sourceId: 'case-1',
      version: 3,
      capturedAt: '2026-08-08',
      freshness: 'CURRENT',
      accessState: 'REDACTED',
      confidence: 'HIGH',
      redactions: ['salary'],
    },
  ],
};
const definition = {
  definitionId: 'weekly',
  version: 7,
  currentVersion: 2,
  updatedAt: '2026-08-08T00:00:00.000Z',
  versions: [
    {
      definitionVersion: 2,
      state: 'PUBLISHED',
      name: 'Weekly execution',
      purpose: 'Evidence-led steering',
      audience: ['SteerCo'],
      cadence: 'WEEKLY',
      scope: {
        type: 'EXECUTION',
        refs: ['case-1'],
        projectIds: ['project-1'],
        generalBacklogAllowed: false,
      },
      ownerId: 'owner-1',
      approverId: 'approver-1',
      access: { classification: 'INTERNAL', audienceRoles: ['SPONSOR'] },
      redaction: { defaultState: 'REDACTED', rules: ['salary'] },
      freshnessThresholdMinutes: 60,
      confidenceThreshold: 'MEDIUM',
      validationFindings: [],
    },
  ],
};
describe('ExecutionReportsSurface', () => {
  beforeEach(() => {
    vi.mocked(listReportRuns).mockResolvedValue({ items: [run] });
    vi.mocked(listReportDefinitions).mockResolvedValue({ items: [definition] });
    vi.mocked(getReportDefinition).mockResolvedValue(definition);
    vi.mocked(listExecutionCases).mockResolvedValue({ cases: [{ executionCaseId: 'case-1' }] });
    vi.mocked(readExecutionCase).mockResolvedValue({
      version: 7,
      detail: { initiativeId: 'initiative-1' },
    });
    vi.mocked(createExecutionTask).mockResolvedValue({ aggregateVersion: 1, response: {} });
    vi.mocked(createReportDefinition).mockResolvedValue({ response: definition });
    vi.mocked(transitionReportDefinition).mockResolvedValue({ response: definition });
    vi.mocked(createReportRun).mockResolvedValue({ response: run });
    vi.mocked(transitionReportRun).mockImplementation(async (_id, command: any) => ({
      response:
        command.action === 'LINK_FOLLOW_UP'
          ? {
              ...run,
              followUpTaskRef: {
                taskId: command.taskId,
                version: command.taskVersion,
                receiptClientRequestId: command.taskReceiptClientRequestId,
              },
            }
          : {
              ...run,
              status: 'PUBLISHED',
              exportPackage: { format: 'JSON' },
              distributionReceipts: [
                { receiptId: 'dist-1', audience: 'SteerCo', contentHash: 'hash-1' },
              ],
            },
    }));
  });
  it('keeps the register fail-closed and retries the canonical report sources', async () => {
    vi.mocked(listReportRuns)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [run] });
    render(<ExecutionReportsSurface />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się załadować');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect((await screen.findAllByText(/Weekly execution/)).length).toBeGreaterThan(0);
    expect(listReportRuns).toHaveBeenCalledTimes(2);
  });

  it('opens canonical run by keyboard and publishes only approved frozen snapshot', async () => {
    render(<ExecutionReportsSurface />);
    const row = (await screen.findByText(/Weekly execution · 08 sie 2026/)).closest('tr')!;
    fireEvent.click(row);
    fireEvent.keyDown(row.closest('div[tabindex="0"]')!, { key: 'Enter' });
    expect(screen.getByText(/execution_case · case-1 · v3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nowy raport' }));
    fireEvent.change(screen.getByLabelText('Report distribution receiptId'), {
      target: { value: 'dist-1' },
    });
    fireEvent.change(screen.getByLabelText('Report distribution audience'), {
      target: { value: 'SteerCo' },
    });
    fireEvent.change(screen.getByLabelText('Report distribution distributedAt'), {
      target: { value: '2026-08-10T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish/share frozen approved snapshot' }));
    await waitFor(() =>
      expect(transitionReportRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          expectedVersion: 5,
          action: 'PUBLISH',
          distribution: expect.objectContaining({ receiptId: 'dist-1' }),
        })
      )
    );
    expect(await screen.findByText(/Frozen JSON package retained/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download|export/i })).not.toBeInTheDocument();
  });
  it('uses only an exact PUBLISHED Definition version and supports its governed lifecycle', async () => {
    render(<ExecutionReportsSurface />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Definicje' }));
    const definitionRow = (await screen.findByText('Weekly execution')).closest('tr')!;
    fireEvent.click(definitionRow);
    expect(screen.getAllByText('owner-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('approver-1').length).toBeGreaterThan(0);
    expect(screen.getByText('project-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nowa definicja' }));
    fireEvent.change(screen.getByLabelText('Report Definition publish rationale'), {
      target: { value: 'Independent contract approval' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish Definition' }));
    await waitFor(() =>
      expect(transitionReportDefinition).toHaveBeenCalledWith(
        'weekly',
        expect.objectContaining({
          expectedVersion: 7,
          action: 'PUBLISH',
          rationale: 'Independent contract approval',
        })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Nowy raport' }));
    fireEvent.change(screen.getByLabelText('ReportRun published Definition version'), {
      target: { value: 'weekly@2' },
    });
    fireEvent.change(screen.getByLabelText('ReportRun draft JSON'), {
      target: {
        value: JSON.stringify({
          reportRunId: 'run-2',
          definitionRef: { definitionId: 'wrong', version: 99 },
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create or refresh ReportRun' }));
    await waitFor(() =>
      expect(createReportRun).toHaveBeenCalledWith(
        'run-2',
        expect.objectContaining({ definitionRef: { definitionId: 'weekly', version: 2 } })
      )
    );
  });
  it('creates a versioned Definition only with explicit project scope and no tenant-wide default', async () => {
    render(<ExecutionReportsSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Nowa definicja' }));
    expect(screen.getByRole('button', { name: 'Create Definition' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Report Definition ID'), {
      target: { value: 'project-report' },
    });
    fireEvent.change(screen.getByLabelText('Report Definition project IDs'), {
      target: { value: 'project-1\nproject-2' },
    });
    fireEvent.change(screen.getByLabelText('Report Definition contract JSON'), {
      target: {
        value: JSON.stringify({
          name: 'Project report',
          purpose: 'Steering',
          audience: ['PMO'],
          cadence: 'WEEKLY',
          scope: { type: 'EXECUTION', refs: ['case-1'] },
          outputSchema: {},
          sections: [{ sectionId: 'health', title: 'Health', mandatory: true }],
          sourceBindings: [],
          access: { classification: 'INTERNAL', audienceRoles: ['PMO'] },
          redaction: { defaultState: 'REDACTED', rules: [] },
          freshnessThresholdMinutes: 60,
          confidenceThreshold: 'MEDIUM',
          ownerId: 'owner',
          approverId: 'approver',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Definition' }));
    await waitFor(() =>
      expect(createReportDefinition).toHaveBeenCalledWith(
        'project-report',
        expect.objectContaining({
          scope: expect.objectContaining({
            projectIds: ['project-1', 'project-2'],
            generalBacklogAllowed: false,
          }),
        })
      )
    );
  });
  it('creates a canonical follow-up Task and automatically links its exact receipt', async () => {
    render(<ExecutionReportsSurface />);
    fireEvent.click((await screen.findByText(/Weekly execution · 08 sie 2026/)).closest('tr')!);
    fireEvent.click(screen.getByRole('button', { name: 'Nowy raport' }));
    for (const [label, value] of [
      ['executionCaseId', 'case-1'],
      ['taskId', 'task-follow-1'],
      ['title', 'Resolve report finding'],
      ['description', 'Close source gap'],
      ['assigneeId', 'assignee-1'],
      ['ownerId', 'owner-1'],
      ['dueAt', '2026-08-20T10:00'],
      ['slaAt', '2026-08-19T10:00'],
      ['evidenceRefs', 'report:run-1:v5'],
    ])
      fireEvent.change(screen.getByLabelText(`Report follow-up ${label}`), {
        target: { value },
      });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create and link canonical follow-up Task' })
    );
    await waitFor(() =>
      expect(createExecutionTask).toHaveBeenCalledWith(
        'case-1',
        'task-follow-1',
        expect.objectContaining({
          expectedCaseVersion: 7,
          initiativeId: 'initiative-1',
          evidenceRefs: ['report:run-1:v5'],
        })
      )
    );
    expect(transitionReportRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        action: 'LINK_FOLLOW_UP',
        taskId: 'task-follow-1',
        taskVersion: 1,
        taskReceiptClientRequestId: expect.any(String),
      })
    );
    expect(await screen.findByText(/Follow-up Task task-follow-1 v1/)).toBeInTheDocument();
  });
});
