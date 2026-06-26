// @vitest-environment node
/**
 * W6.3/W6.4 — recipientGovernance: walidacja + opt-out + dedupe + limit odbiorców.
 */
import { describe, expect, it } from 'vitest';
import {
  governRecipients,
  isValidEmail,
} from '../../../server/src/services/deliverables/recipientGovernance';

describe('W6.3 — isValidEmail', () => {
  it('akceptuje poprawne adresy', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
    expect(isValidEmail('piotr.wisniewski@dbr77.com')).toBe(true);
  });

  it('odrzuca śmieci', () => {
    expect(isValidEmail('brak-malpy')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false); // brak TLD
    expect(isValidEmail('a@@b.com')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false); // spacja
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });
});

describe('W6.3 — governRecipients: format', () => {
  it('odrzuca niepoprawne adresy z powodem invalid_format', () => {
    const r = governRecipients(['ok@x.com', 'zły', 'a@b']);
    expect(r.allowed).toEqual(['ok@x.com']);
    expect(r.rejected).toContainEqual({ email: 'zły', reason: 'invalid_format' });
    expect(r.rejected).toContainEqual({ email: 'a@b', reason: 'invalid_format' });
  });

  it('normalizuje (trim + lowercase)', () => {
    const r = governRecipients(['  Piotr@DBR77.COM  ']);
    expect(r.allowed).toEqual(['piotr@dbr77.com']);
  });
});

describe('W6.4 — opt-out', () => {
  it('odrzuca adresy z listy opt-out (case-insensitive)', () => {
    const r = governRecipients(['a@x.com', 'b@x.com'], { optOut: ['B@X.COM'] });
    expect(r.allowed).toEqual(['a@x.com']);
    expect(r.rejected).toContainEqual({ email: 'b@x.com', reason: 'opted_out' });
  });

  it('opt-out pusty → wszyscy przechodzą', () => {
    const r = governRecipients(['a@x.com'], { optOut: [] });
    expect(r.allowed).toEqual(['a@x.com']);
  });
});

describe('W6.3 — deduplikacja', () => {
  it('usuwa duplikaty (case-insensitive)', () => {
    const r = governRecipients(['a@x.com', 'A@X.com', 'a@x.com']);
    expect(r.allowed).toEqual(['a@x.com']);
    expect(r.rejected.filter((x) => x.reason === 'duplicate')).toHaveLength(2);
  });
});

describe('W6.3 — limit', () => {
  it('odrzuca powyżej maxRecipients', () => {
    const r = governRecipients(['a@x.com', 'b@x.com', 'c@x.com'], { maxRecipients: 2 });
    expect(r.allowed).toEqual(['a@x.com', 'b@x.com']);
    expect(r.rejected).toContainEqual({ email: 'c@x.com', reason: 'over_limit' });
  });

  it('domyślny limit 100', () => {
    const many = Array.from({ length: 150 }, (_, i) => `u${i}@x.com`);
    const r = governRecipients(many);
    expect(r.allowed).toHaveLength(100);
    expect(r.rejected.filter((x) => x.reason === 'over_limit')).toHaveLength(50);
  });
});

describe('W6.3 — kolejność reguł i edge cases', () => {
  it('opt-out wygrywa nad dedupe (powód = pierwsza naruszona reguła)', () => {
    const r = governRecipients(['a@x.com', 'a@x.com'], { optOut: ['a@x.com'] });
    // oba opted_out (opt-out sprawdzany przed dedupe)
    expect(r.allowed).toEqual([]);
    expect(r.rejected.every((x) => x.reason === 'opted_out')).toBe(true);
  });

  it('niepoprawne wejście → pusty wynik', () => {
    // @ts-expect-error celowo null
    expect(governRecipients(null).allowed).toEqual([]);
    expect(governRecipients([]).allowed).toEqual([]);
  });

  it('mieszana lista — każdy powód reprezentowany', () => {
    const r = governRecipients(
      ['ok@x.com', 'zły', 'ok@x.com', 'out@x.com', 'over@x.com'],
      { optOut: ['out@x.com'], maxRecipients: 1 },
    );
    expect(r.allowed).toEqual(['ok@x.com']);
    const reasons = new Set(r.rejected.map((x) => x.reason));
    expect(reasons.has('invalid_format')).toBe(true);
    expect(reasons.has('duplicate')).toBe(true);
    expect(reasons.has('opted_out')).toBe(true);
    expect(reasons.has('over_limit')).toBe(true);
  });
});
