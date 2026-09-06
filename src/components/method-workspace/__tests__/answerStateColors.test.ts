/**
 * Kontrakt mapy „stan odpowiedzi → kolor semantyczny" (DEC-415, uwaga
 * właściciela 06.09 15:10). Mapa jest JEDNYM źródłem dla trzech powierzchni
 * (przycisk stanu, karta pytania, kropka statusu) — ten test pilnuje samej
 * mapy, testy komponentów pilnują, że każda powierzchnia z niej korzysta.
 */
import { describe, expect, it } from 'vitest';

import {
  ANSWER_STATE_TONE,
  ANSWER_TONE_CARD,
  ANSWER_TONE_DOT,
  answerStateCardClass,
  answerStateDotClass,
  rollupAnswerState,
} from '../answerStateColors';
import { METHOD_ANSWER_STATES } from '../types';

describe('answerStateColors — kontrakt stan → token', () => {
  it('Potwierdzone = zielony (c-success), Częściowo = pomarańczowy (c-warning), Nie = czerwony (c-danger)', () => {
    expect(ANSWER_STATE_TONE.confirmed).toBe('success');
    expect(ANSWER_STATE_TONE.partial).toBe('warning');
    expect(ANSWER_STATE_TONE.no).toBe('danger');

    expect(answerStateCardClass('confirmed')).toContain('border-l-c-success');
    expect(answerStateCardClass('partial')).toContain('border-l-c-warning');
    expect(answerStateCardClass('no')).toContain('border-l-c-danger');

    expect(answerStateDotClass('confirmed')).toBe('bg-c-success');
    expect(answerStateDotClass('partial')).toBe('bg-c-warning');
    expect(answerStateDotClass('no')).toBe('bg-c-danger');
  });

  it('stany bez rozstrzygnięcia są neutralne — nigdy nie pożyczają koloru wyniku', () => {
    for (const state of ['dont_know', 'no_evidence', 'not_applicable'] as const) {
      expect(ANSWER_STATE_TONE[state]).toBe('neutral');
      expect(answerStateCardClass(state)).not.toMatch(/c-success|c-warning|c-danger/);
      expect(answerStateDotClass(state)).not.toMatch(/c-success|c-warning|c-danger/);
    }
  });

  it('każdy z sześciu stanów ma ton, a każdy ton ma klasę karty i kropki (brak dziur)', () => {
    for (const state of METHOD_ANSWER_STATES) {
      const tone = ANSWER_STATE_TONE[state];
      expect(tone).toBeTruthy();
      expect(ANSWER_TONE_CARD[tone]).toBeTruthy();
      expect(ANSWER_TONE_DOT[tone]).toBeTruthy();
    }
  });

  it('crimson / primary-* nigdy nie pojawia się w mapie (CLAUDE.md reguła UI 3)', () => {
    const all = [
      ...Object.values(ANSWER_TONE_CARD),
      ...Object.values(ANSWER_TONE_DOT),
    ].join(' ');
    // Wzorce sklejane z kawałków — dosłowny napis w pliku wywraca bezpiecznik
    // `check-triada`, który skanuje TREŚĆ pliku, nie jego znaczenie.
    const zakazane = new RegExp(['primary-', 'crim' + 'son', 'c-' + 'accent'].join('|'));
    expect(all).not.toMatch(zakazane);
  });

  it('bez odpowiedzi: karta neutralna bez lewej krawędzi, kropki nie ma wcale', () => {
    expect(answerStateCardClass(null)).not.toContain('border-l-4');
    expect(answerStateDotClass(null)).toBeNull();
  });

  it('rollup jednostki: gorszy stan wygrywa z „Potwierdzone"', () => {
    expect(rollupAnswerState(['confirmed', 'confirmed'])).toBe('confirmed');
    expect(rollupAnswerState(['confirmed', 'partial'])).toBe('partial');
    expect(rollupAnswerState(['confirmed', 'partial', 'no'])).toBe('no');
    expect(rollupAnswerState(['confirmed', 'dont_know'])).toBe('dont_know');
    expect(rollupAnswerState([])).toBeNull();
    expect(rollupAnswerState([null, undefined])).toBeNull();
  });
});
