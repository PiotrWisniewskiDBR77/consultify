/**
 * @vitest-environment jsdom
 *
 * IS-3b (Wpis 95 / DEC-510 / U-08) — Executive Summary prose render.
 *
 * Behind VITE_INTERVIEW_EXEC_SUMMARY_PROSE:
 *  - ON: the section renders the generator prose (insight.executiveSummary) as
 *    document typography, the three counter tiles leave the body, and the
 *    OFFICIAL ANSWERS counter reads the single authoritative source
 *    (generationContext.sourceMaterial.includedAnswerCount) instead of the
 *    summary_facts-derived list length that collapses to 0 without a
 *    generateSummary step.
 *  - OFF: today's Callout + three body tiles, byte-for-byte.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

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

// The flag under test. A mutable closure lets one file assert both ON and OFF.
let execSummaryProseFlag = false;
vi.mock('@/utils/interviewExecSummaryProseFlag', () => ({
  isInterviewExecSummaryProseEnabled: () => execSummaryProseFlag,
}));

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
  NModeShell: ({ header, sections, rightPanel, renderActionBar }: any) => (
    <div>
      <div data-testid="nmode-header">{header?.title}</div>
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
  NModeCanvas: ({ sections }: any) => (
    <div data-testid="nmode-canvas">
      {sections?.map((s: any, i: number) => (
        <div key={s.id || i} data-testid={`section-${s.id}`}>
          {s.component}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/shared/NModeLayout/NModeLeftNav', () => ({
  NModeLeftNav: () => <div data-testid="nmode-leftnav" />,
}));

vi.mock('@/components/shared/NModeLayout/NModePropertiesStrip', () => ({
  NModePropertiesStrip: () => <div data-testid="nmode-properties" />,
}));

vi.mock('@/components/shared/NModeBlocks', () => ({
  Callout: ({ children, title }: any) => (
    <div data-testid="nmode-callout">
      <span>{title}</span>
      <span>{children}</span>
    </div>
  ),
  InlineTable: () => <div />,
  EmptyStateInline: ({ message, hint, action }: any) => (
    <div>
      <p>{message}</p>
      {hint && <p>{hint}</p>}
      {action && (
        <button onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </button>
      )}
    </div>
  ),
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
const mockRegenerateInsight = vi.fn();

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
    regenerateInsight: (...args: any[]) => mockRegenerateInsight(...args),
    updateInsight: vi.fn().mockResolvedValue({ success: true }),
    exportInsight: vi.fn().mockResolvedValue({ success: true }),
    createInsightComment: vi.fn().mockResolvedValue({}),
    deleteInsightComment: vi.fn().mockResolvedValue({ success: true }),
    deleteInsight: vi.fn().mockResolvedValue({ success: true }),
    getInsights: vi.fn().mockResolvedValue({ insights: [] }),
    getAnswerApprovals: vi.fn().mockResolvedValue({ assignmentId: '', approvals: [] }),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { InsightViewer } from '@/components/Interview/InsightViewer';

const PROSE = [
  'Leadership alignment is the headline finding.',
  'What we heard: six respondents described the same bottleneck.',
  'What to do next: fund the pilot before the quarter closes.',
].join('\n\n');

// IS-3b v2 (Wpis 123 pkt 1) — the generator prompt now asks for THREE named
// sections separated by a blank line. The headers render with section-header
// typography; the bodies render as plain prose paragraphs.
const NAMED_SECTIONS = [
  'What we heard',
  'Six respondents described the same approval bottleneck.',
  'What it means',
  'The bottleneck is eating the pilot runway before it starts.',
  'What to do',
  'Fund the pilot before the quarter closes.',
].join('\n\n');

function buildInsight(overrides: Record<string, any> = {}) {
  return {
    id: 'insight-1',
    organizationId: 'org-1',
    title: 'Interview Insight',
    promptType: 'summary',
    sourceSessionIds: ['session-1'],
    content: '## Interview Insight\n\n**Observation.** Narrative lead paragraph.',
    // Generator prose — distinct from the markdown-derived lead above.
    executiveSummary: PROSE,
    // Server-computed authoritative answer count (survives a missing
    // generateSummary step). summary_facts below stay empty, so the old
    // list-length source would read 0.
    generationContext: {
      sourceMaterial: {
        requestedSessionCount: 6,
        includedSessionCount: 6,
        excludedSessionCount: 0,
        includedAnswerCount: 6,
        includedSessionIds: ['session-1'],
        appliedFilters: { respondents: [], roles: [], departments: [], templates: [] },
      },
    },
    themes: [],
    issues: [],
    opportunities: [],
    signals: [],
    evidenceMap: [],
    missingData: [],
    status: 'completed',
    reviewStatus: 'published',
    sourceSessionCount: 6,
    tokensUsed: 0,
    generationTimeMs: 0,
    createdBy: 'user-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:01:00Z',
    ...overrides,
  };
}

function setupMocks(insightOverrides: Record<string, any> = {}) {
  const insightData = buildInsight(insightOverrides);
  mockGetInsight.mockResolvedValue({ insight: insightData });
  mockGetInsightActivity.mockResolvedValue({ activity: [] });
  mockGetInsightComments.mockResolvedValue({ comments: [] });
  mockRegenerateInsight.mockResolvedValue({ insight: buildInsight(insightOverrides) });
}

function renderViewer() {
  return render(<InsightViewer insightId="insight-1" onClose={vi.fn()} />);
}

async function waitForSection(): Promise<HTMLElement> {
  await waitFor(() => {
    expect(screen.getByTestId('section-executive-summary')).toBeTruthy();
  });
  return screen.getByTestId('section-executive-summary');
}

describe('InsightViewer IS-3b Executive Summary prose (DEC-510)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    execSummaryProseFlag = false;
  });

  describe('flag ON', () => {
    beforeEach(() => {
      execSummaryProseFlag = true;
    });

    it('renders the generator prose as document paragraphs, not the Callout', async () => {
      setupMocks();
      renderViewer();
      const section = await waitForSection();

      const prose = within(section).getByTestId('insight-exec-summary-prose');
      expect(prose).toHaveTextContent('Leadership alignment is the headline finding.');
      expect(prose).toHaveTextContent('What to do next: fund the pilot before the quarter closes.');
      // Each blank-line-separated paragraph becomes its own <p>.
      expect(prose.querySelectorAll('p')).toHaveLength(3);
      // The OFF Callout is gone from this section's body.
      expect(within(section).queryByTestId('nmode-callout')).toBeNull();
    });

    it('moves the three counter tiles out of the body into PROPERTIES', async () => {
      setupMocks();
      renderViewer();
      const section = await waitForSection();

      const panel = screen.getByTestId('nmode-right-panel');
      // Body no longer carries the tile labels.
      expect(within(section).queryByText('Official answers')).toBeNull();
      expect(within(section).queryByText('Issues / risks')).toBeNull();
      expect(within(section).queryByText('Signals / opportunities')).toBeNull();
      // PROPERTIES now does.
      expect(within(panel).getByText('Official answers')).toBeTruthy();
      expect(within(panel).getByText('Issues / risks')).toBeTruthy();
      expect(within(panel).getByText('Signals / opportunities')).toBeTruthy();
    });

    it('reads OFFICIAL ANSWERS from the single source (includedAnswerCount), not the empty summary_facts list', async () => {
      setupMocks();
      renderViewer();
      await waitForSection();

      const panel = screen.getByTestId('nmode-right-panel');
      const row = within(panel)
        .getByText('Official answers')
        .closest('tr') as HTMLTableRowElement;
      expect(row).toBeTruthy();
      expect(within(row).getByText('6')).toBeTruthy();
    });

    it('renders the three named sections with header typography (v2 prompt shape)', async () => {
      setupMocks({ executiveSummary: NAMED_SECTIONS });
      renderViewer();
      const section = await waitForSection();

      const prose = within(section).getByTestId('insight-exec-summary-prose');
      const headers = within(prose).getAllByTestId('insight-exec-summary-section-header');
      expect(headers.map((header) => header.textContent)).toEqual([
        'What we heard',
        'What it means',
        'What to do',
      ]);
      // 3 section headers + 3 body paragraphs, each its own <p>.
      expect(prose.querySelectorAll('p')).toHaveLength(6);
    });

    it('shows an explicit empty state with a working Regenerate action when the summary is blank (pkt3)', async () => {
      setupMocks({ executiveSummary: '', content: '' });
      renderViewer();
      const section = await waitForSection();

      const empty = within(section).getByTestId('insight-exec-summary-empty');
      expect(empty).toHaveTextContent('Summary not generated yet.');
      const regenerate = within(empty).getByTestId('insight-exec-summary-regenerate');
      expect(regenerate).toHaveTextContent('Regenerate');

      fireEvent.click(regenerate);
      await waitFor(() => {
        expect(mockRegenerateInsight).toHaveBeenCalledWith('insight-1');
      });
    });
  });

  describe('flag OFF (byte-for-byte today)', () => {
    it('keeps the Callout and the three body tiles, with no prose block', async () => {
      setupMocks();
      renderViewer();
      const section = await waitForSection();

      const panel = screen.getByTestId('nmode-right-panel');
      // Callout present, prose absent.
      expect(within(section).queryByTestId('insight-exec-summary-prose')).toBeNull();
      expect(within(section).getByTestId('nmode-callout')).toBeTruthy();
      // Tiles stay in the body.
      expect(within(section).getByText('Official answers')).toBeTruthy();
      expect(within(section).getByText('Issues / risks')).toBeTruthy();
      expect(within(section).getByText('Signals / opportunities')).toBeTruthy();
      // PROPERTIES does not carry the relocated counters.
      expect(within(panel).queryByText('Official answers')).toBeNull();
    });
  });
});
