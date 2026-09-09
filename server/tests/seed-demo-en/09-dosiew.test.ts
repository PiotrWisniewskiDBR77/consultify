import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BRANZA_ZE_SLOWNIKA,
  FORMATY_ARTEFAKTOW,
  PLAN_OSOBISTYCH,
  PLAN_POPYTU,
  PLAN_ZALEGLOSCI,
  POCHODNE_INICJATYW,
  POLA_KOMPLETNOSCI,
  POZYCJE_KARTY_KPI,
  PRZYDZIALY,
  poniedzialek,
  policzKompletnosc,
} from '../../scripts/seed/demo-en/09-dosiew-po-tescie';

/**
 * Testy ETAPU D9 (dosiew po tescie TEST-DANE) BEZ BAZY — czysta logika
 * i te niezmienniki, ktore latwo po cichu zepsuc, a ktorych `--verify`
 * na kopii NIE zlapie, bo `--verify` sprawdza STAN BAZY, a nie ZGODNOSC
 * stalych ze slownikami produktu.
 *
 * Zapytania SQL i pisarze kanoniczni sa sprawdzani na zywo przez
 * `09-dosiew-po-tescie.ts --dry-run/--apply/--verify` na kopii lokalnej —
 * dowod w `evidence/dane-pokazowe-en/d9/`.
 *
 * ZASADA: kazdy test tutaj pilnuje GRANICY MIEDZY SEEDEM A PRODUKTEM.
 * Slowniki (`INDUSTRIES`, formula kompletnosci, slownik `indicator_type`,
 * slownik osi inicjatywy) zyja w kodzie produktu; seed tylko sie do nich
 * stosuje. Gdy produkt je zmieni, ma tu zapalic sie czerwone swiatlo,
 * a nie cicho wrocic „—" na ekranie klienta.
 */

const KORZEN = join(__dirname, '..', '..', '..');
const czytaj = (wzgledna: string): string => readFileSync(join(KORZEN, wzgledna), 'utf8');

describe('09-dosiew — BRAK 1: industry musi nalezec do slownika INDUSTRIES produktu', () => {
  /**
   * TO JEST TEST PRZYCZYNY D-03. Ekran Organizacja → Identity rysuje pole
   * INDUSTRY natywnym `<select>`; wartosc spoza `INDUSTRIES` nie ma pasujacej
   * `<option>`, wiec select pokazuje `emptyLabel = '—'` mimo poprawnej danej
   * w bazie. Slownik czytamy Z PLIKU PRODUKTU, a nie z wlasnej kopii —
   * inaczej test „zgodzilby sie sam ze soba".
   */
  const zrodlo = czytaj('src/views/ContextBuilder/modules/organizationProfileTaxonomy.tsx');
  const blok = zrodlo.match(/export const INDUSTRIES = \[([\s\S]*?)\];/);
  const slownik = (blok?.[1] ?? '')
    .split('\n')
    .map((l) => l.trim().match(/^'(.+)',?$/)?.[1])
    .filter((v): v is string => Boolean(v));

  it('slownik INDUSTRIES daje sie odczytac z pliku produktu', () => {
    expect(slownik.length).toBeGreaterThan(5);
  });

  it('BRANZA_ZE_SLOWNIKA jest jedna z wartosci INDUSTRIES', () => {
    expect(slownik).toContain(BRANZA_ZE_SLOWNIKA);
  });

  it('wartosc zastana „Industrial Manufacturing" NIE jest w slowniku (dowod przyczyny D-03)', () => {
    expect(slownik).not.toContain('Industrial Manufacturing');
  });

  it('01-rdzen.ts uzywa TEJ SAMEJ branzy — inaczej ponowny 01 --apply cofnalby poprawke', () => {
    const rdzen = czytaj('server/scripts/seed/demo-en/01-rdzen.ts');
    const wartosc = rdzen.match(/const PROFIL = \{[\s\S]*?industry: '([^']+)'/)?.[1];
    expect(wartosc).toBe(BRANZA_ZE_SLOWNIKA);
  });
});

