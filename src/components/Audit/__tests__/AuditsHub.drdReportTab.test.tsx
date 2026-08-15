/**
 * @vitest-environment jsdom
 *
 * AuditsHub — "Raporty DRD" tab (audyt 2026-07-26).
 *
 * DRDAuditReportView (the DRD audit report engine — AI chat, PDF export,
 * publishing-grade client report) had ZERO importers. This wires a flag-gated
 * entry point into the Audits module: a "Raporty DRD" tab (isDrdReportEnabled,
 * default OFF) listing the org's assessment reports (Api.getAssessmentReports)
 * with an "Open" action navigating to /audit-programs/drd-report/:reportId.
 *
 * Covers:
 *  - flag OFF (default): the tab does not exist in the hub at all — the
 *    module renders byte-identical to before, zero visual leak.
 *  - flag ON: the tab appears; selecting it fetches + renders the assessment
 *    reports list; opening a row navigates to the DRD report route.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return opts.defaultValue;
      return k;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const { listPrograms, deleteProgram, generateSurveys, getCompletion } = vi.hoisted(() => ({
  listPrograms: vi.fn(),
  deleteProgram: vi.fn(),
  generateSurveys: vi.fn(),
  getCompletion: vi.fn(),
}));

vi.mock('../auditApi', () => ({
  listPrograms,
  deleteProgram,
  generateSurveys,
  getCompletion,
  reopenProgram: vi.fn(),
  updateProgram: vi.fn(),
  listTemplateOptions: vi.fn(async () => []),
  listUserOptions: vi.fn(async () => []),
  createProgram: vi.fn(async () => ({ id: 'new', name: 'New' })),
}));

const getAssessmentReportsMock = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    getAssessmentReports: (...args: unknown[]) => getAssessmentReportsMock(...args),
  },
}));

let drdFlagOn = false;
vi.mock('@/utils/drdReportFlag', () => ({
  isDrdReportEnabled: () => drdFlagOn,
}));

import { AuditsHub } from '../AuditsHub';

const okResult = (programs: any[] = []) => ({
  programs,
  total: programs.length,
  limit: 50,
  offset: 0,
});

beforeEach(() => {
  drdFlagOn = false;
  listPrograms.mockReset();
  deleteProgram.mockReset();
  generateSurveys.mockReset();
  getCompletion.mockReset();
  getAssessmentReportsMock.mockReset();
  navigateMock.mockReset();
  listPrograms.mockResolvedValue(okResult([]));
  getAssessmentReportsMock.mockResolvedValue([
    {
      id: 'report-1',
      name: 'DRD Report — Acme Corp',
      assessmentName: 'Q3 Digital Readiness',
      status: 'DRAFT',
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuditsHub — Raporty DRD tab (flag-gated)', () => {
  it('flag OFF (default): the tab does not render at all', async () => {
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());
    expect(screen.queryByText('Raporty DRD')).toBeNull();
    // The API for the tab's list is never even called when the tab can't exist.
    expect(getAssessmentReportsMock).not.toHaveBeenCalled();
  });

  it('flag ON: the tab appears and lists assessment reports on selection', async () => {
    drdFlagOn = true;
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());

    const tab = await screen.findByText('Raporty DRD');
    fireEvent.click(tab);

    await waitFor(() => expect(getAssessmentReportsMock).toHaveBeenCalled());
    expect(await screen.findByText('DRD Report — Acme Corp')).toBeInTheDocument();
  });

  it('flag ON: opening a report row navigates to the DRD report route', async () => {
    drdFlagOn = true;
    render(<AuditsHub />);
    const tab = await screen.findByText('Raporty DRD');
    fireEvent.click(tab);

    const row = await screen.findByText('DRD Report — Acme Corp');
    fireEvent.click(row);

    // The preview pane's "Open" action (or header Open) navigates by id.
    const openButtons = await screen.findAllByText('Open');
    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/audit-programs/drd-report/report-1');
    });
  });
});
