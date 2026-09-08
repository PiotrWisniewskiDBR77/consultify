/**
 * @vitest-environment jsdom
 *
 * DEFEKT 1 (przejscie CTO 08.09, DEC-453) — w rejestrze Inicjatyw powod
 * blokady przycisku „Zatwierdz inicjatywe" byl w DOM, ale wizualnie niewidoczny:
 * `elementFromPoint` na jego wspolrzednych zwracal stopke „Kopiuj link", nie
 * sam tekst powodu.
 *
 * PRZYCZYNA: `PreviewPaneShell` renderuje sie ZAGNIEZDZONY, gdy `embedded`
 * (StandardPreview osadzony w PRAWDZIWEJ, nie-embedded powloce — patrz
 * `TableWithPreviewLayout`/`JedenPrawyPanel`, ktore zawijaja `rekord` w
 * `React.cloneElement(rekord, { embedded: true })`). Root wrapper mial
 * BEZWARUNKOWE `h-full … overflow-hidden` — takze dla `embedded` — co
 * przycinalo (a nie przewijalo) tresc dluzsza niz przydzielona wysokosc flexa,
 * bo prawdziwym wlascicielem przewijania jest przodek (kanon: „parent layout
 * already owns header and footer chrome").
 *
 * NAPRAWA: `embedded` renderuje `flex flex-col` (bez `h-full`/`overflow-hidden`)
 * — naturalna wysokosc tresci, zero przycinania; przewija sie PRAWDZIWY
 * (nie-embedded) content-div, ktory ma `overflow-y-auto`.
 *
 * MUTACJA (dowod RED): przywroc bezwarunkowe `'h-full flex flex-col overflow-hidden'`
 * (usun rozgalezienie na `embedded`) — ten plik pada, bo `embedded` znow
 * dostaje `overflow-hidden`.
 */
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { PreviewPaneShell } from '../PreviewPaneShell';

describe('PreviewPaneShell — embedded nie przycina tresci (defekt 1)', () => {
  it('embedded=true: root NIE ma `h-full` ani `overflow-hidden` (rodzic przewija, nie przycina)', () => {
    const { container } = render(
      <PreviewPaneShell title="Test" embedded>
        <div>Tresc</div>
      </PreviewPaneShell>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root).toBeTruthy();
    const classes = root.className.split(/\s+/);
    expect(classes).not.toContain('overflow-hidden');
    expect(classes).not.toContain('h-full');
    expect(classes).toContain('flex');
    expect(classes).toContain('flex-col');
  });

  it('embedded=false (domyslnie): zachowuje `h-full flex flex-col overflow-hidden` — bez regresji na prawdziwej powloce', () => {
    const { container } = render(
      <PreviewPaneShell title="Test">
        <div>Tresc</div>
      </PreviewPaneShell>
    );
    const root = container.firstElementChild as HTMLElement;
    const classes = root.className.split(/\s+/);
    expect(classes).toContain('h-full');
    expect(classes).toContain('overflow-hidden');
    expect(classes).toContain('flex');
    expect(classes).toContain('flex-col');
  });

  it('stopka (footer) prawdziwej powloki NIE jest `position: absolute` — stoi w przeplywie pod trescia', () => {
    render(
      <PreviewPaneShell title="Test" footer={<div>Kopiuj link</div>}>
        <div>Tresc</div>
      </PreviewPaneShell>
    );
    const footer = document.querySelector('[data-preview-block="footer"]') as HTMLElement;
    expect(footer).toBeTruthy();
    const classes = footer.className.split(/\s+/);
    expect(classes).not.toContain('absolute');
    expect(classes).toContain('shrink-0');
  });

  it('kontener tresci (embedded body) jest `flex-1` bez wlasnego `overflow-hidden`, ktory przycinalby ostatni blok', () => {
    const { container } = render(
      <PreviewPaneShell title="Test" embedded>
        <div data-testid="ostatni-blok">Powod blokady</div>
      </PreviewPaneShell>
    );
    const root = container.firstElementChild as HTMLElement;
    // Zero elementu w poddrzewie `embedded` roota, ktory mialby `overflow-hidden`
    // — to WLASNIE ten dodatkowy `overflow-hidden` przycinal powod (defekt 1).
    const anyOverflowHidden = root.querySelector('.overflow-hidden');
    expect(anyOverflowHidden).toBeNull();
  });
});
