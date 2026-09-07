/**
 * P16 / R4 (DEC-453) — CZYSTA LOGIKA RAID w zakładce „Decyzje i ryzyka".
 *
 * ZMIERZONE PRZED R4 (kopia bazy `consultify_p16r45`, API 4161,
 * `evidence/p16-r45/przed/raid.json`):
 *   · 16 pozycji RAID, **0 z terminem** — kolumna „Termin" pokazywała „—"
 *     w każdym wierszu, a preset „Po terminie" nie mógł niczego złapać,
 *   · kolumny `probability` i `impact` SĄ w bazie i mają wartości, więc
 *     migracja nie była potrzebna (28 kolumn `raid_items`, sprawdzone
 *     w `information_schema`),
 *   · `raid_items.risk_score` **nie jest iloczynem**: 13 z 16 wierszy zgadza
 *     się ze skalą 5×5, a 3 nie (LOW/HIGH → 10 zamiast 8, MEDIUM/CRITICAL →
 *     18 zamiast 15, LOW/CRITICAL → 15 zamiast 10). Dlatego ekran LICZY
 *     ekspozycję z dwóch pól i nigdy nie czyta jej z `riskScore`.
 *
 * MUTACJE, na które ten plik reaguje (sprawdzone ręcznie, przywrócone):
 *   (i) `ekspozycjaRaid` zwraca sumę zamiast iloczynu → RED,
 *   (i-1) `ekspozycjaRaid` podstawia 1 za brakujący składnik → RED,
 *   (i-2) `raidDniPoTerminie` liczy też pozycje ZAMKNIĘTE → RED,
 *   (m) `opisEskalacjiRyzyka` gubi identyfikator pozycji źródłowej → RED.
 */
import { describe, expect, it } from 'vitest';

import {
  czyRaidOtwarty,
  czyRaidPoTerminie,
  ekspozycjaRaid,
  opisEskalacjiRyzyka,
  opisPoPrzeksztalceniu,
  pasmoEkspozycji,
  RAID_PRAWDOPODOBIENSTWO,
  RAID_STATUS_KONCOWY,
  RAID_WPLYW,
  raidDniPoTerminie,
  ZNACZNIK_PRZEKSZTALCENIA,
  zrodloEskalacji,
} from '../raidGovernance';

const DZIEN = 86_400_000;

describe('(i) EKSPOZYCJA = prawdopodobieństwo × wpływ', () => {
  it('mnoży, nie dodaje — HIGH × CRITICAL = 4 × 5 = 20', () => {
    expect(ekspozycjaRaid('HIGH', 'CRITICAL')).toBe(20);
    // Suma dałaby 9; test przechodzi TYLKO dla iloczynu.
    expect(ekspozycjaRaid('HIGH', 'CRITICAL')).not.toBe(
      RAID_PRAWDOPODOBIENSTWO.HIGH + RAID_WPLYW.CRITICAL
    );
  });

  it('daje tę samą liczbę, co seed bazy tam, gdzie seed był policzony poprawnie', () => {
    // Trzy pary zmierzone w `GET /api/raid` (riskScore 12 / 16 / 9).
    expect(ekspozycjaRaid('MEDIUM', 'HIGH')).toBe(12);
    expect(ekspozycjaRaid('HIGH', 'HIGH')).toBe(16);
    expect(ekspozycjaRaid('MEDIUM', 'MEDIUM')).toBe(9);
  });

  it('NIE podstawia jedynki za brak — brak składnika daje null, nie liczbę', () => {
    expect(ekspozycjaRaid(null, 'HIGH')).toBeNull();
    expect(ekspozycjaRaid('HIGH', null)).toBeNull();
    expect(ekspozycjaRaid('', '')).toBeNull();
    // Wartość spoza słownika też jest brakiem, a nie cichym 1.
    expect(ekspozycjaRaid('VERY_HIGH', 'CRITICAL')).toBeNull();
  });

  it('jest niewrażliwa na wielkość liter (baza bywa niespójna)', () => {
    expect(ekspozycjaRaid('high', 'critical')).toBe(20);
  });

  it('pasma barw: ≤6 niskie, ≤12 średnie, >12 wysokie', () => {
    expect(pasmoEkspozycji(ekspozycjaRaid('LOW', 'MEDIUM'))).toBe('niskie'); // 6
    expect(pasmoEkspozycji(ekspozycjaRaid('MEDIUM', 'HIGH'))).toBe('srednie'); // 12
    expect(pasmoEkspozycji(ekspozycjaRaid('HIGH', 'HIGH'))).toBe('wysokie'); // 16
    expect(pasmoEkspozycji(null)).toBe('brak');
  });
});

