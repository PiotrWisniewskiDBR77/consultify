import { describe, expect, it, vi } from 'vitest';

import {
  buildDistillationPrompt,
  buildGenericMaterialQuality,
  deriveInitiativeSeedContext,
  materializeInsightCandidates,
  normalizeSeedValue,
  parseDistillationResponse,
  reconcileEvidenceRefs,
  runQualityGate,
  withSeedFields,
  type GenerateArgs,
  type GenerateResponseLike,
  type InsightCandidate,
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
      // strong ⇒ ≥2 evidence_refs (§3.2); action-title z czasownikiem.
      { title: 'Brak triage wydłuża kolejkę zapytań kluczowych', description: longDesc('Brak triage'), evidence_refs: ['q1', 'q2'], strength: 'strong' },
      { title: 'Brak SLA obniża przewidywalność obsługi zapytań', description: longDesc('Brak SLA'), evidence_refs: ['q2', 'q3'], strength: 'strong' },
      { title: 'Ręczne narzędzia planowania ukrywają wąskie gardło', description: longDesc('Ręczne narzędzia'), evidence_refs: ['q3'], strength: 'moderate' },
    ],
    issues: [
      { title: 'Kolejka bez priorytetów wydłuża czas obsługi', description: 'Zapytania nie są priorytetyzowane, przez co kolejka rośnie i firma traci sprzedaż w segmencie kluczowym.', severity: 'high', evidence_refs: ['q1'] },
      { title: 'Brak mierzenia czasu obsługi ukrywa wąskie gardło', description: 'Nikt nie mierzy czasu obsługi, więc nie wiadomo, gdzie utyka proces.', severity: 'medium', evidence_refs: ['q2'] },
    ],
    opportunities: [{ title: 'Integracja z CRM skróci obsługę zapytań o 30%', description: 'Zastąpienie arkusza integracją z CRM skróci czas obsługi o 30% w 2 kwartały.', evidence_refs: ['q3'] }],
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

// ────────────────────────────────────────────────────────────────────────────
// §6 downstream seeds (#57/Z60) — suggestedOwnerRole/metric/baseline/target/
// horizon on issues/opportunities. "opcjonalne, gdy dane są, inaczej null".
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeSeedValue', () => {
  it('keeps a real, trimmed string value', () => {
    expect(normalizeSeedValue('  Head of Operations  ')).toBe('Head of Operations');
  });

  it('normalizes missing/empty/non-string values to null', () => {
    expect(normalizeSeedValue(undefined)).toBeNull();
    expect(normalizeSeedValue(null)).toBeNull();
    expect(normalizeSeedValue('')).toBeNull();
    expect(normalizeSeedValue('   ')).toBeNull();
    expect(normalizeSeedValue(42)).toBeNull();
  });

  it('treats placeholder text as absent, never as a real seed', () => {
    for (const placeholder of ['do ustalenia', 'TBD', 'N/A', 'brak', 'unknown', 'null']) {
      expect(normalizeSeedValue(placeholder)).toBeNull();
    }
  });
});

describe('withSeedFields', () => {
  it('stamps all 5 seed keys as explicit null when the entry has none', () => {
    const stamped = withSeedFields({ title: 'x', description: 'y', evidence_refs: [] });
    expect(stamped).toMatchObject({
      suggestedOwnerRole: null,
      metric: null,
      baseline: null,
      target: null,
      horizon: null,
    });
  });

  it('normalizes real grounded values through, and scrubs placeholder text', () => {
    const stamped = withSeedFields({
      title: 'x',
      suggestedOwnerRole: 'Head of Sales Ops',
      metric: 'czas cyklu zatwierdzania',
      baseline: '~5 dni',
      target: '1 dzień',
      horizon: 'do ustalenia', // placeholder — must become null
    });
    expect(stamped.suggestedOwnerRole).toBe('Head of Sales Ops');
    expect(stamped.metric).toBe('czas cyklu zatwierdzania');
    expect(stamped.baseline).toBe('~5 dni');
    expect(stamped.target).toBe('1 dzień');
    expect(stamped.horizon).toBeNull();
  });

  it('passes non-object entries through untouched (mirrors arrayWithEvidenceRefs guard)', () => {
    expect(withSeedFields(null as any)).toBeNull();
    expect(withSeedFields('a string' as any)).toBe('a string');
  });
});

