/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import {
  InsightPackView,
  mapScoreToP10Level,
  P10ConfidenceBadge,
  resolveConfidenceLevel,
  type EvidencePointer,
} from '@/components/Interview/InsightPackView';

function buildInsightRow(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'ins-1',
    title: overrides.title ?? 'Test Insight',
    category: overrides.category ?? 'risk',
    status: overrides.status ?? 'completed',
    structuredContent: overrides.structuredContent ?? {
      category: 'risk',
      statement: 'Test statement',
      whyItMatters: 'Important because...',
      confidenceScore: overrides.confidenceScore ?? 3,
      confidenceLevel: overrides.confidenceLevel,
      evidence: overrides.evidence ?? [
        { excerpt: 'User mentioned friction', sessionId: 's1', questionId: 'q1' },
      ],
      assumptions: overrides.assumptions ?? [],
      unknowns: overrides.unknowns ?? [],
      counterpoints: overrides.counterpoints ?? [],
    },
    evidenceLinks: overrides.evidenceLinks ?? [],
    unknowns: overrides.unknowns ?? [],
    counterpoints: overrides.counterpoints ?? [],
    assumptions: overrides.assumptions ?? [],
    confidenceScore: overrides.confidenceScore ?? 3,
    confidenceLevel: overrides.confidenceLevel,
    insightCategory: overrides.insightCategory ?? 'risk',
    inferenceRunId: 'run-1',
    createdAt: '2025-01-01T00:00:00Z',
  };
}

function mockFetchInsights(insights: any[]) {
  vi.mocked(global.fetch).mockImplementation(async (url: any) => {
    const u = typeof url === 'string' ? url : String(url);
    if (u.includes('/insights')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ insights }),
        headers: new Headers(),
      } as Response;
    }
    if (u.includes('/inference/runs')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ runs: [] }),
        headers: new Headers(),
      } as Response;
    }
    return { ok: true, status: 200, json: async () => ({}), headers: new Headers() } as Response;
  });
}

function renderView(insights: any[] = []) {
  mockFetchInsights(insights);
  return render(
    <InsightPackView organizationId="org-1" sessionIds={['s1']} />
  );
}

// ── Unit: mapScoreToP10Level ──────────────────────────────────────────────────

describe('mapScoreToP10Level', () => {
  it('maps 1 → insufficient', () => {
    expect(mapScoreToP10Level(1)).toBe('insufficient');
  });

  it('maps 2 → low', () => {
    expect(mapScoreToP10Level(2)).toBe('low');
  });

  it('maps 3 → medium', () => {
    expect(mapScoreToP10Level(3)).toBe('medium');
  });

  it('maps 4 → high', () => {
    expect(mapScoreToP10Level(4)).toBe('high');
  });

  it('maps 5 → high', () => {
    expect(mapScoreToP10Level(5)).toBe('high');
  });
});

// ── Unit: resolveConfidenceLevel ──────────────────────────────────────────────

describe('resolveConfidenceLevel', () => {
  it('prefers explicit confidenceLevel over score', () => {
    expect(resolveConfidenceLevel({ confidenceLevel: 'low', confidenceScore: 5 })).toBe('low');
  });

  it('falls back to score mapping when confidenceLevel is unknown', () => {
    expect(resolveConfidenceLevel({ confidenceLevel: 'unknown', confidenceScore: 4 })).toBe('high');
  });

  it('falls back to score mapping when confidenceLevel is absent', () => {
    expect(resolveConfidenceLevel({ confidenceScore: 2 })).toBe('low');
  });

  it('preserves contradicted level', () => {
    expect(resolveConfidenceLevel({ confidenceLevel: 'contradicted' })).toBe('contradicted');
  });
});

// ── P10ConfidenceBadge rendering ──────────────────────────────────────────────

