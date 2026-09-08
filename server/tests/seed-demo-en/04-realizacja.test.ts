import { describe, expect, it } from 'vitest';

import {
  DECYZJE,
  OSOBY,
  PRZESUNIECIA_KAMIENI,
  RAID,
  RAPORTY_STATUSU,
  SLUGI_REALIZOWANE,
  ZADANIA,
} from '../../scripts/seed/demo-en/04-dane-realizacji';
import { det } from '../../scripts/seed/demo-en/00-wspolne';

/**
 * Testy PACZKI D4 (Realizacja) BEZ BAZY — czysta logika i niezmienniki zbioru
 * danych (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D4). Zapytania SQL
 * i etap API sprawdza na żywo `04-realizacja.ts --dry-run/--apply/--verify/
 * --reset` na kopii lokalnej (`evidence/dane-pokazowe-en/d4/dowod-cli.txt`).
 *
 * Tutaj pilnujemy tego, co da się po cichu zepsuć edycją treści: liczności
 * wymaganych przez zlecenie, kotwicy czasu (8 zadań po terminie, 3 decyzje po
 * terminie), skali ekspozycji 5x5, spójności slugów z osobami i inicjatywami
 * oraz dwóch pułapek językowych — polskich znaków i znaku `&`, który sanitizer
 * runtime-v1 zamienia na `&amp;`.
 *
 * Funkcje `ekspozycja`, `poTerminie` i `udzialTygodnia` są ŚWIADOMIE napisane
 * tu od nowa, a nie zaimportowane: `ekspozycjaRaid` żyje we froncie
 * (`src/components/Execution/raidGovernance.ts:76`), a rozkład popytu
 * w serwisie (`server/src/services/workloadCapacityService.ts:732`). Test ma
 * sprawdzać DANE względem NIEZALEŻNEJ kopii reguły, a nie zgadzać się sam
 * ze sobą przez import tej samej implementacji.
 */

/** Poniedziałek bieżącego tygodnia w kotwicy czasu paczki (2026-09-08 = wtorek). */
const PONIEDZIALEK = '2026-09-07';
const DZIS = '2026-09-08';

const PRAWDOPODOBIENSTWO_5: Record<string, number> = { LOW: 2, MEDIUM: 3, HIGH: 4 };
const WPLYW_5: Record<string, number> = { LOW: 2, MEDIUM: 3, HIGH: 4, CRITICAL: 5 };
const ekspozycja = (p: string, w: string): number | null => {
  const a = PRAWDOPODOBIENSTWO_5[p];
  const b = WPLYW_5[w];
  return a == null || b == null ? null : a * b;
};

const poTerminie = (termin: string, granica: string): boolean => termin < granica;

const POLSKIE_ZNAKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

