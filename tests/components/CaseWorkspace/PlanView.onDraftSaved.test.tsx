/**
 * Regression test for the plan-edit state loop fix (commit cf709284d2,
 * packet Q1 2026-08-12).
 *
 * BUG: `PlanView` saved a draft edit into its own local state, but had no
 * way to tell `CaseDetailScreen` (the owner of `bundle`, which holds the
 * plan version used as `expectedVersion` for Zaproponuj/Publikuj) that a
 * newer version now exists on the server. Clicking Zaproponuj/Publikuj
 * immediately after a save sent a stale `expectedVersion` and got a 409 —
 * safely (no corruption), but the user saw an error where nothing was
 * broken.
 *
 * FIX: `PlanView` now accepts an optional `onDraftSaved` callback and fires
 * it once, after a CONFIRMED successful save — never on failure. This test
 * asserts exactly that contract at the `PlanView` boundary.
 *
 * SCOPE NOTE: this is a component-level test of `PlanView` alone, not a
 * full mount of `CaseDetailScreen` (2000 lines, heavy routing/API
 * dependencies — a full integration mount was judged too brittle for this
 * regression test). It does NOT assert that `CaseDetailScreen` actually
 * refetches `bundle` when the callback fires — that half of the fix
 * (`tokenPrzeladowania` in the effect dependency array) is proven by the
 * live runtime browser sequence in the Q1 evidence directory, not here.
 * What this test DOES assert, and what breaks if the wiring in
 * `PlanView.tsx` is removed: `onDraftSaved` fires exactly once after a
 * successful save, and never fires after a failed (e.g. conflicted) save.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { CanonicalGraph, CaseCoreView, CasePlanVersion } from '@/components/CaseWorkspace/types';

const { updatePlanDraftMock } = vi.hoisted(() => ({
  updatePlanDraftMock: vi.fn(),
}));

vi.mock('@/components/CaseWorkspace/api', () => ({
  updatePlanDraft: updatePlanDraftMock,
  getPlanVersion: vi.fn(),
}));

import { PlanView } from '@/components/CaseWorkspace/PlanView';

function makeGraph(label: string): CanonicalGraph {
  return {
    entryNodeIds: ['n1'],
    terminalNodeIds: ['n1'],
    nodes: [{ nodeId: 'n1', type: 'TASK', metadata: { label } }],
    edges: [],
  };
}

function makePlanVersion(overrides: Partial<CasePlanVersion> = {}): CasePlanVersion {
  const graph = makeGraph('Krok pierwszy');
  return {
    casePlanVersionId: 'planv-test-1',
    caseId: 'case-test-1',
    planNumber: 1,
    status: 'DRAFT',
    semanticGraph: graph,
    graphDigest: 'digest-1',
    changeReason: null,
    publishedAt: null,
    createdByActorId: 'actor-1',
    version: 1,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}

const caseItem: CaseCoreView = {
  caseId: 'case-test-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
  caseName: 'Test case',
  caseProfile: 'LIGHT',
  governanceTier: 'LIGHTWEIGHT',
  autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
  autonomyPolicyRef: null,
  caseStatus: 'DRAFT',
  contractedClosureType: 'DELIVERY_COMPLETED',
  deliveryStatus: 'PENDING',
  decisionStatus: 'NOT_APPLICABLE',
  implementationStatus: 'NOT_APPLICABLE',
  outcomeStatus: 'NOT_APPLICABLE',
  closureType: null,
  closedAt: null,
  closedByActorId: null,
  closureEvidenceRef: null,
  sponsorUserId: null,
  acceptanceCriteriaRef: null,
  budgetPolicyRef: null,
  currentPlanVersionId: 'planv-test-1',
  createdByActorId: 'actor-1',
  version: 1,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  completedAt: null,
  projectName: 'Test project',
  projectDescription: null,
  projectOwnerId: null,
};

function renderPlan(onDraftSaved: () => void, planVersion = makePlanVersion()) {
  return render(
    <PlanView
      caseItem={caseItem}
      planVersion={planVersion}
      graph={planVersion.semanticGraph}
      validation={null}
      projection="prosty"
      selectedNodeId={null}
      onSelectNode={() => {}}
      onDraftSaved={onDraftSaved}
    />
  );
}

async function enterEditModeAndChangeLabel(newLabel: string) {
  fireEvent.click(screen.getByTestId('plan-edytuj'));
  const input = await screen.findByDisplayValue('Krok pierwszy');
  fireEvent.change(input, { target: { value: newLabel } });
}

describe('PlanView onDraftSaved callback (plan-edit state loop fix, cf709284d2)', () => {
  beforeEach(() => {
    updatePlanDraftMock.mockReset();
  });

  it('fires onDraftSaved exactly once after a CONFIRMED successful save', async () => {
    const savedVersion = makePlanVersion({ version: 2, semanticGraph: makeGraph('Krok pierwszy — zmieniony') });
    updatePlanDraftMock.mockResolvedValue({
      ok: true,
      value: savedVersion,
      readback: 'confirmed',
      idempotencyKey: 'key-1',
    });

    const onDraftSaved = vi.fn();
    renderPlan(onDraftSaved);

    await enterEditModeAndChangeLabel('Krok pierwszy — zmieniony');
    fireEvent.click(screen.getByTestId('plan-zapisz'));

    await waitFor(() => expect(updatePlanDraftMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onDraftSaved).toHaveBeenCalledTimes(1));

    // Sent expectedVersion is the version PlanView held BEFORE this save —
    // exactly the field that goes stale without the fix.
    expect(updatePlanDraftMock).toHaveBeenCalledWith(
      'planv-test-1',
      expect.objectContaining({ expectedVersion: 1 })
    );
  });

  it('does NOT fire onDraftSaved when the save is rejected (e.g. a genuine version conflict)', async () => {
    updatePlanDraftMock.mockResolvedValue({
      ok: false,
      failure: {
        kind: 'conflict',
        message:
          'Stan na serwerze jest inny niż na ekranie — ktoś zmienił to w międzyczasie albo obiekt jest w innym stanie. Nic nie zostało zmienione. Odśwież dane i zdecyduj ponownie.',
        refreshSuggested: true,
      },
      idempotencyKey: 'key-2',
    });

    const onDraftSaved = vi.fn();
    renderPlan(onDraftSaved);

    await enterEditModeAndChangeLabel('Krok pierwszy — będzie konflikt');
    fireEvent.click(screen.getByTestId('plan-zapisz'));

    await waitFor(() => expect(updatePlanDraftMock).toHaveBeenCalledTimes(1));
    // Give the rejected-save branch a tick to run before asserting the negative.
    await screen.findByText(/Odśwież dane i zdecyduj ponownie/);

    expect(onDraftSaved).not.toHaveBeenCalled();
  });
});
