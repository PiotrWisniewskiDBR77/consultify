import { describe, expect, it } from 'vitest';

import { canonicalJson, hashCanonicalJson } from '../interviewInsightFindingGenerationReceipt.js';

describe('Finding receipt canonical JSON semantic integrity', () => {
  it('preserves a JSON own __proto__ field rather than invoking an object setter', () => {
    const input = JSON.parse('{"__proto__":{"evidence":"original"},"value":1}');
    expect(JSON.parse(canonicalJson(input))).toEqual(input);
    expect(Object.hasOwn(JSON.parse(canonicalJson(input)), '__proto__')).toBe(true);
  });

  it('changes the hash when nested __proto__ evidence changes', () => {
    const original = JSON.parse('{"metadata":{"__proto__":{"evidence":"original"}}}');
    const changed = JSON.parse('{"metadata":{"__proto__":{"evidence":"changed"}}}');
    expect(hashCanonicalJson(original)).not.toBe(hashCanonicalJson(changed));
  });
});
