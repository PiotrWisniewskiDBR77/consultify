/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AiReviewBadge, AiReviewPanelSection } from '../index';
import type { AiReviewSummary } from '@/services/aiReview/aiReviewSummary';

const labels = {
  title: 'AI review',
  reviewedAt: 'Reviewed',
  noSignals: 'No quality concerns detected',
  good: 'Good',
  needs_attention: 'Needs attention',
  blocked: 'Blocked',
  empty: 'No review',
  timeout: 'Timed out',
};

const summary: AiReviewSummary = {
  score0to100: 49,
  verdict: 'blocked',
  reviewedAt: '2026-09-18T09:00:00Z',
  sourceModule: 'interview',
  sourceId: 'interview-1',
  signals: [{ label: 'Evidence', severity: 'critical', message: 'Missing proof' }],
};

describe('AIR-1b shared AI review display', () => {
  it('renders the same column badge contract for Interview', () => {
    render(<AiReviewBadge summary={summary} labels={labels} />);

    expect(screen.getByText('49')).toBeTruthy();
    expect(screen.getByText('Blocked')).toBeTruthy();
    expect(screen.getByText('Blocked').className).toContain('text-c-danger');
  });

  it('renders the shared right-panel section with source module and signals', () => {
    render(<AiReviewPanelSection summary={summary} labels={labels} />);

    expect(screen.getByTestId('ai-review-block').getAttribute('data-ai-review-panel')).toBe(
      'interview'
    );
    expect(screen.getByText('AI review')).toBeTruthy();
    expect(screen.getByText('Evidence')).toBeTruthy();
    expect(screen.getByText(/Missing proof/)).toBeTruthy();
  });

  it('does not render a panel for empty score, but can show a table placeholder badge', () => {
    const empty: AiReviewSummary = { ...summary, score0to100: null, verdict: 'empty', signals: [] };
    const { container } = render(<AiReviewPanelSection summary={empty} labels={labels} />);
    expect(container.textContent).toBe('');

    render(<AiReviewBadge summary={empty} labels={labels} showEmpty />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