describe('P10ConfidenceBadge', () => {
  it('shows "High confidence" for high level', () => {
    render(<P10ConfidenceBadge level="high" />);
    expect(screen.getByText('High confidence')).toBeInTheDocument();
  });

  it('shows "Medium" for medium level', () => {
    render(<P10ConfidenceBadge level="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('shows "Hypothesis" for low level', () => {
    render(<P10ConfidenceBadge level="low" />);
    expect(screen.getByText('Hypothesis')).toBeInTheDocument();
  });

  it('shows "Insufficient — draft only" for insufficient level', () => {
    render(<P10ConfidenceBadge level="insufficient" />);
    expect(screen.getByText('Insufficient — draft only')).toBeInTheDocument();
  });

  it('shows "Contradicted" badge for contradicted level', () => {
    render(<P10ConfidenceBadge level="contradicted" />);
    expect(screen.getByText('Contradicted')).toBeInTheDocument();
  });
});

// ── Integration: InsightPackView P10 alignment ────────────────────────────────

describe('InsightPackView P10 alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders P10 confidence badge instead of stars', async () => {
    const insight = buildInsightRow({ confidenceScore: 4 });
    renderView([insight]);

    const badge = await screen.findByTestId('confidence-badge');
    expect(badge).toHaveTextContent('High confidence');
    expect(screen.queryByRole('img', { name: /star/i })).not.toBeInTheDocument();
  });

  it('maps score 1 to insufficient badge on collapsed row', async () => {
    const insight = buildInsightRow({ confidenceScore: 1 });
    renderView([insight]);

    const badge = await screen.findByTestId('confidence-badge');
    expect(badge).toHaveTextContent('Insufficient');
  });

  it('maps score 2 to Hypothesis badge on collapsed row', async () => {
    const insight = buildInsightRow({ confidenceScore: 2 });
    renderView([insight]);

    const badge = await screen.findByTestId('confidence-badge');
    expect(badge).toHaveTextContent('Hypothesis');
  });

  it('shows limits section always visible (not collapsed) when expanded', async () => {
    const insight = buildInsightRow({
      unknowns: ['We did not measure retention'],
    });
    renderView([insight]);

    const titleBtn = await screen.findByText('Test Insight');
    fireEvent.click(titleBtn);

    const limits = screen.getByTestId('limits-section');
    expect(limits).toBeInTheDocument();
    expect(limits).toBeVisible();
    expect(within(limits).getByText('Limits')).toBeInTheDocument();
    expect(within(limits).getByText('We did not measure retention')).toBeInTheDocument();
  });

  it('shows limits section even when unknowns are empty', async () => {
    const insight = buildInsightRow({ unknowns: [] });
    renderView([insight]);

    const titleBtn = await screen.findByText('Test Insight');
    fireEvent.click(titleBtn);

    const limits = screen.getByTestId('limits-section');
    expect(limits).toBeVisible();
    expect(within(limits).getByText('No limits specified')).toBeInTheDocument();
  });

  it('shows "Source unavailable" for broken evidence pointer', async () => {
    const brokenEvidence: EvidencePointer[] = [
      {
        pointerId: 'ptr-1',
        type: 'interview_session',
        sourceRef: 'session-deleted',
        excerpt: null,
        capturedExcerpt: null,
        isTombstone: false,
      },
    ];
    const insight = buildInsightRow({ evidence: brokenEvidence });
    renderView([insight]);

    const titleBtn = await screen.findByText('Test Insight');
    fireEvent.click(titleBtn);

    expect(screen.getByTestId('broken-pointer')).toBeInTheDocument();
    expect(screen.getByText('Source unavailable')).toBeInTheDocument();
  });

  it('shows tombstone evidence with strikethrough and removal reason', async () => {
    const tombstoneEvidence: EvidencePointer[] = [
      {
        pointerId: 'ptr-2',
        type: 'transcript_excerpt',
        sourceRef: 'ref-1',
        capturedExcerpt: 'Old quote from interview',
        isTombstone: true,
        removalReason: 'Superseded by newer data',
      },
    ];
    const insight = buildInsightRow({ evidence: tombstoneEvidence });
    renderView([insight]);

    const titleBtn = await screen.findByText('Test Insight');
    fireEvent.click(titleBtn);

    const tombstone = screen.getByTestId('tombstone-evidence');
    expect(tombstone).toBeInTheDocument();
    expect(tombstone).toHaveTextContent('Old quote from interview');
    expect(tombstone).toHaveTextContent('Removed: Superseded by newer data');

    const struck = tombstone.querySelector('.line-through');
    expect(struck).toBeTruthy();
  });

  it('shows Hypothesis label + warning for low confidence findings', async () => {
    const insight = buildInsightRow({ confidenceScore: 2 });
    renderView([insight]);

    const badge = await screen.findByTestId('confidence-badge');
    expect(badge).toHaveTextContent('Hypothesis');

    const titleBtn = screen.getByText('Test Insight');
    fireEvent.click(titleBtn);

    const warning = screen.getByTestId('hypothesis-warning');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent('Hypothesis');
    expect(warning).toHaveTextContent('may be inaccurate');
  });

  it('shows contradiction callout for contradicted findings', async () => {
    const insight = buildInsightRow({ confidenceLevel: 'contradicted' });
    renderView([insight]);

    const badge = await screen.findByTestId('confidence-badge');
    expect(badge).toHaveTextContent('Contradicted');

    const titleBtn = screen.getByText('Test Insight');
    fireEvent.click(titleBtn);

    const callout = screen.getByTestId('contradiction-callout');
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent('Contradictory evidence detected');
    expect(callout).toHaveTextContent('Automatic handoff is blocked');
  });

  it('shows duplicate indicator when same source appears twice', async () => {
    const dupEvidence: EvidencePointer[] = [
      {
        pointerId: 'ptr-a',
        type: 'interview_session',
        sourceRef: 'session-42',
        sourceFingerprint: 'fp-1',
        capturedExcerpt: 'First mention',
        isTombstone: false,
      },
      {
        pointerId: 'ptr-b',
        type: 'interview_session',
        sourceRef: 'session-42',
        sourceFingerprint: 'fp-1',
        capturedExcerpt: 'Second mention',
        isTombstone: false,
      },
    ];
    const insight = buildInsightRow({ evidence: dupEvidence });
    renderView([insight]);

    const titleBtn = await screen.findByText('Test Insight');
    fireEvent.click(titleBtn);

    const dupes = screen.getAllByTestId('duplicate-indicator');
    expect(dupes.length).toBe(2);
  });

  it('shows evidence type icon when pointer type is available', async () => {
    const typedEvidence: EvidencePointer[] = [
      {
        pointerId: 'ptr-typed',
        type: 'transcript_excerpt',
        sourceRef: 'tx-1',
        capturedExcerpt: 'From the transcript',
        isTombstone: false,
      },
    ];
    const insight = buildInsightRow({ evidence: typedEvidence });
    renderView([insight]);

    const titleBtn = await screen.findByText('Test Insight');
    fireEvent.click(titleBtn);

    expect(screen.getByText('"From the transcript"')).toBeInTheDocument();
  });

  it('shows assumptions for medium confidence findings', async () => {
    const insight = buildInsightRow({
      confidenceScore: 3,
      assumptions: ['Respondents represent the full team'],
    });
    renderView([insight]);

    const titleBtn = await screen.findByText('Test Insight');
    fireEvent.click(titleBtn);

    expect(screen.getByText('Respondents represent the full team')).toBeInTheDocument();
  });
});
