/**
 * @vitest-environment jsdom
 *
 * Plan napraw MVP 05.09.2026, pozycja (1) `whiteboard-canvas` (A02):
 * właściciel — "jak zaznaczam element otwiera się pasek poziomy funkcji i on
 * się nie mieści w pasie — są ikony które wyglądają poza okno."
 *
 * Naprawione już 2026-09-02 (SHA 08f8194ce5, "pasek funkcji mieści się w
 * kanwie 1100 px -> 564 px"): pasek zaznaczenia dostał `max-w-[calc(100%-1.5rem)]`
 * + `overflow-x-auto` + wszystkie przyciski `iconOnly` (bez podpisów tekstowych
 * wypychających szerokość). jsdom nie liczy realnego layoutu (px), więc ten
 * test nie mierzy szerokości pikselowej — pilnuje MECHANIZMU ograniczenia
 * (klasy na kontenerze + brak widocznego tekstu etykiety w przyciskach), żeby
 * regresja (np. ktoś usunie `max-w`/`iconOnly` przy kolejnej zmianie) złapała
 * się na czerwono zamiast czekać na kolejny odbiór wzrokiem. Dowód
 * pikselowy: `evidence/drobne-20260905/whiteboard-canvas-selection-PO.png`
 * (dev-render, realny komponent, zaznaczony węzeł, pasek 564px w kanwie 1064px).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WhiteboardSelectionBar } from '../WhiteboardSelectionBar';

const noop = () => {};

function baseProps(
  overrides: Partial<React.ComponentProps<typeof WhiteboardSelectionBar>> = {}
) {
  return {
    isPl: true,
    locked: false,
    selectedCount: 1,
    hasSelectedFrame: false,
    ideaId: 'idea-1',
    onAlignNodes: noop,
    onDistributeNodes: noop,
    onGroupSelected: noop,
    onUngroupSelected: noop,
    onDuplicateSelected: vi.fn(),
    onLockSelected: noop,
    onDeleteSelected: vi.fn(),
    ...overrides,
  } as React.ComponentProps<typeof WhiteboardSelectionBar>;
}

describe('WhiteboardSelectionBar — pasek zaznaczenia nie przerasta kanwy', () => {
  it('kontener ma zaciśniętą szerokość (max-w) i poziomy scroll jako siatkę bezpieczeństwa', () => {
    render(<WhiteboardSelectionBar {...baseProps()} />);
    // i18n nie jest zainicjalizowany w testach jednostkowych (klucze wracają
    // dosłownie) — sam `role="toolbar"` wystarcza, bo jest tylko jeden pasek.
    const bar = screen.getByRole('toolbar');
    // Dwa zamki: przycięcie do szerokości kanwy + przewijanie jako ostatnia deska
    // ratunku — usunięcie KTÓREGOKOLWIEK to regresja "wystaje poza okno".
    expect(bar.className).toMatch(/max-w-\[calc\(100%-1\.5rem\)\]/);
    expect(bar.className).toMatch(/overflow-x-auto/);
  });

  it('wszystkie przyciski akcji są iconOnly (brak tekstowych podpisów wypychających szerokość)', () => {
    render(<WhiteboardSelectionBar {...baseProps()} />);
    const bar = screen.getByRole('toolbar');
    // iconOnly=true na ToolbarBtn/ToolbarDropdown chowa podpis tekstowy w
    // przycisku (etykieta zostaje tylko w title/aria-label) — sprawdzamy, że
    // żaden z widocznych <button> w pasku nie ma odsłoniętego tekstu dłuższego
    // niż licznik zaznaczenia (jedyny tekstowy element paska).
    const buttons = bar.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan (0);
    for (const btn of Array.from(buttons)) {
      // Treść widoczna wewnątrz przycisku to tylko ikona SVG — brak węzła
      // tekstowego z podpisem (np. "Wyrównaj", "Rozłóż") obok ikony.
      const visibleText = (btn.textContent || '').trim();
      expect(visibleText).toBe('');
    }
  });

  it('nie renderuje się, gdy nic nie jest zaznaczone (brak pustego paska rezerwującego miejsce)', () => {
    const { container } = render(<WhiteboardSelectionBar {...baseProps({ selectedCount: 0 })} />);
    expect(container.firstChild).toBeNull();
  });
});
