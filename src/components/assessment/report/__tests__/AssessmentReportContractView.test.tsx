import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/method-core/api/methodCoreApi';
import { resetAssessmentReportViewFlagCache } from '@/utils/assessmentReportViewFlag';

import { AssessmentReportContractView } from '../AssessmentReportContractView';

const chapter = (axisId: number): api.AssessmentReportChapter => ({
  axisId,
  axisName: `Axis ${axisId}`,
  axisNamePL: `Oś ${axisId}`,
  maxLevel: 5,
  introduction: { content: null, minWords: 120, maxWords: 180 },
  matrix: {
    caption: { content: null, minWords: 30, maxWords: 60 },
    areas: [
      {
        unitId: `${axisId}A`,
        unitName: 'Area',
        unitNamePL: 'Obszar',
        currentLevel: null,
        targetLevel: 3,
        gap: null,
        skipped: false,
        skipCode: null,
        skips: [],
        evidenceState: 'not_assessed',
      },
    ],
  },
  areaComments: [
    {
      unitId: `${axisId}A`,
      content: null,
      minWords: 110,
      maxWords: 170,
      microstructure: [
        'stan_faktyczny',
        'ocena_i_wiarygodnosc',
        'znaczenie_dla_przedsiebiorstwa',
        'luka_i_sens_targetu',
        'najblizszy_krok',
      ],
      skipped: false,
      skipCode: null,
      skips: [],
      answerRefs: [],
      evidenceRefs: [],
      sourceLocators: [],
      uncertainty: 'not_assessed',
    },
  ],
  conclusion: {
    content: null,
    minWords: 180,
    maxWords: 260,
    decisionLine: { direction: null, priority: null, horizon: null, successCondition: null },
  },
});

const contract: api.AssessmentReportContract = {
  contractVersion: 'assessment-report-contract-v1',
  sessionId: 'session-1',
  outputId: null,
  revision: 0,
  generatedAt: '2026-08-26T10:00:00.000Z',
  methodVersion: 'drd-v1',
  chapters: Array.from({ length: 7 }, (_, index) => chapter(index + 1)),
};

describe('AssessmentReportContractView', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAssessmentReportViewFlagCache();
    vi.restoreAllMocks();
  });

  // flip po akcepcie właściciela 27.08 (DEC-146/148): the flag now defaults
  // ON, so this fail-closed assertion needs an explicit `off` override —
  // localStorage/query "off" still disables the view per-session.
  it('fails closed: explicit OFF override renders null and performs no request', () => {
    localStorage.setItem('ff.assessment_report_view', 'off');
    resetAssessmentReportViewFlagCache();
    const request = vi.spyOn(api, 'getAssessmentReportContract');
    const { container } = render(<AssessmentReportContractView sessionId="session-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(request).not.toHaveBeenCalled();
  });

  // flip po akcepcie właściciela 27.08 (DEC-146/148): default was OFF, now
  // ON — no override needed to reach the request/render path.
  it('defaults ON: renders and requests the contract with no override', async () => {
    vi.spyOn(api, 'getAssessmentReportContract').mockResolvedValue(contract);
    render(<AssessmentReportContractView sessionId="session-1" />);
    await screen.findByTestId('assessment-report-contract-view');
    expect(api.getAssessmentReportContract).toHaveBeenCalledTimes(1);
  });

  it('renders seven chapters in server order and honest word limits', async () => {
    localStorage.setItem('ff.assessment_report_view', '1');
    resetAssessmentReportViewFlagCache();
    vi.spyOn(api, 'getAssessmentReportContract').mockResolvedValue(contract);
    render(<AssessmentReportContractView sessionId="session-1" />);
    await screen.findByTestId('assessment-report-contract-view');
    for (let axis = 1; axis <= 7; axis += 1)
      expect(screen.getByText(`Axis ${axis}`)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-axis-id]')).toHaveLength(1);
    expect(screen.getAllByText(/assessment\.reportView\.emptySlot/).length).toBeGreaterThan(0);
  });

  it('renders null levels as not assessed, never zero', async () => {
    localStorage.setItem('ff.assessment_report_view', '1');
    resetAssessmentReportViewFlagCache();
    vi.spyOn(api, 'getAssessmentReportContract').mockResolvedValue(contract);
    render(<AssessmentReportContractView sessionId="session-1" />);
    await screen.findByTestId('assessment-report-contract-view');
    expect(
      screen.getAllByText(/assessment\.reportView\.evidence\.notAssessed/i).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it('distinguishes a 404 and allows retry', async () => {
    localStorage.setItem('ff.assessment_report_view', '1');
    resetAssessmentReportViewFlagCache();
    vi.spyOn(api, 'getAssessmentReportContract').mockRejectedValue(
      new api.MethodCoreApiError('SESSION_NOT_FOUND', 404, {})
    );
    render(<AssessmentReportContractView sessionId="missing" />);
    await waitFor(() =>
      expect(screen.getByText('assessment.reportView.errors.notFound')).toBeInTheDocument()
    );
  });
});
