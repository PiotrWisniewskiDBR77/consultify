import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return { ...actual, listOutputs: vi.fn(), generateReport: vi.fn() };
});

import { resetAuditsReportChainFlagCache } from '@/utils/auditsReportChainFlag';

import { type AuditOutputSummary, generateReport, listOutputs } from '../auditsMethodApi';
import { AuditOutputsTab } from '../tabs/AuditOutputsTab';

const output: AuditOutputSummary = {
  id: 'out-1',
  programId: 'prog-1',
  programName: 'Audit 41',
  version: 1,
  title: 'Audit 41 Output',
  packVersion: 2,
  finalizedBy: 'u1',
  finalizedByName: 'Ada',
  finalizedAt: '2026-08-28',
  supersededBy: null,
  supersededAt: null,
  contentHash: 'abcdef123456',
};

const report = {
  id: 'rep-1',
  programId: 'prog-1',
  programName: 'Audit 41',
  reportKind: 'audit_report' as const,
  version: 1,
  title: 'Audit report',
  status: 'draft' as const,
  language: 'en',
  audience: null,
  confidentiality: null,
  approvedAt: null,
  publishedAt: null,
  updatedAt: '2026-08-28',
};

function setFlag(on: boolean) {
  window.localStorage.setItem('ff.audits_report_chain', on ? '1' : '0');
  resetAuditsReportChainFlagCache();
}

async function openMenu() {
  fireEvent.click(await screen.findByRole('button', { name: /row actions/i }));
  return screen.findByRole('menu');
}

function renderTab(props: React.ComponentProps<typeof AuditOutputsTab> = { isPolish: false }) {
  return render(
    <MemoryRouter>
      <AuditOutputsTab {...props} />
    </MemoryRouter>
  );
}

describe('AuditOutputsTab report generation', () => {
  beforeEach(() => {
    vi.mocked(listOutputs).mockResolvedValue({ items: [output], total: 1 });
    vi.mocked(generateReport).mockReset();
  });

  afterEach(() => {
    window.localStorage.removeItem('ff.audits_report_chain');
    resetAuditsReportChainFlagCache();
  });

  it('keeps generation actions absent with the flag OFF', async () => {
    setFlag(false);
    renderTab();
    const menu = await openMenu();
    expect(within(menu).queryByText('Generate audit report')).toBeNull();
  });

  it('shows both real generation actions with the flag ON', async () => {
    setFlag(true);
    renderTab();
    const menu = await openMenu();
    expect(within(menu).getByText('Generate audit report')).toBeInTheDocument();
    expect(within(menu).getByText('Generate remediation report')).toBeInTheDocument();
  });

  it('generates an audit report, reports success, and notifies the Hub', async () => {
    setFlag(true);
    const created = vi.fn();
    vi.mocked(generateReport).mockResolvedValue(report);
    renderTab({ isPolish: false, onReportCreated: created });
    fireEvent.click(within(await openMenu()).getByText('Generate audit report'));
    await waitFor(() =>
      expect(generateReport).toHaveBeenCalledWith({
        programId: 'prog-1',
        outputId: 'out-1',
        reportKind: 'audit_report',
      })
    );
    expect(created).toHaveBeenCalledWith(report);
    expect(await screen.findByRole('link', { name: 'Open report' })).toHaveAttribute(
      'href',
      '/audit-programs/reports/rep-1'
    );
  });

  it('opens remediation date modal and omits an empty asOfDate', async () => {
    setFlag(true);
    vi.mocked(generateReport).mockResolvedValue({
      ...report,
      reportKind: 'remediation_progress',
    });
    renderTab();
    fireEvent.click(within(await openMenu()).getByText('Generate remediation report'));
    expect(await screen.findByText(/Empty means today's date/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() =>
      expect(generateReport).toHaveBeenCalledWith({
        programId: 'prog-1',
        outputId: 'out-1',
        reportKind: 'remediation_progress',
      })
    );
  });

  it('passes the selected remediation as-of date', async () => {
    setFlag(true);
    vi.mocked(generateReport).mockResolvedValue({
      ...report,
      reportKind: 'remediation_progress',
    });
    renderTab();
    fireEvent.click(within(await openMenu()).getByText('Generate remediation report'));
    fireEvent.change(await screen.findByLabelText('As-of date (optional)'), {
      target: { value: '2026-08-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() =>
      expect(generateReport).toHaveBeenCalledWith(
        expect.objectContaining({ asOfDate: '2026-08-15' })
      )
    );
  });

  it('disables both actions for a superseded Output and explains why', async () => {
    setFlag(true);
    vi.mocked(listOutputs).mockResolvedValue({
      items: [{ ...output, supersededBy: 'out-2' }],
      total: 1,
    });
    renderTab();
    const menu = await openMenu();
    expect(within(menu).getByText('Generate audit report').closest('button')).toBeDisabled();
    expect(within(menu).getAllByText(/current Output version/)).toHaveLength(2);
  });

  it('shows the literal backend error in the selected Output preview', async () => {
    setFlag(true);
    vi.mocked(generateReport).mockRejectedValue({
      response: { data: { error: 'Output out-1 has already been superseded' } },
    });
    renderTab();
    fireEvent.click(await screen.findByText('Audit 41 Output'));
    fireEvent.click(within(await openMenu()).getByText('Generate audit report'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Output out-1 has already been superseded'
    );
  });
});
