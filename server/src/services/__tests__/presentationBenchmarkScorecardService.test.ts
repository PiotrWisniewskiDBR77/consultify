import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_DIMENSIONS,
  type BenchmarkDimension,
  type BenchmarkRunInput,
  type BenchmarkRunRecord,
  computeBenchmarkScorecard,
  computeVerdict,
  type DeckScoreInput,
  GAMMA_TARGET,
  renderBenchmarkScorecardMarkdown,
  WARNING_THRESHOLD,
} from '../presentationBenchmarkScorecardService.js';

const ORG = 'org_test';
const RUN_LABEL = '2026-05';
const REFERENCE_SET = 'DBR77+VTS';

function deck(overrides: Partial<DeckScoreInput> = {}): DeckScoreInput {
  return {
    deckId: 'd1',
    deckTitle: 'Sample Deck',
    contentQuality: 4,
    visualDesign: 4,
    longContextProcessing: 4,
    apiAutomation: 4,
    conversationalEditing: 4,
    ...overrides,
  };
}

function baseInput(overrides: Partial<BenchmarkRunInput> = {}): BenchmarkRunInput {
  return {
    runLabel: RUN_LABEL,
    organizationId: ORG,
    referenceSet: REFERENCE_SET,
    decks: [],
    ...overrides,
  };
}

