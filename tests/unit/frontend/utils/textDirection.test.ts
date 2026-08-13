import { describe, expect, it } from 'vitest';

import {
  isRtlLanguage,
  normalizeLangCode,
  textDirection,
} from '../../../../src/utils/textDirection';

describe('frontend utils/textDirection', () => {
  it('normalizes language tags consistently', () => {
    expect(normalizeLangCode(' AR-SA ')).toBe('ar-sa');
    expect(normalizeLangCode('pl-PL')).toBe('pl-pl');
    expect(normalizeLangCode(undefined)).toBe('');
  });

  it('detects RTL only for Arabic variants', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('ar-SA')).toBe(true);
    expect(isRtlLanguage('ar-EG')).toBe(true);

    expect(isRtlLanguage('pl')).toBe(false);
    expect(isRtlLanguage('en-US')).toBe(false);
    expect(isRtlLanguage('de')).toBe(false);
    expect(isRtlLanguage('ja')).toBe(false);
  });

  it('returns stable text direction values', () => {
    expect(textDirection('ar')).toBe('rtl');
    expect(textDirection('ar-SA')).toBe('rtl');
    expect(textDirection('en')).toBe('ltr');
    expect(textDirection('pl-PL')).toBe('ltr');
    expect(textDirection('')).toBe('ltr');
  });
});
