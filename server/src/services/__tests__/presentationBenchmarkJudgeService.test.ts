import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_DIMENSIONS,
  DEFAULT_RUBRICS,
  aggregateScores,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
  judgeDeckBenchmark,
  judgeResultToDeckScoreInput,
  mockLlmAdapter,
  noopLlmAdapter,
  parseJudgeResponse,
  type DimensionScoreResult,
  type JudgeDeckInput,
  type JudgeResult,
  type LlmJudgeAdapter,
} from '../presentationBenchmarkJudgeService.js';

function fullScores(score = 4): DimensionScoreResult[] {
  return BENCHMARK_DIMENSIONS.map((dimension) => ({
    dimension,
    score,
    rationale: `rationale for ${dimension}`,
    evidence: [`evidence for ${dimension}`],
    confidence: 'medium' as const,
  }));
}

function deckFixture(overrides: Partial<JudgeDeckInput> = {}): JudgeDeckInput {
  return {
    deckId: 'deck_alpha',
    deckTitle: 'Alpha Growth Plan',
    slideSummaries: [
      {
        index: 0,
        title: 'Cover',
        bullets: ['Subtitle', 'Author'],
        layoutHint: 'cover',
      },
      {
        index: 1,
        title: 'Strategy',
        bullets: ['Bullet A', 'Bullet B', 'Bullet C', 'Bullet D', 'Bullet E', 'Bullet F'],
      },
    ],
    brandKit: { primaryColor: '#0E7C66', theme: 'consulting-dark' },
    templateName: 'consulting-v3',
    ...overrides,
  };
}

function jsonResponseFromScores(scores: DimensionScoreResult[], rationale = 'overall ok'): string {
  return JSON.stringify({
    rationale,
    dimensions: scores.map((s) => ({
      dimension: s.dimension,
      score: s.score,
      rationale: s.rationale,
      evidence: s.evidence,
      confidence: s.confidence,
    })),
  });
}

