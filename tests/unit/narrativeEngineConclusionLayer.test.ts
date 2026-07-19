import { describe, expect, it } from 'vitest';

import { buildSystemPrompt } from '../../server/src/services/narrativeEngine/linguisticRealization.js';
import { runPostChecks } from '../../server/src/services/narrativeEngine/postChecks.js';
import type {
  DiscoursePlan,
  FactSet,
  NarrativeEngineInput,
} from '../../server/src/services/narrativeEngine/types.js';

/**
 * O2.5 (Oxford — Narracja deck/generatorów) proof.
 *
 * Rejestr status before this test: ⬜ "brak dowodu" — the CONCLUSION_LAYER
 * answer-first / anti-fabrication rules were added to the shared L4
 * (Linguistic Realization) prompt builder in be1c9b8a5b (O5.3), which is
 * consumed by BOTH presentationGeneratorService (deck) and
 * reportGenerationService (report) via server/src/services/narrativeEngine —
 * but no test asserted the prompt actually carries those rules, and no test
 * exercised the deterministic L5 post-checks that enforce
 * CONCLUSION_LAYER_STANDARD.md R2/R5 (evidence-backed claims, no invented
 * numbers) at runtime regardless of what the LLM produces.
 *
 * This test asserts both halves directly against the real exported code
 * (not a copy), closing the "brak dowodu" gap.
 */

function baseInput(overrides: Partial<NarrativeEngineInput> = {}): NarrativeEngineInput {
  return {
    context_pack: {},
    section_key: 'exec-summary',
    section_type: 'summary',
    section_title: 'Executive Summary',
    report_config: {
      report_type_v3: 'assessment',
      goal_v3: 'inform',
      communication_register: 'executive',
      density: 'standard',
      form: 'narrative',
      data_level: 'summary',
      language: 'en',
    },
    ...overrides,
  };
}

describe('narrativeEngine L4 system prompt — CONCLUSION_LAYER_STANDARD compliance (O2.5)', () => {
  it('states the answer-first / Pyramid Principle rule as rule #1', () => {
    const prompt = buildSystemPrompt(baseInput());
    expect(prompt).toContain('ANSWER-FIRST');
    expect(prompt).toContain('Pyramid Principle');
    // It must be rule #1, not buried further down the list.
    const rulesIdx = prompt.indexOf('## Rules');
    const answerFirstIdx = prompt.indexOf('1. ANSWER-FIRST');
    expect(rulesIdx).toBeGreaterThan(-1);
    expect(answerFirstIdx).toBeGreaterThan(rulesIdx);
  });

  it('forbids fabricated external citations (Gartner/McKinsey/IDC) — R5 no-invented-numbers/sources', () => {
    const prompt = buildSystemPrompt(baseInput());
    expect(prompt).toMatch(/Gartner\/McKinsey\/IDC/i);
    expect(prompt).toContain('NEVER invent numbers, dates, names, or external citations');
  });

  it('requires unsupported claims to be labeled as explicit assumptions, not fabricated facts', () => {
    const prompt = buildSystemPrompt(baseInput());
    expect(prompt.toLowerCase()).toContain('assumption');
    expect(prompt).toContain('never fabricate a precise-looking number to fill a gap');
  });

  it('carries a CRITICAL, unambiguous PL/EN language directive (parity with docGenerationRuntime)', () => {
    const enPrompt = buildSystemPrompt(baseInput({ report_config: { ...baseInput().report_config, language: 'en' } }));
    const plPrompt = buildSystemPrompt(baseInput({ report_config: { ...baseInput().report_config, language: 'pl' } }));

    expect(enPrompt).toMatch(/CRITICAL: Write ALL content in English/);
    expect(plPrompt).toMatch(/BEZWZGLĘDNIE WAŻNE: Całą treść pisz po POLSKU/);
  });

  it('still requires recommendations to carry "because" + evidence (R2 causality)', () => {
    const prompt = buildSystemPrompt(baseInput());
    expect(prompt.toLowerCase()).toContain('"because"');
  });
});

describe('narrativeEngine L5 post-checks — deterministic CONCLUSION_LAYER enforcement (O2.5)', () => {
  const plan: DiscoursePlan = {
    section_key: 'exec-summary',
    section_title: 'Executive Summary',
    segments: [
      {
        order: 1,
        segment_type: 'recommendation',
        content_hint: 'Recommend vendor consolidation',
        related_observations: ['obs-1'],
        target_word_count: 60,
      },
    ],
    communication_register: 'executive',
    density: 'standard',
  };

  const facts: FactSet[] = [
    {
      fact_id: 'f1',
      category: 'finance',
      label: 'Procurement spend share of revenue',
      value: 8,
      unit: '%',
      source_ref: { artifact_id: 'a1', artifact_type: 'financeStatement', artifact_name: 'FY25 P&L' },
      timestamp: '2026-01-15T00:00:00.000Z',
    },
  ];

  it('flags a number in the generated content that cannot be traced to any source fact (R5)', () => {
    const content =
      '## Executive Summary\n\nProcurement spend is 8% of revenue. Recommendation: consolidate vendors ' +
      'because market benchmarks show potential savings of 47% within 12 months.';
    const result = runPostChecks(content, plan, facts, baseInput());
    expect(result.warnings.map((w) => w.code)).toContain('INVENTED_NUMBER');
  });

  it('does not flag a number that matches a source fact within tolerance (no false positive)', () => {
    const content =
      '## Executive Summary\n\nProcurement spend is 8% of revenue. Recommendation: consolidate vendors ' +
      'because fragmented pricing across suppliers drives avoidable cost.';
    const result = runPostChecks(content, plan, facts, baseInput());
    expect(result.warnings.map((w) => w.code)).not.toContain('INVENTED_NUMBER');
  });

  it('warns when a recommendation segment exists but the content carries no evidence marker (R2)', () => {
    const content = '## Executive Summary\n\nRecommendation: consolidate vendors.';
    const result = runPostChecks(content, plan, facts, baseInput());
    expect(result.warnings.map((w) => w.code)).toContain('HEDGING_NO_EVIDENCE');
  });

  it('passes with no warnings/errors for evidence-backed, fact-grounded content', () => {
    const content =
      '## Executive Summary\n\nProcurement spend is 8% of revenue. Recommendation: consolidate vendors ' +
      'because fragmented pricing across suppliers drives avoidable cost.';
    const result = runPostChecks(content, plan, facts, baseInput());
    expect(result.passed).toBe(true);
    expect(result.warnings.map((w) => w.code)).not.toContain('HEDGING_NO_EVIDENCE');
  });
});
