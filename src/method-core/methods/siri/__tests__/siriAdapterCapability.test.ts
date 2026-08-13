import { describe, expect, it } from 'vitest';

import { SIRI_PRIORITISATION_AREAS } from '@/services/siriStructure';

import { getSiriLevelCanonicalText } from '../siriAdapter';

describe('SIRI adapter — AdapterCapability<T> honest refusal (contracts/methodPack.ts)', () => {
  it('every one of the 16 dimensions x 6 bands returns { supported: false, reason: "EVIDENCE_MISSING" } — never a guessed value', () => {
    let checked = 0;
    for (const area of SIRI_PRIORITISATION_AREAS) {
      for (let level = 0; level <= 5; level++) {
        const capability = getSiriLevelCanonicalText(area.id, level);
        expect(capability.supported).toBe(false);
        if (!capability.supported) {
          expect(capability.reason).toBe('EVIDENCE_MISSING');
          // The refusal shape has no `value` field at all — a caller cannot
          // accidentally read fabricated text off a `{supported:false}` result.
          expect('value' in capability).toBe(false);
        }
        checked += 1;
      }
    }
    expect(checked).toBe(16 * 6);
  });

  it('an unknown unitId is a structurally different refusal: NOT_LICENSED, not EVIDENCE_MISSING', () => {
    const capability = getSiriLevelCanonicalText('not_a_real_siri_dimension', 3);
    expect(capability.supported).toBe(false);
    if (!capability.supported) {
      expect(capability.reason).toBe('NOT_LICENSED');
    }
  });

  it('a level outside the 0-5 Band scale is also NOT_LICENSED — no silent clamping to a nearby band', () => {
    const capability = getSiriLevelCanonicalText('vertical_integration', 9);
    expect(capability.supported).toBe(false);
    if (!capability.supported) {
      expect(capability.reason).toBe('NOT_LICENSED');
    }
  });
});
