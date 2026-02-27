import { describe, expect, it } from 'vitest';

import PiiRedactor, { REDACTION_PLACEHOLDER } from '../../../../server/src/utils/piiRedactor.ts';

describe('server utils/piiRedactor', () => {
  it('redacts known PII keys (deep)', () => {
    const input = {
      email: 'user@example.com',
      profile: { firstName: 'John', lastName: 'Doe', role: 'admin' },
      password: 'secret',
    };

    const redacted = PiiRedactor.redact(input);

    expect(redacted.email).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).password).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).profile.firstName).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).profile.lastName).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).profile.role).toBe('admin');
  });

  it('does not mutate the original object', () => {
    const input = { email: 'user@example.com', nested: { token: 'abc.def.ghi' } };
    const copy = JSON.parse(JSON.stringify(input));
    PiiRedactor.redact(input);
    expect(input).toEqual(copy);
  });

  it('redacts inline emails and JWT-like tokens inside strings', () => {
    const input = {
      message: 'Contact me at user@example.com and use token abc.def.ghi',
    };

    const redacted = PiiRedactor.redact(input);
    expect((redacted as any).message).not.toContain('user@example.com');
    expect((redacted as any).message).not.toContain('abc.def.ghi');
    expect((redacted as any).message).toContain(REDACTION_PLACEHOLDER);
  });

  it.each([
    'Bearer abc.def.ghi',
    'abc.def.ghi',
    'BEARER abc.def.ghi',
    'Bearer abc-DEF_123.def-456_GHI.789-jkl_MNO',
    'prefix abc.def.ghi suffix',
  ])('redacts token variant in free text: %s', (tokenish) => {
    const out = PiiRedactor.redact(`token=${tokenish}`) as any;
    expect(String(out)).toContain(REDACTION_PLACEHOLDER);
    expect(String(out)).not.toContain('abc.def.ghi');
  });

  it.each([
    'user@example.com',
    'USER@EXAMPLE.COM',
    'user.name+tag@sub.example.co.uk',
    'u@e.io',
  ])('redacts email variant in free text: %s', (email) => {
    const out = PiiRedactor.redact(`contact:${email}`) as any;
    expect(String(out)).toContain(REDACTION_PLACEHOLDER);
    expect(String(out)).not.toContain(email);
  });

  it('redactEmails redacts multiple emails in one string', () => {
    const out = PiiRedactor.redactEmails('a@a.io b@b.io') as any;
    expect(String(out)).toBe(`${REDACTION_PLACEHOLDER} ${REDACTION_PLACEHOLDER}`);
  });

  it('redactTokens redacts multiple JWT-like tokens in one string', () => {
    const out = PiiRedactor.redactTokens('a.b.c x.y.z') as any;
    expect(String(out)).toBe(`${REDACTION_PLACEHOLDER} ${REDACTION_PLACEHOLDER}`);
  });

  it.each([
    ['EmailAddress', 'user@example.com'],
    ['user_email', 'user@example.com'],
    ['phoneNumber', '+1 555 123 4567'],
    ['apiKeyValue', 'sk_live_123'],
    ['authorizationHeader', 'Bearer abc.def.ghi'],
  ])('redacts PII-ish key by substring match: %s', (key, value) => {
    const input: any = { [key]: value, ok: 'safe' };
    const redacted: any = PiiRedactor.redact(input);
    expect(redacted[key]).toBe(REDACTION_PLACEHOLDER);
    expect(redacted.ok).toBe('safe');
  });

  it('redacts nested arrays (array-of-arrays) by walking array indices', () => {
    const input = {
      payload: [['user@example.com'], ['ok', 'Bearer abc.def.ghi']],
    };
    const out: any = PiiRedactor.redact(input);
    expect(out.payload[0][0]).toBe(REDACTION_PLACEHOLDER);
    expect(out.payload[1][0]).toBe('ok');
    expect(out.payload[1][1]).toBe(REDACTION_PLACEHOLDER);
  });

  it('redacts primitive string values (not only object fields)', () => {
    const input = 'email user@example.com token abc.def.ghi';
    const out = PiiRedactor.redact(input);
    expect(out).not.toContain('user@example.com');
    expect(out).not.toContain('abc.def.ghi');
    expect(out).toContain(REDACTION_PLACEHOLDER);
  });

  it('returns non-object non-string primitive values unchanged', () => {
    expect(PiiRedactor.redact(123 as any)).toBe(123);
    expect(PiiRedactor.redact(true as any)).toBe(true);
  });

  it('returns null/undefined unchanged', () => {
    expect(PiiRedactor.redact(null as any)).toBeNull();
    expect(PiiRedactor.redact(undefined as any)).toBeUndefined();
  });

  it('redacts nested array string items and object items', () => {
    const input = {
      events: ['user@example.com', { authorization: 'Bearer abc.def.ghi' }, 'ok'],
    };
    const redacted = PiiRedactor.redact(input);
    expect((redacted as any).events[0]).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).events[1].authorization).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).events[2]).toBe('ok');
  });

  it('redacts array string items even when key is not PII-ish', () => {
    const input = { items: ['user@example.com', 'abc.def.ghi'] };
    const out: any = PiiRedactor.redact(input);
    expect(out.items).toEqual([REDACTION_PLACEHOLDER, REDACTION_PLACEHOLDER]);
  });

  it('redactKeys redacts specified keys shallowly', () => {
    const input = { a: 1, secret: 'x', nested: { secret: 'y' } };
    const redacted = PiiRedactor.redactKeys(input, ['secret']);
    expect(redacted.secret).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).nested.secret).toBe('y');
  });

  it('redactKeys does not add missing keys (no-op for absent)', () => {
    const input: any = { a: 1 };
    const redacted: any = PiiRedactor.redactKeys(input, ['missing']);
    expect(redacted).toEqual({ a: 1 });
  });

  it('createAuditSnapshot JSON-stringifies redacted output', () => {
    const input = { email: 'user@example.com' };
    const snapshot = PiiRedactor.createAuditSnapshot(input);
    expect(typeof snapshot).toBe('string');
    expect(snapshot).toContain(REDACTION_PLACEHOLDER);
    expect(snapshot).not.toContain('user@example.com');
  });

  it('redact supports array roots (does not throw, does not mutate)', () => {
    const input: any[] = [{ email: 'user@example.com' }, 'abc.def.ghi'];
    const copy = JSON.parse(JSON.stringify(input));
    const out = PiiRedactor.redact(input as any);
    expect(Array.isArray(out)).toBe(true);
    expect(input).toEqual(copy);
  });

  it('redactEmails returns non-string inputs unchanged (runtime guard)', () => {
    expect((PiiRedactor as any).redactEmails(123)).toBe(123);
  });

  it('redactTokens returns non-string inputs unchanged (runtime guard)', () => {
    expect((PiiRedactor as any).redactTokens({ a: 1 })).toEqual({ a: 1 });
  });

  it('redactKeys returns non-object inputs unchanged (runtime guard)', () => {
    expect((PiiRedactor as any).redactKeys(null, ['x'])).toBeNull();
    expect((PiiRedactor as any).redactKeys(123, ['x'])).toBe(123);
  });

  it('_redactRecursive no-ops on non-objects (runtime guard)', () => {
    expect(() => (PiiRedactor as any)._redactRecursive(null, ['email'])).not.toThrow();
    expect(() => (PiiRedactor as any)._redactRecursive('x', ['email'])).not.toThrow();
  });

  it('_redactRecursive redacts string items inside arrays (direct coverage of array branch)', () => {
    const obj: any = { arr: ['user@example.com', 'abc.def.ghi', 'ok'] };
    (PiiRedactor as any)._redactRecursive(obj, []);
    expect(obj.arr).toEqual([REDACTION_PLACEHOLDER, REDACTION_PLACEHOLDER, 'ok']);
  });
});
