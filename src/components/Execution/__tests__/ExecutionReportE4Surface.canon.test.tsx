/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-497]
 * Guards the E4 list-to-preview path and prevents governed source identifiers
 * from leaking into the user-facing relations block.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => {
      if (key === 'executionReports.e4.sourceTypes.execution_report_snapshot') {
        return 'Execution report snapshot';
      }
      if (key === 'common.pinForComparison') return 'Pin translated';
      return typeof fallback === 'string' ? fallback : key;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { listExecutionReportDefinitions, listReportDefinitions, listReportRuns, getReportDefinition } =
  vi.hoisted(() => ({
    listExecutionReportDefinitions: vi.fn(),
    listReportDefinitions: vi.fn(),
    listReportRuns: vi.fn(),
    getReportDefinition: vi.fn(),
  }));

vi.mock('@/services/executionReports/executionReportsApi', () => ({
  listExecutionReportDefinitions,
  createExecutionReportRun: vi.fn(),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listReportDefinitions,
  listReportRuns,
  getReportDefinition,
  createReportRun: vi.fn(),
  transitionReportRun: vi.fn(),
  createExecutionReportSchedule: vi.fn(),
  deliverExecutionReportProfile: vi.fn(),
  downloadExecutionReportProfilePdf: vi.fn(),
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn().mockResolvedValue([]) },
}));

import { ExecutionReportE4Surface } from '../ExecutionReportE4Surface';

describe('ExecutionReportE4Surface canonical list and preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listExecutionReportDefinitions.mockResolvedValue({ definitions: [] });
    listReportDefinitions.mockResolvedValue({ items: [] });
    getReportDefinition.mockResolvedValue({ versions: [] });
    listReportRuns.mockResolvedValue({
      items: [
        {
          reportRunId: 'run-1',
          status: 'FROZEN',
          version: 3,
          approverId: 'approver-1',
          period: { start: '2026-09-01', end: '2026-09-07' },
          audience: ['owner@example.com'],
          sources: [
            {
              sourceType: 'execution_report_snapshot',
              sourceId: 'private-snapshot-uuid',
              sourceVersion: 1,
            },
          ],
          workReport: {
            profile: 'execution_report',
            title: 'Weekly execution',
            templateId: 'weekly-exec',
            cadence: 'WEEKLY',
            detailLevel: 'MANAGEMENT',
          },
        },
      ],
    });
  });

  it('opens the StandardPreview from the table and shows a translated source label without its raw id', async () => {
    render(
      <MemoryRouter>
        <ExecutionReportE4Surface
          activePreset="all"
          currentUserId="owner-1"
          currentOrganizationId="org-1"
        />
      </MemoryRouter>
    );

    const rowTitle = await screen.findByText('Weekly execution');
    fireEvent.click(rowTitle);

    await waitFor(() => {
      expect(screen.getByText('Execution report snapshot')).toBeInTheDocument();
    });
    expect(screen.queryByText(/private-snapshot-uuid/)).not.toBeInTheDocument();
    expect(screen.getByText('Download PDF')).toBeInTheDocument();
    expect(screen.getByLabelText('Pin translated')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Row actions'));
    await waitFor(() => {
      const approvals = screen.getAllByText('Approve');
      expect(approvals.length).toBeGreaterThan(1);
      for (const approval of approvals) expect(approval.closest('button')).toBeDisabled();
    });
  });
});
