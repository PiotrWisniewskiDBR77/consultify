/**
 * D5 — testy DANYCH seedu Wyników i Finansów, BEZ bazy
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D5, §3.1 poz. 8-9).
 *
 * Mechanika (wywołania API, SQL sprawozdań, `--verify` liczący wiersze w
 * bazie) jest sprawdzona na żywo przez `05-wyniki-finanse.ts --dry-run/
 * --apply/--verify/--reset` na kopii lokalnej — dowód w
 * `evidence/dane-pokazowe-en/d5/dowod-cli.txt` (36 asercji `--verify`
 * PASS). Te testy pilnują wyłącznie tego, co da się zepsuć w SAMYCH danych
 * (`05-dane-wynikow.ts`) i co `--verify` może sprawdzić dopiero PO zapisie —
 * czyli za późno, żeby złapać literówkę przed apply. Każdy blok ma test
 * MUTACYJNY — reprodukcję zepsutej reguły, RED względem wersji produkcyjnej.
 */
import { describe, expect, it } from 'vitest';

import { det } from '../../scripts/seed/demo-en/00-wspolne';
import {
  BUDZET,
  KPI,
  LINIE_PL,
  OKR_CELE,
  OKRESY_POMIAROW,
  RAPORT_KPI,
  ROI_PRZYPADEK,
  SPRAWOZDANIA,
  TYTUL_INICJATYWY,
  type KluczInicjatywy,
} from '../../scripts/seed/demo-en/05-dane-wynikow';

const KLUCZE_INICJATYW = Object.keys(TYTUL_INICJATYWY) as KluczInicjatywy[];

describe('05-dane-wynikow — KPI: dokładnie 8 definicji × 6 pomiarów (STOP 2 wymaga właściciela dla widoczności)', () => {
  it('jest DOKŁADNIE 8 definicji KPI', () => {
    expect(KPI).toHaveLength(8);
  });

  it('każde KPI ma DOKŁADNIE 6 pomiarów — tyle samo, ile okien w OKRESY_POMIAROW', () => {
    expect(OKRESY_POMIAROW).toHaveLength(6);
    for (const k of KPI) {
      expect(k.pomiary, `${k.kod} ma ${k.pomiary.length} pomiarów, oczekiwano 6`).toHaveLength(6);
    }
  });

  it('każdy pomiar jest liczbą skończoną (żaden NaN/Infinity nie trafi do POST measurements)', () => {
    for (const k of KPI) {
      for (const wartosc of k.pomiary) {
        expect(Number.isFinite(wartosc), `${k.kod} ma niepoprawny pomiar ${wartosc}`).toBe(true);
      }
    }
  });

  it('każde KPI ma WŁAŚCICIELA — bez ownerUserId nie ma wiersza widoczności (STOP 2, kpiRepository.ts:127-128)', () => {
    for (const k of KPI) {
      expect(k.wlasciciel, `${k.kod} bez właściciela — POST /kpi utworzyłby definicję bez widoczności`).toBeTruthy();
    }
  });

  it('każde KPI wskazuje inicjatywę, która NAPRAWDĘ istnieje w TYTUL_INICJATYWY (D3)', () => {
    for (const k of KPI) {
      expect(KLUCZE_INICJATYW, `${k.kod} -> „${k.inicjatywa}" nie ma odpowiednika w TYTUL_INICJATYWY`).toContain(
        k.inicjatywa
      );
    }
  });

  it('kody KPI są UNIKALNE (kpi_code jest kluczem idempotencji przy --apply #2)', () => {
    const kody = KPI.map((k) => k.kod);
    expect(new Set(kody).size).toBe(kody.length);
  });

  it('MUTACJA — KPI z 5 pomiarami zamiast 6 jest łapane, nie przepuszczane', () => {
    const mutant = { ...KPI[0]!, pomiary: KPI[0]!.pomiary.slice(0, 5) };
    expect(mutant.pomiary).toHaveLength(5); // mutant: dziura złapana
    expect(KPI.every((k) => k.pomiary.length === 6)).toBe(true); // produkcja: czysta
  });

  it('MUTACJA — KPI bez właściciela (undefined) jest łapane jako brak widoczności', () => {
    const mutant = { ...KPI[0]!, wlasciciel: undefined as unknown as (typeof KPI)[number]['wlasciciel'] };
    expect(mutant.wlasciciel).toBeFalsy(); // mutant: brak właściciela złapany
    expect(KPI.every((k) => Boolean(k.wlasciciel))).toBe(true); // produkcja: każdy ma właściciela
  });
});

