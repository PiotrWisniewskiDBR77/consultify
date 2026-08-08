import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildFinalDeck,
  buildFinalDocument,
  documentSchemaFromNativeReport,
  nativeReportSectionsFromDocument,
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
  ideas: [{ title: 'Skrócić kolejkę', body: 'Hipoteza automatyzacji przekazań' }],
  interviewInsights: [
    { title: 'Wąskie gardło', content: 'Ręczne przekazanie wydłuża akceptację' },
  ],
  drd: {
    name: 'DRD czasu akceptacji',
    status: 'APPROVED',
    completionPercent: 100,
    acceptedSnapshot: { scoring: { completionPercent: 100 } },
  },
  portfolioDecision: { selectedOption: 'go', rationale: 'Korzyść przewyższa koszt' },
  initiative: { name: 'Szybsza akceptacja', status: 'DONE' },
  execution: { tasks: { completed: 3, total: 3 }, milestones: { completed: 3, total: 3 } },
  benefits: { total: 1, verified: 1, verifiedMeasurements: 2, measurementWindowDays: 31 },
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

const digestOf = (value: string) => createHash('sha256').update(value).digest('hex');
const NOW = '2026-08-08T10:00:00.000Z';
const factsDigest = digestOf(stableFactsJson(facts));

const asRows = (document: ReturnType<typeof buildFinalDocument>) =>
  nativeReportSectionsFromDocument(document).map((section) => ({
    section_key: section.sectionKey,
    title: section.title,
    generated_content: section.content,
  }));

describe('U02 native report projection', () => {
  it('projects every document section into exactly one owner section, deterministically', () => {
    const document = buildFinalDocument(facts, factsDigest, NOW);
    const first = nativeReportSectionsFromDocument(document);
    const second = nativeReportSectionsFromDocument(buildFinalDocument(facts, factsDigest, NOW));

    expect(first).toHaveLength(document.sections.length);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.map((s) => s.orderIndex)).toEqual(first.map((_, index) => index));
    expect(new Set(first.map((s) => s.sectionKey)).size).toBe(first.length);
  });

  it('round-trips owner rows back into the same DOCX render model', () => {
    const document = buildFinalDocument(facts, factsDigest, NOW);
    const rebuilt = documentSchemaFromNativeReport({
      title: document.title,
      factsDigest,
      transformationCaseId: facts.transformationCaseId,
      createdAt: NOW,
      updatedAt: NOW,
      sections: asRows(document),
    });

    expect(rebuilt.title).toBe(document.title);
    expect(rebuilt.sections).toHaveLength(document.sections.length);
    expect(rebuilt.sections.map((s) => s.title)).toEqual(document.sections.map((s) => s.title));
    expect(rebuilt.sections.flatMap((s) => s.blocks.map((b) => b.content))).toEqual(
      document.sections.flatMap((s) => s.blocks.map((b) => b.content))
    );
  });

  it('preserves UNKNOWN literally through the owner round trip', () => {
    const unresolved: TransformationFinalOutputFacts = {
      ...facts,
      finance: { ...facts.finance, status: 'UNKNOWN' },
      initiative: { ...facts.initiative, status: 'UNKNOWN' },
    };
    const unresolvedDigest = digestOf(stableFactsJson(unresolved));
    const document = buildFinalDocument(unresolved, unresolvedDigest, NOW);
    const rebuilt = JSON.stringify(
      documentSchemaFromNativeReport({
        title: document.title,
        factsDigest: unresolvedDigest,
        transformationCaseId: unresolved.transformationCaseId,
        createdAt: NOW,
        updatedAt: NOW,
        sections: asRows(document),
      })
    );
    const deck = JSON.stringify(buildFinalDeck(unresolved, unresolvedDigest, NOW));

    expect(rebuilt).toContain('UNKNOWN');
    expect(deck).toContain('UNKNOWN');
    expect(rebuilt).not.toContain('Nieznany');
    expect(rebuilt).not.toContain('N/A');
  });

  it('lets a native narrative edit change the export without touching facts or the deck', () => {
    const document = buildFinalDocument(facts, factsDigest, NOW);
    const deckBefore = JSON.stringify(buildFinalDeck(facts, factsDigest, NOW));
    const rows = asRows(document);

    // Consultant edits one section in Report Builder.
    const edited = rows.map((row, index) =>
      index === 0 ? { ...row, generated_content: 'Zredagowane podsumowanie.' } : row
    );
    const rebuilt = documentSchemaFromNativeReport({
      title: document.title,
      factsDigest,
      transformationCaseId: facts.transformationCaseId,
      createdAt: NOW,
      updatedAt: NOW,
      sections: edited,
    });

    expect(rebuilt.sections[0].blocks[0].content).toEqual({ text: 'Zredagowane podsumowanie.' });
    // The other sections, the facts snapshot, its digest and the deck are untouched.
    expect(rebuilt.sections.slice(1).flatMap((s) => s.blocks.map((b) => b.content))).toEqual(
      document.sections.slice(1).flatMap((s) => s.blocks.map((b) => b.content))
    );
    expect(digestOf(stableFactsJson(facts))).toBe(factsDigest);
    expect(JSON.stringify(buildFinalDeck(facts, factsDigest, NOW))).toBe(deckBefore);
    // The immutable source version keeps the pre-edit narrative.
    expect(rows[0].generated_content).not.toBe('Zredagowane podsumowanie.');
  });

  it('binds report and deck to the same facts digest and case', () => {
    const document = buildFinalDocument(facts, factsDigest, NOW);
    const deck = buildFinalDeck(facts, factsDigest, NOW);
    expect(document.sourceRefs?.[0]).toMatchObject({
      sourceType: 'transformation_case',
      sourceId: facts.transformationCaseId,
      sourceVersion: factsDigest,
    });
    expect(JSON.stringify(deck)).toContain(factsDigest);
  });
});
