/**
 * @vitest-environment jsdom
 *
 * ASM-001A — Task 1 coverage (flag ON): five stable tab ids behind
 * `assessmentFiveSurfacesV1`, with `?tab=` as the source of truth
 * (default tab, deep link, tab-change → URL write, legacy `?tab=list`
 * compat mapping, refresh).
 *
 * `AssessmentLibraryTab` is mocked out — its own behavior (published
 * definitions, Start) is covered by AssessmentLibraryTab.test.tsx. This
 * suite is only about AssessmentHub's tab-id/URL plumbing, so the real
 * StandardModuleBar/StandardTable render (not mocked) to exercise real tab
 * click + real "processes" table content.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listAssessments: vi.fn(),
    getAssessmentReports: vi.fn(),
    get: vi.fn(),
    listReportImports: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getUsers: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', () => ({ Api: apiMock }));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    isEnabled: (id: string) => id === 'assessmentFiveSurfacesV1',
  }),
  FeatureFlagsProvider: ({ children }: any) => children,
}));

vi.mock('../../../src/components/assessment/library/AssessmentLibraryTab', () => ({
  AssessmentLibraryTab: () => <div data-testid="assessment-library-tab">Library stub</div>,
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

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe('AssessmentHub — five surfaces (assessmentFiveSurfacesV1 ON)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMock.listAssessments.mockResolvedValue({
      items: [
        {
          id: 'asm_1',
          name: 'Canonical DRD',
          type: 'DRD',
          status: 'DRAFT',
          updatedAt: '2026-04-11T08:00:00.000Z',
        },
      ],
    });
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
  });

  it('defaults to the Library tab and canonicalizes ?tab= on mount', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('assessment-library-tab')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('tab=library');
    });
  });

  it('?tab=processes opens the former "list" content (same table, same data)', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment?tab=processes']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Canonical DRD')).toBeInTheDocument();
    expect(screen.queryByTestId('assessment-library-tab')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Processes/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('legacy ?tab=list is compat-mapped to processes', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment?tab=list']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Canonical DRD')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('tab=processes');
    });
  });

  it('clicking a tab updates the URL (?tab=)', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    await screen.findByTestId('assessment-library-tab');

    const reportsTab = await screen.findByRole('tab', { name: /Reports/i });
    fireEvent.click(reportsTab);

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('tab=reports');
    });
    expect(reportsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('a fresh mount with ?tab=reports starts on the Reports tab (refresh/back-forward)', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment?tab=reports']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    const reportsTab = await screen.findByRole('tab', { name: /Reports/i });
    await waitFor(() => {
      expect(reportsTab).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByTestId('location-probe')).toHaveTextContent('tab=reports');
    expect(screen.queryByTestId('assessment-library-tab')).not.toBeInTheDocument();
  });

  it('renders all 5 tabs: Library, Processes, Outputs, Reports, Initiatives', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    await screen.findByTestId('assessment-library-tab');
    const tabs = screen.getAllByRole('tab').map((el) => el.textContent);
    expect(tabs.some((t) => /Library/.test(t || ''))).toBe(true);
    expect(tabs.some((t) => /Processes/.test(t || ''))).toBe(true);
    expect(tabs.some((t) => /Outputs/.test(t || ''))).toBe(true);
    expect(tabs.some((t) => /Reports/.test(t || ''))).toBe(true);
    expect(tabs.some((t) => /Initiatives/.test(t || ''))).toBe(true);
  });
});
