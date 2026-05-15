import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { navigateMock, apiMock, tMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  apiMock: {
    listAssessments: vi.fn(),
    getAssessmentReports: vi.fn(),
    get: vi.fn(),
    listReportImports: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  tMock: (_key: string, fallback?: string) => fallback ?? _key,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: tMock,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', () => ({
  Api: apiMock,
}));

vi.mock('../../../src/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isEnabled: () => false,
  }),
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  ModuleHub: ({
    children,
    commandRowContent,
  }: {
    children: React.ReactNode;
    commandRowContent?: React.ReactNode;
  }) => (
    <div data-testid="assessment-module-hub">
      {commandRowContent}
      {children}
    </div>
  ),
  FilterableTable: ({ data, emptyMessage }: { data: Array<{ id: string; name: string }>; emptyMessage: string }) => (
    <div>
      {data.length > 0 ? data.map((row) => <div key={row.id}>{row.name}</div>) : <div>{emptyMessage}</div>}
    </div>
  ),
  GridView: ({ items }: { items: Array<{ id: string; name: string }> }) => (
    <div>{items.map((item) => item.name).join(', ')}</div>
  ),
  StatusDropdown: () => null,
  ASSESSMENT_STATUSES: {},
  REPORT_STATUSES: {},
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

vi.mock('../../../src/components/MyWork/TaskDetailView', () => ({
  TaskDetailView: () => null,
}));

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

const RATE_LIMIT_ERROR = Object.assign(new Error('Too many requests, please try again later.'), {
  status: 429,
});

describe('AssessmentHub rate limit resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMock.getAssessmentReports.mockResolvedValue([]);
    apiMock.get.mockResolvedValue([]);
    apiMock.listReportImports.mockResolvedValue({ data: [] });
  });

  it('keeps the hub usable when the assessment list is rate limited', async () => {
    apiMock.listAssessments.mockRejectedValue(RATE_LIMIT_ERROR);

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('assessment-module-hub')).toBeInTheDocument();
    });

    expect(apiMock.listAssessments).toHaveBeenCalled();
    expect(
      await screen.findByText(
        'Assessment data is temporarily rate limited. Retry in a moment or create a new assessment while staging recovers.'
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Assessment list is temporarily unavailable. Retry or create a new assessment while staging recovers.'
      )
    ).toBeInTheDocument();
  });

  it('shows the cached assessment list when a transient rate limit blocks refresh', async () => {
    sessionStorage.setItem(
      'assessment.hub.cached-list.v1',
      JSON.stringify([
        {
          id: 'asm_cached_1',
          name: 'Cached DRD Assessment',
          type: 'DRD',
          status: 'DRAFT',
          updatedAt: '2026-03-26T08:00:00.000Z',
        },
      ])
    );
    apiMock.listAssessments.mockRejectedValue(RATE_LIMIT_ERROR);

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('Cached DRD Assessment')).toBeInTheDocument();

    expect(
      await screen.findByText(
        'Assessment data is temporarily rate limited. Showing the last available list while staging recovers.'
      )
    ).toBeInTheDocument();
  });

  it('renders the canonical Menu 3 AI actions in the hub', async () => {
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

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('AI Triage')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Interpretation Draft')).toBeInTheDocument();
  });
});
