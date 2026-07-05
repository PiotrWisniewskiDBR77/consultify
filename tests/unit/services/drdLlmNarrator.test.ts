import { describe, expect, it, vi } from 'vitest';

import type { ConclusionInput } from '../../../src/services/report/drdConclusionContract';
import {
  buildNarratorPrompt,
  extractNumbers,
  makeLlmNarrator,
  numbersFromFacts,
  parseNarrativeJson,
  validateFactRefs,
  validateNarrative,
  validateNumbersFromEngine,
  type LlmLike,
} from '../../../src/services/report/drdLlmNarrator';
import { generateDrdReport } from '../../../src/services/report/drdReportGenerator';
import {
  SAMPLE_DRD_META,
  SAMPLE_DRD_SCORES,
} from '../../../src/services/report/drdReportSampleData';

const GAP_INPUT: ConclusionInput = {
  kind: 'gap_card',
  language: 'en',
  organizationName: 'Test Co',
  facts: {
    areaName: 'Sales Processes',
    axisName: 'Digital Processes',
    actual: 3,
    target: 6,
    maxLevel: 7,
    currentLevelTitle: 'Process Control',
    targetLevelTitle: 'ERP',
  },
  evidence: [{ type: 'drd_area', ref: '1A', excerpt: '3→6' }],
};

/** A model whose call() returns a fixed raw content string. */
function mockLlm(content: string): LlmLike & { call: ReturnType<typeof vi.fn> } {
  return { call: vi.fn(async () => ({ content })) };
}

describe('drdLlmNarrator — number extraction / numbers_from_engine', () => {
  it('extracts and canonicalizes numbers (%, level notation, PL/EN decimals)', () => {
    expect([...extractNumbers('level 3/7 at 42%')]).toEqual(
      expect.arrayContaining(['3', '7', '42'])
    );
    // PL decimal comma and EU grouping
    expect([...extractNumbers('marża 1,2 przy 1.234,5')]).toEqual(
      expect.arrayContaining(['1.2', '1234.5'])
    );
    // trailing "6.0" collapses to "6"
    expect([...extractNumbers('target 6.0')]).toContain('6');
  });

  it('numbersFromFacts collects every engine number including rounded forms', () => {
    const set = numbersFromFacts({ actual: 3, target: 6.4, maxLevel: 7 });
    expect(set).toContain('3');
    expect(set).toContain('6.4');
    expect(set).toContain('6'); // rounded form allowed
    expect(set).toContain('7');
  });

  it('PASSES when every prose number is in facts', () => {
    const res = validateNumbersFromEngine(
      ['Area sits at level 3/7 against target 6/7.'],
      GAP_INPUT.facts
    );
    expect(res.ok).toBe(true);
    expect(res.offenders).toEqual([]);
  });

  it('FAILS (hard) when prose invents a number absent from facts', () => {
    const res = validateNumbersFromEngine(
      ['This will save 250000 EUR and 42 days.'],
      GAP_INPUT.facts
    );
    expect(res.ok).toBe(false);
    expect(res.offenders).toContain('250000');
  });

  it('allows structural methodology constants (7 axes, 3 waves, 39 areas)', () => {
    const res = validateNumbersFromEngine(
      ['Across 7 axes and 3 waves covering 39 areas.'],
      GAP_INPUT.facts
    );
    expect(res.ok).toBe(true);
  });
});

describe('drdLlmNarrator — factRefs / evidence_link', () => {
  it('PASSES when factRefs resolve to evidence ref or facts keys', () => {
    const res = validateFactRefs(['1A', 'actual'], GAP_INPUT);
    expect(res.ok).toBe(true);
    expect(res.hasAny).toBe(true);
  });

  it('FAILS when a factRef is dangling', () => {
    const res = validateFactRefs(['1A', 'ghostFact'], GAP_INPUT);
    expect(res.ok).toBe(false);
    expect(res.dangling).toContain('ghostFact');
  });

  it('FAILS when there are no factRefs at all', () => {
    const res = validateFactRefs([], GAP_INPUT);
    expect(res.ok).toBe(false);
    expect(res.hasAny).toBe(false);
  });
});

