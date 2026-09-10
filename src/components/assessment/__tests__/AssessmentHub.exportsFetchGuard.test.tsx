/**
 * @vitest-environment jsdom
 *
 * F4b (pomiar A2 §4 defekt 3, KROK 0 zmierzone na kopii `consultify_kopia_f4`).
 *
 * `ReportSlideOverContent` (AssessmentHub.tsx ~3255) fetched exports via
 * `GET /report-builder/:id/exports` using `builderReportId || assessmentReportId`.
 * `assessment_reports.id` and `report_builder_reports.id` are DISJOINT id
 * spaces (confirmed on a live DB copy: DBR77's one assessment report has
 * `builder_report_id = 'staging-dbr77-assessment-builder-report'`, but
 * `report_builder_reports` has ZERO rows for that org — the referenced
 * builder report was never materialized). So whenever `builderReportId` is
 * missing, the old fallback to `assessmentReportId` was GUARANTEED to 404 —
 * not a routing bug, but a doomed parameter every single time (matches the
 * "reproducible 3/3" measurement).
 *
 * RED (before F4b): the component calls `Api.get` even when `builderReportId`
 * is falsy, using the assessment-report id as a substitute — an API call
 * that cannot ever succeed.
 * GREEN (after F4b): the component skips the network call entirely when
 * `builderReportId` is falsy and renders the honest "no exports" state
 * directly — same visible UI, zero doomed requests.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _k,
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));
vi.mock('@/services/api', () => ({ Api: { get: apiGet } }));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => vi.fn(),
}));

import { ReportSlideOverContent } from '../AssessmentHub';

describe('AssessmentHub → ReportSlideOverContent exports fetch guard (F4b)', () => {
  afterEach(() => {
    apiGet.mockReset();
  });

  it('RED before the fix / GREEN after: skips the exports fetch entirely when builderReportId is missing (no builder report was ever materialized)', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url.includes('/full')) return { report: { name: 'Report' } };
      // Any call to /report-builder/*/exports here would be the doomed
      // fallback-to-assessmentReportId call this fix removes.
      throw Object.assign(new Error('Report not found'), { status: 404 });
    });

    render(
      <ReportSlideOverContent
        assessmentReportId="assessment-report-1"
        builderReportId={undefined}
        onOpenFull={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText(/no exports yet/i)).toBeInTheDocument());

    // The regression guard: no call was ever made to the exports endpoint
    // with the assessment-report id substituted in (the doomed fallback).
    const exportsCalls = apiGet.mock.calls.filter(([url]) =>
      String(url).includes('/exports')
    );
    expect(exportsCalls).toHaveLength(0);
  });

  it('still fetches real exports when a builderReportId is actually present', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url.includes('/full')) return { report: { name: 'Report' } };
      if (url.includes('/report-builder/real-builder-report-1/exports')) {
        return { exports: [{ id: 'exp-1', format: 'pdf' }] };
      }
      throw Object.assign(new Error('unexpected url ' + url), { status: 500 });
    });

    render(
      <ReportSlideOverContent
        assessmentReportId="assessment-report-1"
        builderReportId="real-builder-report-1"
        onOpenFull={vi.fn()}
      />
    );

    await waitFor(() =>
      expect(
        apiGet.mock.calls.some(([url]) =>
          String(url).includes('/report-builder/real-builder-report-1/exports')
        )
      ).toBe(true)
    );
  });
});
