/**
 * @vitest-environment jsdom
 *
 * Component tests for `<TabeleQaPanel>` (Block C · C-S5).
 *
 * Coverage:
 *   - Renders QaHealthBar + axis cards + suggestions for a fresh report.
 *   - "Recompute" triggers the API and replaces the report.
 *   - Suggestion dismissal optimistically removes the card.
 *   - "Open in AI Editor" forwards the suggestion to the parent.
 *   - Empty-suggestions state renders the "great shape" banner.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recomputeQaReport: vi.fn(),
  getLatestQaReport: vi.fn(),
  dismissQaSuggestion: vi.fn(),
}));

vi.mock('@/services/api/tablePlatform.api', () => ({
  recomputeQaReport: mocks.recomputeQaReport,
  getLatestQaReport: mocks.getLatestQaReport,
  dismissQaSuggestion: mocks.dismissQaSuggestion,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import { TabeleQaPanel } from '../qa/TabeleQaPanel';

const SAMPLE_REPORT = {
  id: 'rep-1',
  tableId: 'tbl-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  computedAt: '2026-05-09T10:00:00Z',
  computedBy: 'user-1',
  triggerKind: 'on_demand' as const,
  overallScore: 0.72,
  axes: {
    completeness: {
      score: 0.6,
      band: 'amber' as const,
      details: [{ metric: 'fill_rate', value: 0.6 }],
    },
    freshness: { score: 1, band: 'green' as const, details: [] },
    sourceCoverage: { score: 0.4, band: 'red' as const, details: [] },
    methodology: { score: 1, band: 'green' as const, details: [] },
    formulaConsistency: { score: 1, band: 'green' as const, details: [] },
  },
  suggestions: [
    {
      id: 'qa_x_0',
      fingerprint: 'qa_abc',
      axis: 'completeness' as const,
      description: 'Bulk-fill column "name"',
      recommendedAction: {
        kind: 'open_ai_editor' as const,
        level: 'column' as const,
        payload: { fieldId: 'f1' },
      },
      severity: 'medium' as const,
    },
  ],
  computationMs: 12,
};

describe('<TabeleQaPanel>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders health bar, axes and suggestions when given an initial report', () => {
    render(<TabeleQaPanel tableId="tbl-1" testInitialReport={SAMPLE_REPORT} />);
    expect(screen.getByTestId('tabele-qa-panel')).toBeInTheDocument();
    expect(screen.getByTestId('qa-health-bar')).toBeInTheDocument();
    expect(screen.getByTestId('qa-axis-completeness')).toBeInTheDocument();
    expect(screen.getByTestId('qa-axis-sourceCoverage')).toBeInTheDocument();
    expect(screen.getByTestId('qa-suggestion-list')).toBeInTheDocument();
    expect(screen.getByText(/Bulk-fill column/i)).toBeInTheDocument();
  });

  it('triggers recompute and replaces the report', async () => {
    const fresh = { ...SAMPLE_REPORT, id: 'rep-2', overallScore: 0.99 };
    mocks.recomputeQaReport.mockResolvedValueOnce(fresh);

    render(<TabeleQaPanel tableId="tbl-1" testInitialReport={SAMPLE_REPORT} />);
    fireEvent.click(screen.getByTestId('qa-recompute-button'));

    await waitFor(() => {
      expect(mocks.recomputeQaReport).toHaveBeenCalledWith('tbl-1', 'on_demand');
    });
  });

  it('optimistically removes a dismissed suggestion', async () => {
    mocks.dismissQaSuggestion.mockResolvedValueOnce({
      tableId: 'tbl-1',
      fingerprint: 'qa_abc',
      dismissed: true,
    });

    render(<TabeleQaPanel tableId="tbl-1" testInitialReport={SAMPLE_REPORT} />);
    expect(screen.getByText(/Bulk-fill column/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('qa-suggestion-dismiss'));

    await waitFor(() => {
      expect(screen.queryByText(/Bulk-fill column/i)).toBeNull();
    });
    expect(mocks.dismissQaSuggestion).toHaveBeenCalledWith('tbl-1', 'qa_x_0', 'qa_abc');
  });

  it('forwards "Open in AI Editor" to the parent callback', () => {
    const onOpen = vi.fn();
    render(
      <TabeleQaPanel tableId="tbl-1" testInitialReport={SAMPLE_REPORT} onOpenInAiEditor={onOpen} />
    );
    fireEvent.click(screen.getByTestId('qa-suggestion-open-ai'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ fingerprint: 'qa_abc', axis: 'completeness' })
    );
  });

  it('renders the empty-suggestions banner when none remain', () => {
    const empty = { ...SAMPLE_REPORT, suggestions: [] };
    render(<TabeleQaPanel tableId="tbl-1" testInitialReport={empty} />);
    expect(screen.getByTestId('qa-suggestion-list-empty')).toBeInTheDocument();
  });
});
