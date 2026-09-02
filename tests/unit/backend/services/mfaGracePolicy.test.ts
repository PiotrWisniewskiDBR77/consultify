/**
 * Arytmetyka karencji MFA — przypadki brzegowe, których nie widać w scenariuszu
 * HTTP: karencja zerowa, brak kotwicy, konto założone po włączeniu wymogu.
 */
import { describe, expect, it } from 'vitest';

import { evaluateMfaGrace } from '../../../../server/src/services/mfaGracePolicy.js';

const NOW = new Date('2026-09-02T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe('evaluateMfaGrace', () => {
  it('nie uruchamia karencji, gdy wymogu nie ma', () => {
    const d = evaluateMfaGrace({ enforced: false, enabled: false, gracePeriodDays: 7, now: NOW });
    expect(d.graceActive).toBe(false);
    expect(d.deadline).toBeNull();
  });

  it('nie uruchamia karencji dla konta, które MA drugi składnik', () => {
    const d = evaluateMfaGrace({
      enforced: true,
      enabled: true,
      requiredSince: daysAgo(1),
      gracePeriodDays: 7,
      now: NOW,
    });
    expect(d.graceActive).toBe(false);
  });

  it('liczy dni od kotwicy organizacji, gdy konto jest starsze', () => {
    const d = evaluateMfaGrace({
      enforced: true,
      enabled: false,
      requiredSince: daysAgo(2),
      userCreatedAt: daysAgo(400),
      gracePeriodDays: 7,
      now: NOW,
    });
    expect(d.graceActive).toBe(true);
    expect(d.daysRemaining).toBe(5);
  });

  it('daje własny bieg konta założonego PO włączeniu wymogu', () => {
    const d = evaluateMfaGrace({
      enforced: true,
      enabled: false,
      requiredSince: daysAgo(200),
      userCreatedAt: daysAgo(1),
      gracePeriodDays: 7,
      now: NOW,
    });
    expect(d.graceActive).toBe(true);
    expect(d.daysRemaining).toBe(6);
  });

  it('karencja wyczerpana: zero dni, żadnej przepustki', () => {
    const d = evaluateMfaGrace({
      enforced: true,
      enabled: false,
      requiredSince: daysAgo(30),
      userCreatedAt: daysAgo(400),
      gracePeriodDays: 7,
      now: NOW,
    });
    expect(d.graceActive).toBe(false);
    expect(d.daysRemaining).toBe(0);
  });

  it('świadome 0 dni znaczy "bez karencji", nie "domyślne 7"', () => {
    const d = evaluateMfaGrace({
      enforced: true,
      enabled: false,
      requiredSince: daysAgo(0),
      userCreatedAt: daysAgo(400),
      gracePeriodDays: 0,
      now: NOW,
    });
    expect(d.gracePeriodDays).toBe(0);
    expect(d.graceActive).toBe(false);
  });

  it('brak konfiguracji dni = domyślne 7', () => {
    const d = evaluateMfaGrace({
      enforced: true,
      enabled: false,
      requiredSince: daysAgo(1),
      userCreatedAt: daysAgo(400),
      gracePeriodDays: null,
      now: NOW,
    });
    expect(d.gracePeriodDays).toBe(7);
    expect(d.graceActive).toBe(true);
  });

  it('brak kotwicy organizacji NIE otwiera bezterminowej furtki: liczy od daty konta', () => {
    const d = evaluateMfaGrace({
      enforced: true,
      enabled: false,
      requiredSince: null,
      userCreatedAt: daysAgo(400),
      gracePeriodDays: 7,
      now: NOW,
    });
    expect(d.graceActive).toBe(false);
    expect(d.daysRemaining).toBe(0);
  });
});
