/**
 * Anti-false-green coverage for the CURRENCY / DURATION field-type polish
 * (Table Platform → Airtable parity).
 *
 * These tests target:
 *   - CURRENCY: `currencyCode` (ISO-4217-ish) + `precision` (0-4) options,
 *     and value validation/normalisation (rounding to precision).
 *   - DURATION: `durationFormat` options (h:mm / h:mm:ss / d h:mm) and value
 *     validation/normalisation of string durations to seconds.
 *
 * Before this change, `currencyCode` / `durationFormat` were unknown to
 * `SchemaValidationService` (currency validated exactly like `number`;
 * duration only accepted a raw seconds number). These tests are written to
 * be RED against the pre-change code and GREEN after.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import schemaValidationService from '../SchemaValidationService.js';

describe('CURRENCY field type — options validation', () => {
  it('accepts a valid ISO-4217 currencyCode + precision', () => {
    const result = schemaValidationService.validateFieldOptions('currency', {
      currencyCode: 'EUR',
      precision: 0,
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects an invalid / made-up currency code', () => {
    const result = schemaValidationService.validateFieldOptions('currency', {
      currencyCode: 'ZZZ',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /currencyCode/.test(e))).toBe(true);
  });

  it('rejects a currencyCode that is not 3 letters', () => {
    const result = schemaValidationService.validateFieldOptions('currency', {
      currencyCode: 'euro',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects precision outside 0-4', () => {
    const tooHigh = schemaValidationService.validateFieldOptions('currency', { precision: 5 });
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.errors.some((e) => /precision/.test(e))).toBe(true);

    const negative = schemaValidationService.validateFieldOptions('currency', { precision: -1 });
    expect(negative.valid).toBe(false);
  });

  it('backward compatible: no currencyCode / precision at all still validates', () => {
    const result = schemaValidationService.validateFieldOptions('currency', {});
    expect(result).toEqual({ valid: true, errors: [] });
  });
});

describe('CURRENCY field type — value validation', () => {
  it('accepts a finite number value with currencyCode/precision configured', async () => {
    const result = await schemaValidationService.validateRecord(
      'table-1',
      { amount: 12.5 },
      { isUpdate: true }
    );
    // No fields configured in mocked DB (fields query returns []), so this
    // just proves the call path doesn't throw. Real per-value precision
    // rounding is exercised via normalizeCurrencyValue below.
    expect(result.valid).toBe(true);
  });

  it('normalizeCurrencyValue rounds to configured precision', () => {
    const { normalizeCurrencyValue } = schemaValidationService as unknown as {
      normalizeCurrencyValue: (value: number, options: any) => number;
    };
    expect(normalizeCurrencyValue(12.3456, { precision: 2 })).toBe(12.35);
    expect(normalizeCurrencyValue(12.6, { currencyCode: 'EUR', precision: 0 })).toBe(13);
    expect(normalizeCurrencyValue(12.3456, {})).toBe(12.35); // default precision = 2
  });

  it('checkCurrencyValue rejects non-finite / non-number values', () => {
    const { checkCurrencyValue } = schemaValidationService as unknown as {
      checkCurrencyValue: (value: unknown, options: any) => { ok: boolean; message?: string };
    };
    expect(checkCurrencyValue('12.50', {}).ok).toBe(false);
    expect(checkCurrencyValue(NaN, {}).ok).toBe(false);
    expect(checkCurrencyValue(Infinity, {}).ok).toBe(false);
    expect(checkCurrencyValue(12.5, { currencyCode: 'EUR', precision: 0 }).ok).toBe(true);
  });
});

describe('DURATION field type — options validation', () => {
  it('accepts a valid durationFormat', () => {
    const result = schemaValidationService.validateFieldOptions('duration', {
      durationFormat: 'h:mm',
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('accepts the new d h:mm format', () => {
    const result = schemaValidationService.validateFieldOptions('duration', {
      durationFormat: 'd h:mm',
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects an unknown durationFormat', () => {
    const result = schemaValidationService.validateFieldOptions('duration', {
      durationFormat: 'whenever',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /durationFormat/.test(e))).toBe(true);
  });

  it('still validates the legacy `format` option key', () => {
    const result = schemaValidationService.validateFieldOptions('duration', {
      format: 'h:mm:ss',
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });
});

describe('DURATION field type — value validation / normalisation', () => {
  it('normalizeDurationValue converts "1:30" (h:mm) to 5400 seconds', () => {
    const { normalizeDurationValue } = schemaValidationService as unknown as {
      normalizeDurationValue: (value: unknown) => number | null;
    };
    expect(normalizeDurationValue('1:30')).toBe(5400);
  });

  it('normalizeDurationValue converts "1:02:03" (h:mm:ss) to seconds', () => {
    const { normalizeDurationValue } = schemaValidationService as unknown as {
      normalizeDurationValue: (value: unknown) => number | null;
    };
    expect(normalizeDurationValue('1:02:03')).toBe(3723);
  });

  it('normalizeDurationValue converts "1d 2:00" (d h:mm) to seconds', () => {
    const { normalizeDurationValue } = schemaValidationService as unknown as {
      normalizeDurationValue: (value: unknown) => number | null;
    };
    expect(normalizeDurationValue('1d 2:00')).toBe(86400 + 2 * 3600);
  });

  it('normalizeDurationValue passes plain numbers through unchanged (seconds)', () => {
    const { normalizeDurationValue } = schemaValidationService as unknown as {
      normalizeDurationValue: (value: unknown) => number | null;
    };
    expect(normalizeDurationValue(120)).toBe(120);
  });

  it('normalizeDurationValue rejects garbage strings', () => {
    const { normalizeDurationValue } = schemaValidationService as unknown as {
      normalizeDurationValue: (value: unknown) => number | null;
    };
    expect(normalizeDurationValue('abc')).toBeNull();
    expect(normalizeDurationValue('1:99')).toBeNull(); // invalid minutes
    expect(normalizeDurationValue('')).toBeNull();
  });

  it('checkDurationValue accepts a numeric seconds value', () => {
    const { checkDurationValue } = schemaValidationService as unknown as {
      checkDurationValue: (value: unknown) => { ok: boolean; message?: string };
    };
    expect(checkDurationValue(5400).ok).toBe(true);
  });

  it('checkDurationValue accepts and normalises a "1:30" string', () => {
    const { checkDurationValue } = schemaValidationService as unknown as {
      checkDurationValue: (value: unknown) => { ok: boolean; message?: string; normalized?: number };
    };
    const result = checkDurationValue('1:30');
    expect(result.ok).toBe(true);
    expect(result.normalized).toBe(5400);
  });

  it('checkDurationValue rejects "abc"', () => {
    const { checkDurationValue } = schemaValidationService as unknown as {
      checkDurationValue: (value: unknown) => { ok: boolean; message?: string };
    };
    const result = checkDurationValue('abc');
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('rejects negative durations', () => {
    const { checkDurationValue } = schemaValidationService as unknown as {
      checkDurationValue: (value: unknown) => { ok: boolean; message?: string };
    };
    expect(checkDurationValue(-5).ok).toBe(false);
  });
});
