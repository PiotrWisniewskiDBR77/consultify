/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentQualityReviewPanel } from '../AssessmentQualityReviewPanel';

const api = vi.hoisted(() => ({
  getAssessment: vi.fn(),
  listEvidence: vi.fn(),
  listReviewHistory: vi.fn(),
  getAcceptedReport: vi.fn(),
}));

vi.mock('@/services/api/v8/assessment', () => ({ V8AssessmentApi: api }));
vi.mock('@/components/standard/StandardTable', () => ({
  StandardTable: () => <div data-testid="day275-standard-table" />,
}));
vi.mock('@/components/assessment/drd/DRDAssessmentEditor', () => ({
  DRDMatrixGrid: (props: { value?: { areas?: Record<string, unknown> } }) => (
    <div
      data-testid="day275-drd-matrix-grid"
      data-area-count={Object.keys(props.value?.areas ?? {}).length}
    />
  ),
}));

describe('Day 275 — macierz obok tabeli w panelu jakości', () => {
  beforeEach(() => {
    api.getAssessment.mockResolvedValue({
      assessment: {
        answers: { drd: { areas: { '1A': { achievedLevel: 3, targetLevel: 5 } } } },
      },
    });
    api.listEvidence.mockResolvedValue({
      evidence: [],
      scoring: {
        completionPercent: 100,
        overallAvgAchievedLevel: 3,
        evidenceCoverage: 0,
        axesMissingEvidence: ['1'],
        axes: [
          {
            axisId: '1',
            axisName: 'Procesy Cyfrowe',
            areaCount: 9,
            answeredAreas: 1,
            avgAchievedLevel: 3,
            avgTargetLevel: 5,
            gap: 2,
            evidenceCount: 0,
            hasEvidence: false,
          },
        ],
      },
    });
    api.listReviewHistory.mockResolvedValue({ reviews: [] });
    api.getAcceptedReport.mockRejectedValue(new Error('NO_ACCEPTED_OUTPUT'));
  });

  it('renderuje kanoniczny grid z dokładnych answers.drd oraz zachowuje StandardTable obok', async () => {
    render(<AssessmentQualityReviewPanel assessmentId="assessment-275" />);

    await waitFor(() => expect(screen.getByTestId('day275-drd-matrix-grid')).toBeInTheDocument());
    expect(screen.getByTestId('day275-drd-matrix-grid')).toHaveAttribute('data-area-count', '1');
    expect(screen.getByTestId('day275-standard-table')).toBeInTheDocument();
    expect(api.getAssessment).toHaveBeenCalledWith('assessment-275');
  });
});
