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
    /* F9 (15.09.2026): CZWARTY dropdown to ten sam przelacznik „Status"
       renderowany w skrzynce recenzenta (`transitionInbox`) — bez niego
       wejscie do skrzynki byloby jednokierunkowe. Niezmiennik, ktorego ten
       test broni, NIE jest liczba 3, tylko „zaden dropdown Menu 2 nie pokazuje
       licznika na przycisku" — czyli KAZDY chodzi w trybie `compact`. Dlatego
       porownujemy zbiory, a nie przepisujemy stalej w dol. */
    expect(wszystkie).toHaveLength(4); // Inicjatywy · Plan · Obciążenie · Skrzynka
    expect(dropdowny).toHaveLength(wszystkie.length);
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

describe('Menu 3 · pigułki rejestru nie przeciekają do skrzynki [H1f DEC-507]', () => {
  it('`commandRowContent` (Wszystkie/Do zatwierdzenia/W realizacji) jest wyłączony dla `transitionInbox`', () => {
    /*
     * Zakładka „Do akceptacji" (`TransitionInboxSurface`) ma WŁASNY licznik
     * w tabeli — pigułki rejestru cyklu życia z reszty Inicjatyw nie mają tu
     * sensu (filtrują po statusie inicjatywy, nie po stanie propozycji).
     * Mutacja: usuń `activeTab === 'transitionInbox'` z warunku wyłączeń
     * `commandRowContent` → RED.
     */
    const start = hub.indexOf('commandRowContent={');
    const koniec = hub.indexOf('commandRowRightContent={', start);
    expect(start).toBeGreaterThan(-1);
    expect(koniec).toBeGreaterThan(start);
    const blok = bezKomentarzy(hub.slice(start, koniec));
    expect(blok).toContain("activeTab === 'transitionInbox'");
  });

  it('`commandRowContent` jest wyłączony także dla `workReport` [P1 RP1b]', () => {
    /*
     * Zakładka „Raport z pracy" listuje PRZEBIEGI raportu, a pigułki Menu 3
     * filtrują INICJATYWY po statusie cyklu życia (PENDING_APPROVAL /
     * IN_EXECUTION) — przejazd kanonu Z-29 zmierzył je nad tabelą przebiegów,
     * gdzie nie miały czego filtrować. Ta sama klasa defektu co H1f.
     * Mutacja: usuń `activeTab === 'workReport'` z warunku wyłączeń → RED.
     */
    const start = hub.indexOf('commandRowContent={');
    const koniec = hub.indexOf('commandRowRightContent={', start);
    const blok = bezKomentarzy(hub.slice(start, koniec));
    expect(blok).toContain("activeTab === 'workReport'");

    /* Prawy skraj Menu 3 (kebab „Więcej" = adopcja klasycznej inicjatywy) też
       nie ma sensu nad listą przebiegów raportu. */
    const startR = hub.indexOf('commandRowRightContent={');
    const koniecR = hub.indexOf('chips={', startR);
    const blokR = bezKomentarzy(hub.slice(startR, koniecR));
    expect(blokR).toContain("activeTab === 'workReport'");
  });
});

describe('Menu 3 · `commandRowContent` (pigułki cyklu życia) — `capacity` już bezwarunkowo wyłączony', () => {
  it('warunek zawiera `activeTab === \'capacity\'` BEZ gałęzi flagi — sprzed `INITIATIVES_WORKLOAD_ENABLED` (audyt Q1 P3 DEC-495, zmiany NIE było)', () => {
    /*
     * Audyt Q1 P3 (14.09): premisa zlecenia mówiła o przecieku pigułek
     * REJESTRU (Wszystkie/Do zatwierdzenia/W realizacji) do zakładki
     * „Obciążenie" przy włączonej heatmapie. Ten konkretny prop
     * (`commandRowContent`) wyłącza `capacity` bezwarunkowo od commitu
     * c7faa68b0d — SPRZED istnienia flagi `INITIATIVES_WORKLOAD_ENABLED`.
     * Realny przeciek (patrz opis niżej) siedział gdzie indziej — w
     * `canonicalMenu3Definitions.capacity` (`chips=`) i w dropdownie
     * „Status" (`Menu2PresetDropdown`). Test zostaje jako regresja-guard na
     * TEN prop — nie dowodzi całości fixa Q1 P3.
     * Mutacja: dopisz `&& INITIATIVES_WORKLOAD_ENABLED` obok `capacity` w
     * tym warunku → RED (chipy wróciłyby przy OFF, na linii scenariuszy).
     */
    const start = hub.indexOf('commandRowContent={');
    const koniec = hub.indexOf('commandRowRightContent={', start);
    expect(start).toBeGreaterThan(-1);
    expect(koniec).toBeGreaterThan(start);
    const blok = bezKomentarzy(hub.slice(start, koniec));
    expect(blok).toContain("activeTab === 'capacity'");
    expect(blok).not.toContain("'capacity' && INITIATIVES_WORKLOAD_ENABLED");
    expect(blok).not.toContain("INITIATIVES_WORKLOAD_ENABLED && activeTab === 'capacity'");
  });
});

