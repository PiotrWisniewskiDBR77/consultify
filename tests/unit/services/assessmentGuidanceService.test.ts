import { describe, it, expect, vi } from 'vitest';

import {
  getAssessmentGuidance,
  deterministicGuidance,
  resolveKnowledge,
  buildGuidancePrompt,
  parseGuidanceJson,
  validateGuidance,
  type AssessmentGuidanceInput,
  type GuidanceLlm,
} from '@/services/assessmentKnowledge/assessmentGuidanceService';

const DRD_INPUT: AssessmentGuidanceInput = {
  framework: 'DRD',
  dimensionId: '1A',
  dimensionName: 'Procesy Sprzedaży',
  levelNumber: 3,
  levelTitle: 'Zintegrowany',
  levelDescription: 'Dane sprzedażowe płyną między systemami bez ręcznego przepisywania.',
  language: 'pl',
};

const SIRI_INPUT: AssessmentGuidanceInput = {
  framework: 'SIRI',
  dimensionId: 'operations',
  dimensionName: 'Operations',
  levelNumber: 3,
  language: 'en',
};

const ADMA_INPUT: AssessmentGuidanceInput = {
  framework: 'ADMA',
  dimensionId: 'digital_strategy',
  dimensionName: 'Digital Strategy',
  levelNumber: 2,
  language: 'en',
};

/** A well-formed LLM that returns valid, filler-free guidance JSON. */
const goodLlm: GuidanceLlm = async () =>
  JSON.stringify({
    whyItMatters:
      'Procesy sprzedaży wyznaczają, czy firma potrafi przewidywać popyt i planować produkcję z danych, a nie z intuicji handlowca.',
    levelInterpretation:
      'Poziom 3 potwierdza log integracji CRM→ERP bez ręcznego przepisywania; sprawdź, czy zamówienie z CRM tworzy rekord w ERP automatycznie, inaczej to poziom 2.',
    canonContext:
      'Wg kanonu DRD poziom 3 to integracja systemów sprzedażowych, nie sama cyfryzacja formularza.',
    confidence: 'high',
  });

describe('assessmentGuidanceService — knowledge grounding', () => {
  it('resolveKnowledge returns canon questions for DRD', () => {
    const k = resolveKnowledge('DRD', '1A', 3);
    expect(Array.isArray(k.questions)).toBe(true);
    expect(k.questions.length).toBe(3);
    expect(typeof k.example).toBe('string');
    expect(k.example.length).toBeGreaterThan(0);
  });

  it('SIRI/ADMA knowledge carries the richer evidence/levelMeaning fields', () => {
    const siri = resolveKnowledge('SIRI', 'operations', 3);
    const adma = resolveKnowledge('ADMA', 'digital_strategy', 2);
    expect(typeof siri.evidenceGuidance).toBe('string');
    expect(typeof siri.levelMeaning).toBe('string');
    expect(typeof adma.evidenceGuidance).toBe('string');
  });

  it('buildGuidancePrompt embeds canon example + validation questions in the grounding', () => {
    const k = resolveKnowledge('DRD', '1A', 3);
    const { systemPrompt, userPrompt } = buildGuidancePrompt(DRD_INPUT, k);
    expect(systemPrompt).toContain('CONCLUSION_LAYER_STANDARD');
    expect(userPrompt).toContain('1A');
    expect(userPrompt).toContain(k.example);
  });
});

