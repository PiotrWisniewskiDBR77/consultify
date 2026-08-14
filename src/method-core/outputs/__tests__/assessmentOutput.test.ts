/**
 * Covers canon tests 1, 3, 4, 9 from the A8 task brief:
 *  1. Output is immutable — mutation attempt is rejected (thrown, not silent).
 *  3. content_hash is deterministic across repeated runs, INCLUDING when the
 *     findings/evidence array order varies between runs (the exact shape of
 *     the documented 6-7-hashes-from-10-runs defect).
 *  4. Output without limitations and without methodology version is rejected.
 *  9. a finding without contradicting evidence is allowed; without
 *     supporting evidence it is not.
 */
import { describe, expect, it } from 'vitest';
import { createAssessmentOutput, OutputValidationError, recomputeOutputContentHash } from '../assessmentOutput';
import { assertFindingIsValid, createFinding, FindingValidationError } from '../finding';
import { makeEvidence, makeFinding, makeOutput, makeOutputInput } from './testFixtures';

describe('AssessmentOutput — immutability (test 1)', () => {
  it('rejects a top-level property mutation with a thrown error', () => {
    const output = makeOutput();
    expect(() => {
      (output as { scope: string }).scope = 'tampered scope';
    }).toThrow(TypeError);
  });

  it('rejects mutating a nested array (limitations)', () => {
    const output = makeOutput();
    expect(() => {
      (output.limitations as string[]).push('sneaked-in limitation');
    }).toThrow(TypeError);
  });

  it('rejects mutating a nested finding object', () => {
    const output = makeOutput();
    const finding = output.findings[0];
    expect(() => {
      (finding as { recommendation: string }).recommendation = 'rewritten recommendation';
    }).toThrow(TypeError);
  });

  it('rejects mutating deeply nested evidence inside a finding', () => {
    const output = makeOutput();
    const evidence = output.findings[0].supportingEvidence[0];
    expect(() => {
      (evidence as { strength: string }).strength = 'E4';
    }).toThrow(TypeError);
  });

  it('exposes no update/patch function anywhere in the package', async () => {
    const mod = await import('../index');
    const exportedNames = Object.keys(mod);
    const suspicious = exportedNames.filter((n) => /update|patch|mutate/i.test(n));
    expect(suspicious).toEqual([]);
  });

  it('a revision is a brand new Output object, never the old one changed', () => {
    const original = makeOutput({ id: 'output-1', version: 1 });
    const revised = makeOutput({
      id: 'output-2',
      version: 2,
      lineage: {
        sourceSessionId: 'session-1',
        sourceRevisionOfSessionId: 'session-1-rev',
        revisionOfOutputId: original.id,
        supersededByOutputId: null,
      },
    });
    expect(revised).not.toBe(original);
    expect(revised.lineage.revisionOfOutputId).toBe(original.id);
    // The original is completely untouched by the existence of the revision.
    expect(original.version).toBe(1);
    expect(original.lineage.supersededByOutputId).toBeNull();
  });
});

describe('AssessmentOutput — deterministic content hash (test 3)', () => {
  it('produces the SAME hash across 10 runs with identical input', () => {
    const input = makeOutputInput();
    const hashes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      hashes.add(createAssessmentOutput({ ...input, id: `run-${i}` } as typeof input).contentHash);
    }
    expect(hashes.size).toBe(1);
  });

  it('produces the SAME hash across 10 runs even when the findings array order is shuffled', () => {
    const findingA = makeFinding({ id: 'finding-a' });
    const findingB = makeFinding({ id: 'finding-b' });
    const findingC = makeFinding({ id: 'finding-c' });

    const orders = [
      [findingA, findingB, findingC],
      [findingC, findingA, findingB],
      [findingB, findingC, findingA],
      [findingA, findingC, findingB],
    ];

    const hashes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const findings = orders[i % orders.length];
      const output = createAssessmentOutput(makeOutputInput({ id: `run-${i}`, findings }));
      hashes.add(output.contentHash);
    }
    expect(hashes.size).toBe(1);
  });

  it('produces the SAME hash even when per-finding evidence array order is shuffled', () => {
    const e1 = makeEvidence({ evidenceId: 'ev-1' });
    const e2 = makeEvidence({ evidenceId: 'ev-2' });
    const orders = [
      [e1, e2],
      [e2, e1],
    ];
    const hashes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const finding = makeFinding({ id: 'finding-shared', supportingEvidence: orders[i % 2] });
      const output = createAssessmentOutput(makeOutputInput({ id: `run-${i}`, findings: [finding] }));
      hashes.add(output.contentHash);
    }
    expect(hashes.size).toBe(1);
  });

  it('recomputing the hash from the constructed Output reproduces the stored hash', () => {
    const output = makeOutput();
    expect(recomputeOutputContentHash(output)).toBe(output.contentHash);
  });

  it('a genuinely different Output produces a different hash', () => {
    const a = makeOutput({ id: 'a', scope: 'Scope A' });
    const b = makeOutput({ id: 'b', scope: 'Scope B — materially different' });
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});

describe('AssessmentOutput — validation gate (test 4)', () => {
  it('rejects an Output with no limitations', () => {
    expect(() => createAssessmentOutput(makeOutputInput({ limitations: [] }))).toThrow(
      OutputValidationError
    );
  });

  it('rejects an Output with no methodology version', () => {
    expect(() =>
      createAssessmentOutput(
        makeOutputInput({ methodology: { methodPackId: 'drd', version: '' } })
      )
    ).toThrow(OutputValidationError);
  });

  it('rejects an Output missing both limitations and methodology version, listing both reasons', () => {
    try {
      createAssessmentOutput(
        makeOutputInput({ limitations: [], methodology: { methodPackId: 'drd', version: '' } })
      );
      expect.unreachable('expected OutputValidationError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OutputValidationError);
      const validationError = err as OutputValidationError;
      expect(validationError.reasons.some((r) => /limitations/.test(r))).toBe(true);
      expect(validationError.reasons.some((r) => /methodology.version/.test(r))).toBe(true);
    }
  });

  it('accepts an Output with limitations and a methodology version present', () => {
    expect(() => createAssessmentOutput(makeOutputInput())).not.toThrow();
  });
});

describe('Finding — supporting vs contradicting evidence rule (test 9)', () => {
  it('allows a finding with supporting evidence and NO contradicting evidence', () => {
    const finding = makeFinding({ supportingEvidence: [makeEvidence()], contradictingEvidence: [] });
    expect(() => assertFindingIsValid(finding)).not.toThrow();
    expect(() => createFinding(finding)).not.toThrow();
  });

  it('rejects a finding with NO supporting evidence, even if contradicting evidence exists', () => {
    const finding = makeFinding({
      supportingEvidence: [],
      contradictingEvidence: [makeEvidence({ evidenceId: 'contra-1' })],
    });
    expect(() => assertFindingIsValid(finding)).toThrow(FindingValidationError);
  });

  it('rejects a finding with no evidence at all', () => {
    const finding = makeFinding({ supportingEvidence: [], contradictingEvidence: [] });
    expect(() => assertFindingIsValid(finding)).toThrow(FindingValidationError);
  });

  it('an Output containing an invalid finding is rejected end to end', () => {
    const badFinding = makeFinding({ supportingEvidence: [] });
    expect(() => createAssessmentOutput(makeOutputInput({ findings: [badFinding] }))).toThrow(
      OutputValidationError
    );
  });
});
