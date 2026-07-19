import { describe, expect, it } from 'vitest';

import {
  buildCategoryLadderPromptBlock,
  buildNarrativeConclusionPrompt,
  buildPyramidPromptRules,
  buildPyramidValidationPromptBlock,
  DECLARED_UNCONFIRMED_LABEL,
  evaluateArgumentEvidence,
  NARRATIVE_PYRAMID_QUESTION_BANK,
  type PyramidCategory,
  validateArgumentStaircase,
  validateGoverningThought,
  validateNarrativePyramid,
  validatePyramidMece,
  validatePyramidQuestionBank,
  validateScqa,
} from '../../src/config/narrativeengine';
import { buildNarrativeEngineConversationProtocol } from '../../src/hooks/discovery/toolAi/narrativeEngine';
import type { NarrativeEngineData, NarrativePillar } from '../../src/store/useToolStore';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const pillar = (id: string, overrides: Partial<NarrativePillar> = {}): NarrativePillar => ({
  id,
  title: `Pillar ${id}`,
  message: 'claim',
  proofPoints: [],
  audienceResonance: 'medium',
  drivers: [],
  evidence: [],
  ...overrides,
});

const buildData = (
  pillars: NarrativePillar[],
  contextOverrides: Partial<NarrativeEngineData['context']> = {}
): NarrativeEngineData => ({
  context: {
    audience: 'CFO',
    coreMessage: 'We should consolidate vendor contracts to cut procurement costs by 12%',
    ...contextOverrides,
  },
  signals: [],
  pillars,
  threads: [],
  recommendedMoves: [],
  outputCandidates: [],
});

// A clean, MECE, evidenced pair of arguments for the "everything passes" tests.
const cleanPillars = (): NarrativePillar[] => [
  pillar('p1', {
    title: 'Vendor pricing is fragmented across 40 suppliers',
    message: 'Fragmented vendor pricing prevents volume discounts on procurement spend',
    proofPoints: ['40 active suppliers billed separately in FY25 ledger'],
    evidence: ['Procurement ledger export Q2'],
    implication: 'Consolidating volume into 8 vendors unlocks tiered discount pricing within two quarters',
  }),
  pillar('p2', {
    title: 'Contract renewal timing is uncoordinated',
    message: 'Uncoordinated renewal dates block joint negotiation leverage across suppliers',
    proofPoints: ['Renewal dates span 11 different months in the contract register'],
    evidence: ['Contract register export'],
    implication: 'Aligning renewal windows lets procurement negotiate all contracts in one leverage event',
  }),
];

const cleanScqa = () => ({
  situation: 'Procurement spends 8% of revenue across 40 separate vendor contracts today',
  complication: 'Vendor pricing has drifted 6% above market benchmark over the last two renewal cycles',
  question: 'Should we consolidate vendor contracts to recapture that pricing drift',
  coreMessage: 'We should consolidate vendor contracts to cut procurement costs by 12%',
});

// ---------------------------------------------------------------------------
// 1. Question bank structural integrity
// ---------------------------------------------------------------------------

