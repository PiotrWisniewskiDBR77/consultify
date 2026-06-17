import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  claimsCompletedCanvasAction,
  isHallucinatedCanvasConfirmation,
  looksLikeProposal,
} from '../../src/components/AIChat/unbackedCanvasClaim';

// GAP M02 L-03 / M01 L-09 Tryb A — Teresa truthfulness (P1).
// Locks the deterministic guard that catches a hallucinated "I did it" canvas/
// document confirmation when no real handoff/tool path fired. Full
// function-calling enforcement is Fala 2; this is the testable WITHOUT-FC guard.

describe('claimsCompletedCanvasAction — completed-action claims ARE detected', () => {
  const completedClaims = [
    // PL
    'Dodałem to do Canvasa.',
    'Dodałam ten fragment do canvasa, możesz sprawdzić.',
    'Zapisałem dokument w Outputs.',
    'Utworzyłem nowy raport dla Ciebie.',
    'Stworzyłem prezentację, jest gotowa.',
    'Wygenerowałem tabelę i wstawiłem ją do dokumentu.',
    'Gotowe — raport jest już w Outputs.',
    'Dokument został zapisany.',
    // EN
    "I've added it to your Canvas.",
    'Added the section to the document.',
    'I saved the document for you.',
    'Created the report and put it in Outputs.',
    'Done — the document is ready.',
    'I generated the presentation and inserted it into the deck.',
  ];

  it.each(completedClaims)('flags completed-action claim: %s', (text) => {
    expect(claimsCompletedCanvasAction(text)).toBe(true);
  });
});

describe('claimsCompletedCanvasAction — proposals/questions are NOT flagged', () => {
  const proposals = [
    // PL — offers / questions / future tense
    'Mogę dodać to do Canvasa, jeśli chcesz.',
    'Chcesz, żebym dodał ten raport do dokumentu?',
    'Czy mam zapisać ten dokument w Outputs?',
    'Jeśli chcesz, przygotuję dla Ciebie raport.',
    'Proponuję utworzyć nowy dokument z tym podsumowaniem.',
    'Dodam to do Canvasa, daj tylko znać.',
    // EN — offers / questions / future tense
    'I can add this to your Canvas.',
    'Would you like me to save the document?',
    'Shall I create the report for you?',
    'Do you want me to put this in Outputs?',
    "If you'd like, I'll generate the presentation.",
    'I suggest creating a document with this summary.',
    // neutral chat that merely mentions a noun — must not trip
    'What do you think about this report?',
    'Ten raport wygląda nieźle, co o nim sądzisz?',
  ];

  it.each(proposals)('does NOT flag proposal/question: %s', (text) => {
    expect(claimsCompletedCanvasAction(text)).toBe(false);
  });

  it('empty / whitespace input is never a claim', () => {
    expect(claimsCompletedCanvasAction('')).toBe(false);
    expect(claimsCompletedCanvasAction('   ')).toBe(false);
    // @ts-expect-error — defensive: non-string input must not throw
    expect(claimsCompletedCanvasAction(undefined)).toBe(false);
  });
});

describe('looksLikeProposal', () => {
  it('recognizes PL and EN offers', () => {
    expect(looksLikeProposal('Mogę dodać to do Canvasa.')).toBe(true);
    expect(looksLikeProposal('Would you like me to add it?')).toBe(true);
  });
  it('a flat completion claim is NOT a proposal', () => {
    expect(looksLikeProposal('Dodałem to do Canvasa.')).toBe(false);
    expect(looksLikeProposal("I've added it to your Canvas.")).toBe(false);
  });
});

describe('isHallucinatedCanvasConfirmation — the contract predicate', () => {
  it('claim + NO handoff → true (unbacked, violates honesty contract)', () => {
    expect(
      isHallucinatedCanvasConfirmation('Dodałem to do Canvasa.', { handoffOccurred: false })
    ).toBe(true);
    expect(
      isHallucinatedCanvasConfirmation("I've saved the document.", { handoffOccurred: false })
    ).toBe(true);
  });

  it('claim + handoff fired → false (legitimate — a real path ran)', () => {
    expect(
      isHallucinatedCanvasConfirmation('Dodałem to do Canvasa.', { handoffOccurred: true })
    ).toBe(false);
    expect(
      isHallucinatedCanvasConfirmation("I've saved the document.", { handoffOccurred: true })
    ).toBe(false);
  });

  it('no claim → false regardless of handoff state', () => {
    expect(
      isHallucinatedCanvasConfirmation('Mogę dodać to do Canvasa, jeśli chcesz.', {
        handoffOccurred: false,
      })
    ).toBe(false);
    expect(
      isHallucinatedCanvasConfirmation('What do you think about this report?', {
        handoffOccurred: false,
      })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source-guard: the persona honesty contract must NOT be silently removed.
// If these strings disappear from server/src/ai/persona.ts, the LLM-side rule
// is gone and this whole guard loses its upstream anchor — fail loudly.
// ---------------------------------------------------------------------------
describe('persona honesty contract is present in server/src/ai/persona.ts', () => {
  const personaPath = join(__dirname, '../../server/src/ai/persona.ts');
  const personaSrc = readFileSync(personaPath, 'utf8');

  it('keeps the PL contract ("PROPONUJ, nie udawaj wykonania" + "Nigdy nie twierdź")', () => {
    expect(personaSrc).toContain('PROPONUJ, nie udawaj wykonania');
    expect(personaSrc).toContain('Nigdy nie twierdź, że coś zrobiłeś');
  });

  it('keeps the EN contract ("PROPOSE, don\'t fake execution" + "Never claim you did")', () => {
    expect(personaSrc).toContain("PROPOSE, don't fake execution");
    expect(personaSrc).toContain('Never claim you did something you cannot verify was done');
  });
});
