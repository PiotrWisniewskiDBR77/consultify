/**
 * @vitest-environment jsdom
 *
 * ASM-005/006/007 — golden-flow coverage for AssessmentQualityReviewPanel
 * (src/components/assessment/AssessmentQualityReviewPanel.tsx). The v8
 * assessment API is mocked (`@/services/api/v8/assessment`'s `V8AssessmentApi`
 * object) — this suite is about the panel's data-fetch/render/submit wiring,
 * not the server contract itself (covered by the ASM-005/006/007 acceptance
 * tests). react-i18next is stubbed because the embedded StandardTable
 * (scoring axes table) calls useTranslation internally, mirroring
 * tests/components/standard/StandardTable.test.tsx.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssessmentQualityReviewPanel } from '../../../src/components/assessment/AssessmentQualityReviewPanel';

const listEvidence = vi.fn();
const addEvidence = vi.fn();
const submitReview = vi.fn();
const listReviewHistory = vi.fn();
const getAcceptedReport = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('@/services/api/v8/assessment', () => ({
  V8AssessmentApi: {
    listEvidence: (...args: unknown[]) => listEvidence(...args),
    addEvidence: (...args: unknown[]) => addEvidence(...args),
    submitReview: (...args: unknown[]) => submitReview(...args),
    listReviewHistory: (...args: unknown[]) => listReviewHistory(...args),
    getAcceptedReport: (...args: unknown[]) => getAcceptedReport(...args),
  },
}));

const ASSESSMENT_ID = 'asm-quality-review-1';

const baseScoring = {
  completionPercent: 100,
  overallAvgAchievedLevel: 3.2,
  evidenceCoverage: 57,
  axesMissingEvidence: ['3', '5', '6'],
  axes: [
    {
      // Deliberately NOT the real DRD_STRUCTURE axis 1 namePL ("Procesy
      // Cyfrowe") — that exact string also appears as an <option> in the
      // "Dodaj dowód" axis <select> (real, unmocked DRD_STRUCTURE), which
      // would make getByText ambiguous. A distinct fixture name proves the
      // scoring table renders from the mocked `scoring.axes` response.
      axisId: '1',
      axisName: 'Scoring Fixture Axis One',
      areaCount: 9,
      answeredAreas: 9,
      avgAchievedLevel: 3,
      avgTargetLevel: 4,
      gap: 1,
      evidenceCount: 2,
      hasEvidence: true,
    },
    {
      axisId: '2',
      axisName: 'Scoring Fixture Axis Two',
      areaCount: 5,
      answeredAreas: 5,
      avgAchievedLevel: 3.4,
      avgTargetLevel: 4,
      gap: 0.6,
      evidenceCount: 1,
      hasEvidence: true,
    },
  ],
};

const baseEvidence = [
  {
    id: 'ev-1',
    organizationId: 'org-1',
    assessmentId: ASSESSMENT_ID,
    axisId: '1',
    areaId: '1A',
    evidenceType: 'note',
    title: 'Sales process audit notes',
    description: 'Existing evidence row',
    url: null,
    createdBy: 'user-1',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
];

const baseReviews = [
  {
    id: 'rev-1',
    organizationId: 'org-1',
    assessmentId: ASSESSMENT_ID,
    action: 'return',
    actorId: 'user-1',
    actorRole: 'admin',
    rationale: 'Please add more evidence for axis 3.',
    previousStatus: 'APPROVED',
    newStatus: 'DRAFT',
    createdAt: '2026-08-01T01:00:00.000Z',
  },
];

describe('AssessmentQualityReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listEvidence.mockResolvedValue({ evidence: baseEvidence, scoring: baseScoring });
    listReviewHistory.mockResolvedValue({ reviews: baseReviews });
    // No accepted output yet by default — matches the panel's own try/catch
    // treating a rejected getAcceptedReport as "no report", not an error state.
    getAcceptedReport.mockRejectedValue(new Error('NO_ACCEPTED_OUTPUT'));
    addEvidence.mockResolvedValue({ evidence: { ...baseEvidence[0], id: 'ev-new' } });
    submitReview.mockResolvedValue({ review: { ...baseReviews[0], id: 'rev-new' } });
  });

  it('initial load renders the scoring table and the evidence list from the mocked responses', async () => {
    render(<AssessmentQualityReviewPanel assessmentId={ASSESSMENT_ID} />);

    await waitFor(() => {
      expect(listEvidence).toHaveBeenCalledWith(ASSESSMENT_ID);
      expect(listReviewHistory).toHaveBeenCalledWith(ASSESSMENT_ID);
    });

    // Scoring summary tiles.
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument(); // completionPercent
    });
    expect(screen.getByText('57%')).toBeInTheDocument(); // evidenceCoverage

    // Scoring table (StandardTable) rows — axis names from the mocked scoring.
    expect(screen.getByText('Scoring Fixture Axis One')).toBeInTheDocument();
    expect(screen.getByText('Scoring Fixture Axis Two')).toBeInTheDocument();

    // Evidence list.
    expect(screen.getByText('Sales process audit notes')).toBeInTheDocument();

    // Review history list (return decision from the mock).
    expect(screen.getByText('Odesłano')).toBeInTheDocument();
    expect(screen.getByText(/Please add more evidence for axis 3\./)).toBeInTheDocument();

    // No accepted output yet.
    expect(
      screen.getByText('Ten assessment nie ma jeszcze zaakceptowanego outputu.')
    ).toBeInTheDocument();
  });

  it('adding evidence calls V8AssessmentApi.addEvidence with the right payload and reloads', async () => {
    render(<AssessmentQualityReviewPanel assessmentId={ASSESSMENT_ID} />);

    await waitFor(() => {
      expect(listEvidence).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('Tytuł dowodu'), {
      target: { value: 'New evidence title' },
    });

    const addButton = screen.getByRole('button', { name: 'Dodaj dowód' });
    expect(addButton).not.toBeDisabled();
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(addEvidence).toHaveBeenCalledTimes(1);
    });
    expect(addEvidence).toHaveBeenCalledWith(ASSESSMENT_ID, {
      axisId: '1',
      areaId: '1A',
      evidenceType: 'note',
      title: 'New evidence title',
      description: null,
      url: null,
    });

    // A successful add reloads the panel's data.
    await waitFor(() => {
      expect(listEvidence).toHaveBeenCalledTimes(2);
      expect(listReviewHistory).toHaveBeenCalledTimes(2);
    });
  });

  it('clicking "Zaakceptuj" with a rationale filled in calls V8AssessmentApi.submitReview with {action: accept, rationale}', async () => {
    render(<AssessmentQualityReviewPanel assessmentId={ASSESSMENT_ID} />);

    await waitFor(() => {
      expect(listEvidence).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('Uzasadnienie decyzji (wymagane)'), {
      target: { value: 'Complete and fully evidenced.' },
    });

    const acceptButton = screen.getByRole('button', { name: /Zaakceptuj/ });
    expect(acceptButton).not.toBeDisabled();
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledTimes(1);
    });
    expect(submitReview).toHaveBeenCalledWith(ASSESSMENT_ID, {
      action: 'accept',
      rationale: 'Complete and fully evidenced.',
    });
  });

  it('the accept/return buttons are disabled when the rationale is under 3 (trimmed) characters', async () => {
    render(<AssessmentQualityReviewPanel assessmentId={ASSESSMENT_ID} />);

    await waitFor(() => {
      expect(listEvidence).toHaveBeenCalledTimes(1);
    });

    const rationaleInput = screen.getByPlaceholderText('Uzasadnienie decyzji (wymagane)');
    const acceptButton = screen.getByRole('button', { name: /Zaakceptuj/ });
    const returnButton = screen.getByRole('button', { name: /Odeślij do poprawy/ });

    // Empty rationale — both disabled.
    expect(acceptButton).toBeDisabled();
    expect(returnButton).toBeDisabled();

    // Under 3 trimmed chars — still disabled.
    fireEvent.change(rationaleInput, { target: { value: 'ab' } });
    expect(acceptButton).toBeDisabled();
    expect(returnButton).toBeDisabled();

    // Whitespace-only 3+ chars — trimmed length is under 3, still disabled.
    fireEvent.change(rationaleInput, { target: { value: '   ' } });
    expect(acceptButton).toBeDisabled();
    expect(returnButton).toBeDisabled();

    // 3+ trimmed chars — enabled.
    fireEvent.change(rationaleInput, { target: { value: 'abc' } });
    expect(acceptButton).not.toBeDisabled();
    expect(returnButton).not.toBeDisabled();

    expect(submitReview).not.toHaveBeenCalled();
  });
});
