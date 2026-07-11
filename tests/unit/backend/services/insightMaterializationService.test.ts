import { describe, expect, it, vi } from 'vitest';

import {
  buildDistillationPrompt,
  buildGenericMaterialQuality,
  materializeInsightCandidates,
  parseDistillationResponse,
  reconcileEvidenceRefs,
  runQualityGate,
  type GenerateArgs,
  type GenerateResponseLike,
  type MaterializationInput,
} from '../../../../server/src/services/insightMaterializationService.js';

// ────────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────────

const ITEMS: MaterializationInput['items'] = [
  { id: 'q1', label: 'Proces obsługi zapytań', text: 'Brak priorytetyzacji zapytań, kolejka rośnie tygodniowo.' },
  { id: 'q2', label: 'Mierzenie SLA', text: 'Nikt nie mierzy czasu odpowiedzi na zapytania klientów.' },
  { id: 'q3', label: 'Narzędzia', text: 'Zespół pracuje w arkuszu Excel bez integracji z CRM.' },
];

function baseInput(overrides: Partial<MaterializationInput> = {}): MaterializationInput {
  return {
    sourceType: 'assessment',
    sourceId: 'assess-1',
    organizationId: 'org-1',
    title: 'DRD — Ocena dojrzałości',
    items: ITEMS,
    ...overrides,
  };
}

const GOOD_SUMMARY =
  'Zespół sprzedaży traci realne szanse, bo proces obsługi zapytań nie ma priorytetyzacji ' +
  'ani mierzonego przepływu, co potwierdzają odpowiedzi z oceny. Największym wąskim gardłem ' +
  'jest brak triage, przez co kolejka rośnie z tygodnia na tydzień w segmencie kluczowym. ' +
  'Rekomendujemy wdrożenie mierzonego przepływu z jasnym progiem SLA. Poziom pewności jest ' +
  'umiarkowany, bo obserwacja pochodzi z jednej oceny bez dodatkowej walidacji operacyjnej.';

const longDesc = (label: string) =>
  `${label}: obserwacja wynika wprost z odpowiedzi oceny i wskazuje na systemowy brak ` +
  'mierzonego przepływu; brak priorytetyzacji zapytań blokuje realizację zamówień w ' +
  'kluczowym segmencie i realnie obniża konwersję sprzedaży, a jednocześnie utrudnia ' +
  'planowanie zdolności zespołu, bo nikt nie widzi rzeczywistego obciążenia kolejki ani ' +
  'czasu reakcji na poszczególne zapytania klientów strategicznych organizacji.';

function goodCandidateJson(): string {
  return JSON.stringify({
    title: 'Wdrożenie triage zapytań skraca kolejkę o 30% w 2 kwartały',
    executive_summary: GOOD_SUMMARY,
    themes: [
      { title: 'Brak triage', description: longDesc('Brak triage'), evidence_refs: ['q1'], strength: 'strong' },
      { title: 'Brak SLA', description: longDesc('Brak SLA'), evidence_refs: ['q2'], strength: 'strong' },
      { title: 'Ręczne narzędzia', description: longDesc('Ręczne narzędzia'), evidence_refs: ['q3'], strength: 'moderate' },
    ],
    issues: [
      { title: 'Kolejka bez priorytetów', description: 'Zapytania nie są priorytetyzowane.', severity: 'high', evidence_refs: ['q1'] },
      { title: 'Brak mierzenia', description: 'Nikt nie mierzy czasu obsługi.', severity: 'medium', evidence_refs: ['q2'] },
    ],
    opportunities: [{ title: 'Integracja z CRM', description: 'Zastąpienie arkusza integracją z CRM.', evidence_refs: ['q3'] }],
    signals: [],
    evidence_map: [
      { item_id: 'q1', answer_snippet: 'brak priorytetyzacji zapytań' },
      { item_id: 'q2', answer_snippet: 'nikt nie mierzy czasu odpowiedzi' },
    ],
    missing_data: ['Brak danych o wolumenie zapytań', 'Brak baseline czasu obsługi'],
  });
}

