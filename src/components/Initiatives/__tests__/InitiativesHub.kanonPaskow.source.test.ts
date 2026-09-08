/**
 * @vitest-environment node
 *
 * [ODMROZENIE 05_INITIATIVES DEC-453] PORZĄDEK MENU 1/2/3 — Inicjatywy.
 *
 * Bliźniak `ExecutionHub.kanonPaskow.source.test.ts`. Uwaga właściciela
 * 08.09.2026 dotyczyła zrzutu z Realizacji, ale zlecenie brzmiało „zrób
 * porządek we wszystkich funkcjach tych DWÓCH modułów" — a pomiar PRZED
 * (`evidence/menu-123-porzadek/01..03-inicjatywy-*-przed-1440-jasny.png.json`)
 * pokazał w Inicjatywach trzy własne odstępstwa od kanonu §A2:
 *   · dropdown „Status" niósł LICZNIK wprost w Menu 2 („Status: Wszystkie 97"),
 *     a lista czekowania pkt 3 mówi „Menu 2: bez liczników";
 *   · plakietka „SAMPLE DATA" — komunikat o STANIE DANYCH — stała w Menu 2;
 *   · prawy klaster Menu 3 (kebab „Więcej") siedział w `commandRowContent`,
 *     który `ModuleNavBar` owija w `<div className="min-w-0">` bez `flex-1`,
 *     więc `justify-between` nie miało czego rozpychać i kebab lądował tuż
 *     przy ostatnim chipie zamiast na prawym skraju.
 *
 * Test na ŹRÓDLE z tego samego powodu co w Realizacji: hub jest ciężki, a
 * zachowanie sprawdzają istniejące testy montowane (`InitiativesHub.smoke`).
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const hub = readFileSync(new URL('../InitiativesHub.tsx', import.meta.url), 'utf8');

/** Patrz bliźniaczy test Realizacji — bez tego test mierzy własne komentarze. */
const bezKomentarzy = (kod: string): string =>
  kod
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/([^:])\/\/.*$/gm, '$1');

/** Ciało `const rightControls = (…)` — slot filtrów Menu 2. */
const slotFiltrow = (() => {
  const start = hub.indexOf('const rightControls = (');
  const koniec = hub.indexOf('\n  return (\n    <div className="h-full"', start);
  expect(start).toBeGreaterThan(-1);
  expect(koniec).toBeGreaterThan(start);
  return bezKomentarzy(hub.slice(start, koniec));
})();

describe('Menu 2 · slot filtrów niesie WYŁĄCZNIE filtry', () => {
  it('zero przycisków akcji i zero banerów w slocie filtrów', () => {
    // Mutacja: wróć z plakietką „SAMPLE DATA" (`<span data-testid=
    // "initiatives-sample-data-marker">`) do `rightControls` → RED.
    expect(slotFiltrow).not.toContain('<button');
    expect(slotFiltrow).not.toContain('sampleData');
    expect(slotFiltrow).not.toContain('initiatives-sample-data-marker');
    expect(slotFiltrow).not.toContain('<Banner');
    expect(slotFiltrow).not.toContain('role="status"');
  });

  it('slot filtrów NIE zawija (kanon §A2 „jedna linia")', () => {
    // Mutacja: `MENU_2_FILTERS_ROW` → `"flex items-center gap-2"` z `flex-wrap` → RED.
    expect(slotFiltrow).not.toContain('flex-wrap');
    expect(slotFiltrow).toContain('MENU_2_FILTERS_ROW');
  });

  it('BEZ LICZNIKÓW w Menu 2 — dropdowny statusu chodzą w trybie `compact`', () => {
    /*
     * `Menu2PresetDropdown` pokazuje licznik NA PRZYCISKU tylko wtedy, gdy nie
     * jest `compact` albo gdy wybrano coś innego niż pozycja domyślna
     * (patrz `naDomyslnej` w komponencie). Bez `compact` przycisk pisał
     * „Status: Wszystkie 97" — licznik w Menu 2, wprost przeciw pkt 3 listy
     * czekowania. Mutacja: skasuj `compact` przy którymkolwiek z trzech
     * dropdownów → RED.
     */
    const dropdowny = slotFiltrow.match(/<Menu2PresetDropdown\s+compact/g) ?? [];
    const wszystkie = slotFiltrow.match(/<Menu2PresetDropdown/g) ?? [];
    expect(wszystkie).toHaveLength(3); // Inicjatywy · Plan · Obciążenie
    expect(dropdowny).toHaveLength(3);
  });

  it('natywny select priorytetu ma kanoniczny kształt kontrolki Menu 2', () => {
    /*
     * Selecta NIE zamieniamy na `Menu2PresetDropdown`, bo sterują nim testy
     * (`InitiativesHub.smoke` — `fireEvent.change` na `getByLabelText('Priority')`).
     * Wyrównujemy natomiast WYGLĄD do sąsiada przez wspólną stałą, żeby dwa
     * filtry obok siebie nie wyglądały jak dwa różne systemy.
     */
    expect(slotFiltrow).toContain('className={MENU_2_FILTER_SELECT}');
  });
});

