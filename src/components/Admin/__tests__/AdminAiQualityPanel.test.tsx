import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getAiQualityAnalytics,
  getAiQualityFeedback,
  getAiQualityMetrics,
  getAiQualityPatterns,
  reviewAiQualityFeedback,
} from '../../../services/adminAiQualityApi';
import { AdminAiQualityPanel } from '../AdminAiQualityPanel';

vi.mock('../../../services/adminAiQualityApi', () => ({
  getAiQualityMetrics: vi.fn(),
  getAiQualityFeedback: vi.fn(),
  getAiQualityPatterns: vi.fn(),
  getAiQualityAnalytics: vi.fn(),
  reviewAiQualityFeedback: vi.fn(),
  updateAiQualityPatternStatus: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const metrics = vi.mocked(getAiQualityMetrics);
const feedback = vi.mocked(getAiQualityFeedback);
const patterns = vi.mocked(getAiQualityPatterns);
const analytics = vi.mocked(getAiQualityAnalytics);
const review = vi.mocked(reviewAiQualityFeedback);

describe('AdminAiQualityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metrics.mockResolvedValue({
      satisfactionRate: 80,
      totalFeedback: 10,
      positiveFeedback: 8,
      negativeFeedback: 2,
      avgActionability: 4,
      avgAccuracy: 4,
      activePatternsCount: 1,
      userProfilesCount: 2,
    });
    feedback.mockResolvedValue([
      { id: 'f1', user_name: 'Ada', feedback_type: 'HELPFUL', reviewed_at: null },
    ]);
    patterns.mockResolvedValue([
      { id: 'p1', pattern_type: 'tone', pattern_value: 'brief', status: 'active' },
    ]);
    analytics.mockResolvedValue({ contexts: [{}], formats: [], issues: [] });
  });

  it('renders real metrics, feedback and patterns', async () => {
    render(<AdminAiQualityPanel />);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('brief')).toBeInTheDocument();
  });

  it('renders honest empty states', async () => {
    feedback.mockResolvedValue([]);
    patterns.mockResolvedValue([]);
    render(<AdminAiQualityPanel />);
    expect(await screen.findByText('Brak feedbacku')).toBeInTheDocument();
    expect(screen.getByText('Brak wzorców')).toBeInTheDocument();
  });

  it('renders a load error', async () => {
    metrics.mockRejectedValue(new Error('Quality API unavailable'));
    render(<AdminAiQualityPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Quality API unavailable');
  });

  it('requires list readback before confirming review', async () => {
    feedback
      .mockResolvedValueOnce([{ id: 'f1', user_name: 'Ada', reviewed_at: null }])
      .mockResolvedValueOnce([{ id: 'f1', user_name: 'Ada', reviewed_at: '2026-08-25T05:00:00Z' }]);
    review.mockResolvedValue({ success: true } as never);
    render(<AdminAiQualityPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Oznacz jako przejrzane' }));
    await waitFor(() => expect(feedback).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Przejrzane')).toBeInTheDocument();
  });
});
