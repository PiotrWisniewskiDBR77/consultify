/**
 * S1.14b / B2 — an access block must reach the user as a sentence, not a code.
 *
 * Measured on staging 13.09 (QA org, TRIAL): every Teresa question ended with the
 * literal bubble text "⚠️ Access blocked (TRIAL_PROFILE_INCOMPLETE)." — the raw
 * machine code, interpolated into the message. `accessBlockedSentence` is the one
 * place that turns a code into the catalog sentence (en + pl), with
 * `access.blocked.default` as the only fallback.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { describe, expect, it } from 'vitest';

const t = (key: string, opts?: { defaultValue?: string }) => {
  const catalog: Record<string, string> = {
    'access.blocked.TRIAL_PROFILE_INCOMPLETE':
      'Complete organization setup to start your trial AI experience.',
    'access.blocked.default': 'Access to this feature is blocked.',
  };
  if (catalog[key]) return catalog[key];
  return opts?.defaultValue ?? key;
};

import { accessBlockedSentence } from '../accessBlocked';

describe('S1.14b/B2 — accessBlockedSentence', () => {
  it('returns the catalog sentence for a known code and never the code itself', () => {
    const line = accessBlockedSentence(t, 'TRIAL_PROFILE_INCOMPLETE');
    expect(line).toBe('Complete organization setup to start your trial AI experience.');
    expect(line).not.toContain('TRIAL_PROFILE_INCOMPLETE');
  });

  it('falls back to the default sentence for an unknown code, not to the code', () => {
    const line = accessBlockedSentence(t, 'SOME_NEW_CODE');
    expect(line).toBe('Access to this feature is blocked.');
    expect(line).not.toContain('SOME_NEW_CODE');
  });

  it('handles a missing code without emitting an empty bubble', () => {
    expect(accessBlockedSentence(t, undefined)).toBe('Access to this feature is blocked.');
  });
});

/**
 * Wiring contract: the chat stream branch is the surface that actually showed the
 * code to the user. `Api` is globally mocked in tests/setup.ts, so the wire is
 * pinned at the source level rather than by calling a vi.fn().
 */
describe('S1.14b/B2 — chat stream renders the sentence, not the code', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/services/api.ts'), 'utf8');

  it('no longer interpolates the raw code into the assistant bubble', () => {
    expect(source).not.toContain('Access blocked (${data.code})');
    expect(source).not.toContain('Brak dostępu (${data.code})');
  });

  it('builds the access-block bubble through accessBlockedSentence', () => {
    expect(source).toContain('accessBlockedSentence(');
    expect(source).toMatch(/accessBlockedSentence\([\s\S]{0,160}dataCode/);
  });
});
