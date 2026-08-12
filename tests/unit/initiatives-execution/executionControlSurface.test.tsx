import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionControlSurface } from '../../../src/components/Execution/ExecutionControlSurface';
import {
  createMaterialChange,
  draftIntervention,
  ingestManagementSignal,
  listCapacityOptions,
  listInterventions,
  listManagementSignals,
  transitionIntervention,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  createMaterialChange: vi.fn(),
  draftIntervention: vi.fn(),
  ingestManagementSignal: vi.fn(),
  listCapacityOptions: vi.fn(),
  listInterventions: vi.fn(),
  listManagementSignals: vi.fn(),
  transitionIntervention: vi.fn(),
}));
const item = {
  version: 4,
  interventionId: 'int-1',
  status: 'VERIFICATION_DUE',
  ownerId: 'owner',
  authorityId: 'authority',
  slaAt: '2026-08-20',
  signalRefs: [{ signalId: 'sig-1', signalVersion: 2, fingerprint: 'fp' }],
  evidenceRefs: ['e1'],
  counterEvidenceRefs: ['c1'],
  unknowns: ['u1'],
  blastRadiusRefs: [{ ref: 'task-1', version: 3 }],
  options: [
    {
      optionId: 'nothing',
      kind: 'DO_NOTHING',
      label: 'Do nothing',
      impacts: [{ targetRef: 'task-1', effect: 'Delay remains' }],
      confidence: 'HIGH',
      reversibility: 'REVERSIBLE',
    },
  ],
};
const signal = {
  projectId: 'project-1',
  version: 2,
  signalId: 'sig-1',
  fingerprint: 'fp',
  ruleId: 'STALE_MILESTONE',
  sourceType: 'execution_milestone',
  sourceId: 'milestone-1',
  sourceVersions: { milestoneVersion: 4 },
  severity: 'CRITICAL',
  state: 'OPEN',
  occurrences: [
    {
      occurredAt: '2026-08-10T10:00:00.000Z',
      evidenceRef: 'snapshot:milestone-1:v4',
      sourceVersions: { milestoneVersion: 4 },
    },
    {
      occurredAt: '2026-08-10T11:00:00.000Z',
      evidenceRef: 'snapshot:milestone-1:v4:b',
      sourceVersions: { milestoneVersion: 4 },
    },
  ],
  updatedAt: '2026-08-10T11:00:00.000Z',
};
describe('ExecutionControlSurface', () => {
  beforeEach(() => {
    vi.mocked(listInterventions).mockResolvedValue({ items: [item] });
    vi.mocked(listManagementSignals).mockResolvedValue({ items: [signal] });
    vi.mocked(listCapacityOptions).mockResolvedValue({
      items: [
        {
          comparisonId: 'cmp-1',
          version: 2,
          planRef: { scenarioId: 'plan-1', version: 4 },
          selectedOptionId: 'resequence',
          options: [{ optionId: 'resequence', kind: 'RESEQUENCE' }],
        },
      ],
    });
    vi.mocked(createMaterialChange).mockResolvedValue({
      aggregateVersion: 1,
      response: {
        oldHash: 'old-hash',
        newHash: 'new-hash',
        governedInputRef: { comparisonId: 'cmp-1', comparisonVersion: 2, optionId: 'resequence' },
      },
    });
    vi.mocked(ingestManagementSignal).mockResolvedValue({ response: signal });
    vi.mocked(draftIntervention).mockResolvedValue({ response: item });
    vi.mocked(transitionIntervention).mockResolvedValue({
      response: { ...item, status: 'CLOSED', verification: { outcome: 'EFFECTIVE' } },
    });
  });
  it('keeps the register fail-closed and retries without losing the route', async () => {
    vi.mocked(listInterventions)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [item] });
    render(<ExecutionControlSurface />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się załadować');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByText(/Interwencja operacyjna/)).toBeInTheDocument();
    expect(listInterventions).toHaveBeenCalledTimes(2);
  });

  it('filters the visible projection and reports counts from the same canonical rows', async () => {
    const onCountsChange = vi.fn();
    render(<ExecutionControlSurface activePreset="critical" onCountsChange={onCountsChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj sygnał' }));
    await screen.findByText('sig-1');
    expect(screen.queryByText(/Interwencja operacyjna/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(onCountsChange).toHaveBeenCalledWith(
        expect.objectContaining({ critical: 1, resolved: 0 })
      )
    );
  });
  it('creates governed PLANNING_BASELINE change from the exact selected RESEQUENCE option', async () => {
    render(<ExecutionControlSurface />);
    await screen.findByText(/Interwencja operacyjna/);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj sygnał' }));
    const signalRow = (await screen.findByText('sig-1')).closest('tr')!;
    fireEvent.click(signalRow);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do przygotowywanej interwencji' }));
    fireEvent.click(screen.getByRole('button', { name: 'Przygotuj interwencję' }));
    await waitFor(() => expect(screen.queryByText('Sygnał zarządczy')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Przygotuj zmianę planu' }));
    fireEvent.change(screen.getByLabelText('Governed comparison'), { target: { value: 'cmp-1' } });
    for (const [label, value] of [
      ['proposalId', 'mc-1'],
      ['ownerId', 'planner'],
      ['authorityId', 'plan-authority'],
      ['policyRef', 'plan-policy'],
      ['oldSnapshot', '{"memberships":["a","b"]}'],
      ['newSnapshot', '{"memberships":["b","a"]}'],
    ])
      fireEvent.change(screen.getByLabelText(`Governed ${label}`), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz zarządzaną zmianę planu' }));
    await waitFor(() =>
      expect(createMaterialChange).toHaveBeenCalledWith(
        'mc-1',
        expect.objectContaining({
          target: {
            kind: 'PLANNING_BASELINE',
            aggregateType: 'plan_scenario',
            aggregateId: 'plan-1',
            version: 4,
          },
          governedInputRef: {
            kind: 'CAPACITY_OPTION',
            comparisonId: 'cmp-1',
            comparisonVersion: 2,
            optionId: 'resequence',
          },
          classification: 'MATERIAL',
        })
      )
    );
    expect(await screen.findByText(/Hash planu przed zmianą old-hash/)).toHaveTextContent(
      'po zmianie new-hash'
    );
  });
  it('ingests a deduplicated exact occurrence and guides a multi-signal Intervention draft', async () => {
    render(<ExecutionControlSurface />);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj sygnał' }));
    const signalRow = (await screen.findByText('sig-1')).closest('tr')!;
    fireEvent.click(signalRow);
    expect(screen.getByText(/snapshot:milestone-1:v4:b/)).toBeInTheDocument();
    expect(screen.getByText('Project project-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do przygotowywanej interwencji' }));
    fireEvent.click(screen.getByRole('button', { name: 'Przygotuj interwencję' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj sygnał' }));
    fireEvent.change(screen.getByLabelText('Management signal sourceId'), {
      target: { value: 'milestone-1' },
    });
    fireEvent.change(screen.getByLabelText('Management signal occurredAt'), {
      target: { value: '2026-08-10T12:00' },
    });
    fireEvent.change(screen.getByLabelText('Management signal snapshotRef'), {
      target: { value: 'snapshot:milestone-1:v4:c' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz sygnał' }));
    await waitFor(() =>
      expect(ingestManagementSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedVersion: 2,
          sourceType: 'execution_milestone',
          sourceId: 'milestone-1',
          sourceVersions: { milestoneVersion: 1 },
          evidenceRef: 'snapshot:milestone-1:v4:c',
        })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Przygotuj interwencję' }));
    for (const [label, value] of [
      ['interventionId', 'int-2'],
      ['ownerId', 'owner-2'],
      ['authorityId', 'authority-2'],
      ['slaAt', '2026-08-20T10:00'],
      ['hypotheses', 'Milestone source is stale'],
      ['evidenceRefs', 'snapshot:milestone-1:v4'],
      ['counterEvidenceRefs', 'counter:v1'],
      ['unknowns', 'supplier confirmation'],
      ['blastRadiusRefs', 'task-1@3'],
      ['doNothingImpacts', 'task-1|Delay remains'],
    ])
      fireEvent.change(screen.getByLabelText(`Intervention draft ${label}`), {
        target: { value },
      });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz lub połącz sprawę interwencyjną' }));
    await waitFor(() =>
      expect(draftIntervention).toHaveBeenCalledWith(
        'int-2',
        expect.objectContaining({
          expectedVersion: 0,
          signalRefs: [{ signalId: 'sig-1', signalVersion: 2, fingerprint: 'fp' }],
          blastRadiusRefs: [{ ref: 'task-1', version: 3 }],
          options: expect.arrayContaining([expect.objectContaining({ kind: 'DO_NOTHING' })]),
        })
      )
    );
  });
  it('opens stable Intervention ID by keyboard and closes only EFFECTIVE verification', async () => {
    render(<ExecutionControlSurface />);
    const row = (await screen.findByText(/Interwencja operacyjna/)).closest('tr')!;
    fireEvent.click(row);
    fireEvent.keyDown(row.closest('div[tabindex="0"]')!, { key: 'Enter' });
    expect(screen.getByText(/sig-1 v2/)).toBeInTheDocument();
    expect(screen.getByText(/DO_NOTHING: Do nothing/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj sygnał' }));
    const signalRow = (await screen.findByText('sig-1')).closest('tr')!;
    fireEvent.click(signalRow);
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do przygotowywanej interwencji' }));
    fireEvent.click(screen.getByRole('button', { name: 'Przygotuj interwencję' }));
    fireEvent.change(screen.getByLabelText('Intervention verification evidence'), {
      target: { value: 'measurement:v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zweryfikuj interwencję' }));
    await waitFor(() =>
      expect(transitionIntervention).toHaveBeenCalledWith(
        'int-1',
        expect.objectContaining({
          expectedVersion: 4,
          action: 'VERIFY',
          outcome: 'EFFECTIVE',
          evidenceRefs: ['measurement:v2'],
        })
      )
    );
    expect(await screen.findByText('Skuteczna · zamknięta')).toBeInTheDocument();
  });
});
