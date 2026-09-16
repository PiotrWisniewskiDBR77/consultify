import { act, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionWorkSurface } from '../../../src/components/Execution/ExecutionWorkSurface';
import { ExecutionResourcesSurface } from '../../../src/components/Execution/ExecutionResourcesSurface';
import {
  listExecutionCases,
  createExecutionMilestone,
  readExecutionCase,
  readExecutionCaseBundles,
  readExecutionMilestones,
  readExecutionWork,
  readOperationalAllocations,
  simulateOperationalAllocation,
} from '@/services/initiatives-execution/runtimeApi';
import { readExecutionResourcePlan } from '@/services/execution/resourcePlanApi';
/**
 * WRAPPER TRASY (1.12-R2, 2026-09-06) — dlaczego ten plik byl CZERWONY.
 *
 * Powierzchnie Pracy i Zasobow renderuja `TableWithPreviewLayout`, ktore od
 * czasu kanonu „jeden panel" wola `useJedenPanel()` -> `useLocation()`.
 * Bez `<MemoryRouter>` React Router rzuca „useLocation() may be used only in
 * the context of a <Router> component" i KAZDY test tego pliku pada zanim
 * cokolwiek zmierzy. Zmierzone przed naprawa: 13 czerwonych z 19 w tej parze
 * plikow — czyli caly bezpiecznik „wiszaca realizacja" z 05.09 byl rozbrojony,
 * a nikt tego nie widzial, bo czerwien wygladala jak stary dlug.
 */
const render = (ui: React.ReactElement) =>
  rtlRender(<MemoryRouter initialEntries={['/execution']}>{ui}</MemoryRouter>);

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases: vi.fn(),
  createExecutionMilestone: vi.fn(),
  readExecutionCase: vi.fn(),
  readExecutionCaseBundles: vi.fn(),
  readExecutionMilestones: vi.fn(),
  readExecutionWork: vi.fn(),
  createExecutionTask: vi.fn(),
  updateExecutionTask: vi.fn(),
  completeExecutionTask: vi.fn(),
  createExecutionDecision: vi.fn(),
  requestExecutionDecision: vi.fn(),
  decideExecutionDecision: vi.fn(),
  readOperationalAllocations: vi.fn(),
  simulateOperationalAllocation: vi.fn(),
  proposeOperationalAllocation: vi.fn(),
  transitionOperationalAllocation: vi.fn(),
}));
vi.mock('@/services/execution/resourcePlanApi', () => ({
  readExecutionResourcePlan: vi.fn(),
  saveUserCapacity: vi.fn(),
  przeniesZadanieNaTermin: vi.fn(),
  zamknijZadanieZaleglosci: vi.fn(),
  zmniejszZakresZadania: vi.fn(),
}));

function WorkHarness() {
  const [filter, setFilter] = useState<React.ReactNode>(null);
  const [menu3, setMenu3] = useState<React.ReactNode>(null);
  return (
    <>
      <ExecutionWorkSurface
        onRegisterFilterControl={setFilter}
        onRegisterMenu3Control={setMenu3}
      />
      <div data-testid="work-filter">{filter}</div>
      <div data-testid="work-menu3">{menu3}</div>
    </>
  );
}

function ResourcesHarness() {
  const [filter, setFilter] = useState<React.ReactNode>(null);
  const [menu3, setMenu3] = useState<React.ReactNode>(null);
  return (
    <>
      <ExecutionResourcesSurface
        onRegisterFilterControl={setFilter}
        onRegisterMenu3Control={setMenu3}
      />
      <div data-testid="resources-filter">{filter}</div>
      <div data-testid="resources-menu3">{menu3}</div>
    </>
  );
}