describe('drdLlmNarrator — validateNarrative', () => {
  const good = JSON.stringify({
    paragraphs: [
      'What is: area at level 3/7.',
      'What it means: not leveraging level 6/7.',
      'What to do: plan the move to level 6, owner IT Lead.',
      'Effect: closes the gap within 6 months.',
    ],
    factRefs: ['1A', 'actual', 'target'],
    confidence: 'medium',
    limits: 'Scope requires refinement.',
  });

  it('accepts a well-formed, grounded response as narrative:llm', () => {
    const res = validateNarrative(parseNarrativeJson(good), GAP_INPUT);
    expect(res.ok).toBe(true);
    expect(res.output?.narrative).toBe('llm');
    expect(res.output?.aiGenerated).toBe(true);
    expect(res.output?.paragraphs).toHaveLength(4);
  });

  it('rejects wrong paragraph count', () => {
    const bad = JSON.stringify({ paragraphs: ['only one'], factRefs: ['1A'] });
    expect(validateNarrative(parseNarrativeJson(bad), GAP_INPUT).ok).toBe(false);
  });

  it('rejects invented numbers (numbers_from_engine)', () => {
    const bad = JSON.stringify({
      paragraphs: [
        'What is: area at level 3/7.',
        'What it means: costs 999999 EUR.',
        'What to do: plan the move to level 6.',
        'Effect: closes the gap within 6 months.',
      ],
      factRefs: ['1A'],
    });
    const res = validateNarrative(parseNarrativeJson(bad), GAP_INPUT);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('numbers_from_engine');
  });

  it('rejects missing factRefs (evidence_link)', () => {
    const bad = JSON.stringify({
      paragraphs: [
        'What is: area at level 3/7.',
        'What it means: not leveraging level 6/7.',
        'What to do: plan the move to level 6.',
        'Effect: closes the gap within 6 months.',
      ],
      factRefs: [],
    });
    const res = validateNarrative(parseNarrativeJson(bad), GAP_INPUT);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('no_factrefs');
  });
});

describe('drdLlmNarrator — makeLlmNarrator fail-safe orchestration', () => {
  const goodResponse = JSON.stringify({
    paragraphs: [
      'What is: area at level 3/7.',
      'What it means: not leveraging level 6/7.',
      'What to do: plan the move to level 6, owner IT Lead.',
      'Effect: closes the gap within 6 months.',
    ],
    factRefs: ['1A', 'actual', 'target'],
    confidence: 'medium',
    limits: 'Scope requires refinement.',
  });

  it('returns validated LLM prose on first success', async () => {
    const llm = mockLlm(goodResponse);
    const narrator = makeLlmNarrator({ llm });
    const out = await narrator(GAP_INPUT);
    expect(out.narrative).toBe('llm');
    expect(llm.call).toHaveBeenCalledTimes(1);
    // timeoutMs pitfall: heavy calls get the 120s override.
    expect(llm.call.mock.calls[0][0].timeoutMs).toBe(120_000);
    expect(llm.call.mock.calls[0][0].type).toBe('text');
  });

  it('retries ONCE on a bad response, then succeeds', async () => {
    const bad = JSON.stringify({ paragraphs: ['only one'], factRefs: [] });
    const llm: LlmLike & { call: ReturnType<typeof vi.fn> } = {
      call: vi
        .fn()
        .mockResolvedValueOnce({ content: bad })
        .mockResolvedValueOnce({ content: goodResponse }),
    };
    const narrator = makeLlmNarrator({ llm });
    const out = await narrator(GAP_INPUT);
    expect(llm.call).toHaveBeenCalledTimes(2);
    expect(out.narrative).toBe('llm');
  });

  it('falls back to deterministic stub after two bad responses', async () => {
    const bad = JSON.stringify({ paragraphs: ['nope'], factRefs: [] });
    const llm = mockLlm(bad);
    const narrator = makeLlmNarrator({ llm });
    const out = await narrator(GAP_INPUT);
    expect(llm.call).toHaveBeenCalledTimes(2);
    expect(out.narrative).toBe('deterministic');
    expect(out.aiGenerated).toBe(false);
    expect(out.paragraphs).toHaveLength(4); // stub still produces the 4-part card
  });

  it('falls back to deterministic stub when the LLM throws (never breaks generation)', async () => {
    const llm: LlmLike & { call: ReturnType<typeof vi.fn> } = {
      call: vi.fn(async () => {
        throw new Error('provider timeout');
      }),
    };
    const narrator = makeLlmNarrator({ llm });
    const out = await narrator(GAP_INPUT);
    expect(out.narrative).toBe('deterministic');
    expect(out.paragraphs).toHaveLength(4);
  });
});