function goodCandidateJsonWithSeeds(): string {
  const base = JSON.parse(goodCandidateJson());
  base.issues[0] = {
    ...base.issues[0],
    suggestedOwnerRole: 'Head of Customer Ops',
    metric: 'czas obsługi zapytania',
    baseline: '~5 dni',
    target: '1 dzień',
    horizon: '2 kwartały',
  };
  base.issues[1] = { ...base.issues[1] }; // no seeds — must degrade to null, not guessed
  base.opportunities[0] = {
    ...base.opportunities[0],
    suggestedOwnerRole: 'IT Lead',
    metric: 'liczba ręcznych integracji',
    baseline: '3',
    target: '0',
    // horizon intentionally omitted
  };
  return JSON.stringify(base);
}

describe('materializeInsightCandidates — downstream seeds end-to-end', () => {
  it('carries grounded seed fields through onto the final candidate issues/opportunities', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(goodCandidateJsonWithSeeds()),
    });
    expect(outcome.degraded).toBe(false);
    const [candidate] = outcome.candidates;
    expect(candidate.issues[0]).toMatchObject({
      suggestedOwnerRole: 'Head of Customer Ops',
      metric: 'czas obsługi zapytania',
      baseline: '~5 dni',
      target: '1 dzień',
      horizon: '2 kwartały',
    });
    expect(candidate.opportunities[0]).toMatchObject({
      suggestedOwnerRole: 'IT Lead',
      metric: 'liczba ręcznych integracji',
      baseline: '3',
      target: '0',
      horizon: null,
    });
  });

  it('degrades ungrounded issues to explicit null seeds rather than inventing anything', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(goodCandidateJsonWithSeeds()),
    });
    const [candidate] = outcome.candidates;
    expect(candidate.issues[1]).toMatchObject({
      suggestedOwnerRole: null,
      metric: null,
      baseline: null,
      target: null,
      horizon: null,
    });
  });

  it('when the LLM omits seed fields entirely, candidates still materialize with null seeds (no crash, no guess)', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(goodCandidateJson()),
    });
    expect(outcome.degraded).toBe(false);
    const [candidate] = outcome.candidates;
    for (const issue of candidate.issues) {
      expect(issue.suggestedOwnerRole).toBeNull();
      expect(issue.metric).toBeNull();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// deriveInitiativeSeedContext — the §6 bridge to GenerationContext
// ────────────────────────────────────────────────────────────────────────────

describe('deriveInitiativeSeedContext', () => {
  it('returns {} for a null/undefined candidate (fail-soft)', () => {
    expect(deriveInitiativeSeedContext(null)).toEqual({});
    expect(deriveInitiativeSeedContext(undefined)).toEqual({});
  });

  it('returns {} when no issue/opportunity carries a grounded seed', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(goodCandidateJson()),
    });
    expect(deriveInitiativeSeedContext(outcome.candidates[0])).toEqual({});
  });

  it('picks the first grounded owner role and formats KPI seeds as "metric (baseline → target, horizon)"', async () => {
    const outcome = await materializeInsightCandidates(baseInput(), {
      generate: fixedGenerate(goodCandidateJsonWithSeeds()),
    });
    const seeds = deriveInitiativeSeedContext(outcome.candidates[0]);
    expect(seeds.seedOwnerRole).toBe('Head of Customer Ops');
    expect(seeds.seedKpiSeeds).toContain('czas obsługi zapytania (~5 dni → 1 dzień, 2 kwartały)');
    expect(seeds.seedKpiSeeds).toContain('liczba ręcznych integracji (3 → 0)');
  });

  it('skips an entry with a metric but no baseline/target (nothing to anchor)', () => {
    const candidate: InsightCandidate = {
      title: 't',
      executive_summary: 'e',
      themes: [],
      issues: [
        {
          title: 'i',
          description: 'd',
          evidence_refs: [],
          suggestedOwnerRole: null,
          metric: 'coś tam',
          baseline: null,
          target: null,
          horizon: null,
        },
      ],
      opportunities: [],
      signals: [],
      evidence_map: [],
      missing_data: [],
      material_quality: {
        score: 50,
        answer_quality_posture: 'usable',
        coverage_posture: 'partial_coverage',
        missing_voices: [],
        limitations: [],
        recommended_followups: [],
      },
    };
    expect(deriveInitiativeSeedContext(candidate)).toEqual({});
  });
});
