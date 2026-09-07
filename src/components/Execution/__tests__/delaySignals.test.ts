/**
 * P16 / R5 (DEC-453, §4 D4) — CZYSTA LOGIKA SYGNAŁÓW OPÓŹNIEŃ.
 *
 * ZMIERZONE PRZED R5 (kopia bazy `consultify_p16r45`, API 4161,
 * `evidence/p16-r45/przed/delay-signals.json`):
 *   · `GET /api/execution-control/delay-signals` → **42 sygnały**
 *     (LATE_START 23 · OVERDUE 19; CRITICAL 30 · WARNING 12;
 *     INITIATIVE 23 · TASK 19), powody: NO_OWNER 7 · BLOCKED 6 ·
 *     RAID_HIGH_RISK 6, a 26 sygnałów bez ani jednego powodu,
 *   · zakładka czytała ZAMIAST tego `runtime-v1/management-signals` → 0.
 *
 * MUTACJE, na które ten plik reaguje (sprawdzone ręcznie, przywrócone):
 *   (j) `stanSygnalu` porównuje `sourceId` z identyfikatorem INICJATYWY
 *       zamiast sygnału → RED (wszystkie sygnały tej inicjatywy udawałyby
 *       obsłużone po jednej interwencji),
 *   (j-1) `stanSygnalu` ignoruje `sourceType` → RED (dowolna decyzja
 *       o zbieżnym identyfikatorze zamykałaby sygnał),
 *   (l) `terminInterwencji` przestaje dodawać trzy dni → RED.
 */
import { describe, expect, it } from 'vitest';

import {
  DNI_NA_DECYZJE_INTERWENCJI,
  powodySygnaluLabel,
  rodzajSygnaluLabel,
  stanSygnalu,
  terminInterwencji,
  tytulInterwencji,
  ZRODLO_SYGNALU,
} from '../delaySignals';

const t = (_klucz: string, zapasowy: string) => zapasowy;

describe('słowniki po polsku — cztery rodzaje i sześć powodów kontraktu', () => {
  it('rodzaj sygnału nie zostaje kodem technicznym', () => {
    expect(rodzajSygnaluLabel('LATE_START', t)).toBe('Późny start');
    expect(rodzajSygnaluLabel('OVERDUE', t)).toBe('Po terminie');
    expect(rodzajSygnaluLabel('LATE_FINISH_RISK', t)).toBe('Ryzyko poślizgu końca');
    expect(rodzajSygnaluLabel('DEADLINE_RISK', t)).toBe('Zagrożony termin');
  });

  it('powody po polsku, wiele powodów w jednej komórce', () => {
    expect(
      powodySygnaluLabel(
        [
          { reason: 'BLOCKED', detail: 'Blocked for 0 days' },
          { reason: 'NO_OWNER', detail: 'No owner assigned' },
        ],
        t
      )
    ).toBe('Blokada · Bez właściciela');
  });

  it('BRAK powodu jest nazwany, a nie pusty — 26 z 42 sygnałów go nie ma', () => {
    expect(powodySygnaluLabel([], t)).toBe('Nie ustalono');
    expect(powodySygnaluLabel(undefined, t)).toBe('Nie ustalono');
  });
});

describe('(j) STAN SYGNAŁU liczy się z rodowodu decyzji', () => {
  const decyzje = [
    // Decyzja re-baseline dla sygnału A — otwarta.
    { id: 'dec-a', status: 'PENDING', sourceType: ZRODLO_SYGNALU, sourceId: 'sygnal-a' },
    // Decyzja re-baseline dla sygnału B — już zapadła.
    { id: 'dec-b', status: 'APPROVED', sourceType: ZRODLO_SYGNALU, sourceId: 'sygnal-b' },
    // Zwykła decyzja o TYM SAMYM identyfikatorze źródła, ale innym rodowodzie.
    { id: 'dec-c', status: 'PENDING', sourceType: 'execution', sourceId: 'sygnal-c' },
  ];

  it('sygnał bez powiązanej decyzji jest NOWY', () => {
    expect(stanSygnalu('sygnal-x', decyzje)).toEqual({ stan: 'NOWY', decyzjaId: null });
  });

  it('sygnał z otwartą decyzją re-baseline jest w INTERWENCJI i wskazuje decyzję', () => {
    expect(stanSygnalu('sygnal-a', decyzje)).toEqual({
      stan: 'INTERWENCJA',
      decyzjaId: 'dec-a',
    });
  });

  it('sygnał z rozstrzygniętą decyzją jest ZAMKNIĘTY', () => {
    expect(stanSygnalu('sygnal-b', decyzje).stan).toBe('ZAMKNIETY');
  });

  it('(j-1) decyzja o INNYM rodowodzie nie zamyka sygnału', () => {
    // `dec-c` ma sourceId 'sygnal-c', ale sourceType 'execution' — to jest
    // zwykła decyzja wykonawcza, nie wniosek o przesunięcie.
    expect(stanSygnalu('sygnal-c', decyzje).stan).toBe('NOWY');
  });

  it('nie myli sygnałów tej samej inicjatywy — dopasowanie idzie po ID SYGNAŁU', () => {
    // Dwa sygnały tej samej inicjatywy: jeden obsłużony, drugi nie.
    expect(stanSygnalu('sygnal-a', decyzje).stan).toBe('INTERWENCJA');
    expect(stanSygnalu('late-start-init-siri-01', decyzje).stan).toBe('NOWY');
  });
});

describe('(l) WNIOSEK O PRZESUNIĘCIE ma termin i czytelny tytuł', () => {
  it('termin = dziś + 3 dni (metodyka A1 pkt 6: data bez decyzji jest niezmienna)', () => {
    const teraz = new Date('2026-09-07T10:00:00.000Z');
    const termin = new Date(terminInterwencji(teraz));
    const roznicaDni = Math.round((termin.getTime() - teraz.getTime()) / 86_400_000);
    expect(roznicaDni).toBe(DNI_NA_DECYZJE_INTERWENCJI);
    expect(DNI_NA_DECYZJE_INTERWENCJI).toBe(3);
  });

  it('tytuł mówi CO i O ILE, bez kodów technicznych', () => {
    expect(tytulInterwencji('Migracja ERP', 140)).toBe('Przesunięcie terminu: Migracja ERP (+140 dni)');
  });

  it('ujemne odchylenie nie produkuje „(-3 dni)"', () => {
    expect(tytulInterwencji('Migracja ERP', -3)).toContain('(+0 dni)');
  });
});
