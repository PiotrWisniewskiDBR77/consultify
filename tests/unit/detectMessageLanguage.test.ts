import { describe, expect, it } from 'vitest';

import { detectMessageLanguage } from '../../src/utils/detectMessageLanguage';

describe('detectMessageLanguage', () => {
  it('detects Polish from diacritics (the reported failing case)', () => {
    expect(detectMessageLanguage('opowiedz mi coś o dbr77')).toBe('pl');
  });

  it('detects Polish from stopwords without diacritics', () => {
    expect(detectMessageLanguage('jak to dziala dla mnie')).toBe('pl');
  });

  it('detects English', () => {
    expect(detectMessageLanguage('tell me about dbr77 please')).toBe('en');
  });

  it('detects German', () => {
    expect(detectMessageLanguage('was ist das und wie funktioniert es')).toBe('de');
    expect(detectMessageLanguage('Grüße, schreib mir bitte etwas über die Firma')).toBe('de');
  });

  it('detects Spanish', () => {
    expect(detectMessageLanguage('hola, cuéntame algo sobre la empresa por favor')).toBe('es');
    expect(detectMessageLanguage('¿qué es esto?')).toBe('es');
  });

  it('detects Arabic by script', () => {
    expect(detectMessageLanguage('أخبرني عن الشركة')).toBe('ar');
  });

  it('detects Japanese by script', () => {
    expect(detectMessageLanguage('会社について教えてください')).toBe('ja');
  });

  it('returns null on ambiguous / signal-less input so caller can fall back', () => {
    expect(detectMessageLanguage('dbr77')).toBeNull();
    expect(detectMessageLanguage('')).toBeNull();
    expect(detectMessageLanguage('ok')).toBeNull();
  });

  // UWAGA #4: krótkie polskie otwarcia bez diakrytyków, które wcześniej
  // spadały do UI-lang (EN) → „odpowiedź po angielsku na pytanie po polsku".
  it('detects short Polish openers without diacritics (UWAGA #4)', () => {
    expect(detectMessageLanguage('przygotuj raport')).toBe('pl');
    expect(detectMessageLanguage('daj plan na jutro')).toBe('pl');
    expect(detectMessageLanguage('opracuj zestawienie')).toBe('pl');
    expect(detectMessageLanguage('wygeneruj dokument')).toBe('pl');
  });

  it('keeps short English openers English (no false Polish positives)', () => {
    expect(detectMessageLanguage('write a report')).toBe('en');
    expect(detectMessageLanguage('show the plan')).toBe('en');
    expect(detectMessageLanguage('explain this')).toBe('en');
  });
});
