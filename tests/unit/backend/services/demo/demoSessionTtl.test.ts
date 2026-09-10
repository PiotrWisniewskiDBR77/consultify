/**
 * demoSessionTtlMs — w1a-sprzatanie-20260910, zadanie 3.
 *
 * Czas życia klonu sesji demo (server/src/services/demo/demoSessionService.ts)
 * był hardcoded na 24h (`DEMO_SESSION_DURATION_MS`). Teraz jest konfigurowalny
 * przez `DEMO_SESSION_TTL_HOURS`, z domyślną wartością 24h (dzisiejsze
 * zachowanie bez zmiany). Testujemy czystą funkcję — bez bazy, bez mocków.
 */
import { describe, expect, it } from 'vitest';

import { demoSessionTtlMs } from '../../../../../server/src/services/demo/demoSessionService.js';

const HOUR_MS = 60 * 60 * 1000;

describe('demoSessionTtlMs', () => {
  it('domyślnie zwraca 24h, gdy DEMO_SESSION_TTL_HOURS nie jest ustawione', () => {
    expect(demoSessionTtlMs({})).toBe(24 * HOUR_MS);
  });

  it('respektuje DEMO_SESSION_TTL_HOURS, gdy jest dodatnią liczbą całkowitą', () => {
    expect(demoSessionTtlMs({ DEMO_SESSION_TTL_HOURS: '2' })).toBe(2 * HOUR_MS);
    expect(demoSessionTtlMs({ DEMO_SESSION_TTL_HOURS: '1' })).toBe(1 * HOUR_MS);
    expect(demoSessionTtlMs({ DEMO_SESSION_TTL_HOURS: '48' })).toBe(48 * HOUR_MS);
  });

  it('wraca do domyślnej 24h dla wartości nieprawidłowych (0, ujemna, nie-liczba)', () => {
    expect(demoSessionTtlMs({ DEMO_SESSION_TTL_HOURS: '0' })).toBe(24 * HOUR_MS);
    expect(demoSessionTtlMs({ DEMO_SESSION_TTL_HOURS: '-5' })).toBe(24 * HOUR_MS);
    expect(demoSessionTtlMs({ DEMO_SESSION_TTL_HOURS: 'abc' })).toBe(24 * HOUR_MS);
    expect(demoSessionTtlMs({ DEMO_SESSION_TTL_HOURS: '' })).toBe(24 * HOUR_MS);
  });

  it('domyślny process.env (bez argumentu) nie rzuca i zwraca liczbę dodatnią', () => {
    // Wywołanie bez argumentu czyta prawdziwy process.env — w środowisku testowym
    // DEMO_SESSION_TTL_HOURS zwykle nie jest ustawione, więc oczekujemy defaultu,
    // ale test nie zakłada tego na sztywno (środowisko CI mogłoby je ustawić).
    const ms = demoSessionTtlMs();
    expect(ms).toBeGreaterThan(0);
    expect(Number.isFinite(ms)).toBe(true);
  });
});
