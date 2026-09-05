/**
 * @vitest-environment jsdom
 *
 * Odbiór 05.09 (05-ocena, defekt 2): panel jakości nie pokazywał trzech kafli
 * z obrazu (Kompletność / Śr. poziom osiągnięty / Pokrycie dowodami) — zamiast
 * nich zdanie „Ocena dostępna tylko dla assessmentów DRD.", i to na rekordzie
 * DRD. Kafle są w kodzie od dawna, ale renderują się TYLKO gdy backend odda
 * `scoring`; backend gatował to na złej kolumnie (patrz
 * server/src/routes/v8/__tests__/assessmentFramework.test.ts).
 *
 * Ten test broni drugiej połowy łańcucha: mając realny kształt `scoring`
 * z serwera, panel MUSI narysować trzy kafle z prawdziwymi liczbami.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAssessmentMock,
  listEvidenceMock,
  listReviewHistoryMock,
  getAcceptedReportMock,
} = vi.hoisted(() => ({
  getAssessmentMock: vi.fn(),
  listEvidenceMock: vi.fn(),
  listReviewHistoryMock: vi.fn(),
  getAcceptedReportMock: vi.fn(),
}));

vi.mock('@/services/api/v8/assessment', () => ({
  V8AssessmentApi: {
    getAssessment: getAssessmentMock,
    listEvidence: listEvidenceMock,
    listReviewHistory: listReviewHistoryMock,
    getAcceptedReport: getAcceptedReportMock,
    addEvidence: vi.fn(),
    submitReview: vi.fn(),
  },
}));

vi.mock('@/components/assessment/drd/DRDAssessmentEditor', () => ({
  DRDMatrixGrid: () => <div data-testid="drd-matrix-grid" />,
}));

const i18nStub = { language: 'pl', changeLanguage: vi.fn(), on: vi.fn(), off: vi.fn() };
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k, i18n: i18nStub }),
  Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

import { AssessmentQualityReviewPanel } from '@/components/assessment/AssessmentQualityReviewPanel';

const SCORING = {
  completionPercent: 42,
  overallAvgAchievedLevel: 2.35,
  overallAvgTargetLevel: 4.1,
  evidenceCoverage: 17,
  axes: [
    {
      axisId: '1',
      axisName: 'Procesy Sprzedaży',
      avgAchievedLevel: 2.5,
      avgTargetLevel: 4,
      gap: 1.5,
      evidenceCount: 2,
      hasEvidence: true,
    },
    {
      axisId: '2',
      axisName: 'Procesy Marketingu',
      avgAchievedLevel: 2.2,
      avgTargetLevel: 4.2,
      gap: 2,
      evidenceCount: 0,
      hasEvidence: false,
    },
  ],
};

describe('AssessmentQualityReviewPanel — trzy kafle z obrazu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAssessmentMock.mockResolvedValue({ assessment: { answers: { drd: { areas: {} } } } });
    listReviewHistoryMock.mockResolvedValue({ reviews: [] });
    getAcceptedReportMock.mockRejectedValue(new Error('no accepted output'));
  });

  it('rysuje Kompletność / Śr. poziom osiągnięty / Pokrycie dowodami z danych scoringu', async () => {
    listEvidenceMock.mockResolvedValue({ evidence: [], scoring: SCORING });

    render(<AssessmentQualityReviewPanel assessmentId="dbr77-assess-001" />);

    const completeness = await screen.findByTestId('assessment-quality-tile-completeness');
    expect(completeness).toHaveTextContent('Kompletność');
    expect(completeness).toHaveTextContent('42%');

    const avgLevel = screen.getByTestId('assessment-quality-tile-avg-level');
    expect(avgLevel).toHaveTextContent('Śr. poziom osiągnięty');
    expect(avgLevel).toHaveTextContent('2.4');

    const coverage = screen.getByTestId('assessment-quality-tile-evidence-coverage');
    expect(coverage).toHaveTextContent('Pokrycie dowodami');
    expect(coverage).toHaveTextContent('17%');

    // i nie ma komunikatu zastępczego
    expect(
      screen.queryByTestId('assessment-quality-scoring-unavailable')
    ).not.toBeInTheDocument();
  });

  it('bez scoringu nie twierdzi, że rekord nie jest DRD', async () => {
    listEvidenceMock.mockResolvedValue({ evidence: [], scoring: null });

    render(<AssessmentQualityReviewPanel assessmentId="siri-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('assessment-quality-scoring-unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('assessment-quality-tile-completeness')).not.toBeInTheDocument();
    expect(screen.queryByText('Ocena dostępna tylko dla assessmentów DRD.')).not.toBeInTheDocument();
  });
});
