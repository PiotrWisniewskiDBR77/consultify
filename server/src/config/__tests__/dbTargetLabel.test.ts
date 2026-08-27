import { describe, expect, it } from 'vitest';

import { resolveDbTargetLabel } from '../dbTargetLabel.js';

describe('resolveDbTargetLabel', () => {
  it.each([
    ['keeps a valid value', 'staging-primary', 'staging-primary'],
    ['normalizes uppercase and whitespace', '  Staging Primary  ', 'staging-primary'],
    ['replaces unsupported characters', 'stage___primary...db', 'stage-primary-db'],
    ['collapses and trims separators', '--stage---primary--', 'stage-primary'],
    ['truncates to 40 characters', 'a'.repeat(50), 'a'.repeat(40)],
    ['returns unset for an empty value', '', 'unset'],
    ['returns unset for unsupported characters only', '///', 'unset'],
  ])('%s', (_name, value, expected) => {
    expect(resolveDbTargetLabel({ DB_TARGET_LABEL: value })).toBe(expected);
  });

  it('returns unset when the variable is absent', () => {
    expect(resolveDbTargetLabel({})).toBe('unset');
  });

  it('rejects a value shaped like a database URL without exposing credentials', () => {
    const result = resolveDbTargetLabel({
      DB_TARGET_LABEL: 'postgres://example-user:example-password@example.invalid/example-db',
    });

    expect(result).toBe('unset');
    expect(result).not.toContain('example-password');
    expect(result).not.toMatch(/[@:/]/);
  });

  it('never throws for an environment getter that throws', () => {
    const env = {} as Record<string, string | undefined>;
    Object.defineProperty(env, 'DB_TARGET_LABEL', {
      get() {
        throw new Error('unreadable');
      },
    });

    expect(() => resolveDbTargetLabel(env)).not.toThrow();
    expect(resolveDbTargetLabel(env)).toBe('unset');
  });
});