describe('Menu 2 · JEDEN primary CTA na zakładkę', () => {
  it('`primaryCta` to jedna gałąź warunkowa — nigdy dwa CTA naraz', () => {
    const start = hub.indexOf('        primaryCta={');
    const koniec = hub.indexOf('        filterControls={rightControls}', start);
    expect(start).toBeGreaterThan(-1);
    const blok = bezKomentarzy(hub.slice(start, koniec));

    // Cztery rozłączne gałęzie: Plan → „Nowy plan", Obciążenie → „Nowa
    // analiza", pozostałe niż lista → brak, lista → „Nowa inicjatywa"
    // (wariant zablokowany dla pilota to ta sama, jedna pozycja).
    expect(blok).toContain("activeTab === 'plan'");
    expect(blok).toContain("activeTab === 'capacity'");
    expect(blok).toContain("activeTab !== 'list'");
    // Mutacja: zamień ternary na tablicę/fragment z dwoma przyciskami → RED.
    expect(blok).not.toContain('<button');
    expect(blok).not.toContain('primaryCtaContent');
  });

  it('w Menu 3 nie ma akcji tworzenia (kanon §A3: po prawej tylko AI/przełączniki)', () => {
    const start = hub.indexOf('const commandRowContent = (');
    const koniec = hub.indexOf('const commandRowRightContent', start);
    const blok = bezKomentarzy(hub.slice(start, koniec));
    expect(blok).not.toContain('Nowa inicjatywa');
    expect(blok).not.toContain('initiatives.form.newInitiative');
  });
});

describe('Menu 3 · prawy slot', () => {
  it('kebab „Więcej" jedzie kanonicznym `commandRowRightContent`, nie środkiem chipów', () => {
    /*
     * Mutacja: wstaw kebab z powrotem do `commandRowContent` (i przywróć tam
     * `justify-between`) → kebab wraca pod chipy, a ten test → RED.
     */
    expect(hub).toContain('const commandRowRightContent');
    expect(hub).toContain('commandRowRightContent={');
    const start = hub.indexOf('const commandRowContent = (');
    const koniec = hub.indexOf('const commandRowRightContent', start);
    const blok = bezKomentarzy(hub.slice(start, koniec));
    expect(blok).not.toContain('initiatives-menu3-kebab');
    expect(blok).not.toContain('MENU_3_RIGHT_CLASS');
    expect(blok).not.toContain('justify-between');
  });
});

describe('Segment zakresu — wspólny SSOT z Realizacją', () => {
  it('bierze klasy z `MENU_2_SEGMENT_*`, nie z własnego zestawu', () => {
    // Mutacja: wpisz z powrotem lokalne `h-8 px-3 rounded-full border-slate-200/60` → RED.
    expect(hub).toContain('MENU_2_SEGMENT_GROUP');
    expect(hub).toContain('MENU_2_SEGMENT_ITEM_ACTIVE');
    expect(hub).toContain('MENU_2_SEGMENT_ITEM_INACTIVE');
  });
});

describe('Komunikat o stanie danych — jedno miejsce, nad tabelą', () => {
  it('„SAMPLE DATA" renderuje się w treści zakładki przez wspólny `Banner`', () => {
    expect(hub).toContain("import { Banner } from '../shared/Banner';");
    const start = hub.indexOf('<div className="flex h-full min-h-0 flex-col overflow-hidden">');
    const blok = hub.slice(start, start + 1200);
    expect(blok).toContain('initiatives-sample-data-marker');
    expect(blok).toContain('<Banner');
  });
});
