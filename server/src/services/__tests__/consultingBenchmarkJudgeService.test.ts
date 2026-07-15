import { describe, expect, it } from 'vitest';

import {
  aggregateScores,
  type BinaryCriterion,
  type BinaryCriterionResult,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
  buildProductPromptPayload,
  CONSULTING_DIMENSIONS,
  DEFAULT_CONSULTING_RUBRICS,
  type DimensionScoreResult,
  gradeAllPass,
  judgeConsultingTask,
  type JudgeResult,
  type JudgeTaskInput,
  type LlmJudgeAdapter,
  mockLlmAdapter,
  noopLlmAdapter,
  parseJudgeResponse,
} from '../consultingBenchmarkJudgeService.js';

function fullScores(score = 4): DimensionScoreResult[] {
  return CONSULTING_DIMENSIONS.map((dimension) => ({
    dimension,
    score,
    rationale: `rationale for ${dimension}`,
    evidence: [`evidence for ${dimension}`],
    confidence: 'medium' as const,
  }));
}

function criteriaFixture(): BinaryCriterion[] {
  return [
    {
      id: 'cites-evidence',
      description: 'Answer cites at least one piece of evidence from the context.',
      guidance: 'pass if a concrete data point or fact from context is referenced',
    },
    {
      id: 'names-owner',
      description: 'Recommendation names a responsible owner or role.',
      guidance: 'pass if a specific person/role/team is named as accountable',
    },
  ];
}

function binaryPassAll(criteria: BinaryCriterion[]): BinaryCriterionResult[] {
  return criteria.map((c) => ({ id: c.id, pass: true, rationale: `${c.id} satisfied` }));
}

function taskFixture(overrides: Partial<JudgeTaskInput> = {}): JudgeTaskInput {
  return {
    taskId: 'drd-1A3-001',
    prompt:
      'The client reports inconsistent lead qualification across regions. Diagnose and recommend.',
    context: 'Sales team uses 4 different scoring sheets across EMEA/APAC/AMER/LATAM regions.',
    modelAnswer:
      'Recommendation: consolidate to one scoring rubric owned by the RevOps lead within Q3, ' +
      'based on the 4-region audit showing 60% variance in qualification criteria.',
    binaryCriteria: criteriaFixture(),
    goldNotes: 'Expert reference: correct diagnosis is process fragmentation, not tooling.',
    archetype: 'diagnostic',
    domain: '1A',
    lang: 'en',
    ...overrides,
  };
}

function jsonResponseFrom(
  scores: DimensionScoreResult[],
  binaryResults: BinaryCriterionResult[],
  rationale = 'overall ok'
): string {
  return JSON.stringify({
    rationale,
    dimensions: scores.map((s) => ({
      dimension: s.dimension,
      score: s.score,
      rationale: s.rationale,
      evidence: s.evidence,
      confidence: s.confidence,
    })),
    binaryResults: binaryResults.map((b) => ({ id: b.id, pass: b.pass, rationale: b.rationale })),
  });
}

// ---------------------------------------------------------------------------
// DEFAULT_CONSULTING_RUBRICS
// ---------------------------------------------------------------------------

