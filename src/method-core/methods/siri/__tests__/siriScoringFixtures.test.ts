/**
 * Runs every `ScoringFixture` compiled by `compileSiriPack.ts`
 * (`buildSiriScoringFixtures`) THROUGH `siriAdapter.computeScore` and
 * asserts the result matches `expected` — including the two 80%-boundary
 * fixtures (`siri-8020-boundary-exact-80` / `siri-8020-boundary-just-below-80`),
 * which previously existed only as unexecuted fixture DATA (see
 * `siriMethodPack.test.ts`'s `compileSiriPack().pack.scoringFixtures` checks,
 * which only assert fixture COUNT/kind coverage, never run them). A golden
 * case that is never executed is not a proof of the 80:20 rule at the
 * boundary — this file closes that gap.
 */
import { describe, expect, it } from 'vitest';

import type { ScoringInput } from '../../../contracts';
import { buildSiriScoringFixtures } from '../compileSiriPack';
import { siriAdapter } from '../siriAdapter';

describe('SIRI scoring fixtures — golden cases actually executed through computeScore()', () => {
  const fixtures = buildSiriScoringFixtures();

  it('the pack ships at least one fixture of each kind (valid/boundary/invalid)', () => {
    const kinds = new Set(fixtures.map((f) => f.kind));
    expect(kinds.has('valid')).toBe(true);
    expect(kinds.has('boundary')).toBe(true);
    expect(kinds.has('invalid')).toBe(true);
  });

  for (const fixture of fixtures) {
    it(`[${fixture.kind}] ${fixture.fixtureId} — ${fixture.description}`, () => {
      const result = siriAdapter.computeScore(fixture.input as ScoringInput);
      const expected = fixture.expected as { proposedLevel: number | null; verdict: string };
      expect(result.proposedLevel).toBe(expected.proposedLevel);
      expect(result.verdict).toBe(expected.verdict);
    });
  }

  it('boundary pair: exactly 80% (4/5) satisfies a Band, 60% (3/5) does not — the threshold is a cliff, not a gradient', () => {
    const exact80 = fixtures.find((f) => f.fixtureId === 'siri-8020-boundary-exact-80');
    const justBelow = fixtures.find((f) => f.fixtureId === 'siri-8020-boundary-just-below-80');
    expect(exact80).toBeDefined();
    expect(justBelow).toBeDefined();

    const exactResult = siriAdapter.computeScore(exact80!.input as ScoringInput);
    const belowResult = siriAdapter.computeScore(justBelow!.input as ScoringInput);

    // Same Band-0 base, only Band-1's ratio differs (4/5=80% vs 3/5=60%) —
    // isolates the boundary itself rather than an unrelated input change.
    expect(exactResult.proposedLevel).toBe(1);
    expect(belowResult.proposedLevel).toBe(0);
  });
});
