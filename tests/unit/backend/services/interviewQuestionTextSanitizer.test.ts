/**
 * M03R-007 — sanityzacja treści pytania.
 *
 * Największe ryzyko tej zmiany to nie „nie usunie artefaktu", tylko „zje
 * prawdziwą kwotę". Dlatego przypadków negatywnych jest tu więcej niż
 * pozytywnych, a wśród nich są dokładne kształty z demo.
 */
import { describe, expect, it } from 'vitest';

import {
  hasTrailingIndexArtifact,
  sanitizeQuestionText,
} from '../../../../server/src/services/interview/interviewQuestionTextSanitizer.js';

describe('sanitizeQuestionText — usuwa artefakt', () => {
  // Dokładne ogony sześciu pytań zastanych na demo (sesja b3dfdb9a…).
  const realCases: Array<[string, string]> = [
    [
      'Which systems run this business day to day, and where does someone have to re-key or copy-paste data between them$23',
      'Which systems run this business day to day, and where does someone have to re-key or copy-paste data between them',
    ],
    [
      'What would you need to see to unlock more$35',
      'What would you need to see to unlock more',
    ],
    ['Where does it slow down$15', 'Where does it slow down'],
    ['and what made it hard$29', 'and what made it hard'],
    ['for you to get there$8', 'for you to get there'],
    ['where transformation needs to go next$9', 'where transformation needs to go next'],
  ];

  it.each(realCases)('czyści %s', (input, expected) => {
    expect(sanitizeQuestionText(input)).toBe(expected);
  });

  it('rozpoznaje artefakt osobnym predykatem', () => {
    expect(hasTrailingIndexArtifact('go next$9')).toBe(true);
    expect(hasTrailingIndexArtifact('go next')).toBe(false);
  });

  it('jest idempotentny', () => {
    const once = sanitizeQuestionText('go next$9');
    expect(sanitizeQuestionText(once)).toBe(once);
  });
});

describe('sanitizeQuestionText — NIE rusza prawidłowych kwot', () => {
  const preserved = [
    'What is the committed budget? $23',
    'Ile wynosi budżet? $23',
    '$23 million in savings is the target',
    'Costs rose to $1200',
    'Costs rose to $1,200',
    'Revenue target: 23$',
    'How much of the $50k was spent?',
    'Budget: $5',
    'Czy zmieściliście się w $999?',
  ];

  it.each(preserved)('zostawia bez zmian: %s', (input) => {
    expect(sanitizeQuestionText(input)).toBe(input);
    expect(hasTrailingIndexArtifact(input)).toBe(false);
  });

  it('kwota na końcu ze spacją przed $ przechodzi nietknięta', () => {
    // Ten przypadek jest granicą reguły: bez warunku „przyklejony do \\S"
    // sanitizer zjadłby prawdziwą kwotę.
    expect(sanitizeQuestionText('Total spend last year: $23')).toBe(
      'Total spend last year: $23'
    );
  });

  it('cztery cyfry to kwota, nie indeks', () => {
    expect(sanitizeQuestionText('them$1200')).toBe('them$1200');
  });
});

describe('sanitizeQuestionText — wejścia zdegenerowane', () => {
  it('null/undefined dają pusty string', () => {
    expect(sanitizeQuestionText(null)).toBe('');
    expect(sanitizeQuestionText(undefined)).toBe('');
  });

  it('sam artefakt bez treści nie jest usuwany (brak znaku przed $)', () => {
    expect(sanitizeQuestionText('$23')).toBe('$23');
  });

  it('nie rusza treści wielolinijkowej poza końcem', () => {
    expect(sanitizeQuestionText('linia 1$23\nlinia 2')).toBe('linia 1$23\nlinia 2');
  });
});
