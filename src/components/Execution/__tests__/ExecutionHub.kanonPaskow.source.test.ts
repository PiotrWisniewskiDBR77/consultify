/**
 * @vitest-environment node
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] PORZĄDEK MENU 1/2/3 — Realizacja.
 *
 * Uwaga właściciela 08.09.2026 (staging, Realizacja → Praca, ekran 2000 px):
 * „tutaj w menu też chaos — zrób to zgodnie z kanonem Menu 1, 2, 3". Na jego
 * zrzucie pasek funkcjonalny łamał się na TRZY linie: baner „⚠ Niepełne dane:
 * 1 realizacja bez odpowiedzi", pod nim select „Wszystkie realizacje", pod nim
 * przycisk „Nowe zadanie".
 *
 * Kanon TRIADA (`docs/ui-standards/TRIADA_KANON.md` §A2 + lista czekowania
 * pkt 2 i 3) mówi o Menu 2 trzy rzeczy, które ten test pilnuje mechanicznie:
 *   1. JEDEN primary CTA na zakładkę, na prawym skraju, ciemny wypełniony —
 *      a nie przyciski `btn-secondary` doklejone do slotu FILTRÓW;
 *   2. BEZ LICZNIKÓW (liczniki mieszkają w Menu 3);
 *   3. BEZ BANERÓW i jedna linia (żadnego `flex-wrap`).
 *
 * Dlaczego na ŹRÓDLE, a nie na zamontowanym drzewie: `ExecutionHub` ma ~6 tys.
 * linii i montowanie go w teście jednostkowym jest znanym źródłem OOM w vitest
 * (patrz `ExecutionHub.kokpitMenu3.source.test.ts` i komentarz o pętli
 * efekt↔gospodarz w `ExecutionControlSurface`). Zachowanie CTA jest
 * sprawdzane osobno, na zamontowanych powierzchniach
 * (`ExecutionWorkSurface.edycjaWierszem`, `ExecutionResources.wiszacaRealizacja`,
 * `ExecutionControlSurface.raidSygnaly`), a układ pasków — zrzutami
 * w `evidence/menu-123-porzadek/`.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const zrodlo = (nazwa: string) =>
  readFileSync(new URL(`../${nazwa}`, import.meta.url), 'utf8');

const hub = zrodlo('ExecutionHub.tsx');
const praca = zrodlo('ExecutionWorkSurface.tsx');
const zasoby = zrodlo('ExecutionResourcesSurface.tsx');
const sterowanie = zrodlo('ExecutionControlSurface.tsx');
const raporty = zrodlo('ExecutionReportsSurface.tsx');

/**
 * Usuwa komentarze (`//`, `/* … *\/`, `{/* … *\/}`) — inaczej test mierzyłby
 * własne wyjaśnienia zamiast kodu. Pierwsza wersja tego pliku wywracała się
 * na zdaniach „bez `flex-wrap`" i „cztery `tabular-nums`" W KOMENTARZU, choć
 * kod był poprawny: przyrząd łapał opis defektu zamiast defektu.
 */
const bezKomentarzy = (kod: string): string =>
  kod
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
    .replace(/([^:])\/\/.*$/gm, '$1');

/**
 * Wycina ładunek JSX przekazany do `onRegisterFilterControl(` — czyli DOKŁADNIE
 * to, co ląduje w slocie filtrów Menu 2 gospodarza. Liczenie nawiasów, nie
 * regex do pierwszego `)`, bo w środku jest pełen JSX z nawiasami.
 */
const slotFiltrow = (kod: string): string => {
  const wywolanie = 'onRegisterFilterControl(\n';
  const start = kod.indexOf(wywolanie);
  expect(start, 'powierzchnia musi rejestrować slot filtrów Menu 2').toBeGreaterThan(-1);
  let i = start + wywolanie.length - 1;
  let glebokosc = 1;
  while (glebokosc > 0 && i < kod.length) {
    i += 1;
    if (kod[i] === '(') glebokosc += 1;
    else if (kod[i] === ')') glebokosc -= 1;
  }
  return bezKomentarzy(kod.slice(start, i));
};

const POWIERZCHNIE: Array<[string, string]> = [
  ['Praca', praca],
  ['Zasoby', zasoby],
  ['Decyzje i ryzyka', sterowanie],
];

