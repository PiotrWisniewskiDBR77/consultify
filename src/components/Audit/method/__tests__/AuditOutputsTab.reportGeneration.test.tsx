/**
 * AuditOutputsTab report generation.
 *
 * DEC-417 (1.1-A3): flaga `ff_auditsReportChain` usunięta — akcje generowania
 * raportu są teraz widoczne zawsze, bez warunku.
 *
 * DEC-397b (1.1-K6): drugi opisany blok niżej — klik wiersza po zamknięciu
 * panelu (X) ma go ponownie otworzyć (`jedenPanel.otworz()` w `onRowClick`/
 * kebab „Podgląd", ten sam wzorzec co `InboxContent.tsx`, K5 2f5161f3b4).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetJedenPanelForTests } from '@/components/shared/PreviewPane/useJedenPanel';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return { ...actual, listOutputs: vi.fn(), generateReport: vi.fn() };
});

import { generateReport, listOutputs, type AuditOutputSummary } from '../auditsMethodApi';
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

  it('shows both real generation actions', async () => {
    renderTab();
    const menu = await openMenu();
    expect(within(menu).getByText('Generate audit report')).toBeInTheDocument();
    expect(within(menu).getByText('Generate remediation report')).toBeInTheDocument();
  });

  it('generates an audit report, reports success, and notifies the Hub', async () => {
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

describe('AuditOutputsTab — jeden prawy panel (DEC-397b, 1.1-K6)', () => {
  beforeEach(() => {
    vi.mocked(listOutputs).mockResolvedValue({ items: [output], total: 1 });
    vi.mocked(generateReport).mockReset();
    resetJedenPanelForTests();
    localStorage.clear();
  });

  it('zamknij X → klik wiersza PONOWNIE otwiera panel (MUTACJA: usuń jedenPanel.otworz() w onRowClick → RED)', async () => {
    const { container } = renderTab();

    fireEvent.click(await screen.findByText('Audit 41 Output'));
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });

    const closeButton = within(
      container.querySelector('[data-right-panel]') as HTMLElement
    ).getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(container.querySelector('[data-right-panel]')).toBeNull();
    });

    // DEC-397b: pojedynczy klik wiersza — realna zmiana zaznaczenia z punktu
    // widzenia użytkownika — ma PONOWNIE otworzyć panel, mimo wcześniejszego X.
    fireEvent.click(await screen.findByText('Audit 41 Output'));
    await waitFor(() => {
      expect(container.querySelectorAll('[data-right-panel]')).toHaveLength(1);
    });
  });
});
