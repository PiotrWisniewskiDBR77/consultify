/**
 * @vitest-environment jsdom
 *
 * P0D — AssessmentReportsTab reads `listReports`/`getReportSnapshot`
 * (method_report_snapshots via method-core), not the legacy ReportBuilder
 * `assessment_reports` table. Covers StandardTable rendering, current/
 * superseded distinction, snapshot fetch on open, and honest empty/error/
 * forbidden states.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  listReports: vi.fn(),
  getReportSnapshot: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    listReports: hoisted.listReports,
    getReportSnapshot: hoisted.getReportSnapshot,
  };
});

import { MethodCoreApiError } from '@/method-core/api/methodCoreApi';

import { AssessmentReportsTab } from '../AssessmentReportsTab';

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    organizationId: 'org-1',
    outputId: 'out-1',
    sessionId: 'sess-1',
    title: 'Q3 Digital Readiness Report',
    contentHash: 'hash-1234567890',
    status: 'current',
    supersededByOutputId: null,
    supersededAt: null,
    createdAt: '2026-08-10T10:00:00.000Z',
    kind: 'report',
    demoBypassActive: false,
    ...overrides,
  };
}

describe('AssessmentReportsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the kernel Reports list via StandardTable', async () => {
    hoisted.listReports.mockResolvedValue([reportRow()]);

    render(<AssessmentReportsTab />);

    expect(await screen.findByText('Q3 Digital Readiness Report')).toBeInTheDocument();
    expect(hoisted.listReports).toHaveBeenCalledWith({});
  });

  it('scopes the request to one Output when outputId is provided', async () => {
    hoisted.listReports.mockResolvedValue([]);

    render(<AssessmentReportsTab outputId="out-1" />);

    await waitFor(() => {
      expect(hoisted.listReports).toHaveBeenCalledWith({ outputId: 'out-1' });
    });
  });

  it('visually distinguishes current vs superseded report snapshots', async () => {
    hoisted.listReports.mockResolvedValue([
      reportRow({ id: 'r-1', status: 'superseded', title: 'Old report' }),
      reportRow({ id: 'r-2', status: 'current', title: 'New report' }),
    ]);

    render(<AssessmentReportsTab />);

    await screen.findByText('Old report');
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('opening a row fetches the persisted snapshot content from the server', async () => {
    hoisted.listReports.mockResolvedValue([reportRow()]);
    hoisted.getReportSnapshot.mockResolvedValue({
      ...reportRow(),
      content: { summary: 'Frozen findings summary' },
    });
    const user = userEvent.setup();

    render(<AssessmentReportsTab />);
    await user.click(await screen.findByText('Q3 Digital Readiness Report'));

    await waitFor(() => {
      expect(hoisted.getReportSnapshot).toHaveBeenCalledWith('report-1');
    });
  });

  it('shows an honest empty state explaining why the list is empty', async () => {
    hoisted.listReports.mockResolvedValue([]);

    render(<AssessmentReportsTab />);

    expect(await screen.findByText('No reports yet')).toBeInTheDocument();
    expect(
      screen.getByText('Report snapshots created from a frozen Output will appear here.')
    ).toBeInTheDocument();
  });

  it('shows a scoped empty-state description when filtered to one Output', async () => {
    hoisted.listReports.mockResolvedValue([]);

    render(<AssessmentReportsTab outputId="out-1" />);

    expect(await screen.findByText('This Output has no Report snapshot yet.')).toBeInTheDocument();
  });

  it('shows an error state with retry when the Reports list fails to load', async () => {
    hoisted.listReports.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();

    render(<AssessmentReportsTab />);

    expect(
      await screen.findByText('Failed to load reports. Please try again.')
    ).toBeInTheDocument();

    hoisted.listReports.mockResolvedValueOnce([reportRow()]);
    // Accessible name is "Try again" (i18n `common.retry`), not "Retry" —
    // see the matching note in AssessmentOutputsTab.test.tsx.
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText('Q3 Digital Readiness Report')).toBeInTheDocument();
    });
  });

  it('shows a distinct "no access" state on a 401/403', async () => {
    hoisted.listReports.mockRejectedValueOnce(new MethodCoreApiError('Unauthorized', 401, {}));

    render(<AssessmentReportsTab />);

    expect(await screen.findByText('No access to Reports')).toBeInTheDocument();
    expect(screen.queryByText('No reports yet')).not.toBeInTheDocument();
  });
});
