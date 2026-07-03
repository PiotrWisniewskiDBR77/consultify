/**
 * DRD Report — server service + route round-trip.
 *
 * Covers the server entrypoint that the `GET /api/assessment-reports/:id/drd-report`
 * route delegates to: axisData → engine scores → publishing-grade HTML, with the
 * live LLM narrator wired in and a deterministic fail-safe fallback.
 *
 * The server copy of the generator (server/src/services/report/*) is exercised
 * here so a drift from the FE originals is caught.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  areaScoresFromAxisData,
  buildDrdReportHtmlServer,
} from '../../../server/src/services/report/drdReportService';
import type { LlmLike } from '../../../server/src/services/report/drdLlmNarrator';

// Per-axis aggregates as stored on an assessment report's `axis_data` (keyed by
// internal axis key). Mid-maturity manufacturer.
const AXIS_DATA = {
  processes: { actual: 5, target: 6 },
  digitalProducts: { actual: 3, target: 4 },
  businessModels: { actual: 2, target: 4 },
  dataManagement: { actual: 4, target: 6 },
  culture: { actual: 4, target: 5 },
  cybersecurity: { actual: 3, target: 5 },
  aiMaturity: { actual: 2, target: 4 },
};

const META = {
  organizationName: 'Test Manufacturing Sp. z o.o.',
  language: 'pl' as const,
  assessmentName: 'Diagnoza DRD 2026',
};

/**
 * A minimal LLM mock that always returns a VALID narrative for any ConclusionInput:
 * number-free prose (so `numbers_from_engine` trivially passes) with the exact
 * paragraph count the validator expects, and factRefs pulled from the prompt's
 * evidence so `evidence_link` passes.
 */
function makeValidLlmMock(): LlmLike & { calls: number } {
  const mock = {
    calls: 0,
    async call(params: any) {
      mock.calls += 1;
      const userPrompt = String(params?.messages?.[0]?.content ?? '');
      // Recover a real fact/evidence ref from the grounded prompt.
      const evMatch = userPrompt.match(/"ref":\s*"([^"]+)"/);
      const factRef = evMatch ? evMatch[1] : Object.keys({}).join('');
      // Paragraph count: executive_summary → 5, gap_card → 4, else 1.
      const n = /paragraphs\[5\]|dokładnie 5|exactly 5/i.test(userPrompt)
        ? 5
        : /paragraphs\[4\]|dokładnie 4|exactly 4/i.test(userPrompt)
          ? 4
          : 1;
      const paragraphs = Array.from(
        { length: n },
        (_, i) => `Akapit narracyjny bez liczb, zdanie ${['pierwsze', 'drugie', 'trzecie', 'czwarte', 'piąte'][i] || 'kolejne'}.`
      );
      return {
        content: JSON.stringify({
          paragraphs,
          factRefs: factRef ? [factRef] : [],
          confidence: 'medium',
          limits: 'Interpretacja oparta na danych assessmentu.',
        }),
      };
    },
  };
  return mock;
}

describe('DRD report — axisData → areaScores mapping', () => {
  it('expands 7 axis aggregates into all 39 area scores', () => {
    const scores = areaScoresFromAxisData(AXIS_DATA);
    expect(Object.keys(scores)).toHaveLength(39);
    // every area inherits its axis actual/target
    expect(scores['1A']).toEqual({ actual: 5, target: 6 });
    expect(scores['7D']).toEqual({ actual: 2, target: 4 });
  });
});

describe('DRD report — server generation (route core)', () => {
  it('produces standalone HTML with the deterministic narrator when no LLM', async () => {
    const { html, narrative } = await buildDrdReportHtmlServer({ axisData: AXIS_DATA, meta: META });
    expect(narrative).toBe('deterministic');
    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain(META.organizationName);
    // engine-grounded content is present (radar/matrix SVG rendered inline)
    expect(html).toContain('<svg');
    // crimson is forbidden in the report palette
    expect(html.toLowerCase()).not.toContain('#85182f');
  });

  it('uses the live LLM narrator (narrative=llm) when a valid LLM is injected', async () => {
    const llm = makeValidLlmMock();
    const { html, narrative } = await buildDrdReportHtmlServer({
      axisData: AXIS_DATA,
      meta: META,
      llm,
    });
    expect(narrative).toBe('llm');
    expect(llm.calls).toBeGreaterThan(0);
    expect(html).toContain('Akapit narracyjny bez liczb');
  });

  it('falls back to deterministic narrative when the LLM throws (fail-safe)', async () => {
    const throwing: LlmLike = {
      async call() {
        throw new Error('LLM provider down');
      },
    };
    const warn = vi.fn();
    const { html, narrative } = await buildDrdReportHtmlServer({
      axisData: AXIS_DATA,
      meta: META,
      llm: throwing,
      logger: { warn },
    });
    // report still renders — never breaks on LLM failure
    expect(narrative).toBe('deterministic');
    expect(html).toContain('<!DOCTYPE html');
    expect(warn).toHaveBeenCalled();
  });
});
