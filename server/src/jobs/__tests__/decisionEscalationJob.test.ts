/**
 * P16 / R3 (DEC-453) — REGUŁA DOBOWEGO AUTOMATU ESKALACJI, bez bazy.
 *
 * `nextEscalationLevel` jest CZYSTA celowo: cała reguła („termin minął +
 * status otwarty + nie dziś + poniżej maksimum") daje się zmierzyć wprost,
 * bez Postgresa, bez czasu wykonania i bez atrapy bazy — a atrapa bazy w tym
 * repo potrafi kłamać o zapisie (Database.ts zwraca `changes: 1` dla każdego
 * UPDATE, niezależnie od WHERE). Skutki uboczne (INSERT do
 * `decision_escalation_log`, idempotencja dobowa na realnych wierszach)
 * mierzy siostrzany plik `decisionEscalation.pg.test.ts` na PRAWDZIWYM PG.
 *
 * MUTACJE, na które ten plik reaguje (sprawdzone ręcznie, przywrócone):
 *   · usunięcie warunku statusu (`ESCALATABLE_STATUSES.includes(...)`) → RED
 *     — automat ruszyłby decyzje już rozstrzygnięte,
 *   · usunięcie bramki dobowej (`if (escalatedToday) return null`) → RED
 *     — ten sam dzień podnosiłby poziom wielokrotnie,
 *   · zmiana sufitu na `> ESCALATION_MAX_LEVEL` → RED — powstałby poziom 4,
 *     którego nie ma w modelu (właściciel → PMO → komitet).
 */
import { describe, expect, it } from 'vitest';

import {
  ESCALATABLE_STATUSES,
  ESCALATION_MAX_LEVEL,
  nextEscalationLevel,
} from '../decisionEscalationJob.js';

const TERAZ = new Date('2026-09-07T12:00:00.000Z');
const WCZORAJ = '2026-09-06T12:00:00.000Z';
const JUTRO = '2026-09-08T12:00:00.000Z';

const podnies = (nadpisania: Partial<Parameters<typeof nextEscalationLevel>[0]> = {}) =>
  nextEscalationLevel({
    status: 'pending',
    deadline: WCZORAJ,
    currentLevel: 0,
    escalatedToday: false,
    now: TERAZ,
    ...nadpisania,
  });

describe('(h) automat eskalacji — kogo podnosi i kiedy', () => {
  it('PIERWSZE uruchomienie działa WSTECZNIE: termin w przeszłości, poziom 0 → 1', () => {
    // To jest cała poprawka wobec rynku (AUDYT_RYNKU_PMO §4.3): monday.com
    // reaguje dopiero na nowe przekroczenia, więc istniejące zaległości nie
    // generują u nich nic. Tu pierwszy przebieg podnosi je wszystkie.
    expect(podnies()).toBe(1);
    expect(podnies({ deadline: '2026-01-01T00:00:00.000Z' })).toBe(1);
  });

  it('podnosi po jednym: 1 → 2 → 3 i zatrzymuje się na 3', () => {
    expect(podnies({ currentLevel: 1 })).toBe(2);
    expect(podnies({ currentLevel: 2 })).toBe(3);
    expect(podnies({ currentLevel: 3 })).toBeNull();
    expect(ESCALATION_MAX_LEVEL).toBe(3);
  });

  it('NIE podnosi drugi raz tego samego dnia', () => {
    expect(podnies({ escalatedToday: true })).toBeNull();
    expect(podnies({ escalatedToday: true, currentLevel: 1 })).toBeNull();
  });

  it('NIE rusza decyzji ROZSTRZYGNIĘTEJ, choćby była po terminie', () => {
    for (const status of ['approved', 'rejected', 'superseded', 'cancelled']) {
      expect(podnies({ status })).toBeNull();
    }
    // Otwarte — i tylko te dwa — podlegają automatowi.
    expect([...ESCALATABLE_STATUSES]).toEqual(['pending', 'escalated']);
    expect(podnies({ status: 'pending' })).toBe(1);
    expect(podnies({ status: 'escalated' })).toBe(1);
    expect(podnies({ status: 'ESCALATED' })).toBe(1); // wielkość liter bez znaczenia
  });

  it('NIE rusza decyzji, której termin jeszcze nie minął ani decyzji bez terminu', () => {
    expect(podnies({ deadline: JUTRO })).toBeNull();
    expect(podnies({ deadline: null })).toBeNull();
    expect(podnies({ deadline: 'to nie jest data' })).toBeNull();
    // Termin dokładnie „teraz" jeszcze nie minął.
    expect(podnies({ deadline: TERAZ.toISOString() })).toBeNull();
  });
});
