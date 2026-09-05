import { describe, expect, it } from 'vitest';

import {
  interviewCategoryLabelEntries,
  normalizeTemplateCategory,
} from '../interviewCategoryLabels';

describe('normalizeTemplateCategory', () => {
  it('normalizes every case variant to one localized label', () => {
    expect(interviewCategoryLabelEntries).toEqual({
      commercial: { pl: 'Komercyjne', en: 'Commercial' },
      strategy: { pl: 'Strategia', en: 'Strategy' },
      operations: { pl: 'Operacje', en: 'Operations' },
      operational: { pl: 'Operacyjne', en: 'Operational' },
      digital: { pl: 'Cyfryzacja', en: 'Digital' },
      people: { pl: 'Ludzie', en: 'People' },
      finance: { pl: 'Finanse', en: 'Finance' },
      cost: { pl: 'Koszty', en: 'Cost' },
      data: { pl: 'Dane', en: 'Data' },
      quick: { pl: 'Szybkie', en: 'Quick' },
      custom: { pl: 'Niestandardowe', en: 'Custom' },
      general: { pl: 'Ogólne', en: 'General' },
      executive: { pl: 'Zarząd', en: 'Executive' },
    });
    expect(normalizeTemplateCategory('COMMERCIAL', true)).toBe('Komercyjne');
    expect(normalizeTemplateCategory('commercial', true)).toBe('Komercyjne');
    expect(normalizeTemplateCategory('Commercial', true)).toBe('Komercyjne');
    expect(normalizeTemplateCategory('COMMERCIAL', false)).toBe('Commercial');
    expect(normalizeTemplateCategory('strategy', true)).toBe('Strategia');
    expect(normalizeTemplateCategory('OPERATIONS', true)).toBe('Operacje');
  });

  it('never exposes an unknown raw category', () => {
    expect(normalizeTemplateCategory('FUTURE_INTERNAL_CODE', true)).toBe('Inna kategoria');
    expect(normalizeTemplateCategory('FUTURE_INTERNAL_CODE', false)).toBe('Other category');
  });
});