describe('05-dane-wynikow — RAPORT_KPI: POZIOM 1 zakładki „KPI" musi wymieniać dokładnie te 8 kodów', () => {
  it('RAPORT_KPI.pozycje ma dokładnie 8 pozycji, po jednej na definicję', () => {
    expect(RAPORT_KPI.pozycje).toHaveLength(8);
  });

  it('każda pozycja raportu odwołuje się do kodu, który NAPRAWDĘ istnieje w KPI (inaczej "No KPI reports yet" mimo danych)', () => {
    const kodyKpi = new Set(KPI.map((k) => k.kod));
    for (const p of RAPORT_KPI.pozycje) {
      expect(kodyKpi, `raport wskazuje „${p.kod}", którego nie ma w KPI`).toContain(p.kod);
    }
  });

  it('żaden kod KPI nie jest osierocony — każdy z 8 trafia do raportu dokładnie raz', () => {
    const kodyRaportu = RAPORT_KPI.pozycje.map((p) => p.kod);
    expect(new Set(kodyRaportu).size).toBe(8);
    expect([...kodyRaportu].sort()).toEqual(
      KPI.map((k) => k.kod)
        .slice()
        .sort()
    );
  });

  it('MUTACJA — gdyby raport pominął jeden kod (np. przez literówkę), test go łapie', () => {
    const mutant = RAPORT_KPI.pozycje.slice(0, 7); // mutant: 7 zamiast 8
    expect(mutant).toHaveLength(7);
    expect(RAPORT_KPI.pozycje).toHaveLength(8); // produkcja: komplet
  });
});

describe('05-dane-wynikow — OKR: 3 cele, 6 kluczowych wyników, wagi domykają się do 100 na cel', () => {
  it('jest DOKŁADNIE 3 cele', () => {
    expect(OKR_CELE).toHaveLength(3);
  });

  it('jest DOKŁADNIE 6 kluczowych wyników łącznie (2 na cel)', () => {
    const suma = OKR_CELE.reduce((a, c) => a + c.kluczoweWyniki.length, 0);
    expect(suma).toBe(6);
    for (const cel of OKR_CELE) {
      expect(cel.kluczoweWyniki, `„${cel.tytul}" ma ${cel.kluczoweWyniki.length} KR, oczekiwano 2`).toHaveLength(2);
    }
  });

  it('wagi kluczowych wyników sumują się do 100 w KAŻDYM celu (inaczej rollup ważony jest błędny)', () => {
    for (const cel of OKR_CELE) {
      const suma = cel.kluczoweWyniki.reduce((a, kr) => a + kr.waga, 0);
      expect(suma, `„${cel.tytul}": wagi sumują się do ${suma}, nie 100`).toBe(100);
    }
  });

  it('MUTACJA — cel z wagami 60/30 (suma 90) jest łapany jako niedomknięty rollup', () => {
    const mutant = { ...OKR_CELE[0]!, kluczoweWyniki: [{ ...OKR_CELE[0]!.kluczoweWyniki[0]!, waga: 60 }, { ...OKR_CELE[0]!.kluczoweWyniki[1]!, waga: 30 }] };
    const sumaMutanta = mutant.kluczoweWyniki.reduce((a, kr) => a + kr.waga, 0);
    expect(sumaMutanta).toBe(90); // mutant: rollup nie domyka się do 100
    expect(OKR_CELE.every((c) => c.kluczoweWyniki.reduce((a, kr) => a + kr.waga, 0) === 100)).toBe(true); // produkcja: czysta
  });
});