function weakCandidateJson(): string {
  return JSON.stringify({
    title: 'Poprawić proces',
    executive_summary: 'Za krótkie podsumowanie.',
    themes: [],
    issues: [],
    opportunities: [],
    signals: [],
    evidence_map: [],
    missing_data: [],
  });
}

/** A GenerateFn stub that always returns the same content string. */
function fixedGenerate(content: string): (args: GenerateArgs) => Promise<GenerateResponseLike> {
  return async () => ({ content, usage: { totalTokens: 123 } });
}

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────────────────────

describe('buildDistillationPrompt', () => {
  it('includes every source item id and text so the model can ground findings', () => {
    const prompt = buildDistillationPrompt(baseInput());
    expect(prompt).toContain('[item_id: q1]');
    expect(prompt).toContain('Brak priorytetyzacji zapytań');
    expect(prompt).toContain('[item_id: q3]');
    expect(prompt).toContain(baseInput().sourceType);
  });
});

describe('parseDistillationResponse', () => {
  it('parses a clean JSON object', () => {
    const parsed = parseDistillationResponse(goodCandidateJson());
    expect(parsed.title).toContain('triage');
    expect(Array.isArray(parsed.themes)).toBe(true);
  });

  it('extracts JSON from a markdown-fenced response', () => {
    const fenced = '```json\n' + goodCandidateJson() + '\n```';
    const parsed = parseDistillationResponse(fenced);
    expect(parsed.title).toContain('triage');
  });

  it('returns an empty object (never throws) on malformed JSON', () => {
    expect(() => parseDistillationResponse('not json at all {{{')).not.toThrow();
    expect(parseDistillationResponse('not json at all {{{')).toEqual({});
  });

  it('returns an empty object for empty input', () => {
    expect(parseDistillationResponse('')).toEqual({});
  });
});

describe('reconcileEvidenceRefs (lineage guard)', () => {
  it('strips evidence_refs / evidence_map entries that do not match a real item id', () => {
    const validIds = new Set(['q1', 'q2']);
    const candidate = parseDistillationResponse(
      JSON.stringify({
        themes: [{ title: 't', description: 'd', evidence_refs: ['q1', 'INVENTED_ID'] }],
        evidence_map: [
          { item_id: 'q2', answer_snippet: 'ok' },
          { item_id: 'INVENTED_ID', answer_snippet: 'hallucinated' },
        ],
      })
    );
    const reconciled = reconcileEvidenceRefs(candidate, validIds);
    expect(reconciled.themes?.[0]).toMatchObject({ evidence_refs: ['q1'] });
    expect(reconciled.evidence_map).toEqual([{ item_id: 'q2', answer_snippet: 'ok' }]);
  });
});

