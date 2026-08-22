/** @vitest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock, listMethodSessionsMock, navigateMock } = vi.hoisted(() => ({
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
  navigateMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../src/services/api', () => ({ Api: apiMock }));
vi.mock('../../../src/method-core/api/methodCoreApi', () => ({
  listSessions: listMethodSessionsMock,
}));
vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
}));
vi.mock('../../../src/components/assessment/library/AssessmentLibraryTab', () => ({
  AssessmentLibraryTab: () => null,
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

const canonicalSession = {
  id: 'method-session-12345678',
  organizationId: 'org-1',
  projectId: null,
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: '2.0.0-methodpack.1',
  state: 'active',
  domainStage: null,
  mode: 'guided_manual',
  ownerUserId: 'owner-1',
  createdAt: '2026-08-21T08:00:00.000Z',
  updatedAt: '2026-08-21T09:00:00.000Z',
  version: 1,
  frozenSnapshotId: null,
  revisionOfSessionId: null,
  hasFrozenOutput: false,
};

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/assessment']}>
      <AssessmentHub />
    </MemoryRouter>
  );
}

describe('AssessmentHub Method Core DRD cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
  });

  it('shows a canonical Method Core DRD session and opens its canonical editor route', async () => {
    listMethodSessionsMock.mockResolvedValue({ sessions: [canonicalSession], total: 1 });
    apiMock.listAssessments.mockResolvedValue({ items: [] });
    renderHub();

    const rowName = await screen.findByText('DRD · method-s');
    expect(listMethodSessionsMock).toHaveBeenCalledWith({
      methodPackId: 'drd',
      limit: 100,
      offset: 0,
    });
    const row = rowName.closest('tr');
    expect(row).not.toBeNull();
    fireEvent.doubleClick(row!);
    expect(navigateMock).toHaveBeenCalledWith('/assessment/drd/method-session-12345678');
  });

  it('keeps non-DRD legacy rows but never lets a legacy DRD id masquerade as canonical', async () => {
    listMethodSessionsMock.mockResolvedValue({ sessions: [], total: 0 });
    apiMock.listAssessments.mockResolvedValue({
      items: [
        { id: 'legacy-drd-id', name: 'Legacy DRD', type: 'DRD', status: 'DRAFT' },
        { id: 'legacy-siri-id', name: 'Legacy SIRI', type: 'SIRI', status: 'DRAFT' },
      ],
    });
    renderHub();

    expect(await screen.findByText('Legacy SIRI')).toBeInTheDocument();
    expect(screen.queryByText('Legacy DRD')).not.toBeInTheDocument();
  });

  it('keeps canonical DRD visible with an explicit warning when only legacy loading fails', async () => {
    listMethodSessionsMock.mockResolvedValue({ sessions: [canonicalSession], total: 1 });
    apiMock.listAssessments.mockRejectedValue(new Error('legacy unavailable'));
    renderHub();

    expect(await screen.findByText('DRD · method-s')).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Non-DRD assessments could not be refreshed. Canonical DRD sessions are still shown.'
      )
    ).toBeInTheDocument();
  });

  it('fails closed when Method Core cannot load and does not restore cached legacy DRD', async () => {
    sessionStorage.setItem(
      'assessment.hub.cached-list.v1',
      JSON.stringify([{ id: 'cached-drd', name: 'Cached DRD', type: 'DRD', status: 'DRAFT' }])
    );
    listMethodSessionsMock.mockRejectedValue(new Error('method core unavailable'));
    apiMock.listAssessments.mockResolvedValue({ items: [] });
    renderHub();

    await waitFor(() => expect(listMethodSessionsMock).toHaveBeenCalled());
    expect(screen.queryByText('Cached DRD')).not.toBeInTheDocument();
  });
});
