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
    i18n: {
      language: 'en',
      getFixedT: () => (_key: string, fallback: string, options?: Record<string, unknown>) =>
        Object.entries(options || {}).reduce(
          (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
          fallback
        ),
    },
    t: (_key: string, fallback: string, options?: Record<string, unknown>) =>
      Object.entries(options || {}).reduce(
        (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
        fallback
      ),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: ({ columns = [], data, onRowClick, onRowDoubleClick }: any) => (
    <div data-testid="standard-table">
      {data.map((row: any) => (
        <div key={row.id}>
          <button
            type="button"
            onClick={() => onRowClick?.(row)}
            onDoubleClick={() => onRowDoubleClick?.(row)}
          >
            {row.title}
          </button>
          {columns.map((column: any) =>
            column.render ? (
              <span key={column.id}>{column.render(row)}</span>
            ) : column.id !== 'title' && row[column.id] != null ? (
              <span key={column.id}>{String(row[column.id])}</span>
            ) : null
          )}
        </div>
      ))}
    </div>
  ),
}));

const stateDate = new Date('2026-08-25T12:00:00.000Z');
const GOVERNED_DECISION_TITLE = 'Governed decision';
const TECHNICAL_DECISION_TITLE = 'Technical tool decision';

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
    managerApi.getManagerProblems.mockReset();
    managerApi.executeManagerProblemAction.mockReset();
    managerApi.generateExecutionWorkAnalysis.mockReset();
    managerApi.getManagerProblems.mockResolvedValue({ data: { problems: [] } });
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

  it('renders all nine management sections with real content in contract order', async () => {
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
    // F11: asserting only that the nine `data-section-order` keys equal the
    // component's own hardcoded `sections` constant is a tautology — it
    // cannot fail unless someone also edits that constant. Assert on the
    // actual rendered content of each section instead.
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

    expect(screen.getByRole('heading', { name: 'Context and trust' })).toBeInTheDocument();
    expect(screen.getByText('All accessible Execution cases')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Executive Pulse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'overdueTasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dataCompleteness' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'What hurts today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What is approaching' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'What is at stake' })).toBeInTheDocument();
    // NAPRAWA (dług 11.09): `NO_API_BSC` był surowym literałem w JSX przed
    // naprawą i18n-reszty (komentarz przy WorkIntelligenceReport.tsx:85) —
    // dziś idzie przez `trPair(t, REASON_LABEL_KEY.NO_API_BSC)`, więc RAW
    // klucz enuma nigdy nie trafia na ekran, tylko jego angielski fallback
    // ('No objective-mapping API available' — mock ma i18n.language:'en').
    expect(screen.getByText(/No objective-mapping API available/)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Why it is happening' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How the system is changing' })).toBeInTheDocument();
    // Ta sama naprawa: `EPISTEMIC_LABEL_KEY.unknown` → 'UNKNOWN',
    // `REASON_LABEL_KEY.NO_API_HISTORY` → 'No history API available'.
    expect(screen.getByText('UNKNOWN · No history API available')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'What management should do' })).toBeInTheDocument();
    expect(screen.getByText(/No recommendation is issued/)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Auditable register' })).toBeInTheDocument();
    expect(api.readExecutionWork).toHaveBeenCalledWith('case-1');
    expect(screen.getByTestId('standard-table')).toHaveTextContent('Governed task');
  });

  it('keeps calculated epistemic and severity labels separated in Executive Pulse', async () => {
    api.listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'case-1', initiativeId: 'initiative-1' }],
    });
    api.readExecutionWork.mockResolvedValue({
      tasks: [{ taskId: 'task-1', title: 'Governed task', status: 'OPEN' }],
      decisions: [],
    });
    api.readExecutionMilestones.mockResolvedValue({ items: [] });

    render(<WorkIntelligenceReport />);

    await screen.findByRole('heading', { name: 'Executive Pulse' });
    const calculatedPulseButtons = screen
      .getAllByRole('button')
      .filter((button) => button.textContent?.includes('CALCULATED'));

    expect(calculatedPulseButtons.length).toBeGreaterThan(0);
    for (const button of calculatedPulseButtons) {
      expect(button.textContent).not.toMatch(/CalculatedNeutral|CALCULATEDNeutral/);
      expect(button.textContent).toMatch(
        /CALCULATED\s+Neutral|CALCULATED\s+Amber|CALCULATED\s+Red|CALCULATED\s+Unknown|CALCULATED\s+Warning/
      );
    }
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

  it('shows the three real work windows and narrows the canonical register', async () => {
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
          taskId: 'next-week-task',
          title: 'Prepare the weekly gate',
          status: 'OPEN',
          priority: 'HIGH',
          dueAt: '2026-08-26T12:00:00.000Z',
        },
        {
          taskId: 'next-month-task',
          title: 'Close the monthly dependency',
          status: 'OPEN',
          priority: 'MEDIUM',
          dueAt: '2026-09-10T12:00:00.000Z',
        },
      ],
      decisions: [],
    });
    api.readExecutionMilestones.mockResolvedValue({ items: [] });

    render(<WorkIntelligenceReport analysisEnabled />);

    const week = await screen.findByLabelText('Week of');
    fireEvent.change(week, { target: { value: '2026-08-24' } });

    expect(screen.getByRole('button', { name: /Previous week/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next week/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next month/ })).toBeInTheDocument();
    expect(screen.getAllByTestId('standard-table').at(-1)).toHaveTextContent(
      'Prepare the weekly gate'
    );
    expect(screen.getAllByTestId('standard-table').at(-1)).not.toHaveTextContent(
      'Close the monthly dependency'
    );

    fireEvent.click(screen.getByRole('button', { name: /Next month/ }));
    expect(screen.getAllByTestId('standard-table').at(-1)).toHaveTextContent(
      'Close the monthly dependency'
    );
  });

  it('shows concrete attention reasons, persists on demand, and executes manager actions through the governed service client', async () => {
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
          dueAt: '2026-08-20T12:00:00.000Z',
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
                    id: 'aq-task-blocked-task-1',
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
    managerApi.executeManagerProblemAction.mockResolvedValue({
      data: { success: true, message: 'Task reassigned.', changedCount: 1 },
    });
    managerApi.generateExecutionWorkAnalysis.mockResolvedValue({
      id: 'run-week-1',
      created: true,
      asOf: '2026-08-24T12:00:00.000Z',
    });

    render(<WorkIntelligenceReport analysisEnabled />);
    fireEvent.change(await screen.findByLabelText('Week of'), { target: { value: '2026-08-24' } });

    expect(await screen.findByText(/Blocked, Overdue/)).toBeInTheDocument();
    expect(screen.getAllByText('North plant').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Blocked commissioning' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delegate' }));
    await waitFor(() =>
      expect(managerApi.executeManagerProblemAction).toHaveBeenCalledWith(
        'action-queue',
        { problemId: 'aq-task-blocked-task-1', actionId: 'reassign' },
        'project-1'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Generate for this week' }));
    await waitFor(() =>
      expect(managerApi.generateExecutionWorkAnalysis).toHaveBeenCalledWith('2026-08-24')
    );
    expect(await screen.findByTestId('work-analysis-receipt')).toHaveTextContent('run-week-1');
  });

  it('opens a decision by its real decision.id and filters TOOL_* technical decisions', async () => {
    const onOpenDocument = vi.fn();
    api.listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'case-1', initiativeId: 'initiative-1' }],
    });
    api.readExecutionWork.mockResolvedValue({
      tasks: [],
      decisions: [
        {
          id: 'decision-real-1',
          decisionId: 'runtime-shadow-id',
          title: GOVERNED_DECISION_TITLE,
          status: 'DRAFT',
        },
        {
          id: 'TOOL_AUTO_REWRITE',
          decisionId: 'TOOL_AUTO_REWRITE',
          title: TECHNICAL_DECISION_TITLE,
          status: 'DRAFT',
        },
      ],
    });
    api.readExecutionMilestones.mockResolvedValue({ items: [] });

    render(<WorkIntelligenceReport onOpenDocument={onOpenDocument} />);
    const table = await screen.findByTestId('standard-table');
    expect(screen.queryByText(TECHNICAL_DECISION_TITLE)).not.toBeInTheDocument();
    fireEvent.doubleClick(within(table).getByRole('button', { name: GOVERNED_DECISION_TITLE }));

    await waitFor(() =>
      expect(onOpenDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'decision-real-1',
          kind: 'DECISION',
          executionCaseId: 'case-1',
        })
      )
    );
  });

  it('renders an honest empty state when runtime returns no cases', async () => {
    api.listExecutionCases.mockResolvedValue({ cases: [] });

    render(<WorkIntelligenceReport />);

    expect(
      await screen.findByText('No work records are available for the selected scope.')
    ).toBeInTheDocument();
    // NAPRAWA (dług 11.09): patrz uzasadnienie przy pierwszym teście tego
    // pliku — `trPair` renderuje angielski fallback, nigdy surowy klucz enuma.
    expect(screen.getByText('UNKNOWN · No history API available')).toBeInTheDocument();
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
