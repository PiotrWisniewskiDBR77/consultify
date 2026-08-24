import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanScenarioSurface } from '../../../src/components/Initiatives/PlanScenarioSurface';
import {
  createPlanAnalysisProposal,
  listPlanScenarioRegister,
  readPlanScenario,
  readPlanScenarioDiff,
  readPlanScenarioHistory,
  writePlanScenario,
  reviewPlanAnalysisProposal,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(readonly status: number) {
      super(String(status));
    }
  },
  createPlanAnalysisProposal: vi.fn(),
  listPlanScenarioRegister: vi.fn(),
  readPlanScenario: vi.fn(),
  readPlanScenarioDiff: vi.fn(),
  readPlanScenarioHistory: vi.fn(),
  writePlanScenario: vi.fn(),
  reviewPlanAnalysisProposal: vi.fn(),
}));

const plan = {
  scenarioId: 'plan-q4',
  scenarioVersion: 1,
  status: 'DRAFT' as const,
  portfolioScenarioId: 'portfolio-q4',
  portfolioScenarioVersion: 3,
  windowUnit: 'WEEK',
  timezone: 'Europe/Warsaw',
  periods: [
    { periodId: 'w1', start: '2026-09-01T00:00:00Z', end: '2026-09-08T00:00:00Z' },
    { periodId: 'w2', start: '2026-09-08T00:00:00Z', end: '2026-09-15T00:00:00Z' },
  ],
  windows: [
    {
      initiativeId: 'initiative-1',
      initiativeVersion: 7,
      earliest: '2026-10-01T00:00:00.000Z',
      target: '2026-10-15T00:00:00.000Z',
      latest: '2026-10-31T00:00:00.000Z',
      confidence: 'MEDIUM' as const,
      rationale: 'Draft planning envelope',
      dependencySnapshot: [],
      constraintSnapshot: [
        { constraintId: 'c1', state: 'UNKNOWN' as const, detail: 'Supplier window unconfirmed' },
      ],
    },
  ],
  assumptions: ['No baseline commitment'],
  createdBy: 'planner',
  updatedBy: 'planner',
  publishedBy: null,
  publishedAt: null,
};

