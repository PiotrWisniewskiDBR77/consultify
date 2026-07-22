import { describe, expect, it } from 'vitest';

import {
  deriveDeckTitle,
  inferDeckAudience,
  inferDeckGoal,
  resolveDeckBrief,
} from '../deckChatBrief.js';

/**
 * Audyt 2026-07-22: ścieżka Teresa→deck hardkodowała audience:'internal'/
 * goal:'inform' i tytuł = dosłowne polecenie. Ten test przypina kontrakt briefu.
 */
describe('deckChatBrief — inferDeckAudience', () => {
  it('zarząd/komitet/board → executive (zapala register executive)', () => {
    expect(inferDeckAudience('prezentacja dla zarządu')).toBe('executive');
    expect(inferDeckAudience('materiał na komitet inwestycyjny')).toBe('executive');
    expect(inferDeckAudience('deck for the board')).toBe('executive');
  });
  it('inwestor → investor', () => {
    expect(inferDeckAudience('pitch dla inwestora')).toBe('investor');
    expect(inferDeckAudience('for a VC fund')).toBe('investor');
  });
  it('klient → sponsor', () => {
    expect(inferDeckAudience('oferta dla klienta')).toBe('sponsor');
    expect(inferDeckAudience('deck for the client')).toBe('sponsor');
  });
  it('nierozpoznane / zespół → internal (bez regresji, dawne domyślne)', () => {
    expect(inferDeckAudience('status projektu dla zespołu')).toBe('internal');
    expect(inferDeckAudience('')).toBe('internal');
  });
});

describe('deckChatBrief — inferDeckGoal', () => {
  it('decyzja/rekomendacja → decide', () => {
    expect(inferDeckGoal('prezentacja do decyzji zarządu')).toBe('decide');
    expect(inferDeckGoal('rekomendacja go/no-go')).toBe('decide');
    expect(inferDeckGoal('a deck to approve the budget')).toBe('decide');
  });
  it('oferta/sprzedaż → sell', () => {
    expect(inferDeckGoal('deck z ofertą wdrożenia')).toBe('sell');
    expect(inferDeckGoal('sales pitch')).toBe('sell');
  });
  it('uzgodnienie → align', () => {
    expect(inferDeckGoal('spotkanie by uzgodnić kierunek')).toBe('align');
  });
  it('nierozpoznane → inform (dawne domyślne)', () => {
    expect(inferDeckGoal('slajdy o statusie')).toBe('inform');
    expect(inferDeckGoal('')).toBe('inform');
  });
});

describe('deckChatBrief — deriveDeckTitle', () => {
  it('jawny tytuł od modelu WYGRYWA', () => {
    expect(deriveDeckTitle('zrób prezentację o czymś', 'Pilot faktur — rekomendacja')).toBe(
      'Pilot faktur — rekomendacja'
    );
  });
  it('ścina wiodące polecenie — cover NIE jest dosłownym poleceniem', () => {
    const t = deriveDeckTitle('zrób prezentację dla zarządu z wyników pilota automatyzacji faktur');
    expect(t.toLowerCase().startsWith('zrób')).toBe(false);
    expect(t.toLowerCase()).not.toContain('prezentacj');
    expect(t.length).toBeGreaterThan(0);
  });
  it('temat po „o" wychodzi czysto', () => {
    expect(deriveDeckTitle('przygotuj prezentację o transformacji cyfrowej')).toBe(
      'Transformacji cyfrowej'
    );
  });
  it('fail-soft: pusty intent → pusty string (caller ma fallback)', () => {
    expect(deriveDeckTitle('')).toBe('');
  });
});

describe('deckChatBrief — resolveDeckBrief', () => {
  it('bez override wnioskuje z intentu i znaczy źródło jako inferred', () => {
    const r = resolveDeckBrief('prezentacja dla zarządu do decyzji o skalowaniu pilota');
    expect(r.audience).toBe('executive');
    expect(r.goal).toBe('decide');
    expect(r.audienceSource).toBe('inferred');
    expect(r.goalSource).toBe('inferred');
  });
  it('jawne audience/goal od modelu wygrywają i są znaczone jako model', () => {
    const r = resolveDeckBrief('cokolwiek', { audience: 'board', goal: 'decide' });
    expect(r.audience).toBe('executive'); // board → executive
    expect(r.goal).toBe('decide');
    expect(r.audienceSource).toBe('model');
    expect(r.goalSource).toBe('model');
  });
  it('regresja: brak sygnału = dawne domyślne (internal/inform), nie awaria', () => {
    const r = resolveDeckBrief('slajdy o statusie projektu');
    expect(r.audience).toBe('internal');
    expect(r.goal).toBe('inform');
  });
});
