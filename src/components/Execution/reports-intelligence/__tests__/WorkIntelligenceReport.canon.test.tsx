import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkIntelligenceReport } from '../WorkIntelligenceReport';

const api = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionWork: vi.fn(),
  readExecutionMilestones: vi.fn(),
}));

const managerApi = vi.hoisted(() => ({
  getManagerProblems: vi.fn(),
  executeManagerProblemAction: vi.fn(),
  generateExecutionWorkAnalysis: vi.fn(),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => api);
vi.mock('@/services/api/v8/execution-control', () => ({
  V8ExecutionControlApi: {
    getManagerProblems: managerApi.getManagerProblems,
    executeManagerProblemAction: managerApi.executeManagerProblemAction,
  },
}));
vi.mock('@/services/executionReports/executionReportsApi', () => ({
  generateExecutionWorkAnalysis: managerApi.generateExecutionWorkAnalysis,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: string, options?: Record<string, unknown>) =>
      Object.entries(options || {}).reduce(
        (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
        fallback ?? _key
      ),
  }),
}));

describe('Work Intelligence attention surface — real triad behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listExecutionCases.mockResolvedValue({
      cases: [
        {
          executionCaseId: 'case-1',
          initiativeId: 'initiative-1',
          projectId: 'project-1',
          projectTitle: 'North plant',
        },
      ],
    });
    api.readExecutionWork.mockResolvedValue({
      tasks: [
        {
          taskId: 'task-1',
          title: 'Blocked commissioning',
          status: 'BLOCKED',
          priority: 'HIGH',
          assigneeId: 'owner-1',
          dueAt: '2026-09-15T12:00:00.000Z',
          version: 2,
        },
      ],
      decisions: [],
    });
    api.readExecutionMilestones.mockResolvedValue({ items: [] });
    managerApi.getManagerProblems.mockImplementation((laneId: string) =>
      Promise.resolve({
        data: {
          problems:
            laneId === 'action-queue'
              ? [
                  {
                    id: 'problem-1',
                    sourceEntityId: 'task-1',
                    sourceEntityType: 'TASK',
                    actions: [
                      { id: 'escalate', label: 'Escalate' },
                      { id: 'reassign', label: 'Reassign' },
                      { id: 'set_capacity', label: 'Set capacity' },
                    ],
                  },
                ]
              : [],
        },
      })
    );
  });

  it('opens the real row kebab and the same source handler from the preview header', async () => {
    const onOpenDocument = vi.fn();
    const resolveOwnerName = vi.fn((id: string) =>
      id === 'owner-1' ? 'Marek Nowak' : null
    );

    render(
      <WorkIntelligenceReport
        analysisEnabled
        resolveOwnerName={resolveOwnerName}
        onOpenDocument={onOpenDocument}
      />
    );

    expect((await screen.findAllByText('Blocked commissioning')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('North plant').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Marek Nowak').length).toBeGreaterThan(0);
    expect(screen.queryByText('owner-1')).toBeNull();

    const kebab = screen.getAllByRole('button', { name: 'Row actions' })[0];
    fireEvent.click(kebab);
    const menu = await screen.findByRole('menu');

    expect(within(menu).getByText('Open source record')).toBeInTheDocument();
    expect(within(menu).getByText('Escalate')).toBeInTheDocument();
    expect(within(menu).getByText('Delegate')).toBeInTheDocument();
    expect(within(menu).getByText('Change resources')).toBeInTheDocument();
    expect(within(menu).getByText('Open preview')).toBeInTheDocument();
    expect(within(menu).queryByText(/^Edit$/)).toBeNull();
    expect(within(menu).queryByText(/^Archive$/)).toBeNull();
    expect(within(menu).queryByText(/^Delete$/)).toBeNull();

    fireEvent.click(within(menu).getByText('Open preview'));
    await waitFor(() => expect(document.querySelector('aside')).not.toBeNull());
    const previewRoot = document.querySelector('aside')!;
    expect(within(previewRoot).getByText('Blocked commissioning')).toBeInTheDocument();
    expect(within(previewRoot).getByText('Marek Nowak')).toBeInTheDocument();

    const headerOpen = within(previewRoot).getByRole('button', { name: /^Open$/ });
    expect(headerOpen).toBeEnabled();
    fireEvent.click(headerOpen);

    await waitFor(() =>
      expect(onOpenDocument).toHaveBeenCalledWith({
        id: 'task-1',
        title: 'Blocked commissioning',
        kind: 'TASK',
        status: 'BLOCKED',
        executionCaseId: 'case-1',
      })
    );
  });

  it.each([
    ['Escalate', 'escalate'],
    ['Delegate', 'reassign'],
    ['Change resources', 'set_capacity'],
  ] as const)('executes the canonical %s action from the row menu', async (label, actionId) => {
    managerApi.executeManagerProblemAction.mockResolvedValue({
      data: { success: true, message: `${label} completed.` },
    });
    render(<WorkIntelligenceReport analysisEnabled />);

    expect((await screen.findAllByText('Blocked commissioning')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]);
    fireEvent.click(within(await screen.findByRole('menu')).getByText(label));

    await waitFor(() =>
      expect(managerApi.executeManagerProblemAction).toHaveBeenCalledWith(
        'action-queue',
        { problemId: 'problem-1', actionId },
        'project-1'
      )
    );
  });

  it('renders the canonical empty state when no work record needs management attention', async () => {
    api.readExecutionWork.mockResolvedValue({ tasks: [], decisions: [] });
    managerApi.getManagerProblems.mockResolvedValue({ data: { problems: [] } });
    render(<WorkIntelligenceReport analysisEnabled />);

    expect(
      await screen.findByText('No records require management attention')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Row actions' })).toBeNull();
  });
});