describe('buildGenericMaterialQuality', () => {
  it('produces the exact keys cardContentFormulaValidator requires (score, not overall_material_score)', () => {
    const candidate = parseDistillationResponse(goodCandidateJson());
    const mq = buildGenericMaterialQuality(ITEMS, candidate);
    expect(typeof mq.score).toBe('number');
    expect(Array.isArray(mq.limitations)).toBe(true);
    expect(Array.isArray(mq.missing_voices)).toBe(true);
    expect(Array.isArray(mq.recommended_followups)).toBe(true);
  });

  it('flags a limitation when claims lack evidence_refs', () => {
    const candidate = { themes: [{ title: 't', description: 'd', evidence_refs: [] }] };
    const mq = buildGenericMaterialQuality(ITEMS, candidate);
    expect(mq.limitations.some((l) => l.includes('evidence_ref'))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// runQualityGate — the F14 bramka in isolation (no LLM involved)
// ────────────────────────────────────────────────────────────────────────────

describe('runQualityGate', () => {
  it('passes a well-formed, well-evidenced candidate', () => {
    const candidate = parseDistillationResponse(goodCandidateJson());
    const verdict = runQualityGate(candidate, ITEMS);
    expect(verdict.kind).toBe('insight');
    expect(verdict.score).toBeGreaterThanOrEqual(60);
  });

  it('flags a weak candidate (missing summary/themes/issues) with violations and pass=false', () => {
    const candidate = parseDistillationResponse(weakCandidateJson());
    const verdict = runQualityGate(candidate, ITEMS);
    expect(verdict.pass).toBe(false);
    expect(verdict.violations.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// materializeInsightCandidates — orchestrator, steps [3]-[5], injected deps
// ────────────────────────────────────────────────────────────────────────────

describe('materializeInsightCandidates', () => {
  it('distills a raw result into a candidate and returns it undegraded when the gate passes', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(goodCandidateJson()),
    });
    expect(outcome.degraded).toBe(false);
    expect(outcome.candidates).toHaveLength(1);
    expect(outcome.candidates[0].title).toContain('triage');
    expect(outcome.verdict).toBeDefined();
    expect(outcome.tokensUsed).toBeGreaterThan(0);
  });

  it('never persists anything — it only returns candidates for the caller to review (jawna materializacja)', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(goodCandidateJson()),
    });
    // Contract check: the outcome is a plain data object, not a side-effecting write.
    expect(outcome).not.toHaveProperty('insightId');
    expect(outcome).not.toHaveProperty('persisted');
  });

  it('flags a weak card via the verdict, attempts exactly one repair, and keeps repaired=false when the repair does not improve', async () => {
    const generate = vi.fn(fixedGenerate(weakCandidateJson()));
    const outcome = await materializeInsightCandidates(baseInput(), { generate });
    expect(outcome.degraded).toBe(false);
    expect(outcome.verdict?.pass).toBe(false);
    expect(outcome.repaired).toBe(false);
    // 1 distill call + 1 repair call — never more (ADVISORY = single repair pass).
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('accepts the repair when the second pass scores strictly better', async () => {
    const generate = vi
      .fn<[GenerateArgs], Promise<GenerateResponseLike>>()
      .mockResolvedValueOnce({ content: weakCandidateJson(), usage: { totalTokens: 50 } })
      .mockResolvedValueOnce({ content: goodCandidateJson(), usage: { totalTokens: 60 } });

    const outcome = await materializeInsightCandidates(baseInput(), { generate });
    expect(outcome.repaired).toBe(true);
    expect(outcome.verdict?.score).toBeGreaterThanOrEqual(60);
    expect(outcome.candidates[0].title).toContain('triage');
  });

  it('is fail-soft on empty source items (no LLM call, degraded outcome, never throws)', async () => {
    const generate = vi.fn();
    const outcome = await materializeInsightCandidates(baseInput({ items: [] }), { generate });
    expect(outcome.degraded).toBe(true);
    expect(outcome.degradedReason).toBe('no_source_items');
    expect(outcome.candidates).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it('is fail-soft when the LLM call throws (never propagates the error)', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('provider timeout'));
    await expect(
      materializeInsightCandidates(baseInput(), { generate })
    ).resolves.toMatchObject({ degraded: true, degradedReason: 'llm_call_failed', candidates: [] });
  });

  it('is fail-soft when the LLM returns unparseable content', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate('I refuse to return JSON today.'),
    });
    expect(outcome.degraded).toBe(true);
    expect(outcome.degradedReason).toBe('unparseable_response');
    expect(outcome.candidates).toEqual([]);
  });

  it('strips hallucinated evidence_refs before scoring (lineage guard applied end-to-end)', async () => {
    const hallucinated = JSON.parse(goodCandidateJson());
    hallucinated.themes[0].evidence_refs = ['NOT_A_REAL_ITEM'];
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(JSON.stringify(hallucinated)),
    });
    expect(outcome.candidates[0].themes[0].evidence_refs).toEqual([]);
  });
});
