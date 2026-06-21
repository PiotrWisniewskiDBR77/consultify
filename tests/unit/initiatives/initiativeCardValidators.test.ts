import { describe, expect, it } from 'vitest';

import {
  validateCardContent,
  type CardRule,
} from '../../../server/src/services/initiative/initiativeCardValidators.js';

const rulesOf = (text: string, rules?: CardRule[]) =>
  validateCardContent(text, rules).map((i) => i.rule);

describe('initiativeCardValidators §B3 (K1)', () => {
  it('empty text → no issues', () => {
    expect(validateCardContent('')).toEqual([]);
    expect(validateCardContent('   ')).toEqual([]);
  });

  it('lang_pl flags English prose (≥2 EN stopwords)', () => {
    expect(rulesOf('The process will improve with this change')).toContain('lang_pl');
  });

  it('lang_pl does NOT flag Polish prose, and ignores §A5 acronyms', () => {
    expect(rulesOf('Standaryzacja procesu wg metodyki RACI i WBS, z mierzeniem KPI.')).not.toContain(
      'lang_pl'
    );
  });

  it('no_filler flags placeholders / TODO / brackets', () => {
    expect(rulesOf('TODO uzupełnić opis')).toContain('no_filler');
    expect(rulesOf('Opis [do uzupełnienia] tutaj')).toContain('no_filler');
    expect(rulesOf('Realna, konkretna treść problemu bez wypełniaczy.')).not.toContain('no_filler');
  });

  it('problem_len flags out-of-range word counts', () => {
    const short = 'Za krótki opis problemu.';
    expect(rulesOf(short, ['problem_len'])).toContain('problem_len');
    const inRange = Array.from({ length: 150 }, (_, i) => `słowo${i}`).join(' ');
    expect(rulesOf(inRange, ['problem_len'])).not.toContain('problem_len');
  });

  it('hypothesis_format requires the "Jeśli … to … bo/ponieważ …" shape', () => {
    expect(
      rulesOf('Jeśli zautomatyzujemy przekazania to skrócimy czas bo usuniemy ręczne kroki', [
        'hypothesis_format',
      ])
    ).not.toContain('hypothesis_format');
    expect(rulesOf('Automatyzacja skróci czas obsługi', ['hypothesis_format'])).toContain(
      'hypothesis_format'
    );
  });

  it('default rules are lang_pl + no_filler only', () => {
    // a short PL line: no problem_len/hypothesis checks by default
    expect(validateCardContent('Krótki polski opis.')).toEqual([]);
  });
});
