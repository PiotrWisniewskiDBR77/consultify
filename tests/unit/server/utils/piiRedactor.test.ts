import { describe, expect, it } from 'vitest';

import PiiRedactor, { REDACTION_PLACEHOLDER } from '../../../../server/src/utils/piiRedactor.js';

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

  it('redactKeys redacts specified keys shallowly', () => {
    const input = { a: 1, secret: 'x', nested: { secret: 'y' } };
    const redacted = PiiRedactor.redactKeys(input, ['secret']);
    expect(redacted.secret).toBe(REDACTION_PLACEHOLDER);
    expect((redacted as any).nested.secret).toBe('y');
  });

  it('createAuditSnapshot JSON-stringifies redacted output', () => {
    const input = { email: 'user@example.com' };
    const snapshot = PiiRedactor.createAuditSnapshot(input);
    expect(typeof snapshot).toBe('string');
    expect(snapshot).toContain(REDACTION_PLACEHOLDER);
    expect(snapshot).not.toContain('user@example.com');
  });
});
