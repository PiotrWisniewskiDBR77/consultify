import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EffectivenessClosureQueue } from '../../../src/components/MyWork/EffectivenessClosureQueue';
import {
  archiveClosedInitiative,
  createEffectivenessCase,
  createFinanceReconciliation,
  createResultsKpiObservation,
  getEffectivenessSnapshot,
  listArchiveManifests,
  listEffectivenessCases,
  listMyEffectivenessWork,
  listResultsKpiObservations,
  readRegisteredInitiative,
  transitionEffectiveness,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  archiveClosedInitiative: vi.fn(),
  createEffectivenessCase: vi.fn(),
  createFinanceReconciliation: vi.fn(),
  createResultsKpiObservation: vi.fn(),
  getEffectivenessSnapshot: vi.fn(),
  listArchiveManifests: vi.fn(),
  listEffectivenessCases: vi.fn(),
  listMyEffectivenessWork: vi.fn(),
  listResultsKpiObservations: vi.fn(),
  readRegisteredInitiative: vi.fn(),
  transitionEffectiveness: vi.fn(),
}));
const base = {
  initiativeId: 'init-1',
  executionCaseId: 'case-1',
  benefitsHandoffPackRef: { packId: 'pack-1', version: 2 },
  resultsAcceptanceRef: { resultsCaseId: 'results-1', version: 3 },
  benefitOwnerId: 'owner',
  reviewerId: 'reviewer',
  closureAuthorityId: 'closer',
  measurements: [
    {
      measurementId: 'm-1',
      contractRef: { ref: 'kpi-1', version: 4 },
      sourceRef: { ref: 'source-1', version: 2 },
      baseline: null,
      current: null,
      target: null,
      formula: 'revenue-cost',
      unit: 'PLN',
      currency: 'PLN',
      window: { start: '2026-01-01', end: '2026-06-30' },
      confidence: 'UNKNOWN',
      knowledgeState: 'UNKNOWN',
      asOf: '2026-07-01',
      evidenceRefs: [],
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listMyEffectivenessWork).mockResolvedValue({
    items: [
      {
        ...base,
        version: 5,
        effectivenessCaseId: 'eff-review',
        status: 'PENDING_REVIEW',
        closureSnapshotId: null,
      },
    ],
  });
  vi.mocked(listResultsKpiObservations).mockResolvedValue({
    items: [
      {
        observationId: 'obs-1',
        version: 2,
        measurementState: 'NOT_MEASURED',
        observedValue: null,
        knowledgeState: 'UNKNOWN',
        financeReconciliationRef: null,
      },
    ],
  });
  vi.mocked(createFinanceReconciliation).mockResolvedValue({ response: {} });
  vi.mocked(createResultsKpiObservation).mockResolvedValue({ response: {} });
  vi.mocked(createEffectivenessCase).mockResolvedValue({ response: {} });
  vi.mocked(listEffectivenessCases).mockResolvedValue({
    items: [
      {
        ...base,
        version: 6,
        effectivenessCaseId: 'eff-closed',
        status: 'CLOSED',
        closureSnapshotId: 'snap-1',
      },
    ],
  });
  vi.mocked(readRegisteredInitiative).mockResolvedValue({ version: 12 });
  vi.mocked(transitionEffectiveness).mockResolvedValue({
    response: { ...base, status: 'REVIEWED', reviewOutcome: 'CONFIRMED' },
  });
  vi.mocked(getEffectivenessSnapshot).mockResolvedValue({
    snapshotId: 'effectiveness-eff-review-v5',
    effectivenessCaseId: 'eff-review',
    outcome: 'CONFIRMED',
  });
  vi.mocked(archiveClosedInitiative).mockResolvedValue({});
  vi.mocked(listArchiveManifests).mockResolvedValue({
    items: [
      {
        archiveId: 'archive-init-1',
        initiativeId: 'init-1',
        retentionPolicyRef: { ref: 'ret-1', version: 1 },
        exportRefs: [{ ref: 'export-1', version: 1 }],
      },
    ],
  });
});
describe('EffectivenessClosureQueue', () => {
  it('forces NOT_MEASURED to null and UNKNOWN and creates Effectiveness from exact observation refs only', async () => {
    render(<EffectivenessClosureQueue />);
    fireEvent.change(await screen.findByLabelText('Results KPI observation ID'), {
      target: { value: 'obs-2' },
    });
    fireEvent.change(screen.getByLabelText('Results KPI observation contract JSON'), {
      target: {
        value: JSON.stringify({
          measurementState: 'NOT_MEASURED',
          observedValue: 99,
          knowledgeState: 'KNOWN',
          confidence: 'HIGH',
          financeReconciliationRef: { reconciliationId: 'fake', version: 1 },
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Results KPI observation' }));
    await waitFor(() =>
      expect(createResultsKpiObservation).toHaveBeenCalledWith(
        'obs-2',
        expect.objectContaining({
          measurementState: 'NOT_MEASURED',
          observedValue: null,
          knowledgeState: 'UNKNOWN',
          confidence: 'UNKNOWN',
          financeReconciliationRef: null,
        })
      )
    );
    fireEvent.click(screen.getByLabelText('Select observation obs-1'));
    fireEvent.change(screen.getByLabelText('Effectiveness Case ID'), {
      target: { value: 'effect-new' },
    });
    fireEvent.change(screen.getByLabelText('Effectiveness Case contract JSON'), {
      target: { value: JSON.stringify({ initiativeId: 'init-1' }) },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create with selected exact observations' })
    );
    await waitFor(() =>
      expect(createEffectivenessCase).toHaveBeenCalledWith(
        'effect-new',
        expect.objectContaining({
          observationRefs: [{ observationId: 'obs-1', version: 2 }],
        })
      )
    );
  });
  it('shows UNKNOWN and creates immutable canonical Effectiveness Snapshot without direct close', async () => {
    render(<EffectivenessClosureQueue />);
    fireEvent.click((await screen.findByText('eff-review')).closest('tr')!);
    expect(
      screen.getByText(/Baseline UNKNOWN · current UNKNOWN · target UNKNOWN/)
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Effectiveness rationale'), {
      target: { value: 'Independent effectiveness review' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMED' }));
    await waitFor(() =>
      expect(transitionEffectiveness).toHaveBeenCalledWith(
        'eff-review',
        expect.objectContaining({
          expectedVersion: 5,
          expectedInitiativeVersion: 12,
          snapshotId: 'effectiveness-eff-review-v5',
          outcome: 'CONFIRMED',
        })
      )
    );
    expect(
      await screen.findByText(
        /Effectiveness Snapshot effectiveness-eff-review-v5 · CONFIRMED · lifecycle EFFECTIVENESS_REVIEWED/
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close effective/i })).not.toBeInTheDocument();
  });
  it('fails closed on legal hold and creates a separate read-only Archive Manifest', async () => {
    render(<EffectivenessClosureQueue />);
    fireEvent.click((await screen.findByText('eff-closed')).closest('tr')!);
    fireEvent.click(screen.getByLabelText('Legal hold'));
    expect(screen.getByRole('button', { name: 'Create Archive Manifest' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Archive blocked');
    fireEvent.click(screen.getByLabelText('Legal hold'));
    fireEvent.change(screen.getByLabelText('Retention policy ref'), { target: { value: 'ret-1' } });
    fireEvent.change(screen.getByLabelText('Archive export ref'), {
      target: { value: 'export-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Archive Manifest' }));
    await waitFor(() =>
      expect(archiveClosedInitiative).toHaveBeenCalledWith(
        'archive-init-1',
        expect.objectContaining({
          legalHold: false,
          closureSnapshotRef: { snapshotId: 'snap-1', version: 1 },
          retentionPolicyRef: { ref: 'ret-1', version: 1 },
          exportRefs: [{ ref: 'export-1', version: 1 }],
        })
      )
    );
    expect(
      await screen.findByText(/Archive Manifest archive-init-1 · read-only/)
    ).toBeInTheDocument();
  });
});
