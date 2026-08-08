import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildFinalDeck,
  buildFinalDocument,
  stableFactsJson,
  type TransformationFinalOutputFacts,
} from '../transformationFinalOutputService.js';

const facts: TransformationFinalOutputFacts = {
  outputContractVersion: 'consultify-transformation-final-v3',
  transformationCaseId: 'case-1',
  caseVersion: 24,
  lineageId: 'lineage-1',
  mandate: 'Skrócić czas akceptacji.',
  lifecycleStage: 'final_outputs',
  initiative: { name: 'Szybsza akceptacja', status: 'DONE' },
  execution: {
    tasks: { completed: 3, total: 3 },
    milestones: { completed: 3, total: 3 },
  },
  benefits: {
    total: 1,
    verified: 1,
    verifiedMeasurements: 2,
    measurementWindowDays: 31,
  },
  finance: {
    status: 'approved',
    currency: 'PLN',
    capex: 100000,
    opexAnnual: 20000,
    forecastBenefitAnnual: 300000,
    actualBenefitAnnual: 330000,
    actualVsForecastPct: 110,
  },
  kpi: {
    name: 'Czas akceptacji',
    unit: 'dni',
    baseline: 10,
    target: 5,
    actual: 4,
    direction: 'LOWER_IS_BETTER',
    status: 'on_target',
  },
  recovery: { status: 'resolved', openCards: 0, unresolvedExperiments: 0 },
  evidence: { auditEvents: 23, activePlanId: 'plan-1' },
};

describe('transformation final output builders', () => {
  it('uses one deterministic facts payload for both formats', () => {
    const json = stableFactsJson(facts);
    const factsDigest = createHash('sha256').update(json).digest('hex');
    const now = '2026-08-07T12:00:00.000Z';

    const document = buildFinalDocument(facts, factsDigest, now);
    const deck = buildFinalDeck(facts, factsDigest, now);

    expect(stableFactsJson(facts)).toBe(json);
    expect(document.sourceRefs[0]?.sourceVersion).toBe(factsDigest);
    expect(JSON.stringify(document)).toContain(factsDigest);
    expect(JSON.stringify(deck)).toContain(factsDigest);
    expect(document.sections).toHaveLength(7);
    expect(deck.slides).toHaveLength(7);
    expect(JSON.stringify(document)).toContain('330\u00a0000');
    expect(JSON.stringify(document)).toContain('Czas akceptacji');
    expect(JSON.stringify(deck)).toContain('Plan finansowy');
    const serializedDocument = JSON.stringify(document);
    const serializedDeck = JSON.stringify(deck);
    expect(serializedDocument).toContain('MNIEJ ZNACZY LEPIEJ');
    expect(serializedDeck).toContain('Mniej znaczy lepiej');
    expect(serializedDocument).not.toContain('MNIEJ_ZNACZY_LEPIEJ');
    expect(serializedDeck).not.toContain('MNIEJ_ZNACZY_LEPIEJ');
    expect(serializedDeck).toContain('Wynik rzeczywisty');
    expect(serializedDeck).toContain('Transformacja zakończona');
    expect(serializedDeck).toContain('ZATWIERDZONA');
    expect(serializedDeck).toContain('Baza: 10 dni');
    expect(serializedDeck).toContain('Mniej znaczy lepiej');
    expect(serializedDeck).toContain('2 zweryfikowane pomiary');
    expect(serializedDeck).not.toContain('LOWER_IS_BETTER');
    expect(serializedDeck).not.toContain('APPROVED');
  });

  it('reports open recovery without declaring sustained success', () => {
    const unresolved = {
      ...facts,
      recovery: { status: 'unresolved' as const, openCards: 1, unresolvedExperiments: 1 },
    };
    const digest = createHash('sha256').update(stableFactsJson(unresolved)).digest('hex');
    const document = JSON.stringify(buildFinalDocument(unresolved, digest, '2026-08-07T12:00:00Z'));
    const deck = JSON.stringify(buildFinalDeck(unresolved, digest, '2026-08-07T12:00:00Z'));
    expect(document).toContain('nie jest potwierdzonym sukcesem');
    expect(deck).toContain('Nie deklarować sukcesu');
    expect(deck).not.toContain('Transformacja zakończona');
  });
});
