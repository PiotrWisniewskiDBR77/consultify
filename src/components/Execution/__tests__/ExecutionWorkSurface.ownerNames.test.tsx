/**
 * @vitest-environment jsdom
 *
 * Kolumna „Właściciel / osoba decyzyjna" pokazuje CZŁOWIEKA, nie identyfikator.
 *
 * ZMIERZONY DEFEKT (odbiór na żywo 2026-09-05, `execution-tab-work`): kolumna
 * pisała `d2b6a316-08c5-47cf-9bf7-4ba50311d5a2`, podczas gdy obraz zatwierdzony
 * (`evidence/grafika/uwagi-zrobione-20260902/UW-06-01__execution-tab-work__light.png`)
 * ma tam „Anna Kowalska", „Marek Nowak", „Katarzyna Wójcik". Powierzchnia nie
 * czytała ŻADNEGO katalogu osób, a jedyny istniejący
 * (`GET /api/organizations/:orgId/members`) zwraca wiersze snake_case
 * (`user_id`/`first_name`/`last_name`).
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): usunięcie `resolveMemberName` z
 * `actorLabel` w `ExecutionWorkSurface.tsx` → ten test pada („Piotr Wiśniewski"
 * znika, wraca „Nieznany użytkownik"). Mutacja celuje w SAM przewód katalog →
 * kolumna, nie w scenariusz ładowania.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({
      currentUser: { id: 'user-anna' },
      currentOrganization: { id: 'org-1' },
    }),
}));

const { getOrganizationMembers } = vi.hoisted(() => ({ getOrganizationMembers: vi.fn() }));
vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers },
}));

const { listExecutionCases, readExecutionWork } = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionWork: vi.fn(),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases,
  readExecutionWork,
  readOperationalAllocations: vi.fn(),
  readExecutionCase: vi.fn(),
  readExecutionMilestones: vi.fn(),
  createExecutionTask: vi.fn(),
  updateExecutionTask: vi.fn(),
  completeExecutionTask: vi.fn(),
  createExecutionDecision: vi.fn(),
  requestExecutionDecision: vi.fn(),
  decideExecutionDecision: vi.fn(),
  createExecutionMilestone: vi.fn(),
  proposeOperationalAllocation: vi.fn(),
  simulateOperationalAllocation: vi.fn(),
  acceptResourceCommitment: vi.fn(),
  requestResourceCommitment: vi.fn(),
  decideResourceCommitment: vi.fn(),
  assessOperationalAllocation: vi.fn(),
  confirmOperationalAllocation: vi.fn(),
  releaseOperationalAllocation: vi.fn(),
}));

import { ExecutionWorkSurface } from '../ExecutionWorkSurface';

const WLASCICIEL = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';

/** Dokładny kształt odpowiedzi `getActiveMembers` — snake_case, bez `name`. */
const CZLONKOWIE = [
  {
    id: 'membership-1',
    user_id: WLASCICIEL,
    role: 'OWNER',
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00.000Z',
    first_name: 'Piotr',
    last_name: 'Wiśniewski',
    email: 'piotr.wisniewski@dbr77.com',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getOrganizationMembers.mockResolvedValue(CZLONKOWIE);
  listExecutionCases.mockResolvedValue({
    cases: [{ executionCaseId: 'case-ok', initiativeId: 'init-ok', initiativeTitle: 'Realizacja OEE' }],
  });
  readExecutionWork.mockResolvedValue({
    tasks: [
      {
        taskId: 'task-1',
        title: 'Zweryfikować kompletność danych',
        status: 'OPEN',
        assigneeId: WLASCICIEL,
        dueAt: '2026-09-20T10:00:00.000Z',
        slaAt: null,
        version: 1,
        evidenceRefs: [],
      },
    ],
    decisions: [],
  });
});

describe('ExecutionWorkSurface — kolumna osoby', () => {
  it('pokazuje imię i nazwisko z katalogu organizacji zamiast UUID-a', async () => {
    render(<ExecutionWorkSurface activePreset="all" />);

    await waitFor(() =>
      expect(screen.getByText('Zweryfikować kompletność danych')).toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByText('Piotr Wiśniewski')).toBeInTheDocument());
    expect(document.body.textContent).not.toContain(WLASCICIEL);
  });

  it('gdy katalog nie zna osoby — „Nieznany użytkownik", nadal NIE identyfikator', async () => {
    getOrganizationMembers.mockResolvedValue([]);

    render(<ExecutionWorkSurface activePreset="all" />);

    await waitFor(() =>
      expect(screen.getByText('Zweryfikować kompletność danych')).toBeInTheDocument()
    );
    expect(screen.getAllByText('Nieznany użytkownik').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(WLASCICIEL);
  });
});