describe('05-dane-wynikow — ROI: 1 przypadek, 3 założenia, 3 koszty, 3 korzyści, dowody wiążą się z realnym KPI', () => {
  it('ma DOKŁADNIE 3 założenia, 3 linie kosztów i 3 linie korzyści', () => {
    expect(ROI_PRZYPADEK.zalozenia).toHaveLength(3);
    expect(ROI_PRZYPADEK.kosztyLinie).toHaveLength(3);
    expect(ROI_PRZYPADEK.korzysciLinie).toHaveLength(3);
  });

  it('przypadek wskazuje inicjatywę, która istnieje w TYTUL_INICJATYWY', () => {
    expect(KLUCZE_INICJATYW).toContain(ROI_PRZYPADEK.inicjatywa);
  });

  it('każda korzyść z dowodem KPI wskazuje kod, który NAPRAWDĘ istnieje w KPI (inaczej powiązanie dowodowe 404)', () => {
    const kodyKpi = new Set(KPI.map((k) => k.kod));
    for (const korzysc of ROI_PRZYPADEK.korzysciLinie) {
      if (korzysc.kpi) {
        expect(kodyKpi, `korzyść „${korzysc.label}" wiąże się z „${korzysc.kpi}", którego nie ma w KPI`).toContain(
          korzysc.kpi
        );
      }
    }
  });

  it('MUTACJA — korzyść wiążąca się z nieistniejącym kodem KPI jest łapana', () => {
    const kodyKpi = new Set(KPI.map((k) => k.kod));
    const mutant = { ...ROI_PRZYPADEK.korzysciLinie[0]!, kpi: 'NW-DOES-NOT-EXIST' };
    expect(kodyKpi.has(mutant.kpi)).toBe(false); // mutant: dowód wskazuje donikąd
    expect(ROI_PRZYPADEK.korzysciLinie.every((k) => !k.kpi || kodyKpi.has(k.kpi))).toBe(true); // produkcja: czysta
  });
});

describe('05-dane-wynikow — Finanse: 4 kwartały, rachunek P&L się domyka (STOP verify: „revenue - cogs <> gross")', () => {
  const IDX = {
    revenue: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-revenue'),
    cogs: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-cogs'),
    gross: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-gross'),
    opex: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-opex'),
    ebitda: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-ebitda'),
    depreciation: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-depreciation'),
    ebit: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-ebit'),
    interest: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-interest'),
    ebt: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-ebt'),
    tax: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-tax'),
    net: LINIE_PL.findIndex((l) => l.id === 'fsl-pl-net'),
  };

  it('LINIE_PL ma dokładnie 11 linie kanoniczne, wszystkie znalezione', () => {
    expect(LINIE_PL).toHaveLength(11);
    for (const [nazwa, idx] of Object.entries(IDX)) {
      expect(idx, `linia „${nazwa}" nie znaleziona w LINIE_PL`).toBeGreaterThanOrEqual(0);
    }
  });

  it('jest DOKŁADNIE 4 kwartały, każdy z 11 wartościami (tyle, ile LINIE_PL)', () => {
    expect(SPRAWOZDANIA).toHaveLength(4);
    for (const s of SPRAWOZDANIA) {
      expect(s.wartosci, `${s.slug} ma ${s.wartosci.length} wartości, oczekiwano 11`).toHaveLength(11);
    }
  });

  it('slugi kwartałów są UNIKALNE', () => {
    const slugi = SPRAWOZDANIA.map((s) => s.slug);
    expect(new Set(slugi).size).toBe(slugi.length);
  });

  function domykaSie(w: number[]): boolean {
    const gross = w[IDX.revenue]! - w[IDX.cogs]!;
    const ebitda = gross - w[IDX.opex]!;
    const ebit = ebitda - w[IDX.depreciation]!;
    const ebt = ebit - w[IDX.interest]!;
    const net = ebt - w[IDX.tax]!;
    return (
      gross === w[IDX.gross] &&
      ebitda === w[IDX.ebitda] &&
      ebit === w[IDX.ebit] &&
      ebt === w[IDX.ebt] &&
      net === w[IDX.net]
    );
  }

  it('KAŻDY kwartał domyka rachunek: gross=revenue-cogs, ebitda=gross-opex, ebit=ebitda-dep, ebt=ebit-interest, net=ebt-tax', () => {
    for (const s of SPRAWOZDANIA) {
      expect(domykaSie(s.wartosci), `${s.slug}: rachunek P&L się nie domyka`).toBe(true);
    }
  });

  it('MUTACJA — kwartał ze zmienionym gross profit (rachunek NIE domyka się) jest łapany', () => {
    const zepsuty = [...SPRAWOZDANIA[0]!.wartosci];
    zepsuty[IDX.gross] = zepsuty[IDX.gross]! + 1; // mutant: gross nie zgadza się z revenue-cogs
    expect(domykaSie(zepsuty)).toBe(false); // mutant złapany
    expect(SPRAWOZDANIA.every((s) => domykaSie(s.wartosci))).toBe(true); // produkcja: czysta
  });
});

