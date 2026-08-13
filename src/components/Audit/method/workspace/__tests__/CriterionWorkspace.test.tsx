/**
 * CriterionWorkspace — ekran roboczy audytora dla jednego kryterium.
 *
 * Mockuje `../workspaceApi` NA POZIOMIE MODUŁU (kształt serwera: funkcje
 * zwracają Promise<obiekt/tablica>, nie `window.fetch`) i `@/store/useAppStore`
 * (currentUser.id steruje segregacją obowiązków). Router jest PRAWDZIWY
 * (`MemoryRouter` + `Routes`/`Route` z `:programId`/`:criterionId`), bo
 * `CriterionWorkspace` czyta oba parametry przez `useParams`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockCurrentUserId = 'user-auditor';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { id: mockCurrentUserId, role: 'user' } }),
}));

vi.mock('../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../workspaceApi')>('../workspaceApi');
  return {
    ...actual,
    getCriterion: vi.fn(),
    getProgramMembers: vi.fn(),
    updateApplicability: vi.fn(),
    assignCriterion: vi.fn(),
    submitAuditeeResponse: vi.fn(),
    recordTest: vi.fn(),
    concludeCriterion: vi.fn(),
    listEvidence: vi.fn(),
    submitEvidence: vi.fn(),
    reviewEvidence: vi.fn(),
    listEvidenceRequests: vi.fn(),
    createEvidenceRequest: vi.fn(),
    listFindings: vi.fn(),
    getFinding: vi.fn(),
    createFinding: vi.fn(),
    reviewFinding: vi.fn(),
    submitManagementResponse: vi.fn(),
    acceptResidualRisk: vi.fn(),
    closeFinding: vi.fn(),
    updateFinding: vi.fn(),
    proposeAction: vi.fn(),
    approveAction: vi.fn(),
    reportImplementation: vi.fn(),
    planVerification: vi.fn(),
    performVerification: vi.fn(),
    createIntent: vi.fn(),
    getAiPreview: vi.fn(),
    decideProposal: vi.fn(),
    commitProposal: vi.fn(),
  };
});

import { CriterionWorkspace } from '../CriterionWorkspace';
import * as workspaceApi from '../workspaceApi';
import type { CriterionDetail, WorkspaceCriterion, WorkspaceProgramMember } from '../workspaceApi';

const mockedGetCriterion = vi.mocked(workspaceApi.getCriterion);
const mockedGetProgramMembers = vi.mocked(workspaceApi.getProgramMembers);
const mockedRecordTest = vi.mocked(workspaceApi.recordTest);
const mockedListEvidence = vi.mocked(workspaceApi.listEvidence);
const mockedListFindings = vi.mocked(workspaceApi.listFindings);

function baseCriterion(overrides: Partial<WorkspaceCriterion> = {}): WorkspaceCriterion {
  return {
    id: 'crit-1',
    programId: 'prog-1',
    organizationId: 'org-1',
    refCode: 'A.1',
    title: 'Access control policy exists',
    requirementText: 'The organization documents an access control policy.',
    sourceReference: 'ISO 27001 A.5.15',
    auditQuestion: 'Is there a documented access control policy?',
    expectedEvidence: [{ kind: 'document', description: 'Policy document', mandatory: true }],
    auditProcedure: 'Review the policy document',
    samplingGuidance: null,
    applicable: true,
    notApplicableReason: null,
    assignedAuditorId: null,
    assignedAuditeeId: null,
    auditeeResponse: null,
    auditeeRespondedBy: null,
    auditeeRespondedAt: null,
    procedurePerformed: null,
    sampleDescription: null,
    testPerformed: null,
    testResult: null,
    auditorNote: null,
    auditorConclusion: null,
    conformityStatus: 'not_tested',
    concludedBy: null,
    concludedAt: null,
    workStatus: 'open',
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function baseDetail(overrides: Partial<WorkspaceCriterion> = {}, evidence: CriterionDetail['evidence'] = []): CriterionDetail {
  return {
    criterion: baseCriterion(overrides),
    evidence,
    evidenceRequests: [],
    findings: [],
  };
}

function membersWithRole(userId: string, memberRole: WorkspaceProgramMember['memberRole']): WorkspaceProgramMember[] {
  return [{ userId, name: 'Test User', memberRole }];
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/audit-programs/method/prog-1/criteria/crit-1']}>
      <Routes>
        <Route path="/audit-programs/method/:programId/criteria/:criterionId" element={<CriterionWorkspace />} />
      </Routes>
    </MemoryRouter>
  );
}

const ALL_CHAIN_LINK_IDS = [
  'kryterium-zrodlo',
  'pytanie-audytowe',
  'oczekiwany-dowod',
  'dostarczony-dowod',
  'procedura-audytora',
  'proba',
  'wykonany-test',
  'wynik-testu',
  'wniosek-audytora',
  'status-zgodnosci',
  'ustalenie',
  'odpowiedz-wlasciciela',
  'korekcja',
  'przyczyna-zrodlowa',
  'dzialanie-korygujace',
  'wlasciciel-termin',
  'weryfikacja-skutecznosci',
  'zamkniecie',
];

describe('CriterionWorkspace', () => {
  beforeEach(() => {
    mockCurrentUserId = 'user-auditor';
    mockedListEvidence.mockResolvedValue([]);
    mockedListFindings.mockResolvedValue({ items: [], total: 0 });
    mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-auditor', 'auditor'));
  });

  it('renders all 18 chain links as separate, individually addressable sections', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail());
    renderWorkspace();

    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    for (const id of ALL_CHAIN_LINK_IDS) {
      expect(screen.getByTestId(`chain-link-${id}`)).toBeInTheDocument();
    }
    // Stepper renders the same 18 as distinct step chips too — the chain is
    // never collapsed into one blob.
    await waitFor(() => {
      for (const id of ALL_CHAIN_LINK_IDS) {
        expect(screen.getByTestId(`chain-step-${id}`)).toBeInTheDocument();
      }
    });
  });

  it('shows a reason, not a bare blockade, for an unreachable link', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail({ testResult: null }));
    renderWorkspace();

    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const conclusionSection = screen.getByTestId('chain-link-wniosek-audytora');
    expect(conclusionSection.textContent).toMatch(/wymaga wcześniej wykonanej procedury testowej/i);
  });

  it('does not offer "conclude" to the auditee who answered this criterion themselves', async () => {
    mockCurrentUserId = 'user-auditee';
    mockedGetProgramMembers.mockResolvedValue([
      { userId: 'user-auditee', name: 'Auditee', memberRole: 'auditee' },
      { userId: 'user-auditee', name: 'Auditee', memberRole: 'auditor' }, // dual-hatted — rule is unconditional
    ]);
    mockedGetCriterion.mockResolvedValue(
      baseDetail({ testResult: 'pass', auditeeRespondedBy: 'user-auditee' })
    );
    renderWorkspace();

    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const conformitySection = screen.getByTestId('chain-link-status-zgodnosci');
    expect(conformitySection.textContent).toMatch(/nie możesz wyciągnąć wniosku/i);
    expect(screen.queryByRole('button', { name: /wyciągnij wniosek/i })).not.toBeInTheDocument();
  });

  it('disables "conforming" as a conclusion when there is no accepted evidence', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail({ testResult: 'pass' }, []));
    renderWorkspace();

    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const select = (await screen.findByLabelText('Status zgodności')) as HTMLSelectElement;
    const conformingOption = Array.from(select.options).find((o) => o.value === 'conforming');
    expect(conformingOption?.disabled).toBe(true);
  });

  it('proposes "evidence_insufficient", never an automatic nonconformity, when there is no accepted evidence', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail({ testResult: 'pass' }, []));
    renderWorkspace();

    const select = (await screen.findByLabelText('Status zgodności')) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe('evidence_insufficient'));
    expect(select.value).not.toBe('nonconforming');
  });

  it('shows an ErrorState with a working retry when the criterion fails to load', async () => {
    mockedGetCriterion.mockRejectedValueOnce(new Error('boom'));
    mockedGetCriterion.mockResolvedValueOnce(baseDetail());
    renderWorkspace();

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    const retryButton = screen.getByRole('button', { name: /try again|retry|spróbuj/i });
    fireEvent.click(retryButton);

    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalledTimes(2));
  });

  it('shows a saving indicator and then a saved confirmation when recording a test', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail());
    let resolveRecordTest: (value: WorkspaceCriterion) => void = () => undefined;
    mockedRecordTest.mockReturnValue(
      new Promise((resolve) => {
        resolveRecordTest = resolve;
      })
    );
    renderWorkspace();

    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const testResultSelect = await screen.findByLabelText('Wynik testu');
    fireEvent.change(testResultSelect, { target: { value: 'pass' } });
    fireEvent.click(screen.getByRole('button', { name: /zapisz procedurę i wynik testu/i }));

    await waitFor(() => expect(screen.getByText('Saving…')).toBeInTheDocument());

    resolveRecordTest(baseCriterion({ testResult: 'pass' }));

    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });
});
