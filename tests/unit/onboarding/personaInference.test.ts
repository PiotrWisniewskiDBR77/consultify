import { describe, expect, it } from 'vitest';

import { resolvePersonaFromProfile } from '@/services/onboarding/personaInference';

describe('resolvePersonaFromProfile', () => {
  it('detects CFO from title keywords', () => {
    expect(resolvePersonaFromProfile({ title: 'Group CFO' })).toEqual({
      persona: 'CFO',
      confidence: 'medium',
    });
  });

  it('uses high confidence when both title and group match', () => {
    expect(
      resolvePersonaFromProfile({
        title: 'Chief Information Security Officer',
        groups: ['security-leadership'],
      })
    ).toEqual({
      persona: 'CISO',
      confidence: 'high',
    });
  });

  it('falls back to Transformation Officer when unknown', () => {
    expect(resolvePersonaFromProfile({ title: 'Special Projects Lead' })).toEqual({
      persona: 'Transformation Officer',
      confidence: 'low',
    });
  });
});
