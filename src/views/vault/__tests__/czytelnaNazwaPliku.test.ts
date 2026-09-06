/**
 * czytelnaNazwaPliku — [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 *
 * Zgłoszenie właściciela (POWTÓRZONE, przejście Mojej Pracy 06.09): podgląd
 * sejfu pokazywał surową nazwę z magazynu
 * `1786125362405-Tesco_2026_Annual_Report_and_Financial_Statements_EN`.
 *
 * DOWÓD MUTACYJNY (wymóg zlecenia): jeśli z implementacji zniknie usuwanie
 * prefiksu `^\d{10,}-`, pierwszy test poniżej pada — sprawdza wprost, że w
 * tytule NIE MA ciągu cyfr uploadu, a nie tylko że „coś się zwróciło".
 */
import { describe, expect, it } from 'vitest';

import { czytelnaNazwaPliku, ikonaTypuPliku } from '../vaultDocuments';

describe('czytelnaNazwaPliku', () => {
  it('usuwa prefiks znacznika czasu z uploadu (mutacja: brak usuwania → RED)', () => {
    const wynik = czytelnaNazwaPliku(
      '1786125362405-Tesco_2026_Annual_Report_and_Financial_Statements_EN.pdf'
    );
    expect(wynik.tytul).toBe('Tesco 2026 Annual Report and Financial Statements EN');
    expect(wynik.tytul).not.toContain('1786125362405');
    expect(wynik.tytul).not.toMatch(/^\d/);
    expect(wynik.rozszerzenie).toBe('PDF');
    expect(wynik.oryginal).toBe(
      '1786125362405-Tesco_2026_Annual_Report_and_Financial_Statements_EN.pdf'
    );
  });

  it('działa dla nazwy bez rozszerzenia (dokładnie ta z zrzutu właściciela)', () => {
    const wynik = czytelnaNazwaPliku(
      '1786125362405-Tesco_2026_Annual_Report_and_Financial_Statements_EN'
    );
    expect(wynik.tytul).toBe('Tesco 2026 Annual Report and Financial Statements EN');
    expect(wynik.rozszerzenie).toBe('');
  });

  it('nie rusza nazwy, która prefiksu nie ma', () => {
    const wynik = czytelnaNazwaPliku('Raport roczny 2026.docx');
    expect(wynik.tytul).toBe('Raport roczny 2026');
    expect(wynik.rozszerzenie).toBe('DOCX');
  });

  it('nie tnie tytułu na kropce, która nie jest rozszerzeniem', () => {
    const wynik = czytelnaNazwaPliku('Raport 2026.wersja robocza');
    expect(wynik.tytul).toBe('Raport 2026.wersja robocza');
    expect(wynik.rozszerzenie).toBe('');
  });

  it('nie zjada liczby, która nie jest prefiksem uploadu', () => {
    // 4 cyfry to rok, nie znacznik czasu — próg to 10 cyfr.
    const wynik = czytelnaNazwaPliku('2026-plan_operacyjny.pdf');
    expect(wynik.tytul).toBe('2026-plan operacyjny');
  });

  it('nie wywraca się na pustym/nullowym wejściu', () => {
    expect(czytelnaNazwaPliku('').tytul).toBe('');
    expect(czytelnaNazwaPliku(null).tytul).toBe('');
    expect(czytelnaNazwaPliku(undefined).rozszerzenie).toBe('');
  });

  it('zdejmuje ścieżkę, gdy backend poda pełną nazwę katalogową', () => {
    expect(czytelnaNazwaPliku('uploads/1786125362405-Raport_Q3.pdf').tytul).toBe('Raport Q3');
  });
});

describe('ikonaTypuPliku', () => {
  it('rozróżnia arkusz, obraz, prezentację i dokument', () => {
    const nazwy = ['XLSX', 'PNG', 'PPTX', 'PDF', 'ZIP'].map((e) => ikonaTypuPliku(e));
    // Cztery znane rodziny mają cztery RÓŻNE ikony; nieznany typ ma piątą.
    expect(new Set(nazwy).size).toBe(5);
  });

  it('jest odporna na małe litery i pustkę', () => {
    expect(ikonaTypuPliku('pdf')).toBe(ikonaTypuPliku('PDF'));
    expect(ikonaTypuPliku('')).toBe(ikonaTypuPliku('nieznane'));
  });
});
