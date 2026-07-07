/**
 * naprawa-r2Narr · Problem 1 — narracja == kind.
 *
 * The confirmation Teresa shows MUST derive from the artifact's real `kind` (the
 * same token the deliverable SSE event carries and the FE navigates on), so the
 * words can never contradict the object that was created. Live bug: "stwórz
 * inicjatywę" → chat said "Utworzyłem DECYZJĘ … w Moja praca → Decyzje" while the
 * created object + event were `initiative`.
 */
import { describe, it, expect } from 'vitest';
import {
  buildCreationConfirmation,
  textContradictsKind,
  type CreationKind,
} from '../../server/src/services/ai/creationConfirmation.js';

describe('buildCreationConfirmation — confirmation text derives from kind', () => {
  it('initiative confirmation names an initiative, never a decision (the live bug)', () => {
    const pl = buildCreationConfirmation('initiative', 'Redukcja kosztów IT', 'pl');
    expect(pl.toLowerCase()).toContain('inicjatyw');
    expect(pl.toLowerCase()).not.toContain('decyzj');
    expect(pl.toLowerCase()).not.toContain('zadani');
    expect(pl).toContain('Redukcja kosztów IT');

    const en = buildCreationConfirmation('initiative', 'IT cost cut', 'en');
    expect(en.toLowerCase()).toContain('initiative');
    expect(en.toLowerCase()).not.toContain('decision');
  });

  it('each kind names ITS OWN artifact type and no other', () => {
    const nounByKind: Record<CreationKind, string> = {
      initiative: 'inicjatyw',
      task: 'zadani',
      decision: 'decyzj',
      note: 'notatk',
      doc: 'dokument',
      sheet: 'arkusz',
      deck: 'prezentacj',
      mindmap: 'mapę myśli',
      process_flow: 'przepływ',
      table: 'tabel',
      whiteboard: 'tablic',
    };
    for (const kind of Object.keys(nounByKind) as CreationKind[]) {
      const msg = buildCreationConfirmation(kind, 'X', 'pl').toLowerCase();
      expect(msg, `kind=${kind}`).toContain(nounByKind[kind].toLowerCase());
    }
  });

  it('handles an empty title without producing a dangling quote', () => {
    const msg = buildCreationConfirmation('task', '', 'pl');
    expect(msg.toLowerCase()).toContain('zadani');
    expect(msg).not.toContain('„”');
  });
});

describe('textContradictsKind — detects narracja ≠ kind', () => {
  it('flags a decision-worded confirmation after an initiative was created', () => {
    expect(
      textContradictsKind('Utworzyłem decyzję „X" w Moja praca → Decyzje.', 'initiative')
    ).toBe(true);
  });

  it('does NOT flag a correct initiative confirmation', () => {
    expect(
      textContradictsKind('Utworzyłem szkic inicjatywy „X" w module Inicjatywy.', 'initiative')
    ).toBe(false);
  });

  it('does NOT flag a vague confirmation that names no artifact type', () => {
    expect(textContradictsKind('Gotowe, otworzyłem to po prawej.', 'initiative')).toBe(false);
  });

  it('flags an EN task-worded confirmation after a decision was created', () => {
    expect(textContradictsKind('I created a task for you in My Work.', 'decision')).toBe(true);
  });

  it('is inert on empty text', () => {
    expect(textContradictsKind('', 'initiative')).toBe(false);
  });
});
