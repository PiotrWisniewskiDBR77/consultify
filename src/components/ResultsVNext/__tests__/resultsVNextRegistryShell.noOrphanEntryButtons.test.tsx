/**
 * @vitest-environment jsdom
 *
 * DEC-422 (06.09, odbiór Piotra na 4 zrzutach KPI/OKR/ROI): Menu 2/3 nad
 * tabelą raportów nie ma mieć ŻADNYCH przycisków akcji poza `primaryCta`
 * (kanon TRIADA §B). Dwa konkretne przyciski właściciel kazał usunąć w
 * całości, nie tylko wyłączyć flagą: „Uwaga" (link do `/results/attention`,
 * skasowanego razem z tym przyciskiem) i „Raport zarządczy" (link do
 * `ROUTES.REPORTS.MANAGEMENT` — TEN ekran zostaje, kasujemy tylko wejście z
 * Wyników).
 *
 * DOWÓD MUTACYJNY: przywrócenie któregokolwiek z dwóch bloków usuniętych z
 * `ResultsVNextRegistryShell.tsx` (managementReportEntryEnabled/
 * attentionEntryEnabled + ich JSX) wywraca ten test na RED.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';

describe('ResultsVNextRegistryShell — brak sierocych wejść nad tabelą', () => {
  it('nie renderuje "Uwaga"/"Attention" ani "Raport zarządczy"/"Management report"', () => {
    render(
      <MemoryRouter initialEntries={['/results/kpi']}>
        <ResultsVNextRegistryShell
          domain="kpi"
          moduleBar={{ tabs: [{ id: 'kpi', label: 'KPI' }], activeTab: 'kpi' }}
          table={{ columns: [], data: [], persistKey: 'test.results-vnext-shell' }}
          preview={null}
        />
      </MemoryRouter>
    );

    expect(screen.queryByText('Uwaga')).not.toBeInTheDocument();
    expect(screen.queryByText('Attention')).not.toBeInTheDocument();
    expect(screen.queryByText('Raport zarządczy')).not.toBeInTheDocument();
    expect(screen.queryByText('Management report')).not.toBeInTheDocument();
    expect(screen.queryByTestId('results-vnext-attention-entry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('results-vnext-management-report-entry')).not.toBeInTheDocument();
  });
});