describe('Menu 3 · pigułki „Drafts/Published/With gaps" nie przeciekają do heatmapy Obciążenia [Q1 P3 DEC-495]', () => {
  it('`canonicalMenu3Definitions.capacity` zwraca PUSTĄ listę gdy `INITIATIVES_WORKLOAD_ENABLED` — inaczej dla OFF (linia zachowuje chipy)', () => {
    /*
     * ZNALEZIONY i NAPRAWIONY przeciek (dev-render z realną atrapą API,
     * zrzut a1-heatmapa-on-light.png PRZED naprawą pokazywał "Drafts 0 /
     * Published 0 / With gaps 0" nad heatmapą Q1 — te trzy pigułki filtrują
     * WYŁĄCZNIE `CapacityScenarioSurface` (linia, `activePreset=
     * {canonicalMenu3Preset.capacity}` przekazywany TYLKO tam), heatmapa
     * (`InitiativeWorkloadSurface`) nie zna `activePreset` — klik był martwy.
     * Mutacja: usuń `INITIATIVES_WORKLOAD_ENABLED ? [] :` przed listą
     * `capacity` w `canonicalMenu3Definitions` → RED (chipy wracają przy ON).
     */
    const start = hub.indexOf('const canonicalMenu3Definitions');
    const koniec = hub.indexOf('const canonicalMenu3 = canonicalMenu3Definitions', start);
    expect(start).toBeGreaterThan(-1);
    expect(koniec).toBeGreaterThan(start);
    const blok = bezKomentarzy(hub.slice(start, koniec));
    const capacityStart = blok.indexOf('capacity: INITIATIVES_WORKLOAD_ENABLED');
    expect(capacityStart).toBeGreaterThan(-1);
    const capacityBlok = blok.slice(capacityStart, blok.indexOf('],', capacityStart) + 2);
    expect(capacityBlok.replace(/\s+/g, ' ')).toContain('INITIATIVES_WORKLOAD_ENABLED ? [] : [');
  });

  it('dropdown „Status" (`Menu2PresetDropdown`, te same Drafts/Published/With gaps) renderuje się TYLKO gdy `!INITIATIVES_WORKLOAD_ENABLED`', () => {
    /*
     * Drugi wołacz tych samych opcji (`canonicalMenu3FullOptions.capacity`) —
     * dropdown „Status" w Menu 2 (`rightControls`). Ten sam przeciek: bez
     * odpowiednika w heatmapie, musi zniknąć razem z chipami.
     * Mutacja: usuń `&& !INITIATIVES_WORKLOAD_ENABLED` z warunku renderowania
     * tego `Menu2PresetDropdown` → RED.
     */
    const marker = "data-testid=\"initiatives-capacity-constraint-dropdown\"";
    const dropdownIdx = hub.indexOf(marker);
    expect(dropdownIdx).toBeGreaterThan(-1);
    const wstecz = hub.lastIndexOf("{activeTab === 'capacity'", dropdownIdx);
    expect(wstecz).toBeGreaterThan(-1);
    const warunek = hub.slice(wstecz, hub.indexOf('(', wstecz));
    expect(bezKomentarzy(warunek)).toContain('!INITIATIVES_WORKLOAD_ENABLED');
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
