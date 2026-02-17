import { describe, expect, it, vi } from 'vitest';

import {
  escapeLikePattern,
  generateCsrfToken,
  generateRateLimitKey,
  invalidateCsrfToken,
  isValidEmail,
  isValidInteger,
  isValidUUID,
  safeIdentifier,
  sanitizeFilename,
  sanitizeObject,
  sanitizeString,
  sanitizeUrl,
  stripHtml,
  validateCsrfToken,
} from '../../../../server/src/utils/security.utils.js';

describe('server utils/security.utils', () => {
  it('sanitizeString escapes HTML-sensitive characters and stripHtml removes tags', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString('<script>alert(1)</script>')).toContain('&lt;script&gt;');
    expect(sanitizeString(`"'&`)).toBe('&quot;&#x27;&amp;');
    expect(stripHtml('<b>Hello</b> world')).toBe('Hello world');
  });

  it('sanitizeObject sanitizes nested values and arrays', () => {
    const input = { a: '<b>1</b>', nested: [{ v: '"x"' }, 'y&z'] };
    const out = sanitizeObject(input);
    expect(out.a).toBe('&lt;b&gt;1&lt;&#x2F;b&gt;');
    expect((out as any).nested[0].v).toBe('&quot;x&quot;');
    expect((out as any).nested[1]).toBe('y&amp;z');
  });

  it('safeIdentifier cleans and validates allowlists', () => {
    expect(safeIdentifier('users', 'table')).toBe('users');
    expect(() => safeIdentifier('users;DROP TABLE users', 'table')).toThrow('Invalid table name');
    expect(() => safeIdentifier('not_allowed', 'table')).toThrow('Invalid table name');
  });

  it('escapeLikePattern escapes %, _ and backslash; generateRateLimitKey is deterministic', () => {
    expect(escapeLikePattern('%_\\abc')).toBe('\\%\\_\\\\abc');
    expect(generateRateLimitKey('login', 'user-1')).toBe('ratelimit:login:user-1');
  });

  it('generates, validates, expires and invalidates CSRF tokens', () => {
    vi.useFakeTimers();
    const sessionId = 's1';
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

    const token = generateCsrfToken(sessionId);
    expect(validateCsrfToken(sessionId, token)).toBe(true);

    invalidateCsrfToken(sessionId);
    expect(validateCsrfToken(sessionId, token)).toBe(false);

    const token2 = generateCsrfToken(sessionId);
    vi.setSystemTime(new Date('2020-01-01T02:00:00.000Z')); // > 1h
    expect(validateCsrfToken(sessionId, token2)).toBe(false);

    vi.useRealTimers();
  });

  it('validates UUID/email/integer helpers and sanitizes filenames/URLs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('bad@')).toBe(false);
    expect(isValidInteger(123)).toBe(true);
    expect(isValidInteger('456')).toBe(true);
    expect(isValidInteger('4.56')).toBe(false);
    expect(sanitizeFilename('../etc/passwd')).toBe('_etc_passwd');
    expect(sanitizeFilename('..\\evil.exe')).toContain('evil.exe'.replace(/[^a-zA-Z0-9._-]/g, '_'));
    expect(sanitizeUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('not a url')).toBeNull();
  });
});
