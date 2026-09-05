/** @vitest-environment jsdom */
/**
 * JEDEN PRAWY PANEL — kontrakt zakładek (decyzja CTO 2026-09-05).
 *
 * Zgłoszenie właściciela (odbiór na żywo 05.09, Mapa myśli): „Czy naprawdę nie
 * umiesz ogarnąć tematu tych paneli po jednej i po drugiej stronie?" — na
 * ekranie stały DWA prawe panele obok siebie: inspektor elementu i dok Teresy.
 *
 * Ten test broni rozstrzygnięcia: w danej chwili panel ma DOKŁADNIE JEDEN
 * korzeń (`<aside>`), Teresa jest w nim ZAKŁADKĄ (nigdy drugą kolumną), a
 * zamknięcie panelu zdejmuje go z ekranu.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaElementInspector, type IdeaInspectorElement } from '../IdeaElementInspector';

const element: IdeaInspectorElement = {
  id: 'b1a87f77-5fdd-4ab4-969b-8ec9dc72348a',
  label: 'Adopcja użytkowników',
  state: 'idea',
  semanticType: 'Ryzyko',
  branch: 'ERP',
  lineage: 'Rodowód: mapa w wersji 41',
};

const teresa = <div data-testid="teresa-czat">czat Teresy</div>;

describe('IdeaElementInspector — jeden prawy panel z zakładkami', () => {
  it('z zaznaczonym elementem: JEDEN <aside>, dwie zakładki, aktywna „Element"', () => {
    const { container } = render(
      <IdeaElementInspector
        element={element}
        tool="mindmap"
        teresaContent={teresa}
        activeTab="element"
        onTabChange={vi.fn()}
      />
    );
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByTestId('idea-panel-tab-element')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('idea-panel-tab-teresa')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByTestId('teresa-czat')).toBeNull();
  });

  it('zakładka „Teresa": czat renderuje się W TYM SAMYM, JEDNYM panelu (zero drugiego <aside>)', () => {
    const { container } = render(
      <IdeaElementInspector
        element={element}
        tool="mindmap"
        teresaContent={teresa}
        activeTab="teresa"
        onTabChange={vi.fn()}
      />
    );
    // ★ SEDNO ZGŁOSZENIA: dwa panele obok siebie = dwa korzenie panelu.
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="idea-right-panel"]')).toHaveLength(1);
    expect(screen.getByTestId('teresa-czat')).toBeInTheDocument();
    expect(screen.getByTestId('idea-panel-tab-teresa')).toHaveAttribute('aria-selected', 'true');
  });

  it('zakładka „Teresa" jest dostępna także BEZ zaznaczenia (stan pusty ma tę samą powłokę)', () => {
    const onTabChange = vi.fn();
    const { container } = render(
      <IdeaElementInspector
        element={null}
        tool="mindmap"
        teresaContent={teresa}
        activeTab="element"
        onTabChange={onTabChange}
      />
    );
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('idea-panel-tab-teresa'));
    expect(onTabChange).toHaveBeenCalledWith('teresa');
  });

  it('X woła `onClosePanel` (zamknięcie CAŁEGO panelu), a nie tylko powrót na płótno', () => {
    const onClosePanel = vi.fn();
    const onReturnToCanvas = vi.fn();
    render(
      <IdeaElementInspector
        element={element}
        tool="mindmap"
        teresaContent={teresa}
        activeTab="element"
        onClosePanel={onClosePanel}
        onReturnToCanvas={onReturnToCanvas}
      />
    );
    fireEvent.click(screen.getByTestId('idea-panel-close'));
    expect(onClosePanel).toHaveBeenCalledTimes(1);
    expect(onReturnToCanvas).not.toHaveBeenCalled();
  });

  it('gospodarz, który panel zamknął, nie renderuje ŻADNEGO panelu (0 korzeni)', () => {
    // Gospodarzem jest `IdeaMapWorkspace` — po zamknięciu podaje powłoce
    // `elementInspectorRail={undefined}`. Odwzorowanie tego stanu: nic nie
    // renderujemy, więc na ekranie nie ma ani jednego panelu.
    const { container } = render(<div data-testid="tylko-plotno" />);
    expect(container.querySelectorAll('aside')).toHaveLength(0);
  });

  it('bez `teresaContent` komponent nie dokłada zakładek (zero zmiany dla innych wołaczy)', () => {
    const { container } = render(<IdeaElementInspector element={element} tool="mindmap" />);
    expect(container.querySelectorAll('aside')).toHaveLength(1);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('„Analiza płótna" ma gniazdo W PANELU (nie pływa nad płótnem) — także w zakładce Teresa', () => {
    const { container: zElementem } = render(
      <IdeaElementInspector
        element={element}
        tool="mindmap"
        teresaContent={teresa}
        activeTab="element"
        showCanvasAnalysis
      />
    );
    expect(
      zElementem.querySelectorAll('[data-testid="idea-canvas-analysis-slot"]')
    ).toHaveLength(1);

    const { container: zTeresa } = render(
      <IdeaElementInspector
        element={element}
        tool="mindmap"
        teresaContent={teresa}
        activeTab="teresa"
        showCanvasAnalysis
      />
    );
    expect(zTeresa.querySelectorAll('[data-testid="idea-canvas-analysis-slot"]')).toHaveLength(1);
  });
});
