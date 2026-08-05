/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

// M03R-013: `tests/setup.ts` globalnie mockuje react-i18next przez `t=(k)=>k`,
// więc asercje na angielskich literałach nie mogą przejść niezależnie od tego,
// czy produkt działa. Ładujemy realne tłumaczenia EN — te same napisy, które
// widzi użytkownik — dzięki czemu asercje zostają bez zmian i są mocniejsze.
vi.mock('react-i18next', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const EN = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'public/locales/en/translation.json'), 'utf8')
  );
  const t = (key: string, options?: any) => {
    const raw = key.split('.').reduce<any>((acc, p) => (acc == null ? acc : acc[p]), EN);
    if (typeof raw !== 'string') return typeof options === 'string' ? options : key;
    if (!options || typeof options !== 'object') return raw;
    return Object.keys(options).reduce(
      (acc, k) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(options[k])),
      raw
    );
  };
  return {
    useTranslation: () => ({ t, i18n: { language: 'en', changeLanguage: vi.fn() } }),
    Trans: ({ children, i18nKey }: any) => children || i18nKey,
    I18nextProvider: ({ children }: any) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    Translation: ({ children }: any) => children({ t, i18n: { language: 'en' } }),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({
    updateWorkspaceFromView: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePresentationMode', () => ({
  usePresentationMode: () => ({
    mode: 'consulting',
    setMode: vi.fn(),
  }),
}));

vi.mock('@/utils/artifactLinks', () => ({
  buildArtifactCode: vi.fn(() => 'MOCK-CODE'),
}));

vi.mock('@/components/shared/NModeLayout/NModeHeader', () => ({
  default: ({ title }: any) => <div data-testid="nmode-header">{title}</div>,
  NModeHeader: ({ title }: any) => <div data-testid="nmode-header">{title}</div>,
}));

vi.mock('@/components/shared/NModeLayout/NModeShell', () => ({
  NModeShell: ({ header, sections, properties, rightPanel, renderActionBar }: any) => (
    <div>
      <div data-testid="nmode-header">{header?.title}</div>
      {/* Render the properties strip fields (incl. the custom status pill) so
          status-badge assertions exercise the real component output. */}
      <div data-testid="nmode-properties-strip">
        {properties?.map((field: any, index: number) => (
          <div key={field.id || index} data-testid={`property-${field.id}`}>
            {typeof field.render === 'function'
              ? field.render()
              : field.label?.en ?? field.label}
          </div>
        ))}
      </div>
      {/* M03R-013: status artefaktu mieszka w prawym panelu od zmiany #54
          (Properties Strip wycofany z centrum). Stub musiał go pomijać,
          więc asercja o statusie nie miała czego znaleźć. */}
      <div data-testid="nmode-right-panel">{rightPanel}</div>
      <div>{renderActionBar?.()}</div>
      <div data-testid="nmode-canvas">
        {sections?.map((section: any, index: number) => (
          <div key={section.id || index} data-testid={`section-${section.id}`}>
            {section.component}
          </div>
        ))}
      </div>
    </div>
  ),
}));