async function selectCase(label: 'Execution Case for work' | 'Execution Case for resources') {
  const select = await screen.findByLabelText(label);
  await within(select).findByRole('option', { name: /case1/ });
  await act(async () => {
    fireEvent.change(select, { target: { value: 'case1' } });
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.mocked(readExecutionResourcePlan).mockResolvedValue({
    asOf: '2026-08-17',
    weeks: ['2026-08-17'],
    rows: [
      {
        userId: 'u1',
        name: 'U1',
        role: 'Consultant',
        weekStart: '2026-08-17',
        demandHours: 20,
        supplyHours: 40,
        utilizationPercent: 50,
        gapHours: 20,
        overdueHours: 0,
        backlogHours: 0,
        backlogTaskIds: [],
        backlogTasks: [],
        taskCount: 1,
        supplySource: 'PROFIL',
      },
    ],
    people: [
      {
        userId: 'u1',
        name: 'U1',
        role: 'Consultant',
        weeklyCapacityHours: 40,
        availabilityPercent: 100,
        supplySource: 'PROFIL',
        backlogHours: 0,
        unscheduledHours: 0,
        backlogTaskIds: [],
        backlogTasks: [],
      },
    ],
    summary: {
      peopleCount: 1,
      demandHours: 20,
      supplyHours: 40,
      gapHours: 20,
      utilizationPercent: 50,
      overloadedCount: 0,
      peopleWithoutProfileSupply: 0,
      backlogHoursTotal: 0,
      backlogPeople: 0,
    },
  });
  vi.mocked(listExecutionCases).mockResolvedValue({ cases: [{ executionCaseId: 'case1' }] });
  vi.mocked(readExecutionCase).mockResolvedValue({
    version: 3,
    detail: { initiativeId: 'i1', handoffPackageId: 'pack-1', handoffPackageVersion: 2 },
  });
  vi.mocked(readExecutionMilestones).mockResolvedValue({
    items: [
      {
        milestoneId: 'milestone-1',
        version: 4,
        executionCaseId: 'case1',
        initiativeId: 'i1',
        baselineRef: { ref: 'pack-1', version: 2 },
        title: 'Pilot ready',
        ownerId: 'owner-1',
        targetAt: null,
        forecastAt: null,
        status: 'AT_RISK',
        readiness: 'BLOCKED',
        forecastVarianceDays: null,
        evidenceRefs: [],
        sourceVersions: { executionCaseVersion: 3, baselineVersion: 2 },
      },
    ],
  });
  vi.mocked(readExecutionWork).mockResolvedValue({
    tasks: [
      {
        version: 2,
        taskId: 'task1',
        title: 'Validate',
        status: 'OPEN',
        assigneeId: 'u1',
        dueAt: '2026-08-20',
        slaAt: '2026-08-19',
        evidenceRefs: [],
        blockerDecisionIds: [],
        dependencyTaskIds: [],
        milestoneIds: ['milestone-1'],
        blastRadius: [
          {
            milestoneId: 'milestone-1',
            version: 4,
            status: 'AT_RISK',
            readiness: 'BLOCKED',
            forecastVarianceDays: null,
            sourceVersions: { executionCaseVersion: 3, baselineVersion: 2 },
          },
        ],
      },
    ],
    decisions: [],
  });
  vi.mocked(readExecutionCaseBundles).mockResolvedValue(null);
  vi.mocked(readOperationalAllocations).mockResolvedValue({
    items: [
      {
        version: 2,
        allocationId: 'alloc1',
        status: 'PROPOSED',
        assigneeId: 'u1',
        timeBasis: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods: [] },
      },
    ],
  });
  vi.mocked(simulateOperationalAllocation).mockResolvedValue({
    state: 'EVIDENCE_MISSING',
    findings: ['AVAILABILITY_EVIDENCE_MISSING'],
  });
});
describe('Execution canonical work/resources', () => {
  it('keeps Work fail-closed and retries the canonical case register', async () => {
    vi.mocked(listExecutionCases)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ cases: [{ executionCaseId: 'case1' }] });
    render(<WorkHarness />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Execution Case for work')).toBeInTheDocument();
    expect(listExecutionCases).toHaveBeenCalledTimes(2);
  });

  it('keeps Resources fail-closed and retries the canonical case register', async () => {
    vi.mocked(listExecutionCases)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ cases: [{ executionCaseId: 'case1' }] });
    vi.mocked(readExecutionResourcePlan).mockRejectedValueOnce(new Error('offline'));
    render(<ResourcesHarness />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Execution Case for resources')).toBeInTheDocument();
    expect(listExecutionCases).toHaveBeenCalledTimes(2);
  });

  it('loads Task projection by stable executionCaseId and opens preview with keyboard', async () => {
    render(<WorkHarness />);
    await selectCase('Execution Case for work');
    await waitFor(() => expect(readExecutionMilestones).toHaveBeenCalledWith('case1'));
    await screen.findByText(/Pilot ready/);
    const row = (await screen.findByText('Validate')).closest('tr')!;
    fireEvent.click(row);
    fireEvent.keyDown(row.closest('div[tabindex="0"]')!, { key: 'Enter' });
    expect(
      screen.getByRole('region', { name: 'Execution Work item workspace' })
    ).toBeInTheDocument();
    expect(readExecutionWork).toHaveBeenCalledWith('case1');
    expect(screen.getByRole('region', { name: 'Task milestone blast radius' })).toHaveTextContent(
      'Kamień · …estone-1 v4 · Zagrożony · Zablokowany'
    );
    expect(screen.getByText(/Variance No data/)).toBeInTheDocument();
  });
  it('creates a canonical Milestone with exact Case and Handoff baseline versions', async () => {
    vi.mocked(createExecutionMilestone).mockResolvedValue({ response: {} });
    render(<WorkHarness />);
    await selectCase('Execution Case for work');
    await screen.findByText(/Pilot ready/);
    fireEvent.click(within(screen.getByTestId('work-menu3')).getByLabelText('Row actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'New milestone' }));
    fireEvent.change(screen.getByLabelText('Milestone id'), { target: { value: 'milestone-2' } });
    fireEvent.change(screen.getByLabelText('Milestone title'), { target: { value: 'Wave ready' } });
    fireEvent.change(screen.getByLabelText('Milestone ownerId'), { target: { value: 'owner-2' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'New milestone' }));
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(createExecutionMilestone).toHaveBeenCalledWith(
        'case1',
        'milestone-2',
        expect.objectContaining({
          expectedCaseVersion: 3,
          baselineRef: { ref: 'pack-1', version: 2 },
          targetAt: null,
          forecastAt: null,
          sourceVersions: { executionCaseVersion: 3, baselineVersion: 2 },
        })
      )
    );
    await waitFor(() => expect(readExecutionWork).toHaveBeenCalledTimes(3));
  });
  it('keeps allocation simulation pure and exposes literal EVIDENCE_MISSING', async () => {
    render(<ResourcesHarness />);
    await selectCase('Execution Case for resources');
    await waitFor(() => expect(readExecutionCase).toHaveBeenCalledWith('case1', expect.anything()));
    fireEvent.click(
      await within(screen.getByTestId('resources-menu3')).findByLabelText('Row actions')
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Propose allocation' }));
    fireEvent.change(screen.getByLabelText('Operational Allocation proposal JSON'), {
      target: {
        value: JSON.stringify({
          timeBasis: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods: [] },
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
    expect(await screen.findByText('EVIDENCE_MISSING')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('EVIDENCE_MISSING');
  });
  it('opens a person preview on single click, preserves it on double click, and opens its canonical Allocation workspace', async () => {
    render(<ResourcesHarness />);
    await selectCase('Execution Case for resources');
    const row = (await screen.findByText(/U1/)).closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    const allocationRelation = await screen.findByRole('button', { name: 'Allocation alloc1' });

    // A person row has no single canonical allocation to open. Double click must
    // therefore keep the selected person's preview; the relation chooses alloc1.
    fireEvent.doubleClick(row!);
    expect(screen.getByRole('button', { name: 'Allocation alloc1' })).toBe(allocationRelation);

    fireEvent.click(allocationRelation);
    expect(
      screen.getByRole('region', { name: 'Operational Allocation workspace' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Proposed · U1/)).toBeInTheDocument();
    expect(screen.queryByText(/\bPROPOSED\b/)).not.toBeInTheDocument();
  });
});
