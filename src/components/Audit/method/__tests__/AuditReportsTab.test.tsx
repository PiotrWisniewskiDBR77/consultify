/**
 * AuditReportsTab — DEC-2026-08-25-66 (Piotr, werdykt partii D, uwaga 2):
 * the table had no row kebab at all. This proves the kebab now exists with
 * REAL, backend-gated status transitions (approve/publish) and a working
 * preview panel — not a decorative addition.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return { ...actual, listReports: vi.fn(), approveReport: vi.fn(), publishReport: vi.fn() };
});

import { AuditReportsTab } from '../tabs/AuditReportsTab';
import {
  approveReport,
  listReports,
  publishReport,
  type AuditReportSummary,
} from '../auditsMethodApi';

const mockedListReports = vi.mocked(listReports);
const mockedApproveReport = vi.mocked(approveReport);
const mockedPublishReport = vi.mocked(publishReport);

const draftReport: AuditReportSummary = {
  id: 'rep-1',
  programId: 'prog-1',
  programName: 'Q3 Compliance Audit',
  reportKind: 'audit_report',
  version: 1,
  title: 'Q3 Compliance Audit Report',
  status: 'draft',
  language: 'en',
  audience: 'Executive sponsor',
  confidentiality: 'Confidential',
  approvedAt: null,
  publishedAt: null,
  updatedAt: '2026-08-10',
};

async function openKebab() {
  const trigger = await screen.findByRole('button', { name: /row actions/i });
  fireEvent.click(trigger);
  return screen.findByRole('menu');
}

describe('AuditReportsTab — row kebab (DEC-2026-08-25-66)', () => {
  it('renders a working row kebab with Approve enabled for a draft report', async () => {
    mockedListReports.mockResolvedValue({ items: [draftReport], total: 1 });
    render(<AuditReportsTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit Report')).toBeInTheDocument());

    const menu = await openKebab();
    const approveItem = within(menu).getByText('Approve');
    expect(approveItem.closest('button')).not.toBeDisabled();
    // Publish requires 'approved' status — draft report keeps it disabled.
    const publishItem = within(menu).getByText('Publish');
    expect(publishItem.closest('button')).toBeDisabled();
  });

  it('calls the real approveReport endpoint and reflects the returned status', async () => {
    mockedListReports.mockResolvedValue({ items: [draftReport], total: 1 });
    mockedApproveReport.mockResolvedValue({ ...draftReport, status: 'approved' });
    render(<AuditReportsTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit Report')).toBeInTheDocument());

    const menu = await openKebab();
    fireEvent.click(within(menu).getByText('Approve'));

    await waitFor(() => expect(mockedApproveReport).toHaveBeenCalledWith('rep-1'));
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
  });

  it('opens the row preview with audience/confidentiality — real data the table never showed before', async () => {
    mockedListReports.mockResolvedValue({ items: [draftReport], total: 1 });
    render(<AuditReportsTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit Report')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Q3 Compliance Audit Report'));
    const preview = await screen.findByTestId('audit-report-preview');
    // Both values also appear as their own table columns (Audience/Confidentiality
    // are real added columns, DEC-2026-08-25-66 point 3) — scope to the preview
    // panel so this proves the DETAILS block specifically, not just "somewhere".
    await waitFor(() => expect(within(preview).getByText('Executive sponsor')).toBeInTheDocument());
    expect(within(preview).getByText('Confidential')).toBeInTheDocument();
  });

  it('shows Delete disabled with a real reason — never a silent no-op', async () => {
    mockedListReports.mockResolvedValue({ items: [draftReport], total: 1 });
    render(<AuditReportsTab isPolish={false} />);
    await waitFor(() => expect(screen.getByText('Q3 Compliance Audit Report')).toBeInTheDocument());

    const menu = await openKebab();
    const deleteItem = within(menu).getByText('Delete');
    expect(deleteItem.closest('button')).toBeDisabled();
    expect(within(menu).getByText(/immutable audit trail/i)).toBeInTheDocument();
  });
});
