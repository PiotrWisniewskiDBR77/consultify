import { describe, expect, it } from 'vitest';

import PiiRedactor, {
  DEFAULT_PII_FIELDS,
  REDACTION_PLACEHOLDER,
} from '../../../../server/src/utils/piiRedactor.ts';

describe('PiiRedactor', () => {
  it('redacts emails and JWT/Bearer tokens in plain strings', () => {
    const input = 'Email user@example.com and token Bearer abc.def.ghi should be redacted';
    const out = PiiRedactor.redact(input);
    expect(out).toContain(REDACTION_PLACEHOLDER);
    expect(out).not.toContain('user@example.com');
    expect(out).not.toContain('abc.def.ghi');
  });

  it('redacts PII keys and also redacts inline values', () => {
    const input = {
      email: 'user@example.com',
      safe: 'hello',
      nested: { authorization: 'Bearer abc.def.ghi', note: 'reach me at user@example.com' },
    };

    const out = PiiRedactor.redact(input, DEFAULT_PII_FIELDS);
    expect(out).toEqual(
      expect.objectContaining({
        email: REDACTION_PLACEHOLDER,
        safe: 'hello',
        nested: expect.objectContaining({
          authorization: REDACTION_PLACEHOLDER,
          note: expect.stringContaining(REDACTION_PLACEHOLDER),
        }),
      })
    );
  });

  it('redacts string items inside arrays', () => {
    const input = { items: ['user@example.com', 'Bearer abc.def.ghi', 123] };
    const out = PiiRedactor.redact(input);
    expect(out.items).toEqual([REDACTION_PLACEHOLDER, REDACTION_PLACEHOLDER, 123]);
  });

  it('redactKeys redacts existing keys and ignores missing keys', () => {
    const input = { a: 1, token: 'abc.def.ghi' };
    const out = PiiRedactor.redactKeys(input, ['token', 'missing']);
    expect(out).toEqual({ a: 1, token: REDACTION_PLACEHOLDER });
  });

  it('does not mutate the input object when redacting', () => {
    const input = { email: 'user@example.com', nested: { token: 'abc.def.ghi' } };
    const out = PiiRedactor.redact(input);
    expect(out).not.toBe(input);
    expect(input.email).toBe('user@example.com');
    expect((input as any).nested.token).toBe('abc.def.ghi');
  });

  it('createAuditSnapshot returns valid JSON with PII redacted', () => {
    const snapshot = PiiRedactor.createAuditSnapshot({ email: 'user@example.com' });
    expect(JSON.parse(snapshot)).toEqual({ email: REDACTION_PLACEHOLDER });
  });
});