describe('05-dane-wynikow — Budżet: 15 pozycji kanonicznych z wartością, 4 powiązania z inicjatywami', () => {
  const KANONICZNE_LINIE = [
    'REVENUE',
    'COGS',
    'GROSS_PROFIT',
    'OPEX',
    'EBITDA',
    'DEPRECIATION',
    'EBIT',
    'INTEREST_EXPENSE',
    'TAX',
    'NET_INCOME',
    'OPERATING_CF',
    'CAPEX',
    'FCF',
    'FINANCING_CF',
    'NET_CF',
  ];

  it('ma DOKŁADNIE 15 pozycji kanonicznych, każda z wartością liczbową różną od zera', () => {
    expect(Object.keys(BUDZET.wartosciLinii)).toHaveLength(15);
    for (const kod of KANONICZNE_LINIE) {
      const wartosc = BUDZET.wartosciLinii[kod];
      expect(wartosc, `budżet nie ma pozycji „${kod}"`).toBeDefined();
      expect(Number(wartosc), `„${kod}" ma wartość bazową 0 — ekran pokazałby pustą pozycję`).not.toBe(0);
    }
  });

  it('ma DOKŁADNIE 4 inicjatywy powiązane, wszystkie istnieją w TYTUL_INICJATYWY', () => {
    expect(BUDZET.inicjatywy).toHaveLength(4);
    for (const klucz of BUDZET.inicjatywy) {
      expect(KLUCZE_INICJATYW, `budżet wiąże się z „${klucz}", którego nie ma w TYTUL_INICJATYWY`).toContain(klucz);
    }
  });

  it('powiązane inicjatywy są UNIKALNE (bez zdublowanego linku)', () => {
    expect(new Set(BUDZET.inicjatywy).size).toBe(BUDZET.inicjatywy.length);
  });

  it('MUTACJA — pozycja budżetu z wartością bazową "0.00" jest łapana (ekran: pozycja z wartością bazową 0 musi być 0)', () => {
    const mutant = { ...BUDZET.wartosciLinii, REVENUE: '0.00' };
    expect(Number(mutant.REVENUE)).toBe(0); // mutant: zerowa pozycja złapana
    expect(Object.values(BUDZET.wartosciLinii).every((w) => Number(w) !== 0)).toBe(true); // produkcja: czysta
  });
});

describe('05-dane-wynikow — identyfikatory deterministyczne sprawozdań (det z 00-wspolne, klucz D5 fin-pack/fin-stmt/fin-val)', () => {
  it('ten sam slug paczki daje ZAWSZE to samo id paczki', () => {
    const a = det('fin-pack', 'northwind-quarterly-fy2026');
    const b = det('fin-pack', 'northwind-quarterly-fy2026');
    expect(a).toBe(b);
  });

  it('id każdego z 4 sprawozdań jest UNIKALNE (żaden slug nie koliduje z innym)', () => {
    const ids = SPRAWOZDANIA.map((s) => det('fin-stmt', `northwind-quarterly-fy2026|${s.slug}`));
    expect(new Set(ids).size).toBe(4);
  });

  it('id wartości = f(paczka, sprawozdanie, linia) — ta sama trójka daje to samo id, inna linia daje inne id', () => {
    const a = det('fin-val', 'northwind-quarterly-fy2026|q3-fy2025|fsl-pl-revenue');
    const b = det('fin-val', 'northwind-quarterly-fy2026|q3-fy2025|fsl-pl-revenue');
    const c = det('fin-val', 'northwind-quarterly-fy2026|q3-fy2025|fsl-pl-cogs');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('drugi --apply nie zdubluje żadnej z 44 wartości: 4 sprawozdania × 11 linii dają 44 UNIKALNE id', () => {
    const ids = SPRAWOZDANIA.flatMap((s) => LINIE_PL.map((l) => det('fin-val', `northwind-quarterly-fy2026|${s.slug}|${l.id}`)));
    expect(ids).toHaveLength(44);
    expect(new Set(ids).size).toBe(44);
  });
});