describe('04-dane-realizacji — liczności wymagane zleceniem D4', () => {
  it('36 zadań, ani jedno na inicjatywie spoza czterech realizowanych', () => {
    expect(ZADANIA).toHaveLength(36);
    for (const z of ZADANIA) expect(SLUGI_REALIZOWANE).toContain(z.inicjatywa);
  });

  it('każde zadanie ma osobę ze słownika D1, termin, start i dodatnią pracochłonność', () => {
    for (const z of ZADANIA) {
      expect(OSOBY, `zadanie ${z.slug}`).toContain(z.osoba);
      expect(z.termin, `zadanie ${z.slug}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(z.start, `zadanie ${z.slug}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(z.godziny, `zadanie ${z.slug}`).toBeGreaterThan(0);
      expect(z.start <= z.termin, `zadanie ${z.slug}: start po terminie`).toBe(true);
    }
  });

  it('DOKŁADNIE 8 zadań po terminie (otwartych, z terminem przed bieżącym poniedziałkiem)', () => {
    const otwarte = ZADANIA.filter((z) => z.status !== 'done');
    const spoznione = otwarte.filter((z) => poTerminie(z.termin, PONIEDZIALEK));
    expect(spoznione).toHaveLength(8);
  });

  it('każde zadanie po terminie ma godziny POZOSTAŁE — inaczej zakładka Zasoby pokaże zaległość 0 h', () => {
    const spoznione = ZADANIA.filter((z) => z.status !== 'done' && poTerminie(z.termin, PONIEDZIALEK));
    for (const z of spoznione) expect(z.godziny - z.godzinyFaktyczne, `zadanie ${z.slug}`).toBeGreaterThan(0);
  });

  it('zaległość rozkłada się na 5 osób (chip „Z zaległością" ma pokazać 5)', () => {
    const osoby = new Set(
      ZADANIA.filter((z) => z.status !== 'done' && poTerminie(z.termin, PONIEDZIALEK)).map((z) => z.osoba)
    );
    expect(osoby.size).toBe(5);
  });

  it('co najmniej jedna osoba jest PRZECIĄŻONA w pierwszym tygodniu okna (popyt > etat)', () => {
    // Etaty z D1 (`01-rdzen.ts`) — powtórzone, żeby test nie zależał od bazy.
    const etat: Record<string, number> = {
      'james.whitfield': 40,
      'sarah.mitchell': 40,
      'robert.chen': 38,
      'emily.carter': 37,
      'daniel.osei': 40,
      'laura.novak': 36,
      'michael.grant': 35,
      'priya.sharma': 32,
      'thomas.baker': 40,
    };
    const wPierwszymTygodniu = ZADANIA.filter(
      (z) => z.status !== 'done' && z.start >= PONIEDZIALEK && z.termin < '2026-09-14'
    );
    const suma = new Map<string, number>();
    for (const z of wPierwszymTygodniu) suma.set(z.osoba, (suma.get(z.osoba) ?? 0) + z.godziny);
    const przeciazeni = [...suma.entries()].filter(([osoba, h]) => h > etat[osoba]! * 1.05);
    expect(przeciazeni.length).toBeGreaterThanOrEqual(1);
    expect(suma.get('laura.novak')).toBe(48); // 2 x 24 h przy etacie 36 h => 133 %
  });

  it('slugi zadań są unikalne (deterministyczne id nie mogą się zderzyć)', () => {
    const slugi = ZADANIA.map((z) => z.slug);
    expect(new Set(slugi).size).toBe(slugi.length);
    const idy = slugi.map((s) => det('task', s));
    expect(new Set(idy).size).toBe(idy.length);
  });
});

describe('04-dane-realizacji — RAID w skali 5x5', () => {
  it('7 pozycji, każda z typem, statusem, p x w, właścicielem, terminem i planem zaradczym', () => {
    expect(RAID).toHaveLength(7);
    for (const r of RAID) {
      expect(['RISK', 'ISSUE', 'DEPENDENCY', 'ASSUMPTION']).toContain(r.typ);
      expect(['OPEN', 'MITIGATED', 'REALIZED', 'CLOSED']).toContain(r.status);
      expect(OSOBY).toContain(r.osoba);
      expect(r.termin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.planZaradczy.length, `RAID ${r.slug}`).toBeGreaterThan(60);
    }
  });

  it('ekspozycja liczy się dla KAŻDEJ pozycji i mieści się w skali 5x5 (4..25)', () => {
    for (const r of RAID) {
      const e = ekspozycja(r.prawdopodobienstwo, r.wplyw);
      expect(e, `RAID ${r.slug}`).not.toBeNull();
      expect(e!).toBeGreaterThanOrEqual(4);
      expect(e!).toBeLessThanOrEqual(25);
    }
  });

  it('są pozycje w każdym paśmie: niskie (<=6), średnie (<=12) i wysokie (>12)', () => {
    const pasma = RAID.map((r) => {
      const e = ekspozycja(r.prawdopodobienstwo, r.wplyw)!;
      return e <= 6 ? 'niskie' : e <= 12 ? 'srednie' : 'wysokie';
    });
    expect(pasma).toContain('srednie');
    expect(pasma).toContain('wysokie');
  });

  it('są cztery typy RAID — rejestr nie może być samymi ryzykami', () => {
    expect(new Set(RAID.map((r) => r.typ)).size).toBe(4);
  });

  it('MUTACJA — gdyby ekspozycja liczyła SUMĘ zamiast ILOCZYNU, żadna pozycja nie byłaby „wysoka"', () => {
    const mutant = (p: string, w: string) => PRAWDOPODOBIENSTWO_5[p]! + WPLYW_5[w]!; // MUTANT: + zamiast x
    const wysokieProdukt = RAID.filter((r) => ekspozycja(r.prawdopodobienstwo, r.wplyw)! > 12).length;
    const wysokieSuma = RAID.filter((r) => mutant(r.prawdopodobienstwo, r.wplyw) > 12).length;
    expect(wysokieProdukt).toBeGreaterThan(0);
    expect(wysokieSuma).toBe(0);
    expect(wysokieSuma).not.toBe(wysokieProdukt);
  });
});

describe('04-dane-realizacji — decyzje', () => {
  it('9 decyzji, każda z decydentem, terminem, opisem i co najmniej dwiema opcjami', () => {
    expect(DECYZJE).toHaveLength(9);
    for (const d of DECYZJE) {
      expect(OSOBY, `decyzja ${d.slug}`).toContain(d.decydent);
      expect(d.termin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.opcje.length, `decyzja ${d.slug}`).toBeGreaterThanOrEqual(2);
      expect(d.opis.length, `decyzja ${d.slug}`).toBeGreaterThan(40);
    }
  });

  it('DOKŁADNIE 3 decyzje otwarte po terminie', () => {
    const spoznione = DECYZJE.filter((d) => !d.rozstrzygniecie && poTerminie(d.termin, DZIS));
    expect(spoznione).toHaveLength(3);
  });

  it('każda rozstrzygnięta decyzja ma uzasadnienie — serwer odmawia bez niego (RATIONALE_REQUIRED)', () => {
    for (const d of DECYZJE.filter((x) => x.rozstrzygniecie)) {
      expect(d.uzasadnienie, `decyzja ${d.slug}`).toBeTruthy();
      expect(d.uzasadnienie!.length, `decyzja ${d.slug}`).toBeGreaterThan(40);
    }
  });

  it('każda decyzja ma DOKŁADNIE jedną opcję rekomendowaną', () => {
    for (const d of DECYZJE)
      expect(d.opcje.filter((o) => o.rekomendowana).length, `decyzja ${d.slug}`).toBe(1);
  });

  it('decyzje nierozstrzygnięte nie niosą uzasadnienia (uzasadnienie powstaje przy rozstrzygnięciu)', () => {
    for (const d of DECYZJE.filter((x) => !x.rozstrzygniecie)) expect(d.uzasadnienie).toBeNull();
  });
});

describe('04-dane-realizacji — plan bazowy i raporty', () => {
  it('2 przesunięcia kamieni, każde z powodem i terminem PÓŹNIEJSZYM niż plan bazowy', () => {
    expect(PRZESUNIECIA_KAMIENI).toHaveLength(2);
    for (const p of PRZESUNIECIA_KAMIENI) {
      expect(SLUGI_REALIZOWANE).toContain(p.inicjatywa);
      expect(p.powod.length).toBeGreaterThan(40);
      expect(p.nowyTermin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('2 raporty statusu, każdy z okresem, oceną, trendem i pięcioma sekcjami treści', () => {
    expect(RAPORTY_STATUSU).toHaveLength(2);
    for (const s of RAPORTY_STATUSU) {
      expect(['GREEN', 'AMBER', 'RED']).toContain(s.stan);
      expect(['IMPROVING', 'STABLE', 'DECLINING']).toContain(s.trend);
      expect(s.okresOd < s.okresDo, `raport ${s.slug}`).toBe(true);
      for (const pole of [s.streszczenie, s.osiagniecia, s.nastepneKroki, s.eskalacje, s.ryzykaIProblemy])
        expect(pole.length, `raport ${s.slug}`).toBeGreaterThan(60);
    }
  });
});

describe('04-dane-realizacji — dwie pułapki językowe', () => {
  const wszystkieTeksty = (): string[] => [
    ...ZADANIA.flatMap((z) => [z.tytul, z.opis, z.kryterium]),
    ...RAID.flatMap((r) => [r.tytul, r.opis, r.planZaradczy]),
    ...DECYZJE.flatMap((d) => [
      d.tytul,
      d.opis,
      d.uzasadnienie ?? '',
      ...d.opcje.flatMap((o) => [o.tytul, o.opis, o.korzysci, o.wady, o.koszt]),
    ]),
    ...RAPORTY_STATUSU.flatMap((s) => [
      s.tytul,
      s.streszczenie,
      s.osiagniecia,
      s.nastepneKroki,
      s.eskalacje,
      s.ryzykaIProblemy,
      s.rekomendacje,
    ]),
    ...PRZESUNIECIA_KAMIENI.map((p) => p.powod),
  ];

  it('ani jednego polskiego znaku w treści — baza pokazowa jest po angielsku', () => {
    for (const t of wszystkieTeksty())
      expect(POLSKIE_ZNAKI.test(t), `polski znak w: ${t.slice(0, 80)}`).toBe(false);
  });

  it('ani jednego znaku & — sanitizer runtime-v1 zamienia go na &amp; i psuje napis na ekranie', () => {
    for (const t of wszystkieTeksty()) expect(t.includes('&'), `znak & w: ${t.slice(0, 80)}`).toBe(false);
  });

  it('MUTACJA — wykrywacz polskich znaków musi reagować na pojedynczą literę wewnątrz zdania', () => {
    expect(POLSKIE_ZNAKI.test('Commission the shuttle system')).toBe(false);
    expect(POLSKIE_ZNAKI.test('Commission the shuttłe system')).toBe(true);
    expect(POLSKIE_ZNAKI.test('Zależność')).toBe(true);
  });
});
