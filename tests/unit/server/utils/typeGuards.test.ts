import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  isArray,
  isBoolean,
  isDatabaseRow,
  isDatabaseRows,
  isDatabaseRunResult,
  isEmailServiceResponse,
  isErrorResponse,
  isNumber,
  isObject,
  isOpenAIResponse,
  isPaginatedResponse,
  isStripeResponse,
  isString,
  isSuccessResponse,
  validateApiResponse,
  validateDatabaseRow,
  validateDatabaseRows,
  validateExternalServiceResponse,
} from '../../../../server/src/utils/typeGuards.js';

describe('server utils/typeGuards', () => {
  it('detects database row shapes', () => {
    expect(isDatabaseRow({ a: 1 })).toBe(true);
    expect(isDatabaseRow(null)).toBe(false);
    expect(isDatabaseRow([])).toBe(false);
  });

  it('detects database rows array', () => {
    expect(isDatabaseRows([{ a: 1 }, { b: 2 }])).toBe(true);
    expect(isDatabaseRows([{ a: 1 }, null] as any)).toBe(false);
  });

  it('detects database run results', () => {
    expect(isDatabaseRunResult({ changes: 1 })).toBe(true);
    expect(isDatabaseRunResult({ changes: '1' } as any)).toBe(false);
  });

  it('detects success and error API responses', () => {
    expect(isSuccessResponse({ success: true })).toBe(true);
    expect(isSuccessResponse({ success: false })).toBe(false);
    expect(isErrorResponse({ success: false, error: 'x' })).toBe(true);
    expect(isErrorResponse({ success: false, error: 123 } as any)).toBe(false);
  });

  it('detects paginated response shape', () => {
    expect(
      isPaginatedResponse({
        data: [{ id: 1 }],
        pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      })
    ).toBe(true);
    expect(isPaginatedResponse({ data: [], pagination: null } as any)).toBe(false);
  });

  it('detects Stripe/OpenAI/email response shapes', () => {
    expect(isStripeResponse({ id: 'cus_1', object: 'customer' })).toBe(true);
    expect(isStripeResponse({ id: 1, object: 'x' } as any)).toBe(false);

    expect(isOpenAIResponse({ choices: [] })).toBe(true);
    expect(isOpenAIResponse({} as any)).toBe(false);

    expect(isEmailServiceResponse({ success: true })).toBe(true);
    expect(isEmailServiceResponse({ success: 'yes' } as any)).toBe(false);
  });

  it('validateDatabaseRow parses via Zod schema', () => {
    const schema = z.object({ id: z.number() });
    expect(validateDatabaseRow({ id: 1 }, schema)).toEqual({ id: 1 });
    expect(() => validateDatabaseRow({ id: '1' }, schema)).toThrow();
  });

  it('validateDatabaseRows throws for non-array and parses arrays', () => {
    const schema = z.object({ id: z.number() });
    expect(() => validateDatabaseRows({} as any, schema)).toThrow(
      'Expected array of database rows'
    );
    expect(validateDatabaseRows([{ id: 1 }, { id: 2 }], schema)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('validateApiResponse and validateExternalServiceResponse parse with schemas', () => {
    const apiSchema = z.object({ success: z.boolean() });
    expect(validateApiResponse({ success: true }, apiSchema)).toEqual({ success: true });

    const svcSchema = z.object({ ok: z.literal(true) });
    expect(validateExternalServiceResponse({ ok: true }, svcSchema)).toEqual({ ok: true });
  });

  it('basic primitives guards behave as expected', () => {
    expect(isString('x')).toBe(true);
    expect(isString(1 as any)).toBe(false);
    expect(isNumber(1)).toBe(true);
    expect(isNumber(NaN)).toBe(false);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean('false' as any)).toBe(false);
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray({} as any)).toBe(false);
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject([])).toBe(false);
  });
});
