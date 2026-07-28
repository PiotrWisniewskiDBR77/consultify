/**
 * Bramka D-06: zakładka Sheets nie rysuje własnego, czwartego paska nagłówkowego.
 *
 * Piotr zgłosił ten sam błąd TRZY razy — Client Vault (P-17), Run agent (P-18),
 * Sheets (P-28): ekran dokładał własną warstwę nad tabelę, choć host ma już
 * komplet Menu 1/2/3. Dla Sheets przełącznik `Sheets | Data sources` przeniósł
 * się do `rightControls` hosta (prawa strona Menu 2), a ten test pilnuje, żeby
 * pasek nie wrócił do środka komponentu przy kolejnym refaktorze.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SheetsTabContent } from '@/components/ReportsAndPresentations/SheetsTabContent';

vi.mock('@/components/ReportsAndPresentations/DataSourcesTabContent', () => ({
  DataSourcesTabContent: () => <div data-testid="atrapa-zrodla-danych" />,
}));

vi.mock('@/components/ReportsAndPresentations/OutputsAggregateTabContent', () => ({
  OutputsAggregateTabContent: () => <div data-testid="atrapa-lista-arkuszy" />,
}));

const propsBazowe = {
  viewMode: 'list' as const,
  searchQuery: '',
  activeFilters: [],
  onFilterChange: () => undefined,
  rows: [{ id: 'a1' }] as never,
  loading: false,
  error: null,
  onRefresh: () => undefined,
  actions: {} as never,
};

describe('Sheets — czwarta warstwa nagłówkowa (D-06)', () => {
  it('nie renderuje własnego paska przełącznika — ten żyje w Menu 2 hosta', () => {
    render(<SheetsTabContent {...propsBazowe} subView="list" />);

    expect(screen.queryByTestId('rap-sheets-subtabs')).toBeNull();
    expect(screen.queryByTestId('rap-sheets-subtab-list')).toBeNull();
    expect(screen.queryByTestId('rap-sheets-subtab-data')).toBeNull();
  });

  it('czyta wybór zbioru z propa hosta: „list" pokazuje arkusze', () => {
    render(<SheetsTabContent {...propsBazowe} subView="list" />);

    expect(screen.getByTestId('atrapa-lista-arkuszy')).toBeTruthy();
    expect(screen.queryByTestId('atrapa-zrodla-danych')).toBeNull();
  });

  it('czyta wybór zbioru z propa hosta: „data" pokazuje źródła danych', () => {
    render(<SheetsTabContent {...propsBazowe} subView="data" />);

    expect(screen.getByTestId('atrapa-zrodla-danych')).toBeTruthy();
    expect(screen.queryByTestId('atrapa-lista-arkuszy')).toBeNull();
  });

  it('bez propa hosta montuje się samodzielnie i domyślnie pokazuje arkusze', () => {
    // Fallback dla harnessu dev-render i testów — bez niego komponentu nie da
    // się zamontować poza hubem.
    render(<SheetsTabContent {...propsBazowe} />);

    expect(screen.getByTestId('atrapa-lista-arkuszy')).toBeTruthy();
  });
});
