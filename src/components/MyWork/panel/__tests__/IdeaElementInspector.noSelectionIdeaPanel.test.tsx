/** @vitest-environment jsdom */
/**
 * Panel BEZ zaznaczenia = poziom IDEI, nie pustka (odbiór CTO 05.09,
 * `09-idea-mapa.png`/`10-idea-whiteboard.png`). Przed naprawą ten stan był
 * 600-pikselową pustką: wyśrodkowana podpowiedź na środku panelu, karty
 * „Analiza płótna" + „Przejrzyj kandydaturę" przybite na sam dół, zderzające
 * się z plakietkami. Ten test broni naprawy: nagłówek niesie tożsamość IDEI
 * (tytuł/etap/narzędzie), podpowiedź jest JEDNĄ wyciszoną linią pod
 * nagłówkiem (nie centrowaną pustką), a ciało to kanoniczny `ArtifactRightPanel`
 * z „Akcje" (gniazdo Analizy płótna) i „Właściwości" idei OTWARTE jako
 * pierwsze dwie sekcje, reszta złożona.
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { IdeaElementInspector } from '../IdeaElementInspector';

const sectionOrder = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-artifact-section]')).map((el) =>
    el.getAttribute('data-artifact-section')
  );

describe('IdeaElementInspector — panel idei bez zaznaczenia', () => {
  it('renders the idea identity in the header (title, stage chip, tool label) and a one-line hint', () => {
    const { container } = render(
      <IdeaElementInspector
        element={null}
        tool="table"
        ideaTitle="Cyfrowy bliźniak linii montażowej"
        ideaStage="seed"
        ideaToolLabel="Table"
        ideaCreatedAt={new Date('2026-09-01T10:00:00Z').getTime()}
        ideaUpdatedAt={new Date('2026-09-05T10:00:00Z').getTime()}
      />
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Cyfrowy bliźniak linii montażowej' })
    ).toBeInTheDocument();
    // Stage chip (canonical `IdeaStageChip`, same one the workspace top bar
    // uses) in the header — it also repeats inside "Properties" below (same
    // duplication the with-selection branch already has for semanticType/branch:
    // a compact identity chip up top, the full property sheet lower down).
    const header = container.querySelector('header')!;
    expect(within(header).getByTestId('idea-menu1-stage-chip')).toBeInTheDocument();
    expect(within(header).getByText('Table')).toBeInTheDocument();
    // The old centred-void hint text still exists (sr-only, kept for a11y/back-compat
    // with the pre-existing empty-state contract) — the VISIBLE copy is the longer,
    // single-line variant that now sits right under the header. (The global
    // react-i18next test mock echoes back the literal default string passed to
    // `t()`, which this component writes in Polish — see translation.json for
    // the real English copy.)
    expect(
      screen.getByText('Kliknij węzeł, wiersz, kartkę albo krawędź, aby zobaczyć jego pola')
    ).toBeInTheDocument();
  });

  it('renders Akcje and Properties open, first in canon order — never a floating action pinned below other content', () => {
    const { container } = render(
      <IdeaElementInspector
        element={null}
        tool="mindmap"
        showCanvasAnalysis
        ideaTitle="Idea"
        ideaStage="seed"
      />
    );

    const order = sectionOrder(container);
    expect(order[0]).toBe('actions');
    expect(order[1]).toBe('properties');
    expect(order.indexOf('actions')).toBeLessThan(order.indexOf('properties'));

    // "Akcje" carries the canvas-analysis portal slot (real card content is
    // portaled in by `IdeaAINudgeStrip`/the workspace — this only asserts the
    // slot lives INSIDE the Akcje section, not floating over the canvas).
    const actionsSection = container.querySelector('[data-artifact-section="actions"]')!;
    expect(
      within(actionsSection as HTMLElement).getByTestId('idea-canvas-analysis-slot')
    ).toBeInTheDocument();

    // "Properties" is open immediately (no click needed) and shows the idea's
    // own fields — not "select an element" placeholders.
    const propertiesSection = container.querySelector('[data-artifact-section="properties"]')!;
    expect(within(propertiesSection as HTMLElement).getByText('Idea')).toBeInTheDocument();
  });

  it('keeps Relations/Sources/Comments/History collapsed and honestly empty with nothing selected', () => {
    render(
      <IdeaElementInspector element={null} tool="whiteboard" ideaTitle="Idea" ideaStage="seed" />
    );

    // Collapsed sections render their header but not their empty-state body text
    // until expanded (same contract the with-selection branch already has).
    expect(screen.queryByText('Brak powiązań.')).not.toBeInTheDocument();
    expect(screen.getByText('Relations')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });
});
