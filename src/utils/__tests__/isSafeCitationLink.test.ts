/**
 * Chat V9 / TRUST T-TR3-lite — unit tests for
 * `isSafeCitationLink`.
 *
 * The sanitiser is the single source of truth for what the
 * Trust Badge popover is allowed to turn into an anchor tag.
 * These tests pin the accept / reject decision for every
 * production-relevant URL shape so an accidental regression
 * (e.g. "allow relative URLs") is caught before ship.
 */

import { describe, expect, it } from 'vitest';

import { isSafeCitationLink } from '../isSafeCitationLink';

describe('isSafeCitationLink', () => {
  // -------------------------------------------------------------
  // Accept path.
  // -------------------------------------------------------------
  it('accepts a plain https URL', () => {
    expect(isSafeCitationLink('https://example.com/deck')).toBe(
      'https://example.com/deck'
    );
  });

  it('accepts a plain http URL', () => {
    expect(isSafeCitationLink('http://example.com/')).toBe('http://example.com/');
  });

  it('canonicalises whitespace-padded input', () => {
    expect(isSafeCitationLink('  https://example.com/deck  ')).toBe(
      'https://example.com/deck'
    );
  });

  it('accepts URLs with query strings and hashes', () => {
    expect(
      isSafeCitationLink('https://example.com/path?q=1&r=2#section')
    ).toBe('https://example.com/path?q=1&r=2#section');
  });

  it('accepts URLs with ports', () => {
    expect(isSafeCitationLink('https://example.com:8443/asset')).toBe(
      'https://example.com:8443/asset'
    );
  });

  // -------------------------------------------------------------
  // Reject path — type / shape.
  // -------------------------------------------------------------
  it('rejects null, undefined, numbers, booleans, objects', () => {
    expect(isSafeCitationLink(null)).toBeNull();
    expect(isSafeCitationLink(undefined)).toBeNull();
    expect(isSafeCitationLink(42)).toBeNull();
    expect(isSafeCitationLink(true)).toBeNull();
    expect(isSafeCitationLink({})).toBeNull();
    expect(isSafeCitationLink([])).toBeNull();
  });

  it('rejects empty and whitespace-only strings', () => {
    expect(isSafeCitationLink('')).toBeNull();
    expect(isSafeCitationLink('   ')).toBeNull();
    expect(isSafeCitationLink('\t\n')).toBeNull();
  });

  it('rejects malformed URL strings', () => {
    expect(isSafeCitationLink('not a url')).toBeNull();
    expect(isSafeCitationLink('http://')).toBeNull();
    expect(isSafeCitationLink('://missing-scheme')).toBeNull();
  });

  // -------------------------------------------------------------
  // Reject path — scheme.
  // -------------------------------------------------------------
  it('rejects javascript: URLs (lowercase)', () => {
    expect(isSafeCitationLink('javascript:alert(1)')).toBeNull();
  });

  it('rejects javascript: URLs (mixed case)', () => {
    expect(isSafeCitationLink('JavaScript:alert(1)')).toBeNull();
    expect(isSafeCitationLink('JAVASCRIPT:alert(1)')).toBeNull();
  });

  it('rejects javascript: URLs with leading whitespace', () => {
    expect(isSafeCitationLink('  javascript:alert(1)')).toBeNull();
  });

  it('rejects data: URLs', () => {
    expect(
      isSafeCitationLink('data:text/html,<script>alert(1)</script>')
    ).toBeNull();
  });

  it('rejects vbscript:, file:, about:, blob: URLs', () => {
    expect(isSafeCitationLink('vbscript:msgbox(1)')).toBeNull();
    expect(isSafeCitationLink('file:///etc/passwd')).toBeNull();
    expect(isSafeCitationLink('about:blank')).toBeNull();
    expect(isSafeCitationLink('blob:https://example.com/123')).toBeNull();
  });

  it('rejects mailto: and tel: (not sources the user should open from the badge)', () => {
    expect(isSafeCitationLink('mailto:a@b.c')).toBeNull();
    expect(isSafeCitationLink('tel:+48-111-222-333')).toBeNull();
  });

  it('rejects relative URLs', () => {
    expect(isSafeCitationLink('/asset/x')).toBeNull();
    expect(isSafeCitationLink('./sibling.md')).toBeNull();
    expect(isSafeCitationLink('../parent.md')).toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    // `//example.com` is technically spec-valid in some browsers
    // from the URL constructor's POV, but it resolves against the
    // current location and is not a self-contained source. We
    // conservatively reject.
    expect(isSafeCitationLink('//example.com/path')).toBeNull();
  });

  // -------------------------------------------------------------
  // Returns trimmed + canonical form.
  // -------------------------------------------------------------
  it('returns the URL constructor canonical form', () => {
    // The URL constructor normalises missing trailing slash on
    // host-only URLs; we return that canonical form so consumers
    // always see the same string for the same input.
    expect(isSafeCitationLink('HTTPS://Example.COM')).toBe('https://example.com/');
  });
});
