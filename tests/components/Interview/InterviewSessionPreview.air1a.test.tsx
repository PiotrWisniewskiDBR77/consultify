import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { fromInterviewAiReview } from '@/services/aiReview/aiReviewSummary';
import { InterviewSessionPreviewBody } from '@/components/Interview/InterviewSessionPreview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const map: Record<string, string> = {
        'interview.sessionPreview.aiReview': 'AI Review',
        'interview.sessionPreview.aiReviewedAt': 'Reviewed',
        'interview.sessionPreview.session': 'Session',
        'interview.sessionPreview.progress': 'Progress',
        'interview.sessionPreview.answers': 'Answers',
        'interview.sessionPreview.started': 'Started',
        'interview.sessionPreview.lastActivity': 'Last activity',
        'interview.sessionPreview.owner': 'Owner',
        'interview.sessionPreview.collapse': 'Collapse',
        'interview.sessionPreview.expand': 'Expand',
        'interview.sessionPreview.copyStats': 'Copy stats',
        'interview.sessionPreview.copyId': 'Copy ID',
        'interview.sessionPreview.propertiesLabel': 'Progress',
        'interview.sessionPreview.property': 'Property',
        'interview.sessionPreview.value': 'Value',
        'interview.hub.aiVerdict.good': 'Good',
        'interview.hub.aiVerdict.needs_attention': 'Needs attention',
        'interview.hub.aiVerdict.blocked': 'Blocked',
        'interview.hub.aiVerdict.empty': 'No review',
        'interview.hub.aiVerdict.timeout': 'Timeout',
        'interview.hub.sessionStatusLabel.completed': 'Completed',
      };
      return map[key] || key;
    },
  }),
}));

const baseSession = {
  id: 'sess-1',
  name: 'Northwind Discovery',
  status: 'completed',
  answeredQuestions: 6,
  totalQuestions: 6,
  startedAt: '2026-09-10T08:00:00Z',
  lastActivityAt: '2026-09-12T14:30:00Z',
};

const baseProps = {
  session: baseSession,
  isPolish: false,
  statusConfig: { label: { pl: 'Zakończona', en: 'Completed' } },
  progress: 100,
  detailsExpanded: false,
  onToggleDetailsExpanded: vi.fn(),
  onCopyStats: vi.fn(),
  onCopyId: vi.fn(),
};

describe('InterviewSessionPreviewBody — AI review block (AIR-1a)', () => {
  it('does NOT render ai-review-block when aiReviewSummary is null (flag OFF parity)', () => {
    render(<InterviewSessionPreviewBody {...baseProps} aiReviewSummary={null} />);
    expect(screen.queryByTestId('ai-review-block')).toBeNull();
  });

  it('does NOT render ai-review-block when aiReviewSummary is undefined', () => {
    render(<InterviewSessionPreviewBody {...baseProps} />);
    expect(screen.queryByTestId('ai-review-block')).toBeNull();
  });

  it('renders ai-review-block with score and verdict when summary provided', () => {
    const summary = fromInterviewAiReview(
      {
        overallScore: 4.2,
        overallVerdict: 'ready_for_approval',
        questionEvaluations: [],
        recommendations: ['Add metrics'],
        weakAnswerMap: [
          { key: 'q3', label: 'Timeline', score: 2, verdict: 'needs_improvement', feedback: 'Missing dates', fixType: 'expand' as any, isRequired: false },
        ],
      },
      '2026-09-12T14:00:00Z',
      'assign-1'
    );
    render(<InterviewSessionPreviewBody {...baseProps} aiReviewSummary={summary} />);
    const block = screen.getByTestId('ai-review-block');
    expect(block).toBeTruthy();
    expect(block.textContent).toContain('80');
    expect(block.textContent).toContain('Good');
    expect(block.textContent).toContain('AI Review');
    expect(block.textContent).toContain('Timeline');
  });

  it('renders blocked verdict with score below 50', () => {
    const summary = fromInterviewAiReview(
      {
        overallScore: 2.0,
        overallVerdict: 'insufficient',
        questionEvaluations: [],
        recommendations: [],
        weakAnswerMap: [],
      },
      null,
      'assign-2'
    );
    render(<InterviewSessionPreviewBody {...baseProps} aiReviewSummary={summary} />);
    const block = screen.getByTestId('ai-review-block');
    expect(block.textContent).toContain('25');
    expect(block.textContent).toContain('Blocked');
  });

  it('does NOT render block when score0to100 is null (empty review)', () => {
    const summary = fromInterviewAiReview(null, null, 'assign-3');
    render(<InterviewSessionPreviewBody {...baseProps} aiReviewSummary={summary} />);
    expect(screen.queryByTestId('ai-review-block')).toBeNull();
  });
});
