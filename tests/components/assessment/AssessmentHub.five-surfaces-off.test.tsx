/**
 * @vitest-environment jsdom
 *
 * ASM-001A — Task 1 regression guard (flag OFF): `assessmentFiveSurfacesV1`
 * defaulting to false must reproduce today's exact AssessmentHub behavior —
 * 3 tabs (Assessment/Reports/Initiatives), `list` default, and ZERO `?tab=`
 * reads/writes. If this test breaks, the flag is not a real kill-switch.
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

// Explicit OFF — same default as DEFAULT_FLAGS in useFeatureFlags.tsx.
vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({ isEnabled: () => false }),
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

describe('AssessmentHub — regression guard (assessmentFiveSurfacesV1 OFF)', () => {
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

  it('shows exactly 3 tabs (Assessment/Reports/Initiatives) — no Library/Processes/Outputs', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    await screen.findByText('Canonical DRD');
    const tabs = screen.getAllByRole('tab').map((el) => el.textContent || '');
    expect(tabs.some((t) => /Assessment/.test(t))).toBe(true);
    expect(tabs.some((t) => /Reports/.test(t))).toBe(true);
    expect(tabs.some((t) => /Initiatives/.test(t))).toBe(true);
    expect(tabs.some((t) => /Library/.test(t))).toBe(false);
    expect(tabs.some((t) => /Processes/.test(t))).toBe(false);
    expect(tabs.some((t) => /Outputs/.test(t))).toBe(false);
    expect(screen.queryByTestId('assessment-library-tab')).not.toBeInTheDocument();
  });

  it('defaults to the "Assessment" (list) tab content, not Library', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Canonical DRD')).toBeInTheDocument();
    expect(screen.queryByTestId('assessment-library-tab')).not.toBeInTheDocument();
  });

  it('never reads or writes ?tab= in the URL, at mount or on tab click', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    await screen.findByText('Canonical DRD');
    expect(screen.getByTestId('location-probe')).not.toHaveTextContent('tab=');

    fireEvent.click(await screen.findByRole('tab', { name: /Reports/i }));

    // Re-query fresh each check (not a captured stale node) — tab switching
    // still works, it just never touches the URL.
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Reports/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
    expect(screen.getByTestId('location-probe')).not.toHaveTextContent('tab=');
  });

  it('a stray ?tab=processes in the URL is ignored (flag OFF never reads it)', async () => {
    render(
      <MemoryRouter initialEntries={['/assessment?tab=processes']}>
        <LocationProbe />
        <AssessmentHub />
      </MemoryRouter>
    );

    // Still lands on the default list content — the OFF path never resolves
    // tab ids from the URL at all.
    expect(await screen.findByText('Canonical DRD')).toBeInTheDocument();
    expect(screen.queryByTestId('assessment-library-tab')).not.toBeInTheDocument();
  });
});
