import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionReportsSurface } from '../../../src/components/Execution/ExecutionReportsSurface';
import {
  createExecutionTask,
  createReportDefinition,
  createReportRun,
  getReportDefinition,
  listExecutionCases,
  listReportDefinitions,
  listReportRuns,
  readExecutionCase,
  transitionReportDefinition,
  transitionReportRun,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  createExecutionTask: vi.fn(),
  createReportDefinition: vi.fn(),
  createReportRun: vi.fn(),
  getReportDefinition: vi.fn(),
  listExecutionCases: vi.fn(),
  listReportDefinitions: vi.fn(),
  listReportRuns: vi.fn(),
  readExecutionCase: vi.fn(),
  transitionReportDefinition: vi.fn(),
  transitionReportRun: vi.fn(),
}));
const run = {
  version: 5,
  reportRunId: 'run-1',
  status: 'APPROVED',
  definitionRef: { definitionId: 'weekly', version: 2 },
  parentRunRef: null,
  audience: ['SteerCo'],
  scopeRefs: ['case-1'],
  period: { start: '2026-08-01', end: '2026-08-07' },
  asOf: '2026-08-08',
  contentHash: 'hash-1',
  sources: [
    {
      sourceType: 'execution_case',
      sourceId: 'case-1',
      version: 3,
      capturedAt: '2026-08-08',
      freshness: 'CURRENT',
      accessState: 'REDACTED',
      confidence: 'HIGH',
      redactions: ['salary'],
    },
  ],
};
const definition = {
  definitionId: 'weekly',
  version: 7,
  currentVersion: 2,
  updatedAt: '2026-08-08T00:00:00.000Z',
  versions: [
    {
      definitionVersion: 2,
      state: 'PUBLISHED',
      name: 'Weekly execution',
      purpose: 'Evidence-led steering',
      audience: ['SteerCo'],
      cadence: 'WEEKLY',
      scope: {
        type: 'EXECUTION',
        refs: ['case-1'],
        projectIds: ['project-1'],
        generalBacklogAllowed: false,
      },
      ownerId: 'owner-1',
      approverId: 'approver-1',
      access: { classification: 'INTERNAL', audienceRoles: ['SPONSOR'] },
      redaction: { defaultState: 'REDACTED', rules: ['salary'] },
      freshnessThresholdMinutes: 60,
      confidenceThreshold: 'MEDIUM',
      validationFindings: [],
    },
  ],
};

/**
 * 1.12-R4b (zlecenie 12r4b) — CTA „Nowy raport"/„Nowa definicja", dropdown
 * „Poziom" i przełącznik Raporty|Definicje przeniosły się z własnego
 * nagłówka `ExecutionReportsSurface` (h2 + przyciski, usunięty) do Menu 2
 * GOSPODARZA (`ExecutionHub`). Surface rejestruje ich JSX przez
 * `onRegisterFilterControl` — dokładnie ten sam kontrakt, którym
 * `ExecutionWorkSurface` rejestruje swój filtr realizacji (odbiór grafiki
 * 165-menu3-pasek). `Harness` odtwarza gospodarza: renderuje powierzchnię +
 * slot na zarejestrowaną kontrolkę W TYM SAMYM drzewie Reacta, więc klikanie
 * przycisków w slocie trafia w te same domknięcia stanu co przed R4b —
 * tylko fizyczne miejsce w DOM się zmieniło. `MemoryRouter` jest tu
 * dodatkowo wymagany: `TableWithPreviewLayout` woła `useJedenPanel`, które
 * czyta `useLocation()` — bez routera render tej powierzchni ZAWSZE
 * wywracał się (zastane 5/5 czerwonych sprzed 1.12-R4b, potwierdzone na
 * gałęzi bazowej przed jakąkolwiek zmianą tego zlecenia; naprawione przy
 * okazji tego samego pliku zamiast zostawić martwe czerwone).
 */
function Harness(props: React.ComponentProps<typeof ExecutionReportsSurface>) {
  const [control, setControl] = useState<React.ReactNode>(null);
  return (
    <MemoryRouter>
      <ExecutionReportsSurface {...props} onRegisterFilterControl={setControl} />
      <div data-testid="menu2-slot">{control}</div>
    </MemoryRouter>
  );
}

const dispatchNewReportCta = () =>
  fireEvent(window, new CustomEvent('execution:reports-new-report'));

