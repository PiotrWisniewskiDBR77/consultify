/**
 * J17 — kontrakt `enumLabel`. Defekt źródłowy: rejestr Inicjatyw pokazywał
 * „UNKNOWN Pewność: Nieznana" (surowy enum sklejony z polskim zdaniem) także
 * w wersji angielskiej.
 *
 * MUTACJA DOWODOWA: usunięcie domeny z `ENUM_FALLBACKS_EN` przewraca test
 * „znana wartość", bo etykieta spada na „Unknown".
 */
import { describe, expect, it } from 'vitest';

import { enumLabel, isKnownEnumValue } from '@/utils/enumLabel';

const tEn = (_key: string, fallback: string) => fallback;
const PL: Record<string, string> = {
  'enums.initiativeImpactConfidence.UNKNOWN': 'Nieznana',
  'enums.initiativeGateReadiness.READY': 'Gotowe',
  'enums.unknown': 'Nieznane',
  'initiatives.lifecycle.action.START': 'Rozpocznij realizację',
};
const tPl = (key: string, fallback: string) => PL[key] ?? fallback;

describe('enumLabel', () => {
  it('znana wartość: EN po angielsku, PL po polsku', () => {
    expect(enumLabel('initiativeGateReadiness', 'READY', tEn)).toBe('Ready');
    expect(enumLabel('initiativeGateReadiness', 'READY', tPl)).toBe('Gotowe');
  });

  it('UNKNOWN nie wycieka jako surowy enum — dostaje uczciwą etykietę', () => {
    expect(enumLabel('initiativeImpactConfidence', 'UNKNOWN', tEn)).toBe('Unknown');
    expect(enumLabel('initiativeImpactConfidence', 'UNKNOWN', tPl)).toBe('Nieznana');
  });

  it('nieznana wartość: „Unknown"/„Nieznane", NIGDY surowy string z bazy', () => {
    expect(enumLabel('initiativeHealthState', 'SOLVER-1:SELECTED', tEn)).toBe('Unknown');
    expect(enumLabel('initiativeHealthState', 'SOLVER-1:SELECTED', tPl)).toBe('Nieznane');
    expect(enumLabel('initiativeHealthState', 'SOLVER-1:SELECTED', tEn)).not.toContain('SOLVER');
  });

  it('nieznana DOMENA też nie przepuszcza surowej wartości', () => {
    expect(enumLabel('domenaKtorejNieMa', 'JAKAS_WARTOSC', tEn)).toBe('Unknown');
  });

  it('pusta wartość / nie-string: „Unknown", nigdy pustka', () => {
    expect(enumLabel('initiativeLifecycle', '', tEn)).toBe('Unknown');
    expect(enumLabel('initiativeLifecycle', null, tEn)).toBe('Unknown');
    expect(enumLabel('initiativeLifecycle', undefined, tEn)).toBe('Unknown');
    expect(enumLabel('initiativeLifecycle', 42, tEn)).toBe('Unknown');
  });

  it('domena z własną przestrzenią kluczy nie dostaje drugiego słownika', () => {
    // `initiativeGateAction` ma klucze `initiatives.lifecycle.action.*`
    // (używa ich też `gateActionLabelKey`) — jeden napis, jeden klucz.
    expect(enumLabel('initiativeGateAction', 'START', tPl)).toBe('Rozpocznij realizację');
    expect(enumLabel('initiativeGateAction', 'START', tEn)).toBe('Start execution');
  });

  it('isKnownEnumValue rozróżnia wartość znaną od nieznanej', () => {
    expect(isKnownEnumValue('initiativeLifecycle', 'IN_EXECUTION')).toBe(true);
    expect(isKnownEnumValue('initiativeLifecycle', 'NIE_MA_TAKIEGO')).toBe(false);
    expect(isKnownEnumValue('initiativeLifecycle', '')).toBe(false);
  });
});
