/**
 * @vitest-environment jsdom
 *
 * D7 / DEC-513: the canonical Method Core Output has no business unit,
 * aggregate score or confidence. Processes must not advertise those columns
 * from a legacy project-id twin or fill them with em dashes. Progress remains
 * available through the column picker because it has a canonical session
 * source (covered by AssessmentHub.processes-completion.test.tsx).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, listMethodSessionsMock } = vi.hoisted(() => ({
  apiMock: {
    listAssessments: vi.fn(),
    getAssessmentReports: vi.fn(),
    get: vi.fn(),
    listReportImports: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getUsers: vi.fn(),
  },
  listMethodSessionsMock: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({ Api: apiMock }));
vi.mock('../../../src/method-core/api/methodCoreApi', () => ({
  listSessions: listMethodSessionsMock,
}));
vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
  FeatureFlagsProvider: ({ children }: any) => children,
}));
vi.mock('../../../src/components/assessment/library/AssessmentLibraryTab', () => ({
  AssessmentLibraryTab: () => <div data-testid="assessment-library-tab">Library stub</div>,
  METHODOLOGY_CATALOG: [
    {
      id: 'DRD',
      name: 'Digital Readiness Diagnosis',
      area: { pl: 'Transformacja cyfrowa', en: 'Digital transformation' },
      status: 'active',
    },
  ],
}));
vi.mock('../../../src/components/Initiatives/InitiativeCompactPanel', () => ({
  InitiativeCompactPanel: () => null,
}));
vi.mock('../../../src/components/Initiatives/InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => null,
}));
vi.mock('../../../src/components/MyWork/DecisionDetailView', () => ({
  DecisionDetailView: () => null,
}));
vi.mock('../../../src/components/MyWork/TaskDetailView', () => ({ TaskDetailView: () => null }));
vi.mock('../../../src/components/assessment/ImportedReportDetailView', () => ({
  ImportedReportDetailView: () => null,
}));
vi.mock('../../../src/components/assessment/InitiativesGenerationWizardModal', () => ({
  InitiativesGenerationWizardModal: () => null,
}));
vi.mock('../../../src/components/assessment/modals/NewAssessmentReportModal', () => ({
  NewAssessmentReportModal: () => null,
}));
vi.mock('../../../src/components/assessment/NewAssessmentModal', () => ({
  NewAssessmentModal: () => null,
}));

import { AssessmentHub } from '../../../src/components/assessment/AssessmentHub';

// Legacy wiersze DRD są świadomie odrzucane przez hub (DRD należy do Method
// Core — patrz AssessmentHub.processes-completion.test.tsx), więc do testu
// kolumn używamy wierszy nie-DRD, a do testu filtra frameworku — sesji
// Method Core, bo tylko one dają na liście framework DRD.
const SIRI_ROW = {
  id: 'asm_siri_1',
  name: 'SIRI — hala 2',
  type: 'SIRI',
  status: 'DRAFT',
  updatedAt: '2026-04-11T08:00:00.000Z',
  completion_percent: 42,
  overall_score: 3.4,
  confidence_avg: 0.72,
  business_unit: 'Logistics BU',
};
const ADMA_ROW = {
  id: 'asm_adma_1',
  name: 'ADMA — linia montażowa',
  type: 'ADMA',
  status: 'DRAFT',
  updatedAt: '2026-04-10T08:00:00.000Z',
  completion_percent: 10,
};
const METHOD_CORE_DRD_SESSION = {
  id: 'asm-method-1',
  organizationId: 'org-1',
  projectId: null,
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: '2.0.0-methodpack.1',
  state: 'active',
  domainStage: null,
  mode: 'guided_manual',
  ownerUserId: 'owner-1',
  createdAt: '2026-04-11T08:00:00.000Z',
  updatedAt: '2026-04-11T08:00:00.000Z',
  version: 1,
  frozenSnapshotId: null,
  revisionOfSessionId: null,
  hasFrozenOutput: false,
};

function headerTexts(): string[] {
  return Array.from(document.querySelectorAll('th')).map((th) =>
    (th.textContent || '').replace(/\s+/g, ' ').trim()
  );
}

describe('AssessmentHub — honest Processes columns after D7', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
    listMethodSessionsMock.mockResolvedValue({ sessions: [], total: 0 });
    apiMock.listAssessments.mockResolvedValue({ items: [SIRI_ROW, ADMA_ROW] });
  });

  it('omits BUSINESS UNIT / SCORE / CONFIDENCE when Method Core Output cannot supply them', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    await screen.findByText('SIRI — hala 2');
    const headers = headerTexts().join(' | ');

    expect(headers).toContain('Assessment name');
    expect(headers).toContain('Owner');
    expect(headers).toContain('Update');
    expect(headers).not.toMatch(/Business unit|Jednostka/);
    expect(headers).not.toMatch(/Result|Wynik/);
    expect(headers).not.toMatch(/Confidence|Pewność/);
    expect(headers).not.toMatch(/Type|Typ/);
    expect(headers).not.toMatch(/Progress|Postęp/);
    expect(screen.queryByText('Logistics BU')).not.toBeInTheDocument();
    expect(screen.queryByText('3.4')).not.toBeInTheDocument();
    expect(screen.queryByText('72%')).not.toBeInTheDocument();
  });

  it('/assessment/drd wchodzi na listę sesji i zawęża ją do DRD', async () => {
    listMethodSessionsMock.mockResolvedValue({
      sessions: [METHOD_CORE_DRD_SESSION],
      total: 1,
    });

    render(
      <MemoryRouter initialEntries={['/assessment/drd']}>
        <AssessmentHub initialTab="processes" frameworkFilter="DRD" />
      </MemoryRouter>
    );

    await waitFor(() => expect(apiMock.listAssessments).toHaveBeenCalled());
    expect(await screen.findByText('DRD · asm-meth')).toBeInTheDocument();
    // przed naprawą lista pokazywała też sesje innych metodyk
    expect(screen.queryByText('SIRI — hala 2')).not.toBeInTheDocument();
    expect(screen.queryByText('ADMA — linia montażowa')).not.toBeInTheDocument();
    // i nie ląduje na Bibliotece
    expect(screen.queryByTestId('assessment-library-tab')).not.toBeInTheDocument();
  });
});