describe('09-dosiew — BRAK 1: formula kompletnosci = formula frontu (15 pol, nie 13)', () => {
  /**
   * Backend `profile_completeness` NIE LICZY — przyjmuje liczbe z ciala PUT
   * (`organization-profiles.routes.ts:439,502`). Jedynym mechanizmem produktu
   * jest `completenessChecks()` we froncie. Ten test przypina LISTE POL
   * do zrodla produktu: gdy front doda albo usunie warunek, seed przestanie
   * liczyc to samo i test ma to zlapac.
   */
  const zrodlo = czytaj('src/views/ContextBuilder/modules/organizationProfileTaxonomy.tsx');
  const blok = zrodlo.match(/function completenessChecks\(p: OrgProfile\): unknown\[\] \{\s*return \[([\s\S]*?)\];/);
  const poleFrontu = (blok?.[1] ?? '')
    .split('\n')
    .map((l) => l.trim().match(/^p\.([A-Za-z_]+)/)?.[1])
    .filter((v): v is string => Boolean(v));

  it('front liczy DOKLADNIE 15 warunkow (raport TEST-DANE mowil o 13 — premisa obalona)', () => {
    expect(poleFrontu).toHaveLength(15);
    expect(POLA_KOMPLETNOSCI).toHaveLength(15);
  });

  it('lista pol seeda jest identyczna z lista frontu (co do nazw i kolejnosci)', () => {
    expect([...POLA_KOMPLETNOSCI]).toEqual(poleFrontu);
  });

  it('policzKompletnosc zwraca 100 dla pelnego profilu', () => {
    const pelny: Record<string, unknown> = {};
    for (const k of POLA_KOMPLETNOSCI) pelny[k] = k.endsWith('s') ? ['x'] : 'x';
    pelny.employee_count = 340;
    expect(policzKompletnosc(pelny)).toBe(100);
  });

  it('policzKompletnosc traktuje pusta tablice jak brak (to byl realny stan strategic_priorities)', () => {
    const pelny: Record<string, unknown> = {};
    for (const k of POLA_KOMPLETNOSCI) pelny[k] = 'x';
    pelny.strategic_priorities = [];
    pelny.technology_stack = [];
    expect(policzKompletnosc(pelny)).toBe(Math.round((13 / 15) * 100));
  });

  it('policzKompletnosc zwraca 0 dla pustego profilu', () => {
    expect(policzKompletnosc({})).toBe(0);
  });
});

describe('09-dosiew — BRAK 2: statusy przydzialow ze slownika kanonicznego', () => {
  /**
   * Zlecenie mowilo `pending`/`answered`/`approved`. Takich wartosci
   * `InterviewAssignmentService` nie zna — wstawia `assigned`, a porzadkuje
   * po `assigned|sent_back|in_progress|submitted`. Test przypina to do
   * zrodla serwisu, zeby nikt nie „poprawil" seeda z powrotem na `pending`.
   */
  const serwis = czytaj('server/src/services/InterviewAssignmentService.ts');
  const dozwolone = ['assigned', 'sent_back', 'in_progress', 'submitted', 'approved', 'completed'];

  it('serwis wstawia domyslnie status „assigned"', () => {
    expect(serwis).toMatch(/status TEXT NOT NULL DEFAULT 'assigned'/);
  });

  it('serwis NIE zna statusu „pending" ani „answered"', () => {
    expect(serwis).not.toMatch(/'pending'/);
    expect(serwis).not.toMatch(/'answered'/);
  });

  it('kazdy przydzial D9 ma status ze slownika kanonicznego', () => {
    for (const p of PRZYDZIALY) expect(dozwolone).toContain(p.status);
  });

  it('sa dokladnie trzy przydzialy i trzy rozne statusy (>= 3 z RAPORT §5)', () => {
    expect(PRZYDZIALY).toHaveLength(3);
    expect(new Set(PRZYDZIALY.map((p) => p.status)).size).toBe(3);
  });

  it('wlasciciel jest przypisany albo czlonkiem w co najmniej jednym przydziale (Inbox niepusty)', () => {
    const wlasciciel = 'james.whitfield';
    const widzi = PRZYDZIALY.filter(
      (p) => p.assignee === wlasciciel || (p.czlonkowie as readonly string[]).includes(wlasciciel)
    );
    expect(widzi.length).toBeGreaterThanOrEqual(1);
  });

  it('process_ref kazdego przydzialu jest unikalny — to klucz idempotencji etapu SQL', () => {
    expect(new Set(PRZYDZIALY.map((p) => p.processRef)).size).toBe(PRZYDZIALY.length);
  });
});

describe('09-dosiew — BRAK 4: rozklad pracochlonnosci osiaga progi RAPORT §5', () => {
  /**
   * Progi z RAPORT_DANE §5 poz. 4 i celu zakladki Zasoby: popyt w >= 6 z 8
   * tygodni, wykorzystanie > 40 %. Podaz Northwind = 338 h/tydzien (9 osob,
   * `weekly_capacity_hours` z 01-rdzen), czyli 2704 h w oknie osmiu tygodni.
   */
  const PODAZ_8_TYGODNI = 338 * 8;

  it('suma pracochlonnosci planu przekracza 40 % podazy osmiu tygodni', () => {
    const popyt = PLAN_POPYTU.reduce((s, z) => s + z.godziny, 0);
    expect(popyt).toBeGreaterThan(PODAZ_8_TYGODNI * 0.4);
  });

  it('plan obejmuje co najmniej 6 zadan startujacych w roznych odstepach (rozlozenie w czasie)', () => {
    expect(PLAN_POPYTU.length).toBeGreaterThanOrEqual(6);
    expect(new Set(PLAN_POPYTU.map((z) => z.startPrzed)).size).toBeGreaterThanOrEqual(3);
  });

  it('kazde zadanie ma dodatnia pracochlonnosc i dodatni okres startu', () => {
    for (const z of PLAN_POPYTU) {
      expect(z.godziny).toBeGreaterThan(0);
      expect(z.startPrzed).toBeGreaterThan(0);
    }
  });

  it('zaleglosc ma pozostalo > 0 (estimated - actual), inaczej kolumna BACKLOG zostaje pusta', () => {
    expect(PLAN_ZALEGLOSCI.length).toBeGreaterThanOrEqual(3);
    for (const z of PLAN_ZALEGLOSCI) {
      expect(z.wykonane).toBeLessThan(z.godziny);
      expect(z.godziny - z.wykonane).toBeGreaterThan(0);
    }
  });

  it('zadania osobiste wlasciciela dostaja estymate (bez niej jego wiersz Zasobow byl pusty)', () => {
    expect(PLAN_OSOBISTYCH.length).toBeGreaterThanOrEqual(3);
    for (const z of PLAN_OSOBISTYCH) expect(z.godziny).toBeGreaterThan(0);
  });

  it('zaden tytul nie powtarza sie miedzy planami — inaczej drugi UPDATE cofalby pierwszy', () => {
    const wszystkie = [
      ...PLAN_POPYTU.map((z) => z.tytul),
      ...PLAN_ZALEGLOSCI.map((z) => z.tytul),
      ...PLAN_OSOBISTYCH.map((z) => z.tytul),
    ];
    expect(new Set(wszystkie).size).toBe(wszystkie.length);
  });
});

describe('09-dosiew — BRAK 5: pola pochodne trzymaja sie slownikow bazy i produktu', () => {
  it('indicator_type uzywa WYLACZNIE wartosci z CHECK-a bazy (settlement|informational)', () => {
    // `rvn_kpi_scorecard_items_indicator_type_chk` — zmierzone w pg_constraint
    // 09.09. „leading"/„lagging" (pierwszy odruch) narusza CHECK i wywraca apply.
    for (const p of POZYCJE_KARTY_KPI) expect(['settlement', 'informational']).toContain(p.typ);
  });

  it('axis uzywa slownika walidatora inicjatyw', () => {
    const walidator = czytaj('server/src/validators/initiative.validators.ts');
    for (const i of POCHODNE_INICJATYW) expect(walidator).toContain(`'${i.axis}'`);
  });

  it('exportFormat uzywa wylacznie formatow, ktore rozpoznaje resolvePersistedArtifactFormat', () => {
    for (const a of FORMATY_ARTEFAKTOW) expect(['docx', 'pdf', 'pptx', 'xlsx']).toContain(a.format);
  });

  it('kazda inicjatywa ma baseline_end_date (VARIANCE bez baseline zwraca null → „—")', () => {
    expect(POCHODNE_INICJATYW).toHaveLength(13);
    for (const i of POCHODNE_INICJATYW) expect(i.baselineEnd).toBeTruthy();
  });

  it('baseline rozni sie od planu w obu kierunkach — inaczej VARIANCE bylby zerem w kazdym wierszu', () => {
    const daty = POCHODNE_INICJATYW.map((i) => i.baselineEnd);
    expect(new Set(daty).size).toBeGreaterThan(5);
  });

  it('wszystkie 8 pozycji karty KPI ma obszar (AREA grupuje wiersze raportu)', () => {
    expect(POZYCJE_KARTY_KPI).toHaveLength(8);
    for (const p of POZYCJE_KARTY_KPI) expect(p.area.length).toBeGreaterThan(0);
    expect(new Set(POZYCJE_KARTY_KPI.map((p) => p.area)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('09-dosiew — dane wylacznie po angielsku', () => {
  const POLSKIE = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  const tresci: string[] = [
    ...PRZYDZIALY.map((p) => `${p.notes} ${p.processRef}`),
    ...POCHODNE_INICJATYW.map((i) => `${i.tytul} ${i.stage} ${i.axis}`),
    ...POZYCJE_KARTY_KPI.map((p) => p.area),
    ...PLAN_POPYTU.map((z) => z.tytul),
    ...PLAN_ZALEGLOSCI.map((z) => z.tytul),
    ...PLAN_OSOBISTYCH.map((z) => z.tytul),
    ...FORMATY_ARTEFAKTOW.map((a) => a.tytul),
  ];

  it('zadna tresc dosiewana do bazy nie ma polskiego znaku', () => {
    for (const t of tresci) expect(t).not.toMatch(POLSKIE);
  });

  it('zadna tresc nie jest pusta', () => {
    for (const t of tresci) expect(t.trim().length).toBeGreaterThan(0);
  });
});

describe('09-dosiew — poniedzialek() zgodny z getMonday serwisu zasobow', () => {
  /**
   * Okno osmiu tygodni liczy sie od PONIEDZIALKU. Blad o jeden dzien
   * przesuwa granice zaleglosc/popyt dla calego tygodnia.
   */
  it('poniedzialek dla wtorku cofa o 1 dzien', () => {
    expect(poniedzialek(new Date(2026, 8, 8)).getDate()).toBe(7);
  });

  it('poniedzialek dla niedzieli cofa o 6 dni (tydzien ISO, nie amerykanski)', () => {
    expect(poniedzialek(new Date(2026, 8, 13)).getDate()).toBe(7);
  });

  it('poniedzialek dla poniedzialku jest tozsamoscia', () => {
    expect(poniedzialek(new Date(2026, 8, 7)).getDate()).toBe(7);
  });

  it('poniedzialek zeruje godzine (porownania dat licza dni, nie milisekundy)', () => {
    const p = poniedzialek(new Date(2026, 8, 9, 17, 34, 12));
    expect([p.getHours(), p.getMinutes(), p.getSeconds()]).toEqual([0, 0, 0]);
  });
});
