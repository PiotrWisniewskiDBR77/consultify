import { describe, expect, it } from 'vitest';

import { justification, polishTextReason } from '../../../scripts/dev/i18n-pl-audyt.mjs';

describe('i18n PL semantic classification', () => {
  it('separates justified shared terms from untranslated interface concepts', () => {
    expect(justification('Status')).toBeTruthy();
    expect(justification('Tempo')).toBeTruthy();
    expect(justification('Owner')).toBeNull();
    expect(justification('Milestone')).toBeNull();
  });

  it('finds Polish words without relying on diacritics and preserves proper names', () => {
    expect(polishTextReason('Nazwa szablonu jest wymagana')).toBeTruthy();
    expect(polishTextReason('Zapytaj AI')).toBeTruthy();
    expect(polishTextReason('Zamknij dokument: {{nazwa}}')).toBeTruthy();
    expect(polishTextReason('Guided by Dr. Piotr Wiśniewski')).toBeNull();
    expect(polishTextReason('Paweł Bochniarz')).toBeNull();
  });
});
