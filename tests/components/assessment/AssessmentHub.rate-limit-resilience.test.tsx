import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    // #69: AssessmentHub now resolves the Author column via Api.getUsers()
    // (same wzór as DiscoveryToolsHub) — must be mocked or the hub throws.
    getUsers: vi.fn(),
  },
  // Mirror react-i18next: the second arg may be a fallback string OR an options
  // object ({ defaultValue, ...interpolation }). Returning the raw object would
  // crash React with "Objects are not valid as a React child".
  tMock: (_key: string, fallback?: string | Record<string, unknown>) => {
    if (typeof fallback === 'string') return fallback;
    if (fallback && typeof fallback === 'object') {
      const value = (fallback as { defaultValue?: unknown }).defaultValue;
      if (typeof value === 'string') return value;
    }
    return _key;
  },
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
  getStatusesForModule: () => [],
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
    apiMock.getUsers.mockResolvedValue([]);
  });

  it('keeps the hub usable when the assessment list is rate limited', async () => {
    apiMock.listAssessments.mockRejectedValue(RATE_LIMIT_ERROR);

    render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub />
      </MemoryRouter>
    );

    expect(apiMock.listAssessments).toHaveBeenCalled();
    expect(
      await screen.findByText(
        'Assessment data is temporarily rate limited. Retry in a moment or create a new assessment while staging recovers.'
      )
    ).toBeInTheDocument();
    // With no cached list, the hub fails closed into an ErrorState (with a retry
    // affordance) rather than the empty-list CTA — so the rate-limit message is
    // surfaced as the error copy and a retry control is offered.
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
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

  it('renders only the canonical non-duplicated Menu 3 AI action in the hub', async () => {
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
    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    expect(screen.queryByText('Resume latest assessment')).not.toBeInTheDocument();
  });

  // #73: reports/initiatives used to open a bespoke `fixed inset-0` backdrop
  // drawer (Report Slide-Over) or overlay (InitiativeCompactPanel) on row
  // click — reported as "preview paints across the whole screen" — instead of
  // the docked StandardTable + StandardPreview aside 'list' already had. These
  // two tests render the real (non-mocked) StandardTable/StandardPreview and
  // assert a single contained `<aside>` panel appears on click, not a
  // full-viewport overlay.
  it('reports tab: row click opens a docked preview aside, not a full-viewport drawer (#73)', async () => {
    apiMock.listAssessments.mockResolvedValue({ items: [] });
    apiMock.getAssessmentReports.mockResolvedValue([
      {
        id: 'rep_1',
        name: 'DBR77 Report',
        status: 'APPROVED',
        assessmentType: 'DRD',
        createdBy: 'user_1',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);

    const { container } = render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub initialTab="reports" />
      </MemoryRouter>
    );

    const row = await screen.findByText('DBR77 Report');
    expect(container.querySelector('aside')).toBeNull();

    fireEvent.click(row);

    await waitFor(() => {
      expect(container.querySelector('aside')).not.toBeNull();
    });
    // Exactly one docked preview panel — not a second full-viewport overlay.
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('initiatives tab: row click opens a docked preview aside, not the compact-panel overlay (#73)', async () => {
    apiMock.listAssessments.mockResolvedValue({ items: [] });
    apiMock.get.mockImplementation((url: string) => {
      if (String(url).startsWith('/initiatives')) {
        return Promise.resolve([
          {
            id: 'init_1',
            name: 'Automated Changeover Optimization',
            status: 'DRAFT',
            priority: 'high',
            sourceType: 'assessment',
            sourceId: 'src_1',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/assessment']}>
        <AssessmentHub initialTab="initiatives" />
      </MemoryRouter>
    );

    const row = await screen.findByText('Automated Changeover Optimization');
    expect(container.querySelector('aside')).toBeNull();

    fireEvent.click(row);

    await waitFor(() => {
      expect(container.querySelector('aside')).not.toBeNull();
    });
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });
});
