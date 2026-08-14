/**
 * RemediationPanel — ogniwa „korekcja" → … → „zamknięcie". Mockuje
 * `../workspaceApi` NA POZIOMIE MODUŁU.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../workspaceApi')>('../workspaceApi');
  return {
    ...actual,
    proposeAction: vi.fn(),
    approveAction: vi.fn(),
    reportImplementation: vi.fn(),
    planVerification: vi.fn(),
    performVerification: vi.fn(),
    closeFinding: vi.fn(),
    updateFinding: vi.fn(),
  };
});

import { RemediationPanel } from '../RemediationPanel';
import * as workspaceApi from '../workspaceApi';
import type {
  WorkspaceCapability,
  WorkspaceCorrectiveAction,
  WorkspaceFindingDetail,
  WorkspaceVerification,
} from '../workspaceApi';

const mockedPerformVerification = vi.mocked(workspaceApi.performVerification);

function action(overrides: Partial<WorkspaceCorrectiveAction> = {}): WorkspaceCorrectiveAction {
  return {
    id: 'action-1',
    findingId: 'finding-1',
    actionKind: 'corrective_action',
    title: 'Introduce dual-approval workflow',
    description: null,
    ownerUserId: 'user-owner',
    dueDate: '2026-09-01',
    status: 'implemented',
    approvedBy: 'user-lead',
    implementedAt: '2026-08-10T00:00:00Z',
    implementedBy: 'user-owner',
    createdBy: 'user-lead',
    ...overrides,
  };
}

function verification(overrides: Partial<WorkspaceVerification> = {}): WorkspaceVerification {
  return {
    id: 'verification-1',
    correctiveActionId: 'action-1',
    findingId: 'finding-1',
    verificationKind: 'effectiveness',
    performedAt: null,
    performedBy: null,
    evidenceId: null,
    result: null,
    note: null,
    ...overrides,
  };
}

function finding(overrides: Partial<WorkspaceFindingDetail> = {}): WorkspaceFindingDetail {
  return {
    id: 'finding-1',
    programId: 'prog-1',
    criterionId: 'crit-1',
    referenceCode: 'F-1',
    statement: 'Missing dual approval',
    requirementText: null,
    conditionText: null,
    gapText: null,
    objectiveEvidence: [],
    contradictingEvidence: [],
    classification: 'nonconforming',
    severity: 'medium',
    recommendation: null,
    rootCause: null,
    rootCauseMethod: null,
    rootCauseConfirmed: false,
    status: 'remediation_in_progress',
    ownerUserId: null,
    authorId: 'user-author',
    reviewedBy: null,
    aiProposed: false,
    residualRisk: null,
    residualRiskNote: null,
    closedAt: null,
    closureNote: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    managementResponses: [],
    correctiveActions: [action()],
    verifications: [verification()],
    ...overrides,
  };
}

function renderPanel(
  capabilities: WorkspaceCapability[],
  currentUserId: string | null,
  f = finding()
) {
  const onChanged = vi.fn();
  const utils = render(
    <RemediationPanel
      programId="prog-1"
      isPolish
      capabilities={new Set(capabilities)}
      currentUserId={currentUserId}
      finding={f}
      onChanged={onChanged}
    />
  );
  return { ...utils, onChanged };
}

describe('RemediationPanel', () => {
  it('renders korekcja/przyczyna-zrodlowa/dzialanie-korygujace/wlasciciel-termin/weryfikacja-skutecznosci/zamkniecie as separate sections', () => {
    renderPanel(['verification.perform'], 'user-reviewer');
    for (const id of [
      'korekcja',
      'przyczyna-zrodlowa',
      'dzialanie-korygujace',
      'wlasciciel-termin',
      'weryfikacja-skutecznosci',
      'zamkniecie',
    ]) {
      expect(screen.getByTestId(`chain-link-${id}`)).toBeInTheDocument();
    }
  });

  it('does not let the action owner confirm the effectiveness of their own action', () => {
    // action().ownerUserId === 'user-owner' and implementedBy === 'user-owner'
    renderPanel(['verification.perform'], 'user-owner');
    expect(
      screen.queryByRole('button', { name: /potwierdź skuteczność/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/nie możesz sam potwierdzić skuteczności własnego działania/i)
    ).toBeInTheDocument();
  });

  it('lets an independent verifier confirm effectiveness', async () => {
    mockedPerformVerification.mockResolvedValue(
      verification({ performedAt: '2026-08-11T00:00:00Z', result: 'effective' })
    );
    renderPanel(['verification.perform'], 'user-independent');

    const confirmButton = await screen.findByRole('button', { name: /potwierdź skuteczność/i });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(mockedPerformVerification).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({ result: 'effective' })
      )
    );
  });

  it('gates "close finding" on the finding.close capability, with a visible reason', () => {
    renderPanel(['verification.perform'], 'user-independent');
    expect(screen.queryByRole('button', { name: /zamknij ustalenie/i })).not.toBeInTheDocument();
    const closureSection = screen.getByTestId('chain-link-zamkniecie');
    expect(closureSection.textContent).toMatch(/wymaga roli lead auditor/i);
  });
});
