/**
 * Strażnik rozjazdu semantyki dowodu.
 *
 * ★ Powód: 2026-08-13 te same cztery stany znaczyły co innego w trzech
 * komponentach jednego ekranu (MethodNavigator / InterviewFocusPanel /
 * LiveMatrix). Żaden test tego nie łapał, bo każdy komponent był testowany
 * osobno i każdy był „wewnętrznie spójny".
 *
 * Ten test jest jedynym miejscem, które patrzy na WSZYSTKIE trzy naraz.
 */
import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_CHIP_CLASS,
  EVIDENCE_DOT_CLASS,
  EVIDENCE_LABEL_PL,
  EVIDENCE_TONE,
} from '../evidenceSemantics';
import type { MethodEvidenceState } from '../types';

const ALL_STATES: readonly MethodEvidenceState[] = ['complete', 'weak', 'missing', 'conflicting'];

describe('evidenceSemantics — jedno źródło prawdy', () => {
  it('pokrywa każdy stan unii MethodEvidenceState', () => {
    for (const state of ALL_STATES) {
      expect(EVIDENCE_TONE[state]).toBeTruthy();
      expect(EVIDENCE_LABEL_PL[state]).toBeTruthy();
      expect(EVIDENCE_CHIP_CLASS[EVIDENCE_TONE[state]]).toBeTruthy();
      expect(EVIDENCE_DOT_CLASS[EVIDENCE_TONE[state]]).toBeTruthy();
    }
  });

  it('czerwień jest zarezerwowana WYŁĄCZNIE dla sprzeczności dowodów', () => {
    const danger = ALL_STATES.filter((s) => EVIDENCE_TONE[s] === 'danger');
    expect(danger).toEqual(['conflicting']);
  });

  it('★ brak dowodu jest NEUTRALNY, nie ostrzegawczy', () => {
    // Na starcie oceny każdy obszar ma `missing`. Bursztyn dawałby ścianę
    // ostrzeżeń w sesji, w której nikt jeszcze nic nie zrobił źle.
    expect(EVIDENCE_TONE.missing).toBe('neutral');
    // ...ale dowód SŁABY to już realna luka do domknięcia.
    expect(EVIDENCE_TONE.weak).toBe('warning');
  });

  it('żadne dwa stany o różnym znaczeniu nie dzielą tego samego wyglądu', () => {
    const byTone = new Map<string, MethodEvidenceState[]>();
    for (const state of ALL_STATES) {
      const tone = EVIDENCE_TONE[state];
      byTone.set(tone, [...(byTone.get(tone) ?? []), state]);
    }
    // każdy ton używany dokładnie raz — cztery stany, cztery odrębne tony
    for (const [tone, states] of byTone) {
      expect(states, `ton "${tone}" współdzielony przez ${states.join(', ')}`).toHaveLength(1);
    }
  });

  it('etykiety są po polsku — klient nigdy nie widzi surowego identyfikatora', () => {
    for (const state of ALL_STATES) {
      expect(EVIDENCE_LABEL_PL[state]).not.toBe(state);
      expect(EVIDENCE_LABEL_PL[state]).toMatch(/^[a-ząćęłńóśźż ]+$/i);
    }
  });
});
