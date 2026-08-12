import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionWorkSurface } from '../../../src/components/Execution/ExecutionWorkSurface';
import { ExecutionResourcesSurface } from '../../../src/components/Execution/ExecutionResourcesSurface';
import {
  listExecutionCases,
  createExecutionMilestone,
  readExecutionCase,
  readExecutionMilestones,
  readExecutionWork,
  readOperationalAllocations,
  simulateOperationalAllocation,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases: vi.fn(),
  createExecutionMilestone: vi.fn(),
  readExecutionCase: vi.fn(),
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
beforeEach(() => {
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
    render(<ExecutionWorkSurface />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się załadować');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByLabelText('Execution Case for work')).toBeInTheDocument();
    expect(listExecutionCases).toHaveBeenCalledTimes(2);
  });

  it('keeps Resources fail-closed and retries the canonical case register', async () => {
    vi.mocked(listExecutionCases)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ cases: [{ executionCaseId: 'case1' }] });
    render(<ExecutionResourcesSurface />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się załadować');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByLabelText('Execution Case for resources')).toBeInTheDocument();
    expect(listExecutionCases).toHaveBeenCalledTimes(2);
  });

  it('loads Task projection by stable executionCaseId and opens preview with keyboard', async () => {
    render(<ExecutionWorkSurface />);
    fireEvent.change(await screen.findByLabelText('Execution Case for work'), {
      target: { value: 'case1' },
    });
    const row = (await screen.findByText('Validate')).closest('tr')!;
    fireEvent.click(row);
    fireEvent.keyDown(row.closest('div[tabindex="0"]')!, { key: 'Enter' });
    expect(screen.getAllByText('Otwarte').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('region', { name: 'Execution Work item workspace' })
    ).toBeInTheDocument();
    expect(readExecutionWork).toHaveBeenCalledWith('case1');
    expect(screen.getByRole('region', { name: 'Task milestone blast radius' })).toHaveTextContent(
      'Kamień · …estone-1 v4 · Zagrożony · Zablokowany'
    );
    expect(screen.getByText(/Odchylenie prognozy: NIEZNANA/)).toBeInTheDocument();
  });
  it('creates a canonical Milestone with exact Case and Handoff baseline versions', async () => {
    vi.mocked(createExecutionMilestone).mockResolvedValue({ response: {} });
    render(<ExecutionWorkSurface />);
    fireEvent.change(await screen.findByLabelText('Execution Case for work'), {
      target: { value: 'case1' },
    });
    await screen.findByText(/Pilot ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Nowy kamień milowy' }));
    fireEvent.change(screen.getByLabelText('Milestone id'), { target: { value: 'milestone-2' } });
    fireEvent.change(screen.getByLabelText('Milestone title'), { target: { value: 'Wave ready' } });
    fireEvent.change(screen.getByLabelText('Milestone ownerId'), { target: { value: 'owner-2' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Utwórz kamień milowy' }));
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
    render(<ExecutionResourcesSurface />);
    fireEvent.change(await screen.findByLabelText('Execution Case for resources'), {
      target: { value: 'case1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zaproponuj przydział' }));
    fireEvent.change(screen.getByLabelText('Operational Allocation proposal JSON'), {
      target: {
        value: JSON.stringify({
          timeBasis: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw', periods: [] },
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Symuluj' }));
    expect(await screen.findByText('EVIDENCE_MISSING')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('EVIDENCE_MISSING');
  });
  it('opens Allocation preview on single click and workspace on double click', async () => {
    render(<ExecutionResourcesSurface />);
    fireEvent.change(await screen.findByLabelText('Execution Case for resources'), {
      target: { value: 'case1' },
    });
    const row = (await screen.findByText('u1')).closest('tr');
    expect(row).toBeTruthy();
    fireEvent.click(row!);
    expect(screen.getByRole('button', { name: /^Otwórz przydział/ })).toBeInTheDocument();
    fireEvent.doubleClick(row!);
    expect(
      screen.getByRole('region', { name: 'Operational Allocation workspace' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Propozycja · u1/)).toBeInTheDocument();
    expect(screen.queryByText(/\bPROPOSED\b/)).not.toBeInTheDocument();
  });
});
