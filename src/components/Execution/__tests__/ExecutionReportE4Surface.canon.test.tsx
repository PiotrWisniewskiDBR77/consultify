/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-497]
 * Guards the E4 list-to-preview path and prevents governed source identifiers
 * from leaking into the user-facing relations block.
 *
 * HOLD 2 (odbiór integratora 14.09) — trzy rozjazdy okablowania, których
 * `tsc` łapał jako błędy typów, a oko właściciela zobaczyłoby jako BRAK
 * funkcji. Każdy dostaje tu test mutacyjny:
 *   (a) pusta zakładka NIE MIAŁA przycisku — `StandardTableEmpty` przyjmuje
 *       `actionLabel`/`onAction`, paczka podawała `primaryAction` (cicho
 *       zignorowane). Test: „New report" renderuje się i otwiera kreator.
 *   (b) akcje podglądu miały warianty spoza unii `PreviewActionVariant`
 *       ('accept'/'secondary') → `VARIANTS[variant]` dawało `undefined`
 *       w `className`, czyli przyciski bez koloru. Test asercjonuje KLASY
 *       (emerald dla `positive`, slate/white dla `neutral`), nie brak
 *       `undefined`.
 *   (c) Menu 3 zakładki „Raporty" miało CZTERY pigułki (kanon TRIADA: ≤3).
 *       „Report templates" zeszło do dropdownu Menu 2 powierzchni.
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

const {
  listExecutionReportDefinitions,
  listReportDefinitions,
  listReportRuns,
  getReportDefinition,
} = vi.hoisted(() => ({
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

  // HOLD 2 (b): warianty akcji podglądu muszą pochodzić z unii
  // `PreviewActionVariant`. Mutacja: przywrócenie 'accept'/'secondary' daje
  // `VARIANTS[variant] === undefined` → w `className` znika cała paleta,
  // więc asercja na klasach (a nie na literale wariantu) to łapie.
  it('preview actions use variants from the PreviewActionVariant union (positive / neutral)', async () => {
    render(
      <MemoryRouter>
        <ExecutionReportE4Surface
          activePreset="all"
          currentUserId="owner-1"
          currentOrganizationId="org-1"
        />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText('Weekly execution'));

    const approve = await waitFor(() => {
      const button = screen
        .getAllByText('Approve')
        .map((node) => node.closest('button'))
        .find((node) => node?.className.includes('rounded-full'));
      expect(button).toBeTruthy();
      return button as HTMLButtonElement;
    });
    // `positive` — zielone „Zatwierdź" (kanon §7.3b).
    expect(approve.className).toContain('emerald');
    expect(approve.className).not.toContain('undefined');

    const download = screen
      .getAllByText('Download PDF')
      .map((node) => node.closest('button'))
      .find((node) => node?.className.includes('rounded-full')) as HTMLButtonElement;
    expect(download).toBeTruthy();
    // `neutral` — akcja informacyjna, nigdy czerwień/`primary` (crimson).
    expect(download.className).toContain('slate');
    expect(download.className).not.toContain('undefined');
    expect(download.className).not.toContain('emerald');

    const send = screen
      .getAllByText('Send by email')
      .map((node) => node.closest('button'))
      .find((node) => node?.className.includes('rounded-full')) as HTMLButtonElement;
    expect(send).toBeTruthy();
    expect(send.className).toContain('slate');
    expect(send.className).not.toContain('undefined');
  });

  // HOLD 2 (a): pusty stan MUSI nieść jedyne wyjście z zakładki.
  // Mutacja: powrót do `primaryAction: { label, onClick }` (prop spoza
  // `StandardTableEmpty`) sprawia, że przycisk w ogóle się nie renderuje.
  it('renders the "New report" button in the empty state and opens the wizard', async () => {
    listReportRuns.mockResolvedValue({ items: [] });

    render(
      <MemoryRouter>
        <ExecutionReportE4Surface
          activePreset="all"
          currentUserId="owner-1"
          currentOrganizationId="org-1"
        />
      </MemoryRouter>
    );

    const button = await waitFor(() => {
      const node = screen.getByText('New report').closest('button');
      expect(node).toBeTruthy();
      return node as HTMLButtonElement;
    });
    expect(screen.queryByTestId('execution-report-e4-wizard')).not.toBeInTheDocument();

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByTestId('execution-report-e4-wizard')).toBeInTheDocument();
    });
  });
});

// HOLD 2 / kanon TRIADA: Menu 3 zakładki „Raporty" ma DOKŁADNIE trzy pigułki,
// gdy powierzchnię obsługuje E4. Mutacja: usunięcie filtra `definitions`
// w `ExecutionHub` (albo dopisanie czwartej pigułki statusu) przewraca ten
// test. Blokada na ŹRÓDLE — `ExecutionHub` jest zbyt ciężki, by go montować
// (ten sam wzorzec co `ExecutionHub.reportsMenu.source.test.ts`).
describe('Raporty — Menu 3 pod flagą E4 ma ≤3 pigułki (kanon TRIADA)', () => {
  it('odfiltrowuje czwartą pigułkę „Report templates" gdy executionReportE4Enabled', async () => {
    // jsdom: `new URL(..., import.meta.url)` wpada w Location jsdom-a
    // ('toString' called on an object that is not a valid instance of
    // Location) — ścieżka liczona od katalogu repo, nie od modułu.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const hubSource = readFileSync(
      join(process.cwd(), 'src/components/Execution/ExecutionHub.tsx'),
      'utf8'
    ) as string;

    // Deklaracja w `getExecutionMenu3` zostaje czteroelementowa (ścieżka
    // przed-E4 bez zmian) …
    const declStart = hubSource.indexOf('function getExecutionMenu3');
    const reportsStart = hubSource.indexOf('reports: [', declStart);
    const reportsEnd = hubSource.indexOf('\n    ].map', reportsStart);
    const reportsBlock = hubSource.slice(reportsStart, reportsEnd);
    expect((reportsBlock.match(/^\s*\['[a-z-]+',/gm) ?? []).length).toBe(4);

    // … a miejsce konsumpcji odejmuje `definitions` pod flagą E4, więc
    // właściciel widzi trzy: All · Needs review · Published.
    const chipsStart = hubSource.indexOf('chips={');
    const chipsBlock = hubSource.slice(chipsStart, chipsStart + 2500);
    expect(chipsBlock).toContain("preset.id === 'definitions'");
    expect(chipsBlock).toContain('executionReportE4Enabled');

    // Sanity: powierzchnia E4 liczy dokładnie trzy presety statusu.
    const surfaceSource = readFileSync(
      join(process.cwd(), 'src/components/Execution/ExecutionReportE4Surface.tsx'),
      'utf8'
    ) as string;
    const counts = surfaceSource.slice(
      surfaceSource.indexOf('onCountsChange?.({'),
      surfaceSource.indexOf('});', surfaceSource.indexOf('onCountsChange?.({'))
    );
    expect(counts).toContain('all:');
    expect(counts).toContain("'needs-review':");
    expect(counts).toContain('published:');
    expect((counts.match(/^\s+(?:'[a-z-]+'|[a-z]+):/gm) ?? []).length).toBe(3);
  });
});
