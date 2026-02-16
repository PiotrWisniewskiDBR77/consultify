import { describe, expect, it } from 'vitest';

import {
  asRecord,
  asRecordArray,
  getProperty,
  getPropertyWithDefault,
  isRecord,
  isRecordArray,
} from '../../../../server/src/utils/dbTypeHelpers.js';

describe('server utils/dbTypeHelpers', () => {
  it('isRecord returns true for plain objects', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it('isRecord returns false for null, arrays and primitives', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('isRecordArray returns true only when every item is a record', () => {
    expect(isRecordArray([{ a: 1 }, { b: 2 }])).toBe(true);
    expect(isRecordArray([{ a: 1 }, null] as any)).toBe(false);
    expect(isRecordArray('nope' as any)).toBe(false);
  });

  it('getProperty returns a typed value when present', () => {
    const rec: Record<string, unknown> = { n: 123, s: 'abc' };
    expect(getProperty<number>(rec, 'n')).toBe(123);
    expect(getProperty<string>(rec, 's')).toBe('abc');
  });

  it('getProperty returns undefined when key is missing', () => {
    const rec: Record<string, unknown> = { a: 1 };
    expect(getProperty(rec, 'missing')).toBeUndefined();
  });

  it('getPropertyWithDefault returns the existing value, even if falsy', () => {
    const rec: Record<string, unknown> = { n: 0, s: '' };
    expect(getPropertyWithDefault(rec, 'n', 5)).toBe(0);
    expect(getPropertyWithDefault(rec, 's', 'fallback')).toBe('');
  });

  it('getPropertyWithDefault returns default when key is missing or undefined', () => {
    const rec: Record<string, unknown> = { a: 1, b: undefined };
    expect(getPropertyWithDefault(rec, 'missing', 9)).toBe(9);
    expect(getPropertyWithDefault(rec, 'b', 9)).toBe(9);
  });

  it('asRecord and asRecordArray are pass-through casts', () => {
    const obj: unknown = { a: 1 };
    const arr: unknown = [{ a: 1 }];
    expect(asRecord(obj)).toEqual({ a: 1 });
    expect(asRecordArray(arr)).toEqual([{ a: 1 }]);
  });
});