describe('(i-2) DNI PO TERMINIE liczą się TYLKO dla pozycji otwartej z terminem', () => {
  const teraz = Date.parse('2026-09-10T12:00:00.000Z');
  const przed = new Date(teraz - 5 * DZIEN).toISOString();
  const po = new Date(teraz + 5 * DZIEN).toISOString();

  it('otwarta pozycja z terminem w przeszłości → liczba dni', () => {
    expect(raidDniPoTerminie(przed, 'OPEN', teraz)).toBe(5);
    expect(czyRaidPoTerminie(przed, 'OPEN', teraz)).toBe(true);
  });

  it('ZAMKNIĘTA pozycja po terminie NIE jest zaległością', () => {
    expect(raidDniPoTerminie(przed, RAID_STATUS_KONCOWY, teraz)).toBeNull();
    expect(czyRaidPoTerminie(przed, RAID_STATUS_KONCOWY, teraz)).toBe(false);
  });

  it('pozycja bez terminu nie jest po terminie — to był stan 16/16 przed R4', () => {
    expect(raidDniPoTerminie(null, 'OPEN', teraz)).toBeNull();
    expect(czyRaidPoTerminie(null, 'OPEN', teraz)).toBe(false);
  });

  it('termin w przyszłości nie jest zaległością', () => {
    expect(raidDniPoTerminie(po, 'OPEN', teraz)).toBeNull();
  });

  it('stany pośrednie (Ograniczona / Zmaterializowana) są wciąż otwarte', () => {
    expect(czyRaidOtwarty('MITIGATED')).toBe(true);
    expect(czyRaidOtwarty('REALIZED')).toBe(true);
    expect(czyRaidOtwarty('CLOSED')).toBe(false);
    // Brak statusu = pozycja otwarta (domyślna wartość kontraktu).
    expect(czyRaidOtwarty(null)).toBe(true);
  });
});

describe('(m) KONWERSJA ryzyko → problem zostawia link do źródła', () => {
  it('opis nowego problemu niesie identyfikator i tytuł pozycji źródłowej', () => {
    const opis = opisEskalacjiRyzyka('raid-77', 'Awaria dostawcy chmury');
    expect(opis).toContain('raid-77');
    expect(opis).toContain('Awaria dostawcy chmury');
    expect(zrodloEskalacji(opis)).toBe('raid-77');
  });

  it('nie kasuje poprzedniego opisu — dokleja link nad nim', () => {
    const opis = opisEskalacjiRyzyka('raid-77', 'Awaria', 'Stary opis ryzyka');
    expect(opis).toContain('Stary opis ryzyka');
    expect(zrodloEskalacji(opis)).toBe('raid-77');
  });

  it('opis bez znacznika nie udaje, że ma źródło', () => {
    expect(zrodloEskalacji('Zwykły opis ryzyka')).toBeNull();
    expect(zrodloEskalacji(null)).toBeNull();
  });

  it('pozycja źródłowa dostaje adnotację o przekształceniu', () => {
    const opis = opisPoPrzeksztalceniu('issue-9', 'Stary opis');
    expect(opis).toContain(ZNACZNIK_PRZEKSZTALCENIA);
    expect(opis).toContain('issue-9');
    expect(opis).toContain('Stary opis');
  });
});