describe('assessmentGuidanceService — parse + validate', () => {
  it('parses fenced JSON', () => {
    const parsed = parseGuidanceJson('```json\n{"whyItMatters":"x"}\n```');
    expect(parsed?.whyItMatters).toBe('x');
  });

  it('validate rejects empty, too-short and filler fields', () => {
    expect(validateGuidance(null).ok).toBe(false);
    expect(
      validateGuidance({ whyItMatters: '', levelInterpretation: 'aaaaaaaaaaaaa', canonContext: 'aaaaaaaaaaaaa' }).ok
    ).toBe(false);
    expect(
      validateGuidance({
        whyItMatters: 'Warto rozważyć poprawę procesów w organizacji.',
        levelInterpretation: 'To jest poprawna interpretacja poziomu z dowodem.',
        canonContext: 'Kanon mówi coś konkretnego o tym poziomie oceny.',
      }).ok
    ).toBe(false); // filler in whyItMatters
  });

  it('validate accepts a substantive, filler-free object', () => {
    const res = validateGuidance({
      whyItMatters:
        'Integracja CRM→ERP decyduje o tym, czy planowanie produkcji opiera się na realnych zamówieniach.',
      levelInterpretation:
        'Poziom 3 potwierdza log automatycznej synchronizacji; jeśli rekord trafia ręcznie, to poziom 2.',
      canonContext: 'Wg DRD poziom 3 to zintegrowane systemy sprzedażowe.',
      confidence: 'high',
    });
    expect(res.ok).toBe(true);
    expect(res.fields?.confidence).toBe('high');
  });
});

describe('assessmentGuidanceService — end to end per framework', () => {
  it('DRD: returns a sensible LLM-sourced object', async () => {
    const g = await getAssessmentGuidance(DRD_INPUT, { llm: goodLlm });
    expect(g.source).toBe('llm');
    expect(g.whyItMatters.length).toBeGreaterThan(20);
    expect(g.levelInterpretation.length).toBeGreaterThan(20);
    expect(g.canonContext.length).toBeGreaterThan(10);
    expect(g.validationQuestions.length).toBe(3);
    expect(Array.isArray(g.pitfalls)).toBe(true);
  });

  it('SIRI: deterministic (no LLM) still yields a substantive object', async () => {
    const g = await getAssessmentGuidance(SIRI_INPUT, {});
    expect(g.source).toBe('deterministic');
    expect(g.whyItMatters).toContain('Operations');
    expect(g.levelInterpretation.length).toBeGreaterThan(20);
    expect(g.pitfalls.length).toBeGreaterThan(0);
  });

  it('ADMA: deterministic object references the dimension and canon', async () => {
    const g = deterministicGuidance(ADMA_INPUT, resolveKnowledge('ADMA', 'digital_strategy', 2));
    expect(g.canonContext).toContain('ADMA');
    expect(g.whyItMatters).toContain('Digital Strategy');
  });
});

describe('assessmentGuidanceService — fail-safe (LLM never blocks)', () => {
  it('falls back to deterministic when the LLM throws', async () => {
    const throwing: GuidanceLlm = async () => {
      throw new Error('boom');
    };
    const warn = vi.fn();
    const g = await getAssessmentGuidance(DRD_INPUT, { llm: throwing, logger: { warn } });
    expect(g.source).toBe('deterministic');
    expect(g.whyItMatters.length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalled();
  });

  it('retries once then falls back on invalid output', async () => {
    const llm = vi.fn(async () => 'not json at all');
    const g = await getAssessmentGuidance(DRD_INPUT, { llm });
    expect(g.source).toBe('deterministic');
    expect(llm).toHaveBeenCalledTimes(2); // initial + one retry
  });

  it('recovers on the retry when the first call is bad but the second is good', async () => {
    let call = 0;
    const llm: GuidanceLlm = async () => {
      call += 1;
      return call === 1 ? 'garbage' : await goodLlm({ systemPrompt: '', userPrompt: '' });
    };
    const g = await getAssessmentGuidance(DRD_INPUT, { llm });
    expect(g.source).toBe('llm');
  });

  it('rejects LLM output that smuggles in filler, falling back to canon', async () => {
    const fillerLlm: GuidanceLlm = async () =>
      JSON.stringify({
        whyItMatters: 'W dzisiejszych czasach warto rozważyć poprawę procesów.',
        levelInterpretation: 'W dzisiejszych czasach warto rozważyć poprawę procesów.',
        canonContext: 'W dzisiejszych czasach warto rozważyć poprawę procesów.',
        confidence: 'high',
      });
    const g = await getAssessmentGuidance(DRD_INPUT, { llm: fillerLlm });
    expect(g.source).toBe('deterministic');
  });
});
