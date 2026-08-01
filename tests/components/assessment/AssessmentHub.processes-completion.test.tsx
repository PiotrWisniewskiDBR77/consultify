/**
 * @vitest-environment jsdom
 *
 * ASM-001A fix round (FIX_REQUIRED, Codex) — Task 3.
 *
 * Fala 3 found the Processes list showing 0% even when GET /api/v8/assessment/:id
 * (single record) returned the correct server-derived completion. Root cause
 * (frontend half, verified by reading server/src/routes/v8/assessment.routes.ts
 * `router.get('/')`): the LIST endpoint's response items never carried a
 * `progress` field at all — it returns DRD completion under `completion_percent`
 * (raw persisted column, always present via `...row`) and `completionPercent`
 * (camelCase, only present when server-derived for a DRD row with answers).
 * AssessmentHub.tsx's `currentData` mapping for the 'list'/'processes' tabs read
 * `item.progress ?? 0` — a field the API response never sends — so it always
 * fell back to 0, independent of whatever completion the backend computed.
 *
 * This is a pure frontend bug, independent of the parallel backend-writer's
 * fix to the LIST endpoint's response shape (that shape already returns
 * completion_percent/completionPercent in this working tree — see
 * assessment.routes.ts). Fixed in AssessmentHub.tsx's `currentData` useMemo:
 * `rawItem.completionPercent ?? rawItem.completion_percent ?? item.progress ?? 0`.
 *
 * `useFeatureFlagsContext` is mocked directly here (not the real-provider
 * pattern from AssessmentHub.five-surfaces.real-provider.test.tsx) — this test
 * is only about the progress-column data mapping, which is identical on the
 * 'list' (flag OFF) and 'processes' (flag ON) tabs per the ASM-001A description
 * ("processes (renamed from list, identical content/columns/preview)"), so
 * flag state is irrelevant to what's under test here.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

describe('AssessmentHub — Processes list reads server-derived completion (Codex fix #4, frontend half)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
    apiMock.getUsers.mockResolvedValue([]);
  });

  it('renders 42% (not 0%) for a DRD assessment whose list-item carries completion_percent: 42', async () => {
    apiMock.listAssessments.mockResolvedValue({
      items: [
        {
          id: 'asm_drd_1',
          name: 'DRD with real completion',
          type: 'DRD',
          status: 'DRAFT',
          updatedAt: '2026-04-11T08:00:00.000Z',
          // Exact shape server/src/routes/v8/assessment.routes.ts `router.get('/')`
          // returns for a DRD row with derived completion — snake_case always
          // present (raw persisted column via `...row`), camelCase present
          // when server-derived. No `progress` field — that key never exists
          // on the real API response.
          completion_percent: 42,
          completionPercent: 42,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('DRD with real completion')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('falls back to the raw snake_case completion_percent when camelCase is absent (non-DRD / DRD-without-areas-yet row shape)', async () => {
    apiMock.listAssessments.mockResolvedValue({
      items: [
        {
          id: 'asm_siri_1',
          name: 'SIRI assessment',
          type: 'SIRI',
          status: 'DRAFT',
          updatedAt: '2026-04-11T08:00:00.000Z',
          // Non-DRD rows only ever get the raw persisted snake_case column —
          // assessment.routes.ts only adds the camelCase mirror for
          // server-derived DRD completion.
          completion_percent: 65,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('SIRI assessment')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('regression guard: a row with no completion field at all still renders 0% (not a crash)', async () => {
    apiMock.listAssessments.mockResolvedValue({
      items: [
        {
          id: 'asm_empty_1',
          name: 'Brand new assessment',
          type: 'DRD',
          status: 'DRAFT',
          updatedAt: '2026-04-11T08:00:00.000Z',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Brand new assessment')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