/**
 * Raporty NIE wchodzi do `POWIERZCHNIE` powyżej: jej slot filtrów legalnie
 * niesie `<button>` — przełącznik widoku „Raporty | Definicje" (role="tab",
 * NIE akcja tworzenia) — więc ogólna asercja „zero `<button>` w slocie
 * filtrów" dawałaby fałszywy czerwony. Dostaje własny, węższy komplet
 * asercji niżej: brak `btn-secondary` (dawny jasny obrys CTA) i DOKŁADNIE
 * jedna rejestracja `onRegisterPrimaryCta`.
 */
describe('Menu 2 · Raporty: CTA „Dodaj raport" ciemny primary, nie btn-secondary', () => {
  it('slot filtrów NIE niesie żadnego CTA (`btn-secondary` usunięty razem z `AddReportMenu`)', () => {
    const slot = slotFiltrow(raporty);
    // Mutacja: przywróć `AddReportMenu`/`btn-secondary` do slotu filtrów → RED.
    expect(slot).not.toContain('btn-secondary');
    expect(slot).not.toContain('AddReportMenu');
  });

  it('slot filtrów NIE zawija i bierze klasę z SSOT (`MENU_2_FILTERS_ROW`)', () => {
    const slot = slotFiltrow(raporty);
    expect(slot).not.toContain('flex-wrap');
    expect(slot).toContain('MENU_2_FILTERS_ROW');
  });

  it('rejestruje DOKŁADNIE jeden primary CTA — „Dodaj raport", wariant `menu`', () => {
    // Mutacja: dopisz drugie `onRegisterPrimaryCta({ … })` albo wróć z CTA
    // do slotu filtrów (`AddReportMenu`) → RED.
    const rejestracje = raporty.match(/onRegisterPrimaryCta\(\{/g) ?? [];
    expect(rejestracje).toHaveLength(1);
    expect(raporty).toContain("testId: 'execution-reports-add-report-menu'");
    // Wariant z rozwijanym menu — TEN SAM komponent CTA co Praca/Zasoby/
    // Decyzje i ryzyka (`StandardModuleBar`/`PrimaryCtaMenuButton`), różni
    // się tylko obecnością `menu:` zamiast zwykłego `onClick`.
    expect(raporty).toContain('menu: {');
  });

  it('CTA znika w widoku „Definicje" (rejestruje `null`, nie duplikuje działania)', () => {
    expect(raporty).toContain("if (registerMode !== 'RUNS') {");
  });
});

describe('Menu 2 · slot filtrów niesie WYŁĄCZNIE filtry', () => {
  it.each(POWIERZCHNIE)(
    '%s: zero przycisków akcji w slocie filtrów (CTA idzie osobnym kanałem)',
    (_nazwa, kod) => {
      const slot = slotFiltrow(kod);
      // Mutacja: wstaw z powrotem `<button className="btn-secondary">Nowe …`
      // do węzła `onRegisterFilterControl` → RED.
      expect(slot).not.toContain('<button');
      expect(slot).not.toContain('btn-secondary');
    }
  );

  it.each(POWIERZCHNIE)('%s: slot filtrów NIE zawija (kanon §A2 „jedna linia")', (_n, kod) => {
    // Mutacja: `MENU_2_FILTERS_ROW` → `"flex flex-wrap items-center gap-2"` → RED.
    const slot = slotFiltrow(kod);
    expect(slot).not.toContain('flex-wrap');
    expect(slot).toContain('MENU_2_FILTERS_ROW');
  });

  it.each(POWIERZCHNIE)('%s: żadnego banera ani licznika w Menu 2', (_n, kod) => {
    const slot = slotFiltrow(kod);
    // Baner stanu danych (kanon: jedno miejsce nad tabelą, nigdy Menu 2).
    expect(slot).not.toContain('role="status"');
    expect(slot).not.toContain('role="alert"');
    expect(slot).not.toContain('<Banner');
    // Liczniki (kanon lista czekowania pkt 3 — liczniki tylko w Menu 3).
    expect(slot).not.toContain('tabular-nums');
  });
});

describe('Menu 2 · JEDEN primary CTA na zakładkę', () => {
  it('Praca rejestruje dokładnie jeden CTA — „Nowe zadanie"', () => {
    // Mutacja: dopisz drugie `onRegisterPrimaryCta({ … })` (np. „Nowa decyzja")
    // albo wróć z przyciskiem do slotu filtrów → RED.
    const rejestracje = praca.match(/onRegisterPrimaryCta\(\{/g) ?? [];
    expect(rejestracje).toHaveLength(1);
    expect(praca).toContain("testId: 'execution-work-new-task'");
  });

  it('Zasoby rejestrują dokładnie jeden CTA — „Dodaj dostępność"', () => {
    const rejestracje = zasoby.match(/onRegisterPrimaryCta\(\{/g) ?? [];
    expect(rejestracje).toHaveLength(1);
    expect(zasoby).toContain("testId: 'execution-resources-add-availability'");
  });

  it('Decyzje i ryzyka: dwie rejestracje, ale ROZŁĄCZNE (per preset Menu 3)', () => {
    // „Nowa decyzja" tylko w Decyzjach (i tylko gdy `canDecide`), „Nowa pozycja
    // RAID" tylko w Ryzykach, w Sygnałach żadne — nigdy dwa naraz.
    const rejestracje = sterowanie.match(/onRegisterPrimaryCta\(\{/g) ?? [];
    expect(rejestracje).toHaveLength(2);
    expect(sterowanie).toContain("activeGovernancePreset === 'decyzje' && canDecide(null)");
    expect(sterowanie).toContain("activeGovernancePreset === 'ryzyka'");
  });

  it('rzadkie akcje tworzenia idą do kebaba Menu 3, nie do drugiego CTA', () => {
    expect(praca).toContain("id: 'execution-work-new-milestone'");
    expect(zasoby).toContain("id: 'execution-resources-propose-allocation'");
    // „New Decision" z zakładki Praca USUNIĘTY — dublował CTA zakładki
    // „Decyzje i ryzyka" (JEDNA AKCJA = JEDEN DOM). Mutacja: przywróć → RED.
    expect(praca).not.toContain("setToolMode('DECISION')}>");
    expect(praca).not.toContain('execution.actions.newDecision');
  });
});

describe('ExecutionHub · pasek modułu', () => {
  it('gospodarz podaje `primaryCta` do StandardModuleBar (prawy skraj Menu 2)', () => {
    // Mutacja: usuń prop `primaryCta` → CTA znikają z paska → RED.
    expect(hub).toContain('primaryCta={');
    expect(hub).toContain('workPrimaryCta ?? undefined');
    expect(hub).toContain('resourcesPrimaryCta ?? undefined');
    expect(hub).toContain('controlPrimaryCta ?? undefined');
    // DEC-453 (odbiór spójności 08.09 wieczór): Raporty dołączają do tego
    // samego kanału — CTA „Dodaj raport" przestaje być jedynym `btn-secondary`
    // obok ciemnych primary CTA sąsiednich zakładek.
    expect(hub).toContain('reportsPrimaryCta ?? undefined');
  });

  it('slot filtrów gospodarza nie zawija i nie niesie liczników', () => {
    const start = hub.indexOf('const rightControls = useMemo');
    const koniec = hub.indexOf('const portfolioMetrics', start);
    const blok = bezKomentarzy(hub.slice(start, koniec));
    // Mutacja: przywróć plakietkę „exec v2" z czterema `tabular-nums` → RED.
    expect(blok).not.toContain('tabular-nums');
    expect(blok).not.toContain('exec v2');
    expect(blok).not.toContain('flex-wrap');
  });

  it('segment zakresu bierze klasy z SSOT, nie z własnego zestawu', () => {
    // Mutacja: wpisz z powrotem lokalne `h-8 px-3 rounded-full …` → RED.
    expect(hub).toContain('MENU_2_SEGMENT_GROUP');
    expect(hub).toContain('MENU_2_SEGMENT_ITEM_ACTIVE');
    expect(hub).toContain('MENU_2_SEGMENT_ITEM_INACTIVE');
  });

  it('prawy slot Menu 3 obsługuje Pracę i Zasoby, nie tylko Raporty', () => {
    expect(hub).toContain('workMenu3Control');
    expect(hub).toContain('resourcesMenu3Control');
  });
});
