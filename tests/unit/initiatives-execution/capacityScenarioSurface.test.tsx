import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CapacityScenarioSurface } from '../../../src/components/Initiatives/CapacityScenarioSurface';
import {
  listCapacityScenarioRegister,
  listCapacityOptions,
  readCapacityScenario,
  requestResourceCommitment,
  selectCapacityOption,
  writeCapacityScenario,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  listCapacityScenarioRegister: vi.fn(),
  listCapacityOptions: vi.fn(),
  readCapacityScenario: vi.fn(),
  writeCapacityScenario: vi.fn(),
  requestResourceCommitment: vi.fn(),
  acceptResourceCommitment: vi.fn(),
  decideResourceCommitment: vi.fn(),
  selectCapacityOption: vi.fn(),
}));
const range = {
  knowledgeState: 'UNKNOWN',
  low: null,
  base: null,
  high: null,
  sourceRef: null,
  sourceVersion: null,
  asOf: '2026-08-10T00:00:00.000Z',
  confidence: 'UNKNOWN',
  ownerId: '05000000-0000-4000-8000-000000000012',
  reason: 'No evidence',
};
describe('CapacityScenarioSurface', () => {
  beforeEach(() => {
    vi.mocked(listCapacityScenarioRegister).mockResolvedValue({
      scenarios: [
        {
          id: 'cap-1',
          name: 'Q4 load',
          state: 'PUBLISHED',
          version: 2,
          planRef: { scenarioId: 'plan-1', scenarioVersion: 4 },
          window: { start: '2026-10-01', end: '2026-12-31' },
          unit: { windowUnit: 'WEEK', timezone: 'Europe/Warsaw' },
          updatedAt: '2026-08-10',
          knowledgeSummary: { known: 0, estimated: 0, unknown: 2, unconfirmed: 0 },
        },
      ],
    });
    vi.mocked(readCapacityScenario).mockResolvedValue({
      version: 3,
      scenario: {
        scenarioId: 'cap-1',
        scenarioVersion: 2,
        status: 'PUBLISHED',
        planScenarioId: 'plan-1',
        planScenarioVersion: 4,
        windowUnit: 'WEEK',
        timezone: 'Europe/Warsaw',
        periods: [
          {
            periodId: 'p1',
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-10-08T00:00:00.000Z',
            demand: range,
            supply: range,
          },
        ],
        constraints: [],
        proposedAssignments: [
          {
            assignmentId: 'a1',
            initiativeId: 'i1',
            resourceOrRoleId: 'role1',
            periodIds: ['p1'],
            demand: range,
            rationale: 'proposal',
          },
        ],
        createdBy: 'x',
        updatedBy: 'x',
        publishedBy: 'x',
        publishedAt: '2026-08-10',
      },
    });
    const impact = (unit: string, knowledgeState: 'ESTIMATED' | 'UNKNOWN' = 'ESTIMATED') => ({
      knowledgeState,
      low: knowledgeState === 'UNKNOWN' ? null : 1,
      base: knowledgeState === 'UNKNOWN' ? null : 2,
      high: knowledgeState === 'UNKNOWN' ? null : 3,
      unit,
      confidence: knowledgeState === 'UNKNOWN' ? 'UNKNOWN' : 'MEDIUM',
      sourceRefs: knowledgeState === 'UNKNOWN' ? [] : [{ ref: `capacity:${unit}`, version: 2 }],
    });
    const option = (optionId: string, kind: string) => ({
      optionId,
      kind,
      assumptions: [
        {
          assumption: `${kind} assumption`,
          ownerId: 'capacity-owner',
          sourceRef: { ref: `assumption:${kind}`, version: 1 },
          knowledgeState: 'ESTIMATED',
        },
      ],
      affectedMemberships: [{ initiativeId: 'i1', membershipVersion: 4 }],
      affectedPeriods: ['p1'],
      affectedResources: [{ resourceRef: 'role:controls', version: 3 }],
      impact: {
        date: impact('days'),
        scope: impact('deliverables'),
        cost: impact('PLN', kind === 'SCOPE_SPLIT' ? 'UNKNOWN' : 'ESTIMATED'),
        risk: impact('points'),
      },
      rationale: `${kind} rationale`,
    });
    vi.mocked(listCapacityOptions).mockResolvedValue({
      items: [
        {
          version: 1,
          comparisonId: 'compare-1',
          planRef: { scenarioId: 'plan-1', version: 4 },
          capacityRef: { scenarioId: 'cap-1', version: 3 },
          status: 'DRAFT',
          options: [
            option('opt-resequence', 'RESEQUENCE'),
            option('opt-split', 'SCOPE_SPLIT'),
            option('opt-add', 'ADD_CAPACITY'),
          ],
          selectedOptionId: null,
          nextGovernedInput: null,
        },
      ],
    });
    vi.mocked(requestResourceCommitment).mockResolvedValue({ status: 'APPLIED' });
    vi.mocked(selectCapacityOption).mockResolvedValue({ status: 'APPLIED' });
  });
  it('opens persistent register by keyboard and keeps UNKNOWN non-numeric', async () => {
    render(<CapacityScenarioSurface />);
    const row = (await screen.findByText('p1')).closest('tr')!;
    expect(screen.getAllByText('Właściciel zasobów').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(range.ownerId)).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(screen.getByText('Stan obciążenia i dowodów')).toBeInTheDocument();
    const layout = row.closest('div[tabindex="0"]')!;
    fireEvent.keyDown(layout, { key: 'Enter' });
    expect(
      await screen.findByRole('region', { name: 'Capacity Scenario Workbench' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Otwórz narzędzia obciążenia' })).toHaveLength(1);
    expect(
      screen.getAllByText('UNKNOWN — brak potwierdzonej wartości').length
    ).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByText(/role1 · okresy p1/));
    fireEvent.click(screen.getByRole('button', { name: 'Zarządzaj zobowiązaniem' }));
    fireEvent.change(screen.getByLabelText('Capacity commitmentId'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('Capacity resourceManagerId'), {
      target: { value: 'rm' },
    });
    fireEvent.change(screen.getByLabelText('Capacity assigneeId'), { target: { value: 'u1' } });
    fireEvent.change(screen.getByLabelText('Capacity expiresAt'), {
      target: { value: '2026-08-20T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request commitment' }));
    await waitFor(() =>
      expect(requestResourceCommitment).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          capacityScenarioId: 'cap-1',
          capacityScenarioVersion: 2,
          assignmentId: 'a1',
          initiativeId: 'i1',
        })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij narzędzia obciążenia' }));
    expect(screen.queryByRole('region', { name: 'Capacity Scenario Workbench' })).toBeNull();
  });
  it('compares exactly three evidence-rich options and selects only a governed next input', async () => {
    render(<CapacityScenarioSurface />);
    fireEvent.doubleClick((await screen.findByText('p1')).closest('tr')!);
    expect(
      await screen.findByRole('region', { name: 'Capacity options comparison' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Opcja obciążenia: Zmień kolejność' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Opcja obciążenia: Podziel zakres' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Opcja obciążenia: Zwiększ dostępność' })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Opcja obciążenia: Podziel zakres' })).getByText(
        'UNKNOWN — brak potwierdzonej wartości'
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/assumption:SCOPE_SPLIT v1/)).toBeInTheDocument();
    expect(screen.getAllByText(/Inicjatywy: i1 v4/)).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Capacity governed next input'), {
      target: { value: 'SCHEDULE_DECISION' },
    });
    fireEvent.click(
      screen
        .getByRole('region', { name: 'Opcja obciążenia: Zwiększ dostępność' })
        .querySelector('button')!
    );
    await waitFor(() =>
      expect(selectCapacityOption).toHaveBeenCalledWith(
        'compare-1',
        expect.objectContaining({
          expectedVersion: 1,
          optionId: 'opt-add',
          nextKind: 'SCHEDULE_DECISION',
        })
      )
    );
    expect(writeCapacityScenario).not.toHaveBeenCalled();
  });
});
