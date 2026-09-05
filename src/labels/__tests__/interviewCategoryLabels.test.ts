import { describe, expect, it } from 'vitest';

import {
  interviewCategoryLabelEntries,
  normalizeTemplateCategory,
} from '../interviewCategoryLabels';

describe('normalizeTemplateCategory', () => {
  it('normalizes every case variant to one localized label', () => {
    expect(interviewCategoryLabelEntries).toEqual({
      commercial: { pl: 'Komercyjne', en: 'Commercial' },
    });
    expect(normalizeTemplateCategory('COMMERCIAL', true)).toBe('Komercyjne');
    expect(normalizeTemplateCategory('commercial', true)).toBe('Komercyjne');
    expect(normalizeTemplateCategory('Commercial', true)).toBe('Komercyjne');
    expect(normalizeTemplateCategory('COMMERCIAL', false)).toBe('Commercial');
  });

  it('never exposes an unknown raw category', () => {
    expect(normalizeTemplateCategory('FUTURE_INTERNAL_CODE', true)).toBe('Inna kategoria');
    expect(normalizeTemplateCategory('FUTURE_INTERNAL_CODE', false)).toBe('Other category');
  });
});