describe('drdLlmNarrator — PL/EN prompt language', () => {
  it('builds a Polish prompt for pl input', () => {
    const { systemPrompt } = buildNarratorPrompt({ ...GAP_INPUT, language: 'pl' });
    expect(systemPrompt).toContain('partnerem firmy doradczej');
    expect(systemPrompt).toContain('Liczby WYŁĄCZNIE');
  });

  it('builds an English prompt for en input', () => {
    const { systemPrompt } = buildNarratorPrompt({ ...GAP_INPUT, language: 'en' });
    expect(systemPrompt).toContain('consulting-firm partner');
    expect(systemPrompt).toContain('Numbers ONLY');
  });
});

describe('drdLlmNarrator — end-to-end via generateDrdReport (mock llm)', () => {
  it('produces an LLM-authored report when a valid llm is injected', async () => {
    // A model that always returns a grounded exec/gap/chapter response.
    // We echo engine numbers back so numbers_from_engine passes for any kind.
    const llm: LlmLike = {
      call: vi.fn(async (params) => {
        const userMsg = params.messages.map((m) => m.content).join('\n');
        // Pull the facts JSON out of the user prompt and reuse its numbers.
        const factsMatch = userMsg.match(/facts:\n([\s\S]*?)\n\nevidence:/);
        const facts = factsMatch ? JSON.parse(factsMatch[1]) : {};
        const nums = numbersFromFacts(facts);
        const anyNum = [...nums][0] ?? '3';
        // Detect kind by required paragraph count phrasing.
        const isExec = /paragraphs\[5\]/.test(userMsg);
        const isGap = /paragraphs\[4\]/.test(userMsg);
        const refKeys = Object.keys(facts).slice(0, 2);
        const paragraphs = isExec
          ? Array.from({ length: 5 }, (_, i) => `Exec point ${i + 1}: value ${anyNum}.`)
          : isGap
            ? Array.from({ length: 4 }, (_, i) => `Gap point ${i + 1}: value ${anyNum}.`)
            : [`Axis verdict: value ${anyNum}.`];
        return {
          content: JSON.stringify({
            paragraphs,
            factRefs: refKeys.length ? refKeys : ['maxLevel'],
            confidence: 'medium',
            limits: 'Workshop validation recommended.',
          }),
        };
      }),
    };

    const { model, html } = await generateDrdReport(SAMPLE_DRD_SCORES, SAMPLE_DRD_META, { llm });
    expect(model.executiveSummary.narrative).toBe('llm');
    expect(model.executiveSummary.paragraphs).toHaveLength(5);
    for (const card of model.gapCards) expect(card.narrative.narrative).toBe('llm');
    // The deterministic flag must NOT appear when narrative is LLM-authored.
    expect(html).not.toContain('Deterministic narrative');
  });

  it('falls back to a deterministic report (with flag) when llm always fails', async () => {
    const llm: LlmLike = { call: vi.fn(async () => ({ content: 'not json' })) };
    const { model, html } = await generateDrdReport(SAMPLE_DRD_SCORES, SAMPLE_DRD_META, { llm });
    expect(model.executiveSummary.narrative).toBe('deterministic');
    // Sample meta is Polish → the PL deterministic flag string is rendered.
    expect(html).toContain('Narracja deterministyczna');
  });
});