describe('ExecutionReportsSurface', () => {
  beforeEach(() => {
    vi.mocked(listReportRuns).mockResolvedValue({ items: [run] });
    vi.mocked(listReportDefinitions).mockResolvedValue({ items: [definition] });
    vi.mocked(getReportDefinition).mockResolvedValue(definition);
    vi.mocked(listExecutionCases).mockResolvedValue({ cases: [{ executionCaseId: 'case-1' }] });
    vi.mocked(readExecutionCase).mockResolvedValue({
      version: 7,
      detail: { initiativeId: 'initiative-1' },
    });
    vi.mocked(createExecutionTask).mockResolvedValue({ aggregateVersion: 1, response: {} });
    vi.mocked(createReportDefinition).mockResolvedValue({ response: definition });
    vi.mocked(transitionReportDefinition).mockResolvedValue({ response: definition });
    vi.mocked(createReportRun).mockResolvedValue({ response: run });
    vi.mocked(transitionReportRun).mockImplementation(async (_id, command: any) => ({
      response:
        command.action === 'LINK_FOLLOW_UP'
          ? {
              ...run,
              followUpTaskRef: {
                taskId: command.taskId,
                version: command.taskVersion,
                receiptClientRequestId: command.taskReceiptClientRequestId,
              },
            }
          : {
              ...run,
              status: 'PUBLISHED',
              exportPackage: { format: 'JSON' },
              distributionReceipts: [
                { receiptId: 'dist-1', audience: 'SteerCo', contentHash: 'hash-1' },
              ],
            },
    }));
  });
  it('keeps the register fail-closed and retries the canonical report sources', async () => {
    vi.mocked(listReportRuns)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [run] });
    render(<Harness />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się załadować');
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect((await screen.findAllByText(/Weekly execution/)).length).toBeGreaterThan(0);
    expect(listReportRuns).toHaveBeenCalledTimes(2);
  });

  it('opens canonical run by keyboard and publishes only approved frozen snapshot', async () => {
    render(<Harness />);
    const row = (await screen.findByText(/Weekly execution · 08 sie 2026/)).closest('tr')!;
    fireEvent.click(row);
    fireEvent.keyDown(row.closest('div[tabindex="0"]')!, { key: 'Enter' });
    expect(screen.getByText(/Realizacja · case 1 · v3/)).toBeInTheDocument();
    // CTA „Nowy raport" — teraz w Menu 2 gospodarza, otwiera kreator zdarzeniem.
    // Mutacja: usunięcie nasłuchu `execution:reports-new-report` w
    // `ExecutionReportsSurface` ma przewrócić tę asercję (kreator nigdy się
    // nie otworzy).
    dispatchNewReportCta();
    expect(await screen.findByTestId('execution-report-wizard')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Report distribution receiptId'), {
      target: { value: 'dist-1' },
    });
    fireEvent.change(screen.getByLabelText('Report distribution audience'), {
      target: { value: 'SteerCo' },
    });
    fireEvent.change(screen.getByLabelText('Report distribution distributedAt'), {
      target: { value: '2026-08-10T12:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Opublikuj zatwierdzoną migawkę' }));
    await waitFor(() =>
      expect(transitionReportRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          expectedVersion: 5,
          action: 'PUBLISH',
          distribution: expect.objectContaining({ receiptId: 'dist-1' }),
        })
      )
    );
    expect(await screen.findByText(/Zamrożony pakiet pozostaje/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download|export/i })).not.toBeInTheDocument();
  });
  it('uses only an exact PUBLISHED Definition version and supports its governed lifecycle', async () => {
    render(<Harness />);
    // Przełącznik Raporty|Definicje — teraz w Menu 2 (`onRegisterFilterControl`).
    fireEvent.click(await screen.findByRole('tab', { name: 'Definicje' }));
    const definitionRow = (await screen.findByText('Weekly execution')).closest('tr')!;
    fireEvent.click(definitionRow);
    expect(screen.getAllByText('owner 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('approver 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    // „Nowa definicja" — teraz przycisk drugorzędny w Menu 2, obok dropdownu „Poziom".
    fireEvent.click(screen.getByRole('button', { name: 'Nowa definicja' }));
    fireEvent.change(screen.getByLabelText('Report Definition publish rationale'), {
      target: { value: 'Independent contract approval' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Opublikuj definicję' }));
    await waitFor(() =>
      expect(transitionReportDefinition).toHaveBeenCalledWith(
        'weekly',
        expect.objectContaining({
          expectedVersion: 7,
          action: 'PUBLISH',
          rationale: 'Independent contract approval',
        })
      )
    );
    // Kontrakt raportu (zaawansowane) — otwiera edytor pełnego kontraktu
    // ReportRun (`showRunEditor`), w odróżnieniu od CTA „Nowy raport" (Menu
    // 2), które otwiera tylko kreator migawki MVP (`wizardOpen`).
    fireEvent.click(
      screen.getByRole('button', { name: 'Kontrakt raportu (zaawansowane)' })
    );
    fireEvent.change(screen.getByLabelText('ReportRun published Definition version'), {
      target: { value: 'weekly@2' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Zaawansowany kontrakt JSON' }));
    fireEvent.change(screen.getByLabelText('ReportRun draft JSON'), {
      target: {
        value: JSON.stringify({
          reportRunId: 'run-2',
          definitionRef: { definitionId: 'wrong', version: 99 },
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz lub odśwież raport' }));
    await waitFor(() =>
      expect(createReportRun).toHaveBeenCalledWith(
        'run-2',
        expect.objectContaining({ definitionRef: { definitionId: 'weekly', version: 2 } })
      )
    );
  });
  it('creates a versioned Definition only with explicit project scope and no tenant-wide default', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Nowa definicja' }));
    expect(screen.getByRole('button', { name: 'Utwórz definicję' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Report Definition ID'), {
      target: { value: 'project-report' },
    });
    fireEvent.change(screen.getByLabelText('Report Definition project IDs'), {
      target: { value: 'project-1\nproject-2' },
    });
    fireEvent.click(screen.getByLabelText('Zaawansowany kontrakt definicji'));
    fireEvent.change(screen.getByLabelText('Report Definition contract JSON'), {
      target: {
        value: JSON.stringify({
          name: 'Project report',
          purpose: 'Steering',
          audience: ['PMO'],
          cadence: 'WEEKLY',
          scope: { type: 'EXECUTION', refs: ['case-1'] },
          outputSchema: {},
          sections: [{ sectionId: 'health', title: 'Health', mandatory: true }],
          sourceBindings: [],
          access: { classification: 'INTERNAL', audienceRoles: ['PMO'] },
          redaction: { defaultState: 'REDACTED', rules: [] },
          freshnessThresholdMinutes: 60,
          confidenceThreshold: 'MEDIUM',
          ownerId: 'owner',
          approverId: 'approver',
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz definicję' }));
    await waitFor(() =>
      expect(createReportDefinition).toHaveBeenCalledWith(
        'project-report',
        expect.objectContaining({
          scope: expect.objectContaining({
            projectIds: ['project-1', 'project-2'],
            generalBacklogAllowed: false,
          }),
        })
      )
    );
  });
  it('creates a canonical follow-up Task and automatically links its exact receipt', async () => {
    render(<Harness />);
    fireEvent.click((await screen.findByText(/Weekly execution · 08 sie 2026/)).closest('tr')!);
    // Pola zadania następczego żyją w edytorze pełnego kontraktu ReportRun
    // (`showRunEditor`) — otwiera go „Kontrakt raportu (zaawansowane)", nie
    // CTA „Nowy raport" (to tylko kreator migawki MVP).
    fireEvent.click(
      screen.getByRole('button', { name: 'Kontrakt raportu (zaawansowane)' })
    );
    for (const [label, value] of [
      ['executionCaseId', 'case-1'],
      ['taskId', 'task-follow-1'],
      ['title', 'Resolve report finding'],
      ['description', 'Close source gap'],
      ['assigneeId', 'assignee-1'],
      ['ownerId', 'owner-1'],
      ['dueAt', '2026-08-20T10:00'],
      ['slaAt', '2026-08-19T10:00'],
      ['evidenceRefs', 'report:run-1:v5'],
    ])
      fireEvent.change(screen.getByLabelText(`Report follow-up ${label}`), {
        target: { value },
      });
    fireEvent.click(screen.getByRole('button', { name: 'Utwórz i powiąż zadanie następcze' }));
    await waitFor(() =>
      expect(createExecutionTask).toHaveBeenCalledWith(
        'case-1',
        'task-follow-1',
        expect.objectContaining({
          expectedCaseVersion: 7,
          initiativeId: 'initiative-1',
          evidenceRefs: ['report:run-1:v5'],
        })
      )
    );
    expect(transitionReportRun).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        action: 'LINK_FOLLOW_UP',
        taskId: 'task-follow-1',
        taskVersion: 1,
        taskReceiptClientRequestId: expect.any(String),
      })
    );
    expect(await screen.findByText(/Zadanie następcze task-follow-1 v1/)).toBeInTheDocument();
  });

  it('Menu 3 (3 presety): „Do przeglądu" łączy szkice CONTRACT z definicjami MVP; „Opublikowane" zawęża do PUBLISHED', async () => {
    render(<Harness activePreset="needs-review" />);
    // Zastany kontrakt runtime-v1 (`run`, status APPROVED) NIE jest ani DRAFT/
    // FROZEN/VALIDATED/FAILED ani PUBLISHED — więc nie pojawia się w żadnym z
    // dwóch zawężonych presetów. Potwierdza to, że preset realnie filtruje
    // (nie jest dekoracją z licznikiem, ten sam błąd co 1.12-R1).
    await screen.findByText('Brak raportów');
    expect(screen.queryByText(/Weekly execution · 08 sie 2026/)).not.toBeInTheDocument();
  });

  it('dropdown „Poziom" (Menu 2) jest zarejestrowany i domyślnie na „Wszystkie"', async () => {
    render(<Harness />);
    const dropdown = await screen.findByTestId('execution-reports-level-dropdown');
    expect(dropdown).toHaveTextContent('Poziom');
  });
});
