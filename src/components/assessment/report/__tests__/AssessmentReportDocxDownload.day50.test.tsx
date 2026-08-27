import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as api from '@/method-core/api/methodCoreApi';
import { resetAssessmentReportViewFlagCache } from '@/utils/assessmentReportViewFlag';
import { ASSESSMENT_DOCX_FLAG_KEYS } from '@/utils/assessmentDocxFlag';

import {
  AssessmentReportContractView,
  filenameFromContentDisposition,
} from '../AssessmentReportContractView';

const chapter: api.AssessmentReportChapter = {
  axisId: 1,
  axisName: 'Axis 1',
  axisNamePL: 'Oś 1',
  maxLevel: 5,
  introduction: { content: null, minWords: 120, maxWords: 180 },
  matrix: { caption: { content: null, minWords: 30, maxWords: 60 }, areas: [] },
  areaComments: [],
  conclusion: {
    content: null,
    minWords: 180,
    maxWords: 260,
    decisionLine: { direction: null, priority: null, horizon: null, successCondition: null },
  },
};

const contract: api.AssessmentReportContract = {
  contractVersion: 'assessment-report-contract-v1',
  sessionId: 'session-1',
  outputId: null,
  revision: 0,
  generatedAt: '2026-08-28T10:00:00.000Z',
  methodVersion: 'drd-v1',
  chapters: [chapter],
};

describe('Day 50 Assessment DOCX product download', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(ASSESSMENT_DOCX_FLAG_KEYS.localStorage, '1');
    resetAssessmentReportViewFlagCache();
    vi.restoreAllMocks();
    vi.spyOn(api, 'getAssessmentReportContract').mockResolvedValue(contract);
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:day50-docx'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('prefers the UTF-8 filename supplied by the server', () => {
    expect(
      filenameFromContentDisposition(
        `attachment; filename="Raport_DRD_Lodz.docx"; filename*=UTF-8''Raport_DRD_%C5%81%C3%B3d%C5%BA.docx`
      )
    ).toBe('Raport_DRD_Łódź.docx');
  });

  it('keeps document navigation but does not squeeze the canvas with a docked right panel', async () => {
    render(<AssessmentReportContractView sessionId="session-1" />);

    await screen.findByRole('button', { name: 'Pobierz DOCX' });
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.getByText('assessment.reportView.properties.revision')).toBeInTheDocument();
  });

  it('fetches the production route, downloads its blob and uses the server filename', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['docx']), {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="Raport_DRD_Metalpol.docx"; filename*=UTF-8''Raport_DRD_Metalpol.docx`,
        },
      })
    );
    render(<AssessmentReportContractView sessionId="session-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pobierz DOCX' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/method/sessions/session-1/assessment-report.docx',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('shows a Polish error with the server code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'SESSION_NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    render(<AssessmentReportContractView sessionId="session-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pobierz DOCX' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się pobrać DOCX — kod: SESSION_NOT_FOUND'
    );
  });
});