describe('computeBenchmarkScorecard', () => {
  it('Test 1: empty deck list yields zero dimensions and BLOCK verdict', () => {
    const record = computeBenchmarkScorecard(baseInput({ decks: [] }));
    expect(record.totalDecksScored).toBe(0);
    for (const dim of BENCHMARK_DIMENSIONS) {
      expect(record.scores[dim]).toBe(0);
    }
    expect(record.verdict).toBe('BLOCK');
    expect(record.deltaVsPrior).toBeNull();
  });

  it('Test 2: single 5/5/5/5/5 deck yields 5.0 across the board with PASS', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 5,
            visualDesign: 5,
            longContextProcessing: 5,
            apiAutomation: 5,
            conversationalEditing: 5,
          }),
        ],
      })
    );
    for (const dim of BENCHMARK_DIMENSIONS) expect(record.scores[dim]).toBe(5);
    expect(record.verdict).toBe('PASS');
    expect(record.totalDecksScored).toBe(1);
  });

  it('Test 3: single 4/4/4/4/4 deck (exactly gamma target) yields PASS', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 4,
            visualDesign: 4,
            longContextProcessing: 4,
            apiAutomation: 4,
            conversationalEditing: 4,
          }),
        ],
      })
    );
    for (const dim of BENCHMARK_DIMENSIONS) expect(record.scores[dim]).toBe(4);
    expect(record.verdict).toBe('PASS');
  });

  it('Test 4: 3.9/4/4/4/4 deck mixes warnings and produces PASS_WITH_WARNINGS', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 3.9,
            visualDesign: 4,
            longContextProcessing: 4,
            apiAutomation: 4,
            conversationalEditing: 4,
          }),
        ],
      })
    );
    expect(record.scores.content_quality).toBe(3.9);
    expect(record.verdict).toBe('PASS_WITH_WARNINGS');
  });

  it('Test 5: a sub-warning dimension (3/4/4/4/4) forces BLOCK verdict', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 3,
            visualDesign: 4,
            longContextProcessing: 4,
            apiAutomation: 4,
            conversationalEditing: 4,
          }),
        ],
      })
    );
    expect(record.verdict).toBe('BLOCK');
  });

  it('Test 6: multi-deck input averages each dimension correctly to 2 decimals', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            deckId: 'd1',
            contentQuality: 4.5,
            visualDesign: 4.2,
            longContextProcessing: 4.0,
            apiAutomation: 3.8,
            conversationalEditing: 4.3,
          }),
          deck({
            deckId: 'd2',
            contentQuality: 4.1,
            visualDesign: 4.3,
            longContextProcessing: 4.0,
            apiAutomation: 3.9,
            conversationalEditing: 4.2,
          }),
        ],
      })
    );

    expect(record.totalDecksScored).toBe(2);
    expect(record.scores.content_quality).toBe(4.3);
    expect(record.scores.visual_design).toBe(4.25);
    expect(record.scores.long_context_processing).toBe(4.0);
    expect(record.scores.api_automation).toBe(3.85);
    expect(record.scores.conversational_editing).toBe(4.25);
    expect(record.verdict).toBe('PASS_WITH_WARNINGS');
  });

  it('Test 7: deltaVsPrior is computed per-dimension when a prior run is provided', () => {
    const prior: BenchmarkRunRecord = {
      organizationId: ORG,
      runLabel: '2026-04',
      referenceSet: REFERENCE_SET,
      totalDecksScored: 1,
      scores: {
        content_quality: 4.0,
        visual_design: 4.0,
        long_context_processing: 4.0,
        api_automation: 4.0,
        conversational_editing: 4.0,
      },
      verdict: 'PASS',
      deltaVsPrior: null,
      notes: null,
      reportedBy: null,
      createdAt: '2026-04-01T00:00:00.000Z',
    };

    const record = computeBenchmarkScorecard(
      baseInput({
        priorRun: prior,
        decks: [
          deck({
            contentQuality: 4.5,
            visualDesign: 4.0,
            longContextProcessing: 3.8,
            apiAutomation: 4.2,
            conversationalEditing: 4.1,
          }),
        ],
      })
    );

    expect(record.deltaVsPrior).not.toBeNull();
    expect(record.deltaVsPrior?.content_quality).toBe(0.5);
    expect(record.deltaVsPrior?.visual_design).toBe(0);
    expect(record.deltaVsPrior?.long_context_processing).toBe(-0.2);
    expect(record.deltaVsPrior?.api_automation).toBe(0.2);
    expect(record.deltaVsPrior?.conversational_editing).toBe(0.1);
  });

  it('Test 8: deltaVsPrior is null when no prior run is provided', () => {
    const record = computeBenchmarkScorecard(baseInput({ decks: [deck()] }));
    expect(record.deltaVsPrior).toBeNull();
  });

  it('Test 9: rendered Markdown lists every dimension and verdict', () => {
    const record = computeBenchmarkScorecard(baseInput({ decks: [deck()] }));
    const md = renderBenchmarkScorecardMarkdown(record);
    expect(md).toContain('Content Quality');
    expect(md).toContain('Visual Design');
    expect(md).toContain('Long-Context Processing');
    expect(md).toContain('API & Automation');
    expect(md).toContain('Conversational Editing');
    expect(md).toContain(`Verdict: ${record.verdict}`);
  });

  it('Test 10: Markdown verdict line matches the record verdict for each branch', () => {
    const passRecord = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 5,
            visualDesign: 5,
            longContextProcessing: 5,
            apiAutomation: 5,
            conversationalEditing: 5,
          }),
        ],
      })
    );
    expect(renderBenchmarkScorecardMarkdown(passRecord)).toContain('Verdict: PASS');

    const warnRecord = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 3.8,
            visualDesign: 4,
            longContextProcessing: 4,
            apiAutomation: 4,
            conversationalEditing: 4,
          }),
        ],
      })
    );
    expect(renderBenchmarkScorecardMarkdown(warnRecord)).toContain('Verdict: PASS_WITH_WARNINGS');

    const blockRecord = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 2,
            visualDesign: 4,
            longContextProcessing: 4,
            apiAutomation: 4,
            conversationalEditing: 4,
          }),
        ],
      })
    );
    expect(renderBenchmarkScorecardMarkdown(blockRecord)).toContain('Verdict: BLOCK');
  });

  it('Test 11: produced record is JSON-serializable and round-trips', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        notes: 'monthly run',
        reportedBy: 'piotr@dbr77.com',
        decks: [deck()],
      })
    );
    const json = JSON.stringify(record);
    const parsed = JSON.parse(json) as BenchmarkRunRecord;
    expect(parsed.runLabel).toBe(RUN_LABEL);
    expect(parsed.scores.content_quality).toBe(record.scores.content_quality);
    expect(parsed.notes).toBe('monthly run');
    expect(parsed.reportedBy).toBe('piotr@dbr77.com');
  });

  it('Test 12: computeVerdict thresholds are exact at 4.0 (PASS) and 3.5 (BLOCK)', () => {
    const allFour = {
      content_quality: 4.0,
      visual_design: 4.0,
      long_context_processing: 4.0,
      api_automation: 4.0,
      conversational_editing: 4.0,
    };
    expect(computeVerdict(allFour)).toBe('PASS');

    const oneJustBelowFour = { ...allFour, content_quality: 3.99 };
    expect(computeVerdict(oneJustBelowFour)).toBe('PASS_WITH_WARNINGS');

    const oneAtThreeFive = { ...allFour, content_quality: 3.5 };
    expect(computeVerdict(oneAtThreeFive)).toBe('PASS_WITH_WARNINGS');

    const oneJustBelowThreeFive = { ...allFour, content_quality: 3.49 };
    expect(computeVerdict(oneJustBelowThreeFive)).toBe('BLOCK');
  });

  it('Test 13: computeVerdict honours a custom gamma target', () => {
    const allFour = {
      content_quality: 4.0,
      visual_design: 4.0,
      long_context_processing: 4.0,
      api_automation: 4.0,
      conversational_editing: 4.0,
    };
    expect(computeVerdict(allFour, 4.5)).toBe('PASS_WITH_WARNINGS');

    const allFourPointFive: Record<BenchmarkDimension, number> = {
      content_quality: 4.5,
      visual_design: 4.5,
      long_context_processing: 4.5,
      api_automation: 4.5,
      conversational_editing: 4.5,
    };
    expect(computeVerdict(allFourPointFive, 4.5)).toBe('PASS');

    expect(GAMMA_TARGET).toBe(4.0);
    expect(WARNING_THRESHOLD).toBe(3.5);
  });

  it('Test 14: malformed input never throws and falls back to BLOCK with zero scores', () => {
    expect(() =>
      computeBenchmarkScorecard(undefined as unknown as BenchmarkRunInput)
    ).not.toThrow();
    const record = computeBenchmarkScorecard({
      runLabel: '',
      organizationId: '',
      referenceSet: '',
      decks: [
        {
          deckId: 'bad',
          deckTitle: 'Broken',
          contentQuality: Number.NaN,
          visualDesign: -2,
          longContextProcessing: 99,
          apiAutomation: undefined as unknown as number,
          conversationalEditing: 'oops' as unknown as number,
        },
      ],
    });
    expect(record.verdict).toBe('BLOCK');
    expect(record.scores.content_quality).toBe(0);
    expect(record.scores.visual_design).toBe(0);
    expect(record.scores.long_context_processing).toBe(5);
    expect(record.referenceSet).toBe('DBR77+VTS');
    expect(() => renderBenchmarkScorecardMarkdown(record)).not.toThrow();
  });

  it('Test 15: rendered Markdown is reproducible and includes the createdAt footer', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        reportedBy: 'qa@dbr77.com',
        decks: [deck()],
      })
    );
    record.createdAt = '2026-05-01T09:00:00.000Z';

    const md1 = renderBenchmarkScorecardMarkdown(record);
    const md2 = renderBenchmarkScorecardMarkdown(record);
    expect(md1).toBe(md2);
    expect(md1).toContain('Reported by: qa@dbr77.com');
    expect(md1).toContain('Created at: 2026-05-01T09:00:00.000Z');
    expect(md1).toContain('| Dimension | Current | Prior | Delta | Status |');
  });

  it('Test 16: status column uses ASCII tokens (OK / ~ / FAIL) — no emoji', () => {
    const record = computeBenchmarkScorecard(
      baseInput({
        decks: [
          deck({
            contentQuality: 4.5,
            visualDesign: 3.7,
            longContextProcessing: 3.0,
            apiAutomation: 4.0,
            conversationalEditing: 3.5,
          }),
        ],
      })
    );
    const md = renderBenchmarkScorecardMarkdown(record);
    expect(md).toMatch(/\| OK \|/);
    expect(md).toMatch(/\| ~ \|/);
    expect(md).toMatch(/\| FAIL \|/);
    expect(md).not.toMatch(/[\u2705\u26A0\u274C]/);
  });
});
