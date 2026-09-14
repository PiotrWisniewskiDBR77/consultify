/**
 * P-T16 (pilotaż Tomka, DEC-496 pkt XVI) — „odpowiedź AI niespójna na bełkot:
 * raz odrzucona, raz zamieniona w zmyślony akapit".
 *
 * Reguła rozstrzygająca musi być DETERMINISTYCZNA (ten sam wynik za każdym
 * uruchomieniem) i konserwatywna: fałszywe oskarżenie sensownej odpowiedzi
 * o bełkot jest dla respondenta gorsze niż przepuszczenie bełkotu do modelu,
 * który i tak przyzna 0 punktów z rubryki.
 *
 * Wymagane przez zlecenie: 5 przykładów bełkotu + 3 normalne + regresja
 * (zachowanie dla poprawnych odpowiedzi bez zmian).
 */
import { describe, expect, it } from 'vitest';

import {
  komunikatNieczytelnejOdpowiedzi,
  ocenCzytelnoscOdpowiedzi,
  uzasadnienieNieczytelnejOdpowiedzi,
  zalecenieNieczytelnychOdpowiedzi,
} from '../interviewAnswerIntelligibility.js';

const BELKOT: Array<[string, string]> = [
  ['powtórzony kawałek klawiatury', 'asdasdasd'],
  ['przeciągnięty rząd klawiatury', 'qwertyuiop'],
  ['jedna litera w kółko', 'jjjjjjj'],
  ['ciąg bez ani jednej samogłoski', 'gdfkjghdfkjg'],
  ['sama interpunkcja i symbole', '#### $$$ ;;;'],
];

const NORMALNE: Array<[string, string]> = [
  ['zdanie po polsku z konkretem', 'Tak, wdrożyliśmy ERP w 2023 roku, moduł magazynowy.'],
  ['zdanie po angielsku', 'We use SAP for finance and a custom WMS for the warehouse.'],
  ['krótka, ale sensowna odpowiedź', '3 lata'],
];

describe('P-T16 ocenCzytelnoscOdpowiedzi — bełkot odrzucany deterministycznie', () => {
  it.each(BELKOT)('rozpoznaje bełkot: %s', (_nazwa, tekst) => {
    expect(ocenCzytelnoscOdpowiedzi(tekst).nieczytelna).toBe(true);
  });

  it.each(NORMALNE)('nie rusza poprawnej odpowiedzi: %s', (_nazwa, tekst) => {
    expect(ocenCzytelnoscOdpowiedzi(tekst).nieczytelna).toBe(false);
  });

  it('jest deterministyczna — 20 przebiegów daje ten sam wynik', () => {
    for (const [, tekst] of [...BELKOT, ...NORMALNE]) {
      const wyniki = new Set(
        Array.from({ length: 20 }, () => ocenCzytelnoscOdpowiedzi(tekst).nieczytelna)
      );
      expect(wyniki.size).toBe(1);
    }
  });

  it('pusta odpowiedź to osobny, nazwany powód (obsługiwany już przez #48a wyżej)', () => {
    expect(ocenCzytelnoscOdpowiedzi('   ')).toEqual({ nieczytelna: true, powod: 'pusta' });
    expect(ocenCzytelnoscOdpowiedzi(null).nieczytelna).toBe(true);
  });

  it('REGRESJA: jeden wiarygodny wyraz wystarczy, żeby odpowiedź poszła normalną ścieżką', () => {
    // Odpowiedź częściowo zaśmiecona NIE jest odrzucana — model oceni ją rubryką.
    expect(ocenCzytelnoscOdpowiedzi('asdasd ale mamy dwa magazyny').nieczytelna).toBe(false);
  });

  it('REGRESJA: skróty branżowe i liczby nie są bełkotem', () => {
    for (const tekst of ['SAP', 'WMS', 'CRM', 'ISO-9001', '2023', '50%', 'ERP i MES']) {
      expect(ocenCzytelnoscOdpowiedzi(tekst).nieczytelna).toBe(false);
    }
  });

  it('REGRESJA: polskie i niemieckie znaki nie są mylone z bełkotem', () => {
    for (const tekst of [
      'Wstrząs w łańcuchu dostaw',
      'Zmieniliśmy dostawcę w zeszłym kwartale',
      'Wir nutzen SAP für die Buchhaltung',
    ]) {
      expect(ocenCzytelnoscOdpowiedzi(tekst).nieczytelna).toBe(false);
    }
  });
});

describe('P-T16 stała odpowiedź — przetłumaczona, bez zmyślania', () => {
  it('mówi „Nie rozumiem odpowiedzi — doprecyzuj" po polsku', () => {
    expect(komunikatNieczytelnejOdpowiedzi('pl')).toContain('Nie rozumiem odpowiedzi — doprecyzuj');
  });

  it('ma odpowiednik angielski (EN+PL, DEC-461)', () => {
    const en = komunikatNieczytelnejOdpowiedzi('en');
    expect(en).toContain("can't interpret this answer");
    // Bramka językowa: w wariancie EN nie ma polskich ogonków.
    expect(/[ąćęłńóśźż]/i.test(en)).toBe(false);
  });

  it('uzasadnienie i zalecenie też mają oba języki i się różnią', () => {
    expect(uzasadnienieNieczytelnejOdpowiedzi('pl')).not.toBe(
      uzasadnienieNieczytelnejOdpowiedzi('en')
    );
    expect(zalecenieNieczytelnychOdpowiedzi('pl')).not.toBe(zalecenieNieczytelnychOdpowiedzi('en'));
    expect(/[ąćęłńóśźż]/i.test(uzasadnienieNieczytelnejOdpowiedzi('en'))).toBe(false);
    expect(/[ąćęłńóśźż]/i.test(zalecenieNieczytelnychOdpowiedzi('en'))).toBe(false);
  });
});