describe('narrative pyramid question bank — structure', () => {
  it('has zero structural problems (acyclic, all branches resolve, PL+EN present)', () => {
    expect(validatePyramidQuestionBank()).toEqual([]);
  });

  it('defines all four categories: thesis, scqa, pyramid, evidence', () => {
    const categories = Object.keys(NARRATIVE_PYRAMID_QUESTION_BANK) as PyramidCategory[];
    expect(categories.sort()).toEqual(['evidence', 'pyramid', 'scqa', 'thesis'].sort());
  });

  it('every category has exactly one level-1 entry question', () => {
    (Object.keys(NARRATIVE_PYRAMID_QUESTION_BANK) as PyramidCategory[]).forEach((category) => {
      const entries = NARRATIVE_PYRAMID_QUESTION_BANK[category].filter((q) => q.level === 1);
      expect(entries.length).toBe(1);
    });
  });

  it('every question has at least 2 answer options, each with a branch target', () => {
    Object.values(NARRATIVE_PYRAMID_QUESTION_BANK)
      .flat()
      .forEach((q) => {
        expect(q.answerOptions.length).toBeGreaterThanOrEqual(2);
        q.answerOptions.forEach((opt) => {
          expect(opt.key in q.branches).toBe(true);
        });
      });
  });

  it('buildCategoryLadderPromptBlock renders non-empty PL and EN text for every category', () => {
    (Object.keys(NARRATIVE_PYRAMID_QUESTION_BANK) as PyramidCategory[]).forEach((category) => {
      const pl = buildCategoryLadderPromptBlock(category, 'pl');
      const en = buildCategoryLadderPromptBlock(category, 'en');
      expect(pl.length).toBeGreaterThan(20);
      expect(en.length).toBeGreaterThan(20);
      expect(pl).not.toEqual(en);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Evidence gate
// ---------------------------------------------------------------------------

describe('evidence gate', () => {
  it('confirms an argument with at least one proof point', () => {
    const result = evaluateArgumentEvidence({ proofPoints: ['a hard number'], evidence: [] });
    expect(result.status).toBe('confirmed');
    expect(result.label).toBeUndefined();
  });

  it('confirms an argument with only an evidence entry (no proofPoints)', () => {
    const result = evaluateArgumentEvidence({ proofPoints: [], evidence: ['an artifact link'] });
    expect(result.status).toBe('confirmed');
  });

  it('declares — unconfirmed when both proofPoints and evidence are empty/blank', () => {
    const result = evaluateArgumentEvidence({ proofPoints: ['', '  '], evidence: undefined });
    expect(result.status).toBe('declared');
    expect(result.label?.pl).toBe(DECLARED_UNCONFIRMED_LABEL.pl);
    expect(result.label?.en).toBe(DECLARED_UNCONFIRMED_LABEL.en);
  });

  it('uses the exact canonical bilingual label text', () => {
    expect(DECLARED_UNCONFIRMED_LABEL.pl).toBe('Deklaracja — niepotwierdzone');
    expect(DECLARED_UNCONFIRMED_LABEL.en).toBe('Declared — unconfirmed');
  });
});

// ---------------------------------------------------------------------------
// 3. SCQA validator
// ---------------------------------------------------------------------------

describe('validateScqa', () => {
  it('flags all four missing elements when the context is empty', () => {
    const issues = validateScqa({});
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('missing-situation');
    expect(codes).toContain('missing-complication');
    expect(codes).toContain('missing-question');
    expect(codes).toContain('missing-answer');
  });

  it('flags a complication that mostly restates the situation', () => {
    const issues = validateScqa({
      situation: 'Procurement spends heavily on forty separate vendor contracts every year',
      complication: 'Procurement spends heavily on forty separate vendor contracts annually indeed',
      question: 'Should we consolidate vendor contracts',
      answer: 'Yes, consolidate vendor contracts to save costs',
    });
    expect(issues.map((i) => i.code)).toContain('complication-restates-situation');
  });

  it('flags a question with no vocabulary overlap with the complication', () => {
    const issues = validateScqa({
      situation: 'Procurement spends heavily on forty separate vendor contracts every year',
      complication: 'Pricing has drifted well above the market benchmark over two renewal cycles',
      question: 'What should the summer offsite agenda include',
      answer: 'We should consolidate vendor contracts to cut procurement costs',
    });
    expect(issues.map((i) => i.code)).toContain('question-not-linked-to-complication');
  });

  it('flags an answer with no vocabulary overlap with the question', () => {
    const issues = validateScqa({
      situation: 'Procurement spends heavily on forty separate vendor contracts every year',
      complication: 'Pricing has drifted well above the market benchmark over two renewal cycles',
      question: 'Should we consolidate vendor contracts to recapture the pricing drift',
      answer: 'The office should switch to a four-day work week starting next quarter',
    });
    expect(issues.map((i) => i.code)).toContain('answer-not-linked-to-question');
  });

  it('passes a clean, consistent SCQA chain with zero issues', () => {
    const { coreMessage, ...rest } = cleanScqa();
    expect(validateScqa({ ...rest, answer: coreMessage })).toEqual([]);
  });

  it('does not flag restatement for a short/thin situation (below the length floor)', () => {
    const issues = validateScqa({
      situation: 'short',
      complication: 'Pricing has drifted well above the market benchmark over two renewal cycles',
      question: 'Should we consolidate vendor contracts to recapture the pricing drift',
      answer: 'We should consolidate vendor contracts to cut procurement costs by 12%',
    });
    expect(issues.map((i) => i.code)).toContain('missing-situation');
    expect(issues.map((i) => i.code)).not.toContain('complication-restates-situation');
  });
});

// ---------------------------------------------------------------------------
// 4. Governing thought validator
// ---------------------------------------------------------------------------

describe('validateGoverningThought', () => {
  it('flags a missing governing thought', () => {
    const issues = validateGoverningThought(undefined, cleanPillars());
    expect(issues.map((i) => i.code)).toContain('governing-thought-missing');
  });

  it('flags a generic filler thesis (CONCLUSION_LAYER R1)', () => {
    const issues = validateGoverningThought('We need to optimize processes and improve communication', cleanPillars());
    expect(issues.map((i) => i.code)).toContain('governing-thought-is-filler');
  });

  it('flags zero active arguments', () => {
    const issues = validateGoverningThought('We should consolidate vendor contracts to cut costs', []);
    expect(issues.map((i) => i.code)).toContain('governing-thought-needs-two-plus-arguments');
  });

  it('flags exactly one active argument (cannot be MECE with a single branch)', () => {
    const issues = validateGoverningThought(
      'We should consolidate vendor contracts to cut costs',
      [cleanPillars()[0]]
    );
    expect(issues.map((i) => i.code)).toContain('governing-thought-needs-two-plus-arguments');
  });

  it('ignores rejected/rethinking pillars when counting active arguments', () => {
    const pillars = [
      cleanPillars()[0],
      pillar('rejected-1', { message: 'irrelevant', proposalStatus: 'rejected' }),
    ];
    const issues = validateGoverningThought('We should consolidate vendor contracts to cut costs', pillars);
    expect(issues.map((i) => i.code)).toContain('governing-thought-needs-two-plus-arguments');
  });

  it('flags a governing thought with no vocabulary overlap with any argument', () => {
    const issues = validateGoverningThought(
      'The office should switch to a four-day work week starting next quarter',
      cleanPillars()
    );
    expect(issues.map((i) => i.code)).toContain('governing-thought-not-supported-by-any-argument');
  });

  it('passes a falsifiable, supported governing thought with zero issues', () => {
    const issues = validateGoverningThought(cleanScqa().coreMessage, cleanPillars());
    expect(issues).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. MECE pyramid validator
// ---------------------------------------------------------------------------

describe('validatePyramidMece', () => {
  it('flags an empty pyramid (no active arguments)', () => {
    const report = validatePyramidMece([]);
    expect(report.issues.map((i) => i.code)).toContain('pyramid-empty');
  });

  it('flags a single-argument pyramid', () => {
    const report = validatePyramidMece([cleanPillars()[0]]);
    expect(report.issues.map((i) => i.code)).toContain('pyramid-single-argument');
  });

  it('detects overlap between two near-duplicate arguments (not Mutually Exclusive)', () => {
    const pillars = [
      pillar('a', {
        title: 'Vendor pricing fragmentation drives cost',
        message: 'Fragmented vendor pricing across suppliers drives up procurement cost significantly',
      }),
      pillar('b', {
        title: 'Fragmented vendor pricing drives procurement cost',
        message: 'Vendor pricing fragmentation across suppliers drives up procurement cost significantly',
      }),
    ];
    const report = validatePyramidMece(pillars);
    expect(report.overlaps.length).toBeGreaterThan(0);
    expect(report.issues.map((i) => i.code)).toContain('pillars-overlap');
    expect(report.overlaps[0].pillarIdA).toBe('a');
    expect(report.overlaps[0].pillarIdB).toBe('b');
  });

  it('detects a vague "other/miscellaneous" catch-all bucket', () => {
    const pillars = [
      cleanPillars()[0],
      pillar('c', { title: 'Other miscellaneous factors', message: 'Various other things also matter somewhat' }),
    ];
    const report = validatePyramidMece(pillars);
    expect(report.issues.map((i) => i.code)).toContain('pyramid-catchall-bucket');
  });

  it('detects the Polish catch-all form ("inne", "pozostałe")', () => {
    const pillars = [
      cleanPillars()[0],
      pillar('d', { title: 'Pozostałe czynniki', message: 'Inne, mniej istotne elementy sprawy' }),
    ];
    const report = validatePyramidMece(pillars);
    expect(report.issues.map((i) => i.code)).toContain('pyramid-catchall-bucket');
  });

  it('passes two genuinely distinct arguments with zero MECE issues', () => {
    const report = validatePyramidMece(cleanPillars());
    expect(report.issues).toEqual([]);
    expect(report.overlaps).toEqual([]);
  });

  it('excludes rejected pillars from the MECE check entirely', () => {
    const pillars = [
      ...cleanPillars(),
      pillar('rejected', { title: 'Other stuff', message: 'A vague catch-all point', proposalStatus: 'rejected' }),
    ];
    const report = validatePyramidMece(pillars);
    expect(report.issues.map((i) => i.code)).not.toContain('pyramid-catchall-bucket');
  });
});

// ---------------------------------------------------------------------------
// 6. Insight staircase per argument
// ---------------------------------------------------------------------------

describe('validateArgumentStaircase', () => {
  it('flags a missing fact (no proofPoints, no evidence)', () => {
    const issues = validateArgumentStaircase(
      pillar('x', { message: 'a claim', implication: 'a concrete implication that follows from it' })
    );
    expect(issues.map((i) => i.code)).toContain('argument-missing-fact');
  });

  it('flags a missing interpretation (message too short)', () => {
    const issues = validateArgumentStaircase(
      pillar('x', { message: '', proofPoints: ['a fact'], implication: 'a concrete implication follows' })
    );
    expect(issues.map((i) => i.code)).toContain('argument-missing-interpretation');
  });

  it('flags a missing so-what (implication empty)', () => {
    const issues = validateArgumentStaircase(
      pillar('x', { message: 'a real claim about the business', proofPoints: ['a fact'], implication: '' })
    );
    expect(issues.map((i) => i.code)).toContain('argument-missing-so-what');
  });

  it('flags a so-what that merely restates the claim', () => {
    const claim = 'Fragmented vendor pricing drives up procurement costs across the board';
    const issues = validateArgumentStaircase(
      pillar('x', { message: claim, proofPoints: ['a fact'], implication: claim })
    );
    expect(issues.map((i) => i.code)).toContain('argument-so-what-restates-claim');
  });

  it('passes a complete, non-restating staircase with zero issues', () => {
    expect(validateArgumentStaircase(cleanPillars()[0])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. Orchestrator
// ---------------------------------------------------------------------------

describe('validateNarrativePyramid (orchestrator)', () => {
  it('is valid=true for a fully clean SCQA + MECE + staircase session', () => {
    const data = buildData(cleanPillars(), cleanScqa());
    const report = validateNarrativePyramid(data);
    expect(report.valid).toBe(true);
    expect(report.scqaIssues).toEqual([]);
    expect(report.governingThoughtIssues).toEqual([]);
    expect(report.mece.issues).toEqual([]);
    report.arguments.forEach((a) => expect(a.staircaseIssues).toEqual([]));
  });

  it('is valid=false when SCQA is entirely missing', () => {
    const data = buildData(cleanPillars(), {});
    const report = validateNarrativePyramid(data);
    expect(report.valid).toBe(false);
    expect(report.scqaIssues.length).toBeGreaterThan(0);
  });

  it('is valid=false when the pyramid has only one argument', () => {
    const data = buildData([cleanPillars()[0]], cleanScqa());
    const report = validateNarrativePyramid(data);
    expect(report.valid).toBe(false);
    expect(report.mece.issues.map((i) => i.code)).toContain('pyramid-single-argument');
  });

  it('reports one ArgumentPyramidReport per active pillar, carrying its evidence gate', () => {
    const data = buildData(cleanPillars(), cleanScqa());
    const report = validateNarrativePyramid(data);
    expect(report.arguments.length).toBe(2);
    report.arguments.forEach((a) => expect(a.evidenceGate.status).toBe('confirmed'));
  });

  it('surfaces the declared/unconfirmed gate for an argument with no proof', () => {
    const noProof = pillar('np', {
      title: 'A second, distinct argument about lead time',
      message: 'Lead time variance across regions makes delivery promises unreliable for customers',
      implication: 'Standardizing lead time SLAs restores predictable delivery commitments company-wide',
      proofPoints: [],
      evidence: [],
    });
    const data = buildData([cleanPillars()[0], noProof], cleanScqa());
    const report = validateNarrativePyramid(data);
    const npReport = report.arguments.find((a) => a.pillarId === 'np')!;
    expect(npReport.evidenceGate.status).toBe('declared');
    expect(npReport.evidenceGate.label?.en).toBe(DECLARED_UNCONFIRMED_LABEL.en);
  });
});

// ---------------------------------------------------------------------------
// 8. Prompt builders
// ---------------------------------------------------------------------------

describe('buildPyramidValidationPromptBlock', () => {
  it('returns null when the pyramid report is clean', () => {
    const data = buildData(cleanPillars(), cleanScqa());
    const report = validateNarrativePyramid(data);
    expect(buildPyramidValidationPromptBlock(report, true)).toBeNull();
    expect(buildPyramidValidationPromptBlock(report, false)).toBeNull();
  });

  it('renders a non-empty block listing issues when the pyramid is dirty', () => {
    const data = buildData([cleanPillars()[0]], {});
    const report = validateNarrativePyramid(data);
    const blockPl = buildPyramidValidationPromptBlock(report, true);
    const blockEn = buildPyramidValidationPromptBlock(report, false);
    expect(blockPl).toBeTruthy();
    expect(blockEn).toBeTruthy();
    expect(blockPl).not.toEqual(blockEn);
  });
});

describe('buildPyramidPromptRules', () => {
  it('teaches the SCQA + MECE + evidence-gate contract in both languages', () => {
    const pl = buildPyramidPromptRules('pl');
    const en = buildPyramidPromptRules('en');
    expect(pl).toContain('MECE');
    expect(en).toContain('MECE');
    expect(pl).toContain(DECLARED_UNCONFIRMED_LABEL.pl);
    expect(en).toContain(DECLARED_UNCONFIRMED_LABEL.en);
  });
});

// ---------------------------------------------------------------------------
// 9. Backward-compatible integration with buildNarrativeConclusionPrompt
// ---------------------------------------------------------------------------

describe('buildNarrativeConclusionPrompt — backward-compatible pyramid integration', () => {
  it('still returns null with zero active pillars (unchanged early-exit contract)', () => {
    expect(buildNarrativeConclusionPrompt(buildData([]), true)).toBeNull();
  });

  it('includes an SCQA block when situation/complication/question are present', () => {
    const data = buildData(cleanPillars(), cleanScqa());
    const prompt = buildNarrativeConclusionPrompt(data, false);
    expect(prompt).toContain('SCQA');
    expect(prompt).toContain(cleanScqa().situation);
  });

  it('omits the SCQA block when no SCQA fields are set (backward compatible with old sessions)', () => {
    const data = buildData(cleanPillars(), {});
    const prompt = buildNarrativeConclusionPrompt(data, false)!;
    expect(prompt).not.toContain('=== SCQA');
  });

  it('includes structural validation guidance when the pyramid has issues', () => {
    const data = buildData([cleanPillars()[0]], {});
    const prompt = buildNarrativeConclusionPrompt(data, false)!;
    expect(prompt.toUpperCase()).toContain('STRUCTURAL PYRAMID VALIDATION');
  });

  it('still returns the unchanged W2 JSON contract keys (summary/threads/moves/initiatives/outputCandidates)', () => {
    const data = buildData(cleanPillars(), cleanScqa());
    const prompt = buildNarrativeConclusionPrompt(data, false)!;
    ['"summary"', '"threads"', '"moves"', '"initiatives"', '"outputCandidates"'].forEach((key) => {
      expect(prompt).toContain(key);
    });
  });
});

// ---------------------------------------------------------------------------
// REJESTR (o3-cluster-proof, dowód dla o3-focus-dead #2): the chat mentor for
// the "pillars" step must carry the SAME laddered pyramid question bank
// (thesis/scqa/pyramid/evidence tracks) as the wizard, mirroring
// buildMarketForcesConversationProtocol's multi-track concatenation. Was
// wired in commit 71732e300d (o3-focus-dead) but never asserted by a test —
// the underlying narrativeEnginePyramid suite only covered the ladder
// content itself, not that buildNarrativeEngineConversationProtocol reaches
// runtime through useToolAI.ts's interviewProtocol ternary.
// ---------------------------------------------------------------------------
describe('buildNarrativeEngineConversationProtocol', () => {
  it('is a no-op ("") for steps other than "pillars"', () => {
    expect(buildNarrativeEngineConversationProtocol(undefined)).toBe('');
    expect(buildNarrativeEngineConversationProtocol('mission')).toBe('');
    expect(buildNarrativeEngineConversationProtocol('input')).toBe('');
    expect(buildNarrativeEngineConversationProtocol('threads')).toBe('');
    expect(buildNarrativeEngineConversationProtocol('outputs')).toBe('');
  });

  it('concatenates all 4 pyramid category ladders for the "pillars" step', () => {
    const protocol = buildNarrativeEngineConversationProtocol('pillars', 'en');
    expect(protocol).toContain('INTERVIEW PROTOCOL');
    // One track per category: governing thought -> SCQA -> MECE pyramid ->
    // evidence — single source of truth shared with pyramidQuestionBank.ts.
    expect(protocol).toContain('THESIS');
    expect(protocol).toContain('th1-surface');
    expect(protocol).toContain('SCQA');
    expect(protocol).toContain('sc1-situation');
    expect(protocol).toContain('PYRAMID');
    expect(protocol).toContain('py1-grouping');
    expect(protocol).toContain('EVIDENCE');
    expect(protocol).toContain('ev1-proof');
  });

  it('localizes the ladder into Polish when language="pl"', () => {
    const protocol = buildNarrativeEngineConversationProtocol('pillars', 'pl');
    expect(protocol).toContain('th1-surface');
    expect(protocol.length).toBeGreaterThan(0);
  });
});
