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
import type {
  WorkspaceCapability,
  WorkspaceCorrectiveAction,
  WorkspaceFindingDetail,
  WorkspaceVerification,
} from '../workspaceApi';
import * as workspaceApi from '../workspaceApi';

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
  f = finding(),
  nameForUser?: (userId: string | null | undefined) => string | null
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
      nameForUser={nameForUser}
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

  // Gap pack 2026-08-26 (item 5b): the "Właściciel / termin" link showed
  // the raw `ownerUserId` UUID instead of a name.
  it('without a nameForUser resolver, falls back to the raw ownerUserId (V1 caller, unaffected by this fix)', () => {
    renderPanel(['verification.perform'], 'user-reviewer');
    const ownerLink = screen.getByTestId('chain-link-wlasciciel-termin');
    expect(ownerLink.textContent).toContain('user-owner');
  });

  it('with a nameForUser resolver (V2 passes its existing member-name lookup), shows the resolved name instead of the raw UUID', () => {
    const nameForUser = vi.fn((userId: string | null | undefined) =>
      userId === 'user-owner' ? 'Marek Zieliński' : null
    );
    renderPanel(['verification.perform'], 'user-reviewer', finding(), nameForUser);
    const ownerLink = screen.getByTestId('chain-link-wlasciciel-termin');
    expect(ownerLink.textContent).toContain('Marek Zieliński');
    expect(ownerLink.textContent).not.toContain('user-owner');
  });

  it('falls back to the raw UUID if the resolver has no name for that user (e.g. a since-removed member)', () => {
    const nameForUser = vi.fn(() => null);
    renderPanel(['verification.perform'], 'user-reviewer', finding(), nameForUser);
    const ownerLink = screen.getByTestId('chain-link-wlasciciel-termin');
    expect(ownerLink.textContent).toContain('user-owner');
  });

  it('gates "close finding" on the finding.close capability, with a visible reason', () => {
    renderPanel(['verification.perform'], 'user-independent');
    expect(screen.queryByRole('button', { name: /zamknij ustalenie/i })).not.toBeInTheDocument();
    const closureSection = screen.getByTestId('chain-link-zamkniecie');
    expect(closureSection.textContent).toMatch(/wymaga roli lead auditor/i);
  });
});
