/**
 * CriterionWorkspaceV2 — expert panel gap pack, 2026-08-26, item 5 (7 point
 * fixes). Same mocking harness as `CriterionWorkspaceV2.test.tsx` (module
 * mocks for `../../workspaceApi` and `../../../auditsMethodApi`, real
 * `MemoryRouter`). Covers the sub-fixes that live directly in this
 * component (b's wiring is unit-tested in `RemediationPanel.test.tsx`
 * instead, since it needs a selected finding — see that file for the
 * owner-name-resolution coverage):
 *
 *   (d) kebab menu closes on outside click / Escape
 *   (e) disabled primary CTA always carries a title tooltip with the reason
 *   (f) Menu 3 phase-chip row scrolls horizontally instead of clipping
 *   (g) "you cannot…" permission rows are conditioned on actual role
 *       capability, not shown unconditionally regardless of role
 *
 * All behind `ff_auditsScaleAndPolish` — default flipped OFF -> ON on
 * 2026-08-27 (owner accept on dev-render screenshots). Every "flag OFF"
 * test below now forces OFF via the localStorage kill switch (flip po
 * akcepcie właściciela 27.08) — it proves the pre-flip behavior is still
 * reachable per-session, not that it's the default anymore.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockCurrentUserId = 'user-1';

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
    listEvidence: vi.fn(),
    listFindings: vi.fn(),
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

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { success: (...args: unknown[]) => mockToastSuccess(...args), error: (...args: unknown[]) => mockToastError(...args) },
}));

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
    sourceReference: 'Procedura P-ZAK-02 rew. 4, pkt 8.4.1',
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

function baseDetail(overrides: Partial<WorkspaceCriterion> = {}): CriterionDetail {
  return { criterion: baseCriterion(overrides), evidence: [], evidenceRequests: [], findings: [] };
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

function setFlag(value: '1' | '0' | null) {
  if (value) window.localStorage.setItem('ff.audits_scale_and_polish', value);
  else window.localStorage.removeItem('ff.audits_scale_and_polish');
}

describe('CriterionWorkspaceV2 — expert panel gap pack point fixes (ff_auditsScaleAndPolish)', () => {
  beforeEach(() => {
    mockCurrentUserId = 'user-1';
    mockedListEvidence.mockResolvedValue([]);
    mockedListFindings.mockResolvedValue({ items: [], total: 0 });
    mockedGetEntityHistory.mockResolvedValue([]);
    mockedGetProgram.mockResolvedValue({
      id: 'prog-1',
      name: 'Audyt wewnętrzny 2026/Q3 — proces zakupowy',
      packId: 'pack-1',
      packTitle: 'Procedura QMS klienta',
      packVersion: 4,
      lifecycleState: 'fieldwork',
      applicableCriteria: 24,
      concludedCriteria: 9,
      openFindings: 6,
      leadAuditorId: 'user-1',
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
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(() => {
    setFlag(null);
  });

  describe('(d) kebab closes on outside click / Escape', () => {
    it('flag OFF (localStorage override): stays open on outside click (pre-flip behavior still reachable)', async () => {
      setFlag('0');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'lead_auditor'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

      fireEvent.click(screen.getByLabelText('Więcej akcji'));
      expect(screen.getByTestId('v2-kebab-menu')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.getByTestId('v2-kebab-menu')).toBeInTheDocument();
    });

    it('flag ON: closes on outside click and on Escape', async () => {
      setFlag('1');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'lead_auditor'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

      fireEvent.click(screen.getByLabelText('Więcej akcji'));
      expect(screen.getByTestId('v2-kebab-menu')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByTestId('v2-kebab-menu')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Więcej akcji'));
      expect(screen.getByTestId('v2-kebab-menu')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('v2-kebab-menu')).not.toBeInTheDocument();
    });
  });

  describe('(e) disabled primary CTA always has a full-reason tooltip', () => {
    it('flag ON: title falls back to the disabled label when no explicit title was set', async () => {
      // 'user-1' has NO role on this program → every gated primary action
      // resolves to a disabled "Requires the auditor role" branch with no
      // explicit `title` in the source (see primaryAction memo).
      setFlag('1');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue([]);
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

      const cta = await screen.findByTestId('v2-primary-cta');
      expect(cta).toBeDisabled();
      expect(cta.getAttribute('title')).toBeTruthy();
      expect(cta.getAttribute('title')).toBe(cta.textContent);
    });
  });

  describe('(c) Copy link — success toast + surfaced error, instead of a swallowed rejection', () => {
    const originalClipboard = navigator.clipboard;

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    });

    it('flag OFF (localStorage override): no toast on success (pre-flip behavior still reachable)', async () => {
      setFlag('0');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'lead_auditor'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

      fireEvent.click(screen.getByLabelText('Więcej akcji'));
      fireEvent.click(within(screen.getByTestId('v2-kebab-menu')).getByText('Kopiuj link'));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('flag ON: shows a success toast, and surfaces a rejected clipboard write instead of swallowing it', async () => {
      setFlag('1');
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'lead_auditor'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());

      fireEvent.click(screen.getByLabelText('Więcej akcji'));
      fireEvent.click(within(screen.getByTestId('v2-kebab-menu')).getByText('Kopiuj link'));
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

      // Now simulate a rejected write (e.g. permission denied) — the old
      // `try { void promise } catch {}` never caught this async rejection.
      writeText.mockRejectedValueOnce(new Error('denied'));
      fireEvent.click(screen.getByLabelText('Więcej akcji'));
      fireEvent.click(within(screen.getByTestId('v2-kebab-menu')).getByText('Kopiuj link'));
      await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    });
  });

  describe('(f) Menu 3 phase-chip row scrolls instead of clipping', () => {
    it('flag OFF (localStorage override): no overflow-x-auto class', async () => {
      setFlag('0');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'lead_auditor'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());
      const row = (await screen.findByText('Faza audytu')).closest('div');
      expect(row?.className).not.toContain('overflow-x-auto');
    });

    it('flag ON: row gets overflow-x-auto', async () => {
      setFlag('1');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'lead_auditor'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());
      const row = (await screen.findByText('Faza audytu')).closest('div');
      expect(row?.className).toContain('overflow-x-auto');
    });
  });

  describe('(g) permission rows conditioned by actual role capability', () => {
    it('flag OFF (localStorage override): "you cannot respond as auditee" shows even for a real auditee (pre-flip bug still reachable)', async () => {
      setFlag('0');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'auditee'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());
      expect(await screen.findByText('możesz odpowiadać jako strona audytowana')).toBeInTheDocument();
      expect(screen.getByText('nie możesz odpowiadać w imieniu strony audytowanej')).toBeInTheDocument();
    });

    it('flag ON: a real auditee no longer sees the contradictory "you cannot respond" row', async () => {
      setFlag('1');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'auditee'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());
      expect(await screen.findByText('możesz odpowiadać jako strona audytowana')).toBeInTheDocument();
      expect(screen.queryByText('nie możesz odpowiadać w imieniu strony audytowanej')).not.toBeInTheDocument();
      // auditee has no verification.perform capability either — the
      // "cannot verify your own action" caveat is irrelevant noise for them.
      expect(
        screen.queryByText('nie możesz zweryfikować skuteczności własnego działania korygującego')
      ).not.toBeInTheDocument();
    });

    it('flag ON: a lead auditor (canVerify=true, not an auditee) still sees both caveats', async () => {
      setFlag('1');
      mockedGetCriterion.mockResolvedValue(baseDetail());
      mockedGetProgramMembers.mockResolvedValue(membersWithRole('user-1', 'lead_auditor'));
      renderV2();
      await waitFor(() => expect(mockedGetCriterion).toHaveBeenCalled());
      expect(await screen.findByText('nie możesz odpowiadać w imieniu strony audytowanej')).toBeInTheDocument();
      expect(screen.getByText('nie możesz zweryfikować skuteczności własnego działania korygującego')).toBeInTheDocument();
    });
  });
});