vi.mock('@/components/shared/NModeLayout/NModeCanvas', () => ({
  NModeCanvas: ({ sections }: any) => {
    return (
      <div data-testid="nmode-canvas">
        {sections?.map((s: any, i: number) => (
          <div key={s.id || i} data-testid={`section-${s.id}`}>
            {s.component}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('@/components/shared/NModeLayout/NModeLeftNav', () => ({
  NModeLeftNav: () => <div data-testid="nmode-leftnav" />,
}));

vi.mock('@/components/shared/NModeLayout/NModePropertiesStrip', () => ({
  NModePropertiesStrip: () => <div data-testid="nmode-properties" />,
}));

vi.mock('@/components/shared/NModeBlocks', () => ({
  Callout: ({ children }: any) => <div>{children}</div>,
  EmptyStateInline: ({ message }: any) => <div>{message}</div>,
  InlineTable: () => <div />,
}));

vi.mock('@/components/shared/NModeSections', () => ({
  ActivityLogCanvas: () => <div />,
  CommentsCanvas: () => <div />,
}));

vi.mock('@/components/Interview/interviewDemoData', () => ({
  createInterviewDemoDataset: () => ({
    insightDetailsById: {},
    sessionDetailsById: {},
    insightActivityById: {},
    insightCommentsById: {},
    sessions: [],
    assignments: [],
    insights: [],
  }),
  isInterviewDemoId: () => false,
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('remark-gfm', () => ({
  default: () => {},
}));

const mockGetInsight = vi.fn();
const mockGetInsightActivity = vi.fn();
const mockGetInsightComments = vi.fn();

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    getInsight: (...args: any[]) => mockGetInsight(...args),
    getInsightActivity: (...args: any[]) => mockGetInsightActivity(...args),
    getInsightComments: (...args: any[]) => mockGetInsightComments(...args),
    getSessions: vi.fn().mockResolvedValue({ sessions: [] }),
    getSession: vi.fn().mockResolvedValue({ session: {} }),
    getAcceptedSessions: vi.fn().mockResolvedValue({ sessions: [] }),
    getMyAssignments: vi.fn().mockResolvedValue({ assignments: [] }),
    getManagedAssignments: vi.fn().mockResolvedValue({ assignments: [] }),
    getOverdueAssignments: vi.fn().mockResolvedValue({ assignments: [] }),
    startAssignment: vi.fn().mockResolvedValue({ success: true }),
    submitAssignment: vi.fn().mockResolvedValue({ success: true }),
    remindAssignment: vi.fn().mockResolvedValue({ success: true }),
    sendBackAssignment: vi.fn().mockResolvedValue({ success: true }),
    approveAssignment: vi.fn().mockResolvedValue({ success: true }),
    createInsight: vi.fn().mockResolvedValue({ insight: {} }),
    regenerateInsight: vi.fn().mockResolvedValue({ insight: {} }),
    updateInsight: vi.fn().mockResolvedValue({ success: true }),
    exportInsight: vi.fn().mockResolvedValue({ success: true }),
    createInsightComment: vi.fn().mockResolvedValue({}),
    deleteInsightComment: vi.fn().mockResolvedValue({ success: true }),
    deleteInsight: vi.fn().mockResolvedValue({ success: true }),
    getInsights: vi.fn().mockResolvedValue({ insights: [] }),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn(),
  },
}));

import { Api } from '@/services/api';
import { InsightViewer } from '@/components/Interview/InsightViewer';

function buildInsightResponse(overrides: Record<string, any> = {}) {
  return {
    id: 'insight-1',
    organizationId: 'org-1',
    title: 'Test Insight Report',
    promptType: 'summary',
    sourceSessionIds: [],
    content: '# Summary\n\nThis is a test.',
    executiveSummary: 'Key findings from research.',
    themes: overrides.themes ?? [
      {
        title: 'Theme 1: User Friction',
        description: 'Users report significant friction in onboarding.',
        evidence_refs: ['ref-1'],
        strength: 'strong',
        confidence: overrides.themeConfidence ?? 'high',
        limits: overrides.themeLimits ?? ['Only 3 respondents'],
      },
    ],
    issues: overrides.issues ?? [],
    opportunities: overrides.opportunities ?? [],
    signals: [],
    evidenceMap: [],
    missingData: [],
    status: 'completed',
    reviewStatus: overrides.reviewStatus ?? 'published',
    sourceSessionCount: 0,
    tokensUsed: 500,
    generationTimeMs: 2000,
    createdBy: 'user-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:01:00Z',
  };
}

function setupMocks(insightOverrides: Record<string, any> = {}) {
  const insightData = buildInsightResponse(insightOverrides);

  mockGetInsight.mockResolvedValue({ insight: insightData });
  mockGetInsightActivity.mockResolvedValue({ activity: [] });
  mockGetInsightComments.mockResolvedValue({ comments: [] });

  vi.mocked(Api.post).mockResolvedValue({ success: true, initiativeId: 'init-new-1' });
}

function renderViewer() {
  return render(
    <InsightViewer insightId="insight-1" onClose={vi.fn()} />
  );
}

describe('InsightViewer P10 handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Handoff button for published findings with themes', async () => {
    setupMocks({ reviewStatus: 'published' });
    renderViewer();

    await waitFor(
      () => {
        const handoffButtons = screen.queryAllByText(/Handoff|Inicjatywa/);
        expect(handoffButtons.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 }
    );
  });

  it('renders insight title after loading', async () => {
    setupMocks({ reviewStatus: 'published' });
    renderViewer();

    await waitFor(() => {
      expect(screen.getByTestId('nmode-header')).toHaveTextContent('Test Insight Report');
    });
  });

  it('renders published status badge', async () => {
    setupMocks({ reviewStatus: 'published' });
    renderViewer();

    await waitFor(() => {
      // M03R-013 — asercja przeniesiona na powierzchnię, która NAPRAWDĘ niesie
      // status. Test szukał `property-status` w Properties Stripie, ale ten
      // został ŚWIADOMIE wycofany z centrum artefaktu (zmiana #54): metadane
      // mieszkają w `ArtifactRightPanel`. `NModeShell` nie dostaje już nawet
      // propa `properties` (pomiar: pusta tablica), więc asercja celowała w
      // powierzchnię wycofaną projektowo, a nie w defekt produktu.
      //
      // Wymaganie zostaje identyczne — użytkownik musi zobaczyć „Published" —
      // zmienia się tylko miejsce, w którym go szukamy.
      const rightPanel = screen.getByTestId('nmode-right-panel');
      expect(within(rightPanel).getAllByText('Published').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows insufficient confidence badge for weak findings', async () => {
    setupMocks({
      reviewStatus: 'published',
      themes: [
        {
          title: 'Weak Finding',
          description: 'Not enough data to support this.',
          evidence_refs: [],
          strength: 'weak',
          confidence: 'insufficient',
          limits: [],
        },
      ],
    });
    renderViewer();

    await waitFor(
      () => {
        const insufficientBadges = screen.queryAllByText(/Insufficient data/);
        expect(insufficientBadges.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 }
    );
  });

  it('renders confidence badge in themes section', async () => {
    setupMocks({
      themeConfidence: 'medium',
      reviewStatus: 'published',
    });
    renderViewer();

    await waitFor(
      () => {
        const badges = screen.queryAllByText(/Medium confidence/);
        expect(badges.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 }
    );
  });

  it('renders limits section toggle for theme findings when limits exist', async () => {
    setupMocks({
      themeLimits: ['Only interviewed 3 out of 20 team members'],
      reviewStatus: 'published',
    });
    renderViewer();

    await waitFor(
      () => {
        const limitsToggles = screen.queryAllByText(/Limits & assumptions|Limity i założenia/);
        expect(limitsToggles.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 }
    );
  });

  it('does not call handoff API without user action', async () => {
    setupMocks({ reviewStatus: 'published' });
    renderViewer();

    await waitFor(() => {
      expect(mockGetInsight).toHaveBeenCalledWith('insight-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith(
      expect.stringContaining('/handoff'),
      expect.anything()
    );
  });
});