describe('DEFAULT_RUBRICS', () => {
  it('Test 1: contains exactly 5 entries — one per benchmark dimension', () => {
    expect(DEFAULT_RUBRICS).toHaveLength(5);
    const dims = DEFAULT_RUBRICS.map((r) => r.dimension).sort();
    expect(dims).toEqual([...BENCHMARK_DIMENSIONS].sort());
    for (const rubric of DEFAULT_RUBRICS) {
      expect(rubric.description.length).toBeGreaterThan(10);
      expect(rubric.scoringGuidance.length).toBeGreaterThan(5);
      expect(rubric.weight).toBeGreaterThanOrEqual(0);
      expect(rubric.weight).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildJudgeSystemPrompt', () => {
  it('Test 2: instructs the model to return JSON only and use 0.5 increments', () => {
    const prompt = buildJudgeSystemPrompt();
    expect(prompt).toMatch(/JSON only/i);
    expect(prompt).toMatch(/0\.5/);
    expect(prompt).toMatch(/1\.0 to 5\.0/);
  });
});

describe('buildJudgeUserPrompt', () => {
  it('Test 3: includes deck title and every slide title', () => {
    const prompt = buildJudgeUserPrompt({ deck: deckFixture(), rubrics: DEFAULT_RUBRICS });
    expect(prompt).toContain('Alpha Growth Plan');
    expect(prompt).toContain('Cover');
    expect(prompt).toContain('Strategy');
    expect(prompt).toContain('content_quality');
  });

  it('Test 4: truncates bullets to 5 per slide and emits a truncation marker', () => {
    const prompt = buildJudgeUserPrompt({ deck: deckFixture(), rubrics: DEFAULT_RUBRICS });
    expect(prompt).toContain('Bullet A');
    expect(prompt).toContain('Bullet E');
    expect(prompt).not.toContain('Bullet F');
    expect(prompt).toMatch(/1 more bullets truncated/);
  });
});

describe('parseJudgeResponse', () => {
  it('Test 5: happy path with raw JSON returns ok and ordered scores', () => {
    const result = parseJudgeResponse(jsonResponseFromScores(fullScores(4.5)));
    expect(result.status).toBe('ok');
    expect(result.scores).toHaveLength(5);
    expect(result.scores?.[0].dimension).toBe('content_quality');
    expect(result.scores?.[0].score).toBe(4.5);
    expect(result.rationale).toBe('overall ok');
  });

  it('Test 6: handles ```json fences', () => {
    const fenced = '```json\n' + jsonResponseFromScores(fullScores(3)) + '\n```';
    const result = parseJudgeResponse(fenced);
    expect(result.status).toBe('ok');
    expect(result.scores?.every((s) => s.score === 3)).toBe(true);
  });

  it('Test 7: rejects scores outside [1, 5]', () => {
    const broken = fullScores(4);
    broken[0] = { ...broken[0], score: 7 };
    const result = parseJudgeResponse(jsonResponseFromScores(broken));
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/invalid_score_for_content_quality/);
  });

  it('Test 8: rejects non-0.5 increments (3.3 invalid)', () => {
    const broken = fullScores(4);
    broken[1] = { ...broken[1], score: 3.3 };
    const result = parseJudgeResponse(jsonResponseFromScores(broken));
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/invalid_score_for_visual_design/);
  });

  it('Test 9: rejects missing dimensions', () => {
    const partial = fullScores(4).slice(0, 4);
    const result = parseJudgeResponse(jsonResponseFromScores(partial));
    expect(result.status).toBe('invalid_response');
    expect(result.reason).toMatch(/missing_dimension/);
  });
});

describe('aggregateScores', () => {
  it('Test 10: averages correctly to the per-dimension aggregate', () => {
    const scores = fullScores(4);
    scores[2] = { ...scores[2], score: 3 };
    const agg = aggregateScores(scores);
    expect(agg.contentQuality).toBe(4);
    expect(agg.visualDesign).toBe(4);
    expect(agg.longContextProcessing).toBe(3);
    expect(agg.apiAutomation).toBe(4);
    expect(agg.conversationalEditing).toBe(4);
  });

  it('Test 10b: returns zeros for an empty list', () => {
    const agg = aggregateScores([]);
    for (const value of Object.values(agg)) expect(value).toBe(0);
  });
});

describe('judgeDeckBenchmark', () => {
  it('Test 11: with mockLlmAdapter returns ok and a populated aggregate', async () => {
    const adapter = mockLlmAdapter({ scores: fullScores(4), rationale: 'looks great' });
    const result = await judgeDeckBenchmark({ adapter, deck: deckFixture() });
    expect(result.status).toBe('ok');
    expect(result.scores).toHaveLength(5);
    expect(result.aggregate?.contentQuality).toBe(4);
    expect(result.modelId).toBe('mock-judge-1');
    expect(typeof result.durationMs).toBe('number');
  });

  it('Test 12: with noopLlmAdapter returns unavailable', async () => {
    const result = await judgeDeckBenchmark({ adapter: noopLlmAdapter, deck: deckFixture() });
    expect(result.status).toBe('unavailable');
    expect(result.scores).toBeUndefined();
    expect(result.reason).toMatch(/No LLM adapter configured/);
  });

  it('Test 13: handles rate_limited from the adapter', async () => {
    const adapter: LlmJudgeAdapter = {
      async judge() {
        return { status: 'rate_limited', reason: 'quota exhausted' };
      },
    };
    const result = await judgeDeckBenchmark({ adapter, deck: deckFixture() });
    expect(result.status).toBe('rate_limited');
    expect(result.reason).toMatch(/quota exhausted/);
  });

  it('Test 14: handles invalid_response from parsing', async () => {
    const adapter: LlmJudgeAdapter = {
      async judge() {
        return { status: 'ok', rawText: 'not json at all', modelId: 'mock-broken' };
      },
    };
    const result = await judgeDeckBenchmark({ adapter, deck: deckFixture() });
    expect(result.status).toBe('invalid_response');
    expect(result.modelId).toBe('mock-broken');
  });

  it('Test 14b: handles adapter timeouts via the wall-clock guard', async () => {
    const adapter: LlmJudgeAdapter = {
      judge() {
        return new Promise(() => {
          /* never resolves */
        });
      },
    };
    const result = await judgeDeckBenchmark({
      adapter,
      deck: deckFixture(),
      timeoutMs: 1_000,
    });
    expect(result.status).toBe('timeout');
  });

  it('Test 14c: defensively handles adapters that throw — degrades to unavailable', async () => {
    const adapter: LlmJudgeAdapter = {
      async judge() {
        throw new Error('boom');
      },
    };
    const result = await judgeDeckBenchmark({ adapter, deck: deckFixture() });
    expect(result.status).toBe('unavailable');
    expect(result.reason).toMatch(/boom/);
  });
});

describe('judgeResultToDeckScoreInput', () => {
  it('Test 15: maps aggregated judge result onto the Sprint 15 DeckScoreInput shape', () => {
    const result: JudgeResult = {
      status: 'ok',
      scores: fullScores(4),
      aggregate: aggregateScores(fullScores(4)),
      rationale: 'good deck',
      modelId: 'mock-judge-1',
      durationMs: 50,
    };
    const mapped = judgeResultToDeckScoreInput(result, 'deck_alpha', 'Alpha Growth Plan');
    expect(mapped).not.toBeNull();
    expect(mapped?.deckId).toBe('deck_alpha');
    expect(mapped?.deckTitle).toBe('Alpha Growth Plan');
    expect(mapped?.contentQuality).toBe(4);
    expect(mapped?.notes).toMatch(/good deck/);
    expect(mapped?.notes).toMatch(/mock-judge-1/);
  });

  it('Test 16: returns null on unavailable status', () => {
    const result: JudgeResult = { status: 'unavailable', reason: 'no key' };
    const mapped = judgeResultToDeckScoreInput(result, 'deck_alpha', 'Alpha');
    expect(mapped).toBeNull();
  });
});

describe('JSON-serializable result and defensive inputs', () => {
  it('Test 17: judge result round-trips through JSON.stringify cleanly', async () => {
    const adapter = mockLlmAdapter({ scores: fullScores(3.5) });
    const result = await judgeDeckBenchmark({ adapter, deck: deckFixture() });
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as JudgeResult;
    expect(parsed.status).toBe('ok');
    expect(parsed.scores?.length).toBe(5);
  });

  it('Test 18: never throws on a malformed deck input — returns a typed result', async () => {
    const adapter = mockLlmAdapter({ scores: fullScores(4) });
    const malformed = {
      deckId: 123 as unknown as string,
      deckTitle: null as unknown as string,
      slideSummaries: 'not an array' as unknown as JudgeDeckInput['slideSummaries'],
    } as JudgeDeckInput;
    const result = await judgeDeckBenchmark({ adapter, deck: malformed });
    expect(result.status).toBe('ok');
    expect(result.aggregate?.contentQuality).toBe(4);
  });
});
