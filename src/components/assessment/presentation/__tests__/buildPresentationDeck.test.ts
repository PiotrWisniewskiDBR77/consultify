/**
 * buildPresentationDeck — pure derivation tests. Every assertion checks that
 * a slide field is a verbatim copy or a simple filter/sort of something
 * already on the frozen `AssessmentOutput`, never a new computation — the
 * worker brief's "zero przeliczania w komponencie" rule made concrete.
 */
import { describe, expect, it } from 'vitest';

import { makeEvidence, makeFinding, makeOutput } from '@/method-core/outputs/__tests__/testFixtures';

import { buildPresentationDeck } from '../buildPresentationDeck';

describe('buildPresentationDeck', () => {
  it('copies methodology, scope and frozenAt verbatim from the Output', () => {
    const output = makeOutput({
      methodology: { methodPackId: 'siri', version: '2.1.0' },
      scope: 'Segment Manufacturing — pilot',
      frozenAt: '2026-08-01T10:00:00.000Z',
    });
    const model = buildPresentationDeck(output);
    expect(model.methodPackId).toBe('siri');
    expect(model.methodPackVersion).toBe('2.1.0');
    expect(model.scope).toBe('Segment Manufacturing — pilot');
    expect(model.frozenAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('overallResult is the average of aggregation.byGroup (same math buildReportSnapshot already uses)', () => {
    const output = makeOutput({
      aggregation: {
        byGroup: { d1: 2, d2: 4 },
        mappingVersion: '1.0.0',
        rule: 'weighted-mean',
        excluded: {},
      },
    });
    const model = buildPresentationDeck(output);
    expect(model.overallResult).toBe(3);
  });

  it('dimensionProfile mirrors aggregation.byGroup, sorted by level descending', () => {
    const output = makeOutput({
      aggregation: {
        byGroup: { d1: 1, d2: 5, d3: 3 },
        mappingVersion: '1.0.0',
        rule: 'weighted-mean',
        excluded: {},
      },
    });
    const model = buildPresentationDeck(output);
    expect(model.dimensionProfile.map((d) => d.groupId)).toEqual(['d2', 'd3', 'd1']);
    expect(model.dimensionProfile.map((d) => d.currentLevel)).toEqual([5, 3, 1]);
  });

  it('strengths = accepted findings with gap <= 0; gapsAndRisks = accepted findings with gap > 0', () => {
    const metTarget = makeFinding({
      id: 'f-met',
      unitId: 'u-met',
      unitName: 'Met target',
      gap: 0,
      currentLevel: 4,
      businessMeaning: 'Fully standardized.',
    });
    const behindTarget = makeFinding({
      id: 'f-behind',
      unitId: 'u-behind',
      unitName: 'Behind target',
      gap: 2,
      riskOrOpportunity: 'Manual process risks data drift.',
    });
    const output = makeOutput({
      findings: [metTarget, behindTarget],
      current: { 'u-met': 4, 'u-behind': 1 },
      target: { 'u-met': 4, 'u-behind': 3 },
      gap: { 'u-met': 0, 'u-behind': 2 },
    });
    const model = buildPresentationDeck(output);
    expect(model.strengths).toHaveLength(1);
    expect(model.strengths[0].unitId).toBe('u-met');
    expect(model.strengths[0].text).toBe('Fully standardized.');
    expect(model.gapsAndRisks).toHaveLength(1);
    expect(model.gapsAndRisks[0].unitId).toBe('u-behind');
    expect(model.gapsAndRisks[0].text).toBe('Manual process risks data drift.');
  });

  it('excludes draft (needs-evidence, E0-supported) findings from strengths/gapsAndRisks/recommendations', () => {
    const draft = makeFinding({
      id: 'f-draft',
      unitId: 'u-draft',
      gap: 2,
      supportingEvidence: [makeEvidence({ strength: 'E0' })],
    });
    const output = makeOutput({ findings: [draft], current: { 'u-draft': 1 }, target: { 'u-draft': 3 }, gap: { 'u-draft': 2 } });
    const model = buildPresentationDeck(output);
    expect(model.strengths).toHaveLength(0);
    expect(model.gapsAndRisks).toHaveLength(0);
    expect(model.recommendations).toHaveLength(0);
    expect(model.draftFindingCount).toBe(1);
  });

  it('unknowns.unknownUnits lists units whose current level is null, using the finding name when available', () => {
    const finding = makeFinding({ id: 'f-1', unitId: 'u-known', unitName: 'Known unit', gap: 1 });
    const output = makeOutput({
      findings: [finding],
      current: { 'u-known': 2, 'u-unscored': null },
      target: { 'u-known': 3, 'u-unscored': 3 },
      gap: { 'u-known': 1, 'u-unscored': null },
    });
    const model = buildPresentationDeck(output);
    expect(model.unknowns.unknownUnits).toEqual([{ unitId: 'u-unscored', unitName: null }]);
  });

  it('unknowns has no reasonBreakdown when none is supplied, and carries it verbatim when it is', () => {
    const output = makeOutput();
    const withoutBreakdown = buildPresentationDeck(output);
    expect(withoutBreakdown.unknowns.reasonBreakdown).toBeUndefined();

    const withBreakdown = buildPresentationDeck(output, {}, { dontKnow: 3, noEvidence: 5 });
    expect(withBreakdown.unknowns.reasonBreakdown).toEqual({ dontKnow: 3, noEvidence: 5 });
  });

  it('narrative fields are never invented — undefined stays undefined end-to-end', () => {
    const output = makeOutput();
    const model = buildPresentationDeck(output);
    expect(model.narrative.clientName).toBeUndefined();
    expect(model.narrative.businessQuestion).toBeUndefined();
    expect(model.narrative.participants).toBeUndefined();
  });

  it('narrative fields, when supplied, pass through unchanged', () => {
    const output = makeOutput();
    const model = buildPresentationDeck(output, {
      clientName: 'Acme Sp. z o.o.',
      businessQuestion: 'Czy jesteśmy gotowi na AI w procesach core?',
      participants: ['Piotr (Owner)', 'Anna (Approver)'],
    });
    expect(model.narrative.clientName).toBe('Acme Sp. z o.o.');
    expect(model.narrative.businessQuestion).toBe('Czy jesteśmy gotowi na AI w procesach core?');
    expect(model.narrative.participants).toEqual(['Piotr (Owner)', 'Anna (Approver)']);
  });

  it('limitations are copied verbatim from the Output', () => {
    const output = makeOutput({ limitations: ['No evidence for axis 6.', 'Self-reported only.'] });
    const model = buildPresentationDeck(output);
    expect(model.limitations).toEqual(['No evidence for axis 6.', 'Self-reported only.']);
  });
});
