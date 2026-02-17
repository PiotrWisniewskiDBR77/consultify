import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  escapeLikePattern,
  generateCsrfToken,
  generateRateLimitKey,
  invalidateCsrfToken,
  isValidEmail,
  isValidInteger,
  isValidUUID,
  sanitizeString,
  sanitizeUrl,
  stripHtml,
  validateCsrfToken,
} from '../../server/src/utils/security.utils';

describe('Real security.utils.ts (P0)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sanitizeString escapes HTML entities and stringifies non-strings', () => {
    // Escaping of `/` in closing tags is optional across encoders; both variants are safe.
    expect(sanitizeString('<b>x</b>')).toMatch(/^&lt;b&gt;x&lt;(?:\/|&#x2F;)b&gt;$/);
    expect(sanitizeString(123)).toBe('123');
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
  });

  it('stripHtml removes tags but keeps text', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('no tags')).toBe('no tags');
  });

  it('escapeLikePattern escapes %, _ and backslash for SQL LIKE', () => {
    expect(escapeLikePattern('%_\\')).toBe('\\%\\_\\\\');
    expect(escapeLikePattern('100%')).toBe('100\\%');
  });

  it('generateCsrfToken produces 64-char hex and validates for the same session', () => {
    const token = generateCsrfToken('sess-1');
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^[0-9a-f]{64}$/i);
    expect(validateCsrfToken('sess-1', token)).toBe(true);
  });

  it('validateCsrfToken returns false for unknown sessions', () => {
    expect(validateCsrfToken('missing', 'a'.repeat(64))).toBe(false);
  });

  it('invalidateCsrfToken removes token and validation fails afterwards', () => {
    const token = generateCsrfToken('sess-inv');
    expect(validateCsrfToken('sess-inv', token)).toBe(true);
    invalidateCsrfToken('sess-inv');
    expect(validateCsrfToken('sess-inv', token)).toBe(false);
  });

  it('validateCsrfToken returns false when token expired (time travel)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));
    const token = generateCsrfToken('sess-exp');
    expect(validateCsrfToken('sess-exp', token)).toBe(true);

    vi.setSystemTime(new Date('2020-01-01T01:00:00.001Z'));
    expect(validateCsrfToken('sess-exp', token)).toBe(false);
  });

  it('isValidUUID validates v4-like UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID(null)).toBe(false);
  });

  it('isValidEmail validates basic email format', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('bad')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });

  it('isValidInteger accepts numbers and integer strings (incl. negatives)', () => {
    expect(isValidInteger(1)).toBe(true);
    expect(isValidInteger(1.2)).toBe(false);
    expect(isValidInteger('42')).toBe(true);
    expect(isValidInteger('-7')).toBe(true);
    expect(isValidInteger('7.1')).toBe(false);
    expect(isValidInteger({})).toBe(false);
  });

  it('sanitizeUrl allows only http/https and rejects javascript:', () => {
    expect(sanitizeUrl('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com/');
    expect(sanitizeUrl('javascript:alert(1)')).toBe(null);
    expect(sanitizeUrl('not a url')).toBe(null);
  });

  it('generateRateLimitKey formats stable keys', () => {
    expect(generateRateLimitKey('ip', '127.0.0.1')).toBe('ratelimit:ip:127.0.0.1');
    expect(generateRateLimitKey('user', 'u-1')).toBe('ratelimit:user:u-1');
  });
});
