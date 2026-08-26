/**
 * CriterionWorkspaceV2 — SPEC-A reshell (DEC-88). Same mocking pattern as
 * `../../__tests__/CriterionWorkspace.test.tsx` (module-level `../../workspaceApi`
 * mock + real `MemoryRouter`, since the component reads `programId`/
 * `criterionId` via `useParams`) plus `../../auditsMethodApi` (program/
 * sibling-criteria/reports/proposals — new in V2) and `currentOrganization`
 * on the store mock (new in V2's Properties panel).
 *
 * Scope: shell/composition only — the 18-link state machine itself is
 * covered by `chainLinks.ts` consumers (`CriterionWorkspace.test.tsx`); this
 * file asserts the V2-SPECIFIC contract: 4 phase cards grouping the 18 links
 * correctly, ArtifactRightPanel section order/defaults, and the primary
 * button never claiming to perform a step it cannot actually submit.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockCurrentUserId = 'user-lead';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentUser: { id: mockCurrentUserId, role: 'user' },
      currentOrganization: { id: 'org-1', name: 'Metalpol Sp. z o.o.' },
    }),
}));

vi.mock('../../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../../workspaceApi')>('../../workspaceApi');
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
    getEntityHistory: vi.fn(),
  };
});

vi.mock('../../../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../../../auditsMethodApi')>('../../../auditsMethodApi');
  return {
    ...actual,
    getProgram: vi.fn(),
    listProgramCriteria: vi.fn(),
    listReports: vi.fn(),
    listProposals: vi.fn(),
  };
});

import { CriterionWorkspaceV2 } from '../CriterionWorkspaceV2';
import * as auditsMethodApi from '../../../auditsMethodApi';
import * as workspaceApi from '../../workspaceApi';
import type { CriterionDetail, WorkspaceCriterion, WorkspaceProgramMember } from '../../workspaceApi';

const mockedGetCriterion = vi.mocked(workspaceApi.getCriterion);
const mockedGetProgramMembers = vi.mocked(workspaceApi.getProgramMembers);
const mockedListEvidence = vi.mocked(workspaceApi.listEvidence);
const mockedListFindings = vi.mocked(workspaceApi.listFindings);
const mockedGetEntityHistory = vi.mocked(workspaceApi.getEntityHistory);
const mockedGetProgram = vi.mocked(auditsMethodApi.getProgram);
const mockedListProgramCriteria = vi.mocked(auditsMethodApi.listProgramCriteria);
const mockedListReports = vi.mocked(auditsMethodApi.listReports);
const mockedListProposals = vi.mocked(auditsMethodApi.listProposals);

function baseCriterion(overrides: Partial<WorkspaceCriterion> = {}): WorkspaceCriterion {
  return {
    id: 'crit-1',
    programId: 'prog-1',
    organizationId: 'org-1',
    refCode: 'ZAK-8.4.1',
    title: 'Kwalifikacja i ocena okresowa dostawców krytycznych',
    requirementText: 'Ocena okresowa dostawców krytycznych nie rzadziej niż raz w roku.',
    sourceReference: 'ISO 9001:2015, pkt 8.4.1',
    auditQuestion: 'Czy każdy dostawca klasy A ma aktualną ocenę okresową?',
    expectedEvidence: [{ kind: 'document', description: 'Karty oceny okresowej', mandatory: true }],
    auditProcedure: 'Porównanie AVL z rejestrem ocen',
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

function baseDetail(
  overrides: Partial<WorkspaceCriterion> = {},
  evidence: CriterionDetail['evidence'] = [],
  findings: CriterionDetail['findings'] = []
): CriterionDetail {
  return {
    criterion: baseCriterion(overrides),
    evidence,
    evidenceRequests: [],
    findings,
  };
}

function membersWithRole(userId: string, memberRole: WorkspaceProgramMember['memberRole']): WorkspaceProgramMember[] {
  return [{ userId, name: 'Piotr Wiśniewski', memberRole }];
}

function renderV2() {
  return render(
    <MemoryRouter initialEntries={['/audit-programs/prog-1/criteria/crit-1']}>
      <Routes>
        <Route path="/audit-programs/:programId/criteria/:criterionId" element={<CriterionWorkspaceV2 />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CriterionWorkspaceV2', () => {
  beforeEach(() => {
    mockCurrentUserId = 'user-lead';
    mockedListEvidence.mockResolvedValue([]);
    mockedListFindings.mockResolvedValue({ items: [], total: 0 });
    mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-lead', 'lead_auditor'));
    mockedGetEntityHistory.mockResolvedValue([]);
    mockedGetProgram.mockResolvedValue({
      id: 'prog-1',
      name: 'Audyt wewnętrzny 2026/Q3 — proces zakupowy',
      packId: 'pack-1',
      packTitle: 'ISO 9001',
      packVersion: 4,
      lifecycleState: 'fieldwork',
      applicableCriteria: 24,
      concludedCriteria: 9,
      openFindings: 6,
      leadAuditorId: 'user-lead',
      leadAuditorName: 'Piotr Wiśniewski',
      plannedStart: null,
      plannedEnd: null,
      updatedAt: '2026-08-21T00:00:00Z',
      objective: null,
      scopeText: null,
      projectId: null,
      members: [],
    });
    mockedListProgramCriteria.mockResolvedValue([]);
    mockedListReports.mockResolvedValue({ items: [], total: 0 });
    mockedListProposals.mockResolvedValue({ items: [], total: 0 });
  });

  it('groups the 18-link chain into exactly 4 phase cards, in order, with correct done/total counts', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail());
    renderV2();

    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const phaseIds = ['planowanie', 'badanie', 'ustalenia', 'naprawa'];
    for (const id of phaseIds) {
      expect(await screen.findByTestId(`v2-phase-${id}`)).toBeInTheDocument();
    }
    // DOM order matches the DEC-88 phase order (Planowanie → Badanie →
    // Ustalenia → Naprawa i zamknięcie), not just presence.
    const cards = phaseIds.map((id) => screen.getByTestId(`v2-phase-${id}`));
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].compareDocumentPosition(cards[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    // Fresh criterion: phase 1 (pack metadata) always reads done in the
    // existing chainLinks mechanic; phase 2 is where the real work starts.
    expect(within(screen.getByTestId('v2-phase-planowanie')).getByText('3 / 3')).toBeInTheDocument();
    expect(within(screen.getByTestId('v2-phase-naprawa')).getByText('0 / 6')).toBeInTheDocument();
  });

  it('right panel opens only Akcje and Właściwości by default, in ARTIFACT_PANEL_SECTION_ORDER', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail());
    renderV2();
    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const aside = await screen.findByRole('complementary');
    // Single query, so document order is preserved (unlike concatenating two
    // separately-filtered `expanded:true`/`expanded:false` queries).
    const allButtons = within(aside).getAllByRole('button', { hidden: true }).filter((b) => b.hasAttribute('aria-expanded'));
    const order = ['Akcje', 'Właściwości', 'Powiązania', 'Źródła i założenia', 'Komentarze', 'Historia'];
    const positions = order.map((label) => allButtons.findIndex((h) => (h.textContent || '').includes(label)));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    const expandedLabels = allButtons.filter((b) => b.getAttribute('aria-expanded') === 'true').map((b) => b.textContent || '');
    expect(expandedLabels.some((h) => h.includes('Akcje'))).toBe(true);
    expect(expandedLabels.some((h) => h.includes('Właściwości'))).toBe(true);
    expect(expandedLabels.some((h) => h.includes('Historia'))).toBe(false);
    expect(expandedLabels.some((h) => h.includes('Komentarze'))).toBe(false);
  });

  it('shows the criterion\'s real program name (not a placeholder) in the Menu 1 breadcrumb once auditsMethodApi.getProgram resolves', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail());
    renderV2();
    await waitFor(() => expect(mockedGetProgram).toHaveBeenCalledWith('prog-1'));
    // Renders twice (Menu 1 breadcrumb + right-panel Właściwości row) — assert
    // presence, not uniqueness, and that the "Program…" loading placeholder
    // is gone.
    const matches = await screen.findAllByText('Audyt wewnętrzny 2026/Q3 — proces zakupowy');
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByText('Program…')).not.toBeInTheDocument();
  });

  it('Komentarze section is an honest "planned" empty state, not a fabricated stub (no comments API exists yet)', async () => {
    mockedGetCriterion.mockResolvedValue(baseDetail());
    renderV2();
    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const aside = await screen.findByRole('complementary');
    const commentsHeader = within(aside).getByRole('button', { name: /Komentarze/i });
    fireEvent.click(commentsHeader);
    expect(await within(aside).findByText(/Planowane.*brak API komentarzy/i)).toBeInTheDocument();
  });

  it('Menu 1 primary is honestly disabled (not a fake handler) for the finding-response reminder, which has no backing endpoint', async () => {
    // For 'odpowiedz-wlasciciela' (link 12) to be THE single current link,
    // every earlier link (1-11) must read 'done' — chainLinks.ts derives
    // each independently (accepted evidence, procedure/sample/test text,
    // test result, conclusion, a finding). `hasConfirmedFinding` reads
    // `CriterionDetail.findings` (the lite array `getCriterion` returns),
    // NOT `listFindings()` — that second call only backs FindingPanel's own
    // table — so both must agree.
    mockedGetCriterion.mockResolvedValue(
      baseDetail(
        {
          testResult: 'partial',
          conformityStatus: 'nonconforming',
          procedurePerformed: 'Wykonano procedurę.',
          sampleDescription: 'Próba 17 dostawców.',
          testPerformed: 'Zweryfikowano karty oceny.',
        },
        [
          {
            id: 'evid-1',
            evidenceKind: 'document',
            title: 'Karty oceny',
            accepted: true,
            supportsConformity: true,
            createdAt: '2026-08-01T00:00:00Z',
          },
        ],
        [{ id: 'find-1', statement: 'x', classification: 'nonconforming', severity: 'medium', status: 'confirmed' }]
      )
    );
    mockedListFindings.mockResolvedValue({
      items: [
        {
          id: 'find-1',
          programId: 'prog-1',
          criterionId: 'crit-1',
          referenceCode: 'UST-1',
          statement: 'x',
          classification: 'nonconforming',
          severity: 'medium',
          status: 'confirmed',
        },
      ],
      total: 1,
    });
    renderV2();
    await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

    const primary = await screen.findByRole('button', { name: /Poproś o odpowiedź \(ponownie\)/i });
    expect(primary).toBeDisabled();
    expect(primary.title).toMatch(/Planowane.*brak API/i);
  });
});
