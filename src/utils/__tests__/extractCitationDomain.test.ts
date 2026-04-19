/**
 * Chat V9 / TRUST T-TR3.4 — tests for `extractCitationDomain`.
 *
 * Pins the full accept / reject contract:
 *
 *   Accept (returns a lowercased hostname):
 *     - `https://example.com`                → `example.com`
 *     - `http://example.com`                 → `example.com`
 *     - `https://www.example.com/path?q=1`   → `example.com`
 *     - `https://EXAMPLE.com`                → `example.com`
 *     - `https://sub.example.com`            → `sub.example.com`
 *     - `https://example.com:8443/foo`       → `example.com`
 *     - Surrounding whitespace is trimmed.
 *
 *   Reject (returns `null`):
 *     - non-strings (null, number, object, undefined)
 *     - empty / whitespace-only strings
 *     - `javascript:alert(1)`, `data:…`, `vbscript:…`,
 *       `file:///etc/passwd`, `about:blank`, `blob:https://…`
 *     - `ftp://example.com`
 *     - malformed URLs (`not a url`, bare `example.com`)
 *     - schemes without a hostname (`https://`, `http:///x`)
 *
 * We also pin:
 *     - `www1.example.com` keeps the `www1.` prefix (we only
 *       strip the bare `www.`), matching the product choice
 *       to de-duplicate "two names for the same source"
 *       without being aggressive about subdomains.
 */

import { describe, expect, it } from 'vitest';

import { extractCitationDomain } from '../extractCitationDomain';

describe('extractCitationDomain — accepts', () => {
  it('returns the lowercased hostname for a simple https URL', () => {
    expect(extractCitationDomain('https://example.com')).toBe('example.com');
  });

  it('returns the lowercased hostname for a simple http URL', () => {
    expect(extractCitationDomain('http://example.com')).toBe('example.com');
  });

  it('strips a leading `www.` prefix', () => {
    expect(extractCitationDomain('https://www.example.com/foo/bar')).toBe('example.com');
  });

  it('lowercases mixed-case hostnames', () => {
    expect(extractCitationDomain('https://EXAMPLE.COM')).toBe('example.com');
  });

  it('preserves non-www subdomains', () => {
    expect(extractCitationDomain('https://news.ycombinator.com')).toBe(
      'news.ycombinator.com'
    );
  });

  it('ignores path, query, and fragment', () => {
    expect(
      extractCitationDomain('https://example.com/path/deep?q=1#frag')
    ).toBe('example.com');
  });

  it('drops the port', () => {
    expect(extractCitationDomain('https://example.com:8443/foo')).toBe(
      'example.com'
    );
  });

  it('trims surrounding whitespace', () => {
    expect(extractCitationDomain('   https://example.com   ')).toBe('example.com');
  });

  it('does NOT strip `www1.` (only the bare `www.` prefix is a product choice)', () => {
    expect(extractCitationDomain('https://www1.example.com')).toBe(
      'www1.example.com'
    );
  });
});

describe('extractCitationDomain — rejects', () => {
  it('returns null for non-string input', () => {
    expect(extractCitationDomain(null)).toBeNull();
    expect(extractCitationDomain(undefined)).toBeNull();
    expect(extractCitationDomain(42)).toBeNull();
    expect(extractCitationDomain({})).toBeNull();
    expect(extractCitationDomain([])).toBeNull();
  });

  it('returns null for empty or whitespace-only strings', () => {
    expect(extractCitationDomain('')).toBeNull();
    expect(extractCitationDomain('   ')).toBeNull();
    expect(extractCitationDomain('\t\n')).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>1</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank',
    'blob:https://example.com/abc',
  ])('returns null for dangerous protocol: %s', (input) => {
    expect(extractCitationDomain(input)).toBeNull();
  });

  it('returns null for non-http(s) allowed protocols', () => {
    expect(extractCitationDomain('ftp://example.com')).toBeNull();
    expect(extractCitationDomain('mailto:someone@example.com')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(extractCitationDomain('not a url')).toBeNull();
    expect(extractCitationDomain('example.com')).toBeNull();
    expect(extractCitationDomain('https://')).toBeNull();
  });
});