describe('DEFAULT_CONSULTING_RUBRICS', () => {
  it('Test 1: contains exactly 5 entries — one per consulting dimension', () => {
    expect(DEFAULT_CONSULTING_RUBRICS).toHaveLength(5);
    const dims = DEFAULT_CONSULTING_RUBRICS.map((r) => r.dimension).sort();
    expect(dims).toEqual([...CONSULTING_DIMENSIONS].sort());
    for (const rubric of DEFAULT_CONSULTING_RUBRICS) {
      expect(rubric.description.length).toBeGreaterThan(10);
      expect(rubric.scoringGuidance.length).toBeGreaterThan(5);
      expect(rubric.weight).toBeGreaterThanOrEqual(0);
      expect(rubric.weight).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

describe('buildJudgeSystemPrompt', () => {
  it('Test 2: instructs the model to return JSON only, 0.5 increments, and binary+scale grading', () => {
    const prompt = buildJudgeSystemPrompt();
    expect(prompt).toMatch(/JSON only/i);
    expect(prompt).toMatch(/0\.5/);
    expect(prompt).toMatch(/1\.0 to 5\.0/);
    expect(prompt).toMatch(/binaryResults/);
  });
});

describe('buildJudgeUserPrompt', () => {
  it('Test 3: includes task prompt, context, model answer, and binary criteria ids', () => {
    const task = taskFixture();
    const prompt = buildJudgeUserPrompt({ task, scaleRubrics: DEFAULT_CONSULTING_RUBRICS });
    expect(prompt).toContain(task.prompt);
    expect(prompt).toContain(task.context as string);
    expect(prompt).toContain(task.modelAnswer);
    expect(prompt).toContain('cites-evidence');
    expect(prompt).toContain('names-owner');
    expect(prompt).toContain('answer_first');
  });

  it('Test 4: includes goldNotes for the judge (judge-side prompt only)', () => {
    const task = taskFixture();
    const prompt = buildJudgeUserPrompt({ task, scaleRubrics: DEFAULT_CONSULTING_RUBRICS });
    expect(prompt).toContain('Expert reference: correct diagnosis is process fragmentation');
  });
});

// ---------------------------------------------------------------------------
// Anti-contamination firewall (§4.3 of PROJEKT_BENCHMARK.md)
// ---------------------------------------------------------------------------

describe('buildProductPromptPayload — anti-contamination firewall', () => {
  it('Test 5: emits ONLY prompt+context — never binaryCriteria/scaleRubrics/goldNotes', () => {
    const task = taskFixture();
    const payload = buildProductPromptPayload(task);
    expect(payload).toEqual({ prompt: task.prompt, context: task.context });
    expect(Object.keys(payload).sort()).toEqual(['context', 'prompt']);
    // Structural guarantee: the serialized payload the product model would
    // receive must not contain the gold reference text anywhere.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('Expert reference');
    expect(serialized).not.toContain('cites-evidence');
    expect(serialized).not.toContain('names-owner');
  });

  it('Test 6: strips contamination even if goldNotes/criteria are attached to a malformed/contaminated object', () => {
    const contaminated = {
      prompt: 'Diagnose the situation.',
      context: 'Some context.',
      goldNotes: 'SECRET: the correct answer is X — do not leak this to the model under test.',
      binaryCriteria: criteriaFixture(),
      scaleRubrics: DEFAULT_CONSULTING_RUBRICS,
    };
    const payload = buildProductPromptPayload(contaminated as unknown as JudgeTaskInput);
    expect(payload).toEqual({ prompt: 'Diagnose the situation.', context: 'Some context.' });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('SECRET');
    expect(serialized).not.toContain('do not leak');
  });

  it('Test 7: never throws on null/undefined/empty task input', () => {
    expect(buildProductPromptPayload(null)).toEqual({ prompt: '' });
    expect(buildProductPromptPayload(undefined)).toEqual({ prompt: '' });
    expect(buildProductPromptPayload({} as JudgeTaskInput)).toEqual({ prompt: '' });
  });
});

// ---------------------------------------------------------------------------
// parseJudgeResponse — strict JSON validation
// ---------------------------------------------------------------------------

describe('parseJudgeResponse', () => {
  const criteria = criteriaFixture();

  it('Test 8: happy path with raw JSON returns ok, ordered scores, and binary results', () => {
    const result = parseJudgeResponse(
      jsonResponseFrom(fullScores(4.5), binaryPassAll(criteria)),
      DEFAULT_CONSULTING_RUBRICS,
      criteria
    );
    expect(result.status).toBe('ok');
    expect(result.scores).toHaveLength(5);
    expect(result.scores?.[0].dimension).toBe('answer_first');
    expect(result.scores?.[0].score).toBe(4.5);
    expect(result.binaryResults).toHaveLength(2);
    expect(result.binaryResults?.every((b) => b.pass)).toBe(true);
    expect(result.rationale).toBe('overall ok');
  });

  it('Test 9: rejects loose/non-JSON text (no JSON object at all)', () => {
    const result = parseJudgeResponse(
      'The answer looks pretty good overall, I would say a 4 out of 5.',
      DEFAULT_CONSULTING_RUBRICS,
      criteria
    );
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toBe('no_json_object');
  });

  it('Test 10: handles ```json fences', () => {
    const fenced = '```json\n' + jsonResponseFrom(fullScores(3), binaryPassAll(criteria)) + '\n```';
    const result = parseJudgeResponse(fenced, DEFAULT_CONSULTING_RUBRICS, criteria);
    expect(result.status).toBe('ok');
    expect(result.scores?.every((s) => s.score === 3)).toBe(true);
  });

  it('Test 11: rejects scores outside [1, 5]', () => {
    const broken = fullScores(4);
    broken[0] = { ...broken[0], score: 7 };
    const result = parseJudgeResponse(
      jsonResponseFrom(broken, binaryPassAll(criteria)),
      DEFAULT_CONSULTING_RUBRICS,
      criteria
    );
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/invalid_score_for_answer_first/);
  });

  it('Test 12: rejects non-0.5 increments (3.3 invalid)', () => {
    const broken = fullScores(4);
    broken[1] = { ...broken[1], score: 3.3 };
    const result = parseJudgeResponse(
      jsonResponseFrom(broken, binaryPassAll(criteria)),
      DEFAULT_CONSULTING_RUBRICS,
      criteria
    );
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/invalid_score_for_mece_structure/);
  });

  it('Test 13: rejects missing scale dimensions', () => {
    const partial = fullScores(4).slice(0, 4);
    const result = parseJudgeResponse(
      jsonResponseFrom(partial, binaryPassAll(criteria)),
      DEFAULT_CONSULTING_RUBRICS,
      criteria
    );
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/missing_dimension/);
  });

  it('Test 14: rejects an unknown binary criterion id', () => {
    const bogus: BinaryCriterionResult[] = [
      { id: 'cites-evidence', pass: true, rationale: 'ok' },
      { id: 'not-a-real-criterion', pass: true, rationale: 'ok' },
    ];
    const result = parseJudgeResponse(
      jsonResponseFrom(fullScores(4), bogus),
      DEFAULT_CONSULTING_RUBRICS,
      criteria
    );
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/unknown_binary_criterion/);
  });

  it('Test 15: rejects a missing binary result for an expected criterion', () => {
    const partial: BinaryCriterionResult[] = [
      { id: 'cites-evidence', pass: true, rationale: 'ok' },
    ];
    const result = parseJudgeResponse(
      jsonResponseFrom(fullScores(4), partial),
      DEFAULT_CONSULTING_RUBRICS,
      criteria
    );
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/missing_binary_result: names-owner/);
  });

  it('Test 16: rejects a binary entry whose pass field is not a boolean', () => {
    const raw = JSON.stringify({
      rationale: 'ok',
      dimensions: fullScores(4).map((s) => ({
        dimension: s.dimension,
        score: s.score,
        rationale: s.rationale,
        evidence: s.evidence,
        confidence: s.confidence,
      })),
      binaryResults: [
        { id: 'cites-evidence', pass: 'yes', rationale: 'ok' },
        { id: 'names-owner', pass: true, rationale: 'ok' },
      ],
    });
    const result = parseJudgeResponse(raw, DEFAULT_CONSULTING_RUBRICS, criteria);
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/invalid_pass_for_cites-evidence/);
  });

  it('Test 17: accepts an empty binaryResults array when the task defines no criteria', () => {
    const raw = JSON.stringify({
      rationale: 'ok',
      dimensions: fullScores(4).map((s) => ({
        dimension: s.dimension,
        score: s.score,
        rationale: s.rationale,
        evidence: s.evidence,
        confidence: s.confidence,
      })),
      binaryResults: [],
    });
    const result = parseJudgeResponse(raw, DEFAULT_CONSULTING_RUBRICS, []);
    expect(result.status).toBe('ok');
    expect(result.binaryResults).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// aggregateScores
// ---------------------------------------------------------------------------

describe('aggregateScores', () => {
  it('Test 18: averages correctly to the per-dimension aggregate', () => {
    const scores = fullScores(4);
    scores[2] = { ...scores[2], score: 3 };
    const agg = aggregateScores(scores);
    expect(agg.answerFirst).toBe(4);
    expect(agg.meceStructure).toBe(4);
    expect(agg.grounding).toBe(3);
    expect(agg.actionability).toBe(4);
    expect(agg.evidenceDiscipline).toBe(4);
  });

  it('Test 18b: returns zeros for an empty list', () => {
    const agg = aggregateScores([]);
    for (const value of Object.values(agg)) expect(value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// gradeAllPass — binary BigLaw-Bench-style all-pass verdict
// ---------------------------------------------------------------------------

describe('gradeAllPass', () => {
  const criteria = criteriaFixture();

  it('Test 19: PASS only when every binary criterion passes', () => {
    const result = gradeAllPass(binaryPassAll(criteria), criteria);
    expect(result.verdict).toBe('PASS');
    expect(result.failedCriteria).toEqual([]);
    expect(result.totalCriteria).toBe(2);
    expect(result.passedCriteria).toBe(2);
  });

  it('Test 20: FAIL when any single criterion fails', () => {
    const results: BinaryCriterionResult[] = [
      { id: 'cites-evidence', pass: true, rationale: 'ok' },
      { id: 'names-owner', pass: false, rationale: 'no owner named' },
    ];
    const result = gradeAllPass(results, criteria);
    expect(result.verdict).toBe('FAIL');
    expect(result.failedCriteria).toEqual(['names-owner']);
    expect(result.passedCriteria).toBe(1);
  });

  it('Test 21: a missing result counts as failed — never assumes a pass', () => {
    const results: BinaryCriterionResult[] = [
      { id: 'cites-evidence', pass: true, rationale: 'ok' },
    ];
    const result = gradeAllPass(results, criteria);
    expect(result.verdict).toBe('FAIL');
    expect(result.failedCriteria).toEqual(['names-owner']);
  });

  it('Test 22: undefined/null binaryResults never crashes and never fabricates a PASS', () => {
    expect(gradeAllPass(undefined, criteria).verdict).toBe('FAIL');
    expect(gradeAllPass(null, criteria).verdict).toBe('FAIL');
    expect(gradeAllPass(undefined, criteria).failedCriteria).toEqual([
      'cites-evidence',
      'names-owner',
    ]);
  });

  it('Test 23: a task with zero binary criteria vacuously PASSes the all-pass gate', () => {
    const result = gradeAllPass([], []);
    expect(result.verdict).toBe('PASS');
    expect(result.totalCriteria).toBe(0);
    expect(result.failedCriteria).toEqual([]);
  });

  it('Test 24: never throws on malformed binaryResults entries', () => {
    const malformed = [
      null,
      42,
      { id: 'cites-evidence' /* missing pass */ },
      { pass: true /* missing id */ },
      { id: 'names-owner', pass: true, rationale: 'ok' },
    ] as unknown as BinaryCriterionResult[];
    const result = gradeAllPass(malformed, criteria);
    expect(result.verdict).toBe('FAIL');
    expect(result.failedCriteria).toEqual(['cites-evidence']);
    expect(result.passedCriteria).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// judgeConsultingTask — orchestration, never-throws
// ---------------------------------------------------------------------------

describe('judgeConsultingTask', () => {
  const criteria = criteriaFixture();

  it('Test 25: with mockLlmAdapter returns ok, verdict PASS, and a populated aggregate', async () => {
    const adapter = mockLlmAdapter({
      scores: fullScores(4),
      binaryResults: binaryPassAll(criteria),
      rationale: 'looks great',
    });
    const result = await judgeConsultingTask({ adapter, task: taskFixture() });
    expect(result.status).toBe('ok');
    expect(result.scores).toHaveLength(5);
    expect(result.aggregate?.answerFirst).toBe(4);
    expect(result.verdict).toBe('PASS');
    expect(result.failedCriteria).toEqual([]);
    expect(result.modelId).toBe('mock-judge-1');
    expect(typeof result.durationMs).toBe('number');
  });

  it('Test 26: with mockLlmAdapter reports FAIL verdict when a criterion fails', async () => {
    const adapter = mockLlmAdapter({
      scores: fullScores(4),
      binaryResults: [
        { id: 'cites-evidence', pass: true, rationale: 'ok' },
        { id: 'names-owner', pass: false, rationale: 'no owner named' },
      ],
    });
    const result = await judgeConsultingTask({ adapter, task: taskFixture() });
    expect(result.status).toBe('ok');
    expect(result.verdict).toBe('FAIL');
    expect(result.failedCriteria).toEqual(['names-owner']);
  });

  it('Test 27: with noopLlmAdapter returns unavailable — never fabricates a verdict', async () => {
    const result = await judgeConsultingTask({ adapter: noopLlmAdapter, task: taskFixture() });
    expect(result.status).toBe('unavailable');
    expect(result.scores).toBeUndefined();
    expect(result.verdict).toBeUndefined();
    expect(result.reason).toMatch(/No LLM adapter configured/);
  });

  it('Test 28: handles rate_limited from the adapter', async () => {
    const adapter: LlmJudgeAdapter = {
      async judge() {
        return { status: 'rate_limited', reason: 'quota exhausted' };
      },
    };
    const result = await judgeConsultingTask({ adapter, task: taskFixture() });
    expect(result.status).toBe('rate_limited');
    expect(result.reason).toMatch(/quota exhausted/);
    expect(result.verdict).toBeUndefined();
  });

  it('Test 29: handles invalid_response from parsing (loose text, not JSON)', async () => {
    const adapter: LlmJudgeAdapter = {
      async judge() {
        return { status: 'ok', rawText: 'not json at all', modelId: 'mock-broken' };
      },
    };
    const result = await judgeConsultingTask({ adapter, task: taskFixture() });
    expect(result.status).toBe('invalid_response');
    expect(result.modelId).toBe('mock-broken');
    expect(result.verdict).toBeUndefined();
  });

  it('Test 30: handles adapter timeouts via the wall-clock guard', async () => {
    const adapter: LlmJudgeAdapter = {
      judge() {
        return new Promise(() => {
          /* never resolves */
        });
      },
    };
    const result = await judgeConsultingTask({
      adapter,
      task: taskFixture(),
      timeoutMs: 1_000,
    });
    expect(result.status).toBe('timeout');
  });

  it('Test 31: defensively handles adapters that throw — degrades to unavailable, never crashes', async () => {
    const adapter: LlmJudgeAdapter = {
      async judge() {
        throw new Error('boom');
      },
    };
    const result = await judgeConsultingTask({ adapter, task: taskFixture() });
    expect(result.status).toBe('unavailable');
    expect(result.reason).toMatch(/boom/);
  });

  it('Test 32: never throws on a malformed task input — returns a typed result', async () => {
    const adapter = mockLlmAdapter({ scores: fullScores(4), binaryResults: [] });
    const malformed = {
      taskId: 123 as unknown as string,
      prompt: null as unknown as string,
      modelAnswer: undefined as unknown as string,
      binaryCriteria: 'not an array' as unknown as BinaryCriterion[],
    } as JudgeTaskInput;
    const result = await judgeConsultingTask({ adapter, task: malformed });
    expect(result.status).toBe('ok');
    expect(result.aggregate?.answerFirst).toBe(4);
    expect(result.verdict).toBe('PASS'); // zero criteria on the malformed task -> vacuous pass
  });

  it('Test 33: judge result round-trips through JSON.stringify cleanly', async () => {
    const adapter = mockLlmAdapter({
      scores: fullScores(3.5),
      binaryResults: binaryPassAll(criteria),
    });
    const result = await judgeConsultingTask({ adapter, task: taskFixture() });
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as JudgeResult;
    expect(parsed.status).toBe('ok');
    expect(parsed.scores?.length).toBe(5);
    expect(parsed.verdict).toBe('PASS');
  });
});