describe('PlanScenarioSurface', () => {
  beforeEach(() => {
    vi.mocked(listPlanScenarioRegister)
      .mockReset()
      .mockResolvedValue({
        scenarios: [
          {
            id: 'plan-q4',
            name: 'Q4 plan',
            state: 'DRAFT',
            version: 1,
            portfolioRef: { scenarioId: 'portfolio-q4', scenarioVersion: 3 },
            window: { earliest: plan.windows[0].earliest, latest: plan.windows[0].latest },
            timeBasis: {
              windowUnit: 'WEEK',
              timezone: 'Europe/Warsaw',
              periods: plan.periods,
              knowledgeState: 'KNOWN',
            },
            updatedAt: '2026-08-09T12:00:00.000Z',
          },
        ],
      });
    vi.mocked(readPlanScenario).mockReset().mockResolvedValue({ version: 4, scenario: plan });
    vi.mocked(readPlanScenarioDiff).mockReset().mockResolvedValue({ changes: [] });
    vi.mocked(readPlanScenarioHistory)
      .mockReset()
      .mockResolvedValue({
        versions: [
          { ...plan, scenarioVersion: 1 },
          {
            ...plan,
            scenarioVersion: 2,
            windows: [{ ...plan.windows[0], target: '2026-10-22T00:00:00.000Z' }],
          },
        ],
      });
    vi.mocked(writePlanScenario)
      .mockReset()
      .mockResolvedValue({ aggregateVersion: 5, response: { ...plan, scenarioVersion: 2 } });
    vi.mocked(createPlanAnalysisProposal)
      .mockReset()
      .mockResolvedValue({
        response: {
          proposalId: 'proposal-1',
          inputAggregateVersion: 4,
          inputScenarioVersion: 1,
          status: 'PENDING_REVIEW',
          assumptions: ['Dependencies precede dependants'],
          rationale: 'No source record changed.',
          conflicts: [],
          changes: [
            {
              initiativeId: 'initiative-1',
              before: plan.windows[0],
              after: { ...plan.windows[0], target: '2026-09-01T00:00:00Z' },
            },
          ],
        },
      });
    vi.mocked(reviewPlanAnalysisProposal).mockReset().mockResolvedValue({});
  });

  it('loads the persistent register and opens exact Plan Workbench with Enter', async () => {
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    expect((await screen.findByLabelText('Active Plan Scenario')).textContent).toContain('Szkic');
    expect(screen.queryByText(/\bDRAFT\b/)).not.toBeInTheDocument();
    const row = (await screen.findByText('Automation')).closest('tr')!;
    fireEvent.click(row);
    expect(screen.getByText('Plan initiative window')).toBeInTheDocument();
    const layout = row.closest('div[tabindex="0"]')!;
    layout.focus();
    fireEvent.keyDown(layout, { key: 'Enter' });
    expect(
      await screen.findByRole('region', { name: 'Plan Scenario Workbench' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Plan initiative window')).not.toBeInTheDocument()
    );
    expect(readPlanScenario).toHaveBeenCalledWith('plan-q4');
    expect(screen.getByLabelText('target initiative-1')).toHaveValue('2026-10-15T00:00');
    expect(screen.getByText('UNKNOWN: Supplier window unconfirmed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij narzędzia planu' }));
    expect(screen.queryByRole('region', { name: 'Plan Scenario Workbench' })).toBeNull();
  });

  it('keeps move/window edits in draft and publishes only through Plan Scenario API', async () => {
    render(
      <PlanScenarioSurface
        initiatives={[
          { id: 'initiative-1', name: 'Automation', lifecycle: 'IN_EXECUTION' },
          { id: 'initiative-2', name: 'Digital', lifecycle: 'SCHEDULED' },
        ]}
      />
    );
    fireEvent.doubleClick((await screen.findByText('Automation')).closest('tr')!);
    await screen.findByRole('region', { name: 'Plan Scenario Workbench' });
    expect(screen.getByLabelText('Uwzględnij Automation')).toBeChecked();
    fireEvent.change(screen.getByLabelText('Filtr statusu inicjatyw planu'), {
      target: { value: 'SCHEDULED' },
    });
    expect(screen.queryByLabelText('Uwzględnij Automation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Uwzględnij Digital'));
    fireEvent.click(screen.getByLabelText('Przypisz Digital do w1'));
    expect(screen.getByLabelText('Przypisz Digital do w1')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Przesuń Digital w prawo'));
    expect(screen.getByLabelText('Przypisz Digital do w2')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByLabelText('Move initiative-2 up'));
    expect(writePlanScenario).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Plan assumptions'), {
      target: { value: 'Dependency validated\nWindow remains draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(writePlanScenario).toHaveBeenCalledWith(
        'plan-q4',
        expect.objectContaining({
          operation: 'UPDATE',
          expectedVersion: 4,
          scenario: expect.objectContaining({
            windowUnit: 'WEEK',
            timezone: 'Europe/Warsaw',
            periods: plan.periods,
            windows: expect.arrayContaining([
              expect.objectContaining({
                initiativeId: 'initiative-2',
                target: '2026-09-08T00:00:00Z',
              }),
            ]),
          }),
        })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish Plan Scenario' }));
    await waitFor(() =>
      expect(writePlanScenario).toHaveBeenLastCalledWith(
        'plan-q4',
        expect.objectContaining({ operation: 'PUBLISH' })
      )
    );
  });

  it('shows UNKNOWN and blocks save/publish for a legacy Plan without canonical time basis', async () => {
    vi.mocked(readPlanScenario).mockResolvedValueOnce({
      version: 4,
      scenario: { ...plan, windowUnit: undefined, timezone: undefined, periods: undefined },
    } as any);
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Otwórz narzędzia planu' }));
    await screen.findByRole('region', { name: 'Plan Scenario Workbench' });
    expect(screen.getByRole('alert')).toHaveTextContent('UNKNOWN time basis');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish Plan Scenario' })).toBeDisabled();
  });

  it('compares two persistent Plan versions without mutating the scenario', async () => {
    vi.mocked(readPlanScenarioDiff).mockResolvedValueOnce({
      changes: [
        {
          initiativeId: 'initiative-1',
          before: plan.windows[0],
          after: { ...plan.windows[0], target: '2026-10-22T00:00:00.000Z' },
        },
      ],
    });
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Otwórz narzędzia planu' }));
    await screen.findByRole('region', { name: 'Plan Scenario Workbench' });

    expect(readPlanScenarioHistory).toHaveBeenCalledWith('plan-q4');
    expect(screen.getByLabelText('Bazowa wersja planu')).toHaveValue('1');
    expect(screen.getByLabelText('Porównywana wersja planu')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Porównaj wersje' }));

    await waitFor(() => expect(readPlanScenarioDiff).toHaveBeenCalledWith('plan-q4', 1, 2));
    expect(screen.getByText(/initiative-1:.*2026-10-15.*2026-10-22/)).toBeInTheDocument();
    expect(writePlanScenario).not.toHaveBeenCalled();
  });

  it('keeps current initiatives visible as unscheduled when the scenario has no window', async () => {
    vi.mocked(readPlanScenario).mockResolvedValueOnce({
      version: 4,
      scenario: { ...plan, status: 'PUBLISHED', windows: [] },
    });
    render(
      <PlanScenarioSurface
        initiatives={[{ id: 'initiative-in-execution', name: 'Automation in execution' }]}
      />
    );
    expect(await screen.findByText('Automation in execution')).toBeInTheDocument();
    expect(screen.getByText('Nie przypisano okna planu')).toBeInTheDocument();
    expect(screen.getByText('ADD_TO_PLAN_OR_EXCLUDE')).toBeInTheDocument();
  });

  it('creates a weekly planning horizon without exposing raw JSON', async () => {
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    await screen.findByLabelText('Active Plan Scenario');

    fireEvent.click(screen.getByRole('button', { name: 'Nowy plan' }));
    expect(screen.queryByText('Ordered periods JSON')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Plan Scenario ID'), {
      target: { value: 'plan-transformation' },
    });
    fireEvent.change(screen.getByLabelText('Portfolio Scenario ID'), {
      target: { value: 'portfolio-approved' },
    });
    fireEvent.change(screen.getByLabelText('Plan start date'), {
      target: { value: '2026-09-07' },
    });
    fireEvent.change(screen.getByLabelText('Plan week count'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz plan' }));

    expect(
      await screen.findByRole('region', { name: 'Plan Scenario Workbench' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa okresu 1')).toHaveValue('Tydzień 1');
    expect(screen.getByLabelText('Początek okresu 1')).toHaveValue('2026-09-07');
    expect(screen.getByLabelText('Koniec okresu 2')).toHaveValue('2026-09-21');

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() =>
      expect(writePlanScenario).toHaveBeenCalledWith(
        'plan-transformation',
        expect.objectContaining({
          operation: 'CREATE',
          scenario: expect.objectContaining({
            periods: [
              expect.objectContaining({
                periodId: 'Tydzień 1',
                start: '2026-09-07T00:00:00.000Z',
                end: '2026-09-14T00:00:00.000Z',
              }),
              expect.objectContaining({
                periodId: 'Tydzień 2',
                start: '2026-09-14T00:00:00.000Z',
                end: '2026-09-21T00:00:00.000Z',
              }),
            ],
          }),
        })
      )
    );
  });

  it('reviews an analysis proposal before applying it to the unsaved draft', async () => {
    render(<PlanScenarioSurface initiatives={[{ id: 'initiative-1', name: 'Automation' }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Otwórz narzędzia planu' }));
    await screen.findByRole('region', { name: 'Plan Scenario Workbench' });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(await screen.findByRole('region', { name: 'Plan analysis proposal' })).toHaveTextContent(
      'PENDING_REVIEW'
    );
    expect(writePlanScenario).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zastosuj do szkicu' }));
    await waitFor(() => expect(reviewPlanAnalysisProposal).toHaveBeenCalled());
    expect(screen.getByLabelText('target initiative-1')).toHaveValue('2026-09-01T00:00');
    expect(writePlanScenario).not.toHaveBeenCalled();
  });
});
