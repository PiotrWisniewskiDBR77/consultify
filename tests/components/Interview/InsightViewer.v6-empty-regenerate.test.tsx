/**
 * @vitest-environment jsdom
 *
 * Regression test for #57 "dramat pustych kart" — InsightViewer V6 section
 * cards (Themes/Issues/Opportunities/Signals/Evidence Map) used to show a
 * dead-end "will appear after V6 analysis" placeholder with no way forward
 * when an insight's structured V6 fields were empty (e.g. seed/imported rows
 * that never ran the generateInsight() pipeline). The fix wires the existing
 * `handleRegenerate` action (already used by the section card headers) into
 * the empty-state CTA itself, so the placeholder is no longer a dead end.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';

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
  NModeShell: ({ header, sections, renderActionBar }: any) => (
    <div>
      <div data-testid="nmode-header">{header?.title}</div>
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

// Unlike the P10 handoff test file, the EmptyStateInline stub here renders
// the `action` CTA (the actual thing under test) — a minimal stand-in for
// the real component's message/hint/action contract, not the real component
// itself (importing the real NModeBlocks barrel drags in TipTap/highlight.js
// via InlineTable's dependents, which the vitest/jsdom setup can't resolve).
vi.mock('@/components/shared/NModeBlocks', () => ({
  Callout: ({ children }: any) => <div>{children}</div>,
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
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { InsightViewer } from '@/components/Interview/InsightViewer';

function buildEmptyV6Insight(overrides: Record<string, any> = {}) {
  return {
    id: 'insight-1',
    organizationId: 'org-1',
    title: 'Seeded Insight (no V6 breakdown)',
    promptType: 'summary',
    sourceSessionIds: ['session-1'],
    // Narrative content exists (this is the seed-row shape from #57) but the
    // structured V6 fields were never populated.
    content: '## Seeded Insight\n\n**Observation.** Something was seeded directly.',
    executiveSummary: undefined,
    themes: [],
    issues: [],
    opportunities: [],
    signals: [],
    evidenceMap: [],
    missingData: [],
    status: 'completed',
    reviewStatus: 'draft',
    sourceSessionCount: 1,
    tokensUsed: 0,
    generationTimeMs: 0,
    createdBy: 'user-1',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:01:00Z',
    ...overrides,
  };
}

function setupMocks(insightOverrides: Record<string, any> = {}) {
  const insightData = buildEmptyV6Insight(insightOverrides);
  mockGetInsight.mockResolvedValue({ insight: insightData });
  mockGetInsightActivity.mockResolvedValue({ activity: [] });
  mockGetInsightComments.mockResolvedValue({ comments: [] });
  mockRegenerateInsight.mockResolvedValue({ insight: buildEmptyV6Insight(insightOverrides) });
}

function renderViewer() {
  return render(<InsightViewer insightId="insight-1" onClose={vi.fn()} />);
}

describe('InsightViewer V6 empty-state regenerate CTA (#57)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers a "Generate V6 analysis" CTA on empty V6 cards once the insight has completed', async () => {
    setupMocks();
    renderViewer();

    await waitFor(() => {
      expect(screen.getByTestId('nmode-header')).toHaveTextContent('Seeded Insight');
    });

    await waitFor(() => {
      const ctas = screen.queryAllByText(/Generate V6 analysis/i);
      // Themes, Issues, Opportunities, Signals, Evidence Map — 5 empty cards.
      expect(ctas.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('calls the existing regenerate endpoint when the empty-state CTA is clicked', async () => {
    setupMocks();
    renderViewer();

    await waitFor(() => {
      expect(screen.queryAllByText(/Generate V6 analysis/i).length).toBeGreaterThan(0);
    });

    const [firstCta] = screen.getAllByText(/Generate V6 analysis/i);
    fireEvent.click(firstCta);

    await waitFor(() => {
      expect(mockRegenerateInsight).toHaveBeenCalledWith('insight-1');
    });
  });

  it('does not offer the CTA while the insight is still generating', async () => {
    setupMocks({ status: 'generating' });
    renderViewer();

    await waitFor(() => {
      expect(screen.getByTestId('nmode-header')).toHaveTextContent('Seeded Insight');
    });

    expect(screen.queryAllByText(/Generate V6 analysis/i).length).toBe(0);
  });
});
