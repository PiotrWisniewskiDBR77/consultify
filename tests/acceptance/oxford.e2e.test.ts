/**
 * OXFORD acceptance E2E — QUALITY ENFORCEMENT, not happy-path.
 *
 * The other harness files prove "the feature runs". Oxford proves the QUALITY
 * GATES actually REJECT bad output — the anti-fabrication / anti-filler / anti
 * -missing-K spine of the Conclusion Layer. A validator that only "exists" is
 * worthless; every test here feeds a KNOWN-BAD input and asserts the gate says
 * NO, plus a KNOWN-GOOD input and asserts it says YES.
 *
 * Everything below imports the REAL production functions and calls them with
 * real data. The 12 conclusion validators, the grounding guard and the finance
 * gate are DETERMINISTIC pure functions — no LLM, no HTTP, no DB needed, so the
 * proof is exact and non-flaky.
 *
 * Prefix for any incidental artifacts: `odbior--ox--`.
 */
import { describe, expect, it } from 'vitest';

// REAL server-side 12-validator gate (the one the finance report path uses).
import {
  type ValidatableConclusion,
  validateConclusion,
} from '../../server/src/services/conclusionValidators.js';
// REAL frontend twin (proves FE would block the same content the server ignores).
import { validateConclusion as validateConclusionFE } from '../../src/services/report/conclusionValidators.js';
// REAL anti-fabrication number guard.
import { validateGrounding } from '../../src/hooks/discovery/toolAi/groundingValidator.js';
// REAL finance publication gate (drops non-publishable conclusions).
import {
  buildFinanceReportConclusions,
  type RatioForConclusion,
} from '../../server/src/services/financeReportConclusion.js';
// REAL tool→conclusion server bridge (the SERVER-GAP, now GATED).
import {
  extractToolConclusion,
  persistToolSessionConclusion,
  validateToolConclusionQuality,
} from '../../server/src/services/conclusions/toolConclusionBridge.js';

// ---------------------------------------------------------------------------
// Fixtures — one GOOD conclusion that must pass ALL hard validators, plus
// targeted mutations that each trip a specific gate.
// ---------------------------------------------------------------------------

/** A clean K1→K4 conclusion whose every number is present in `facts`. */
function goodConclusion(): ValidatableConclusion {
  return {
    headline: 'Marża brutto 12% poniżej progu — rentowność wymaga korekty ceny',
    k1Text: 'Marża brutto wynosi 12% wobec progu 20% zapisanego w modelu.',
    k1FactRefs: ['fact:margin'],
    k2Text: 'Klient A odpowiada za 61% przychodu, więc erozja marży koncentruje ryzyko.',
    k2FactRefs: ['fact:margin', 'fact:clientA'],
    k3Actions: [
      {
        action: 'Renegocjuj cennik z Klientem A',
        whyFirst: 'Największa ekspozycja przychodowa',
        ownerRole: 'CFO',
      },
      {
        action: 'Przegląd kosztów bezpośrednich',
        whyFirst: 'Drugi co do wielkości sterownik marży',
        ownerRole: 'COO',
      },
    ],
    k4Text: 'Odbudowa marży do progu w perspektywie dwóch kwartałów.',
    k4Horizon: '2 kwartały',
    confidence: 'confirmed',
    language: 'pl',
    facts: { marginPct: 12, thresholdPct: 20, clientAPct: 61 },
  };
}

const NARRATOR_ORG = { name: 'DBR77 Sp. z o.o.', industrySegment: 'manufacturing', sizeBand: 'SME' };

// A ratio that computes and breaches its target — the finance narrator will
// produce a real conclusion the gate then judges.
function breachingRatio(): RatioForConclusion {
  return {
    code: 'current_ratio',
    family: 'liquidity',
    label: 'Current Ratio',
    labelPl: 'Wskaźnik bieżącej płynności',
    value: 0.9,
    status: 'computed',
    direction: 'higher_better',
    unit: 'x',
    formula: 'current_assets / current_liabilities',
    missingLineCodes: [],
    requiredLineCodes: ['CA', 'CL'],
    benchmark: {
      p25: 1.2,
      median: 1.6,
      p75: 2.0,
      targetMin: 1.5,
      source: 'DBR77',
      origin: 'industry',
      industryLabelPl: 'Przetwórstwo',
      confidence: 'expert-estimate',
      asOf: '2025',
    },
  };
}

// ===========================================================================
// 1. The 12-validator conclusion gate — does allHardPass REALLY reject?
// ===========================================================================
describe('OXFORD §1 — conclusion 12-validator gate REJECTS bad output', () => {
  it('GOOD conclusion → allHardPass === true (gate lets clean output through)', () => {
    const report = validateConclusion(goodConclusion());
    // eslint-disable-next-line no-console
    console.log('[ox §1 good] failures =', JSON.stringify(report.failures));
    expect(report.allHardPass).toBe(true);
    expect(report.failures).toEqual([]);
  });

  it('MISSING K-fields (empty k4, no headline) → k_complete fails, allHardPass false', () => {
    const bad = goodConclusion();
    bad.headline = '';
    bad.k4Text = '';
    bad.k4Horizon = '';
    const report = validateConclusion(bad);
    console.log('[ox §1 missingK] failures =', JSON.stringify(report.failures));
    expect(report.allHardPass).toBe(false);
    expect(report.failures).toContain('k_complete');
    expect(report.failures).toContain('k4_horizon');
  });

  it('k3 > 3 actions → k3_max3 fails, allHardPass false', () => {
    const bad = goodConclusion();
    bad.k3Actions = [
      { action: 'A1', whyFirst: 'w1', ownerRole: 'CFO' },
      { action: 'A2', whyFirst: 'w2', ownerRole: 'COO' },
      { action: 'A3', whyFirst: 'w3', ownerRole: 'CTO' },
      { action: 'A4', whyFirst: 'w4', ownerRole: 'CEO' },
    ];
    const report = validateConclusion(bad);
    console.log('[ox §1 k3>3] failures =', JSON.stringify(report.failures));
    expect(report.allHardPass).toBe(false);
    expect(report.failures).toContain('k3_max3');
  });

  it('FILLER prose (listed filler phrase) → no_filler fails, allHardPass false', () => {
    const bad = goodConclusion();
    // 'zoptymalizować procesy' IS in FILLER_PHRASES_PL; a real slop phrase.
    bad.k1Text = 'Należy zoptymalizować procesy, aby poprawić komunikację w organizacji.';
    const report = validateConclusion(bad);
    console.log('[ox §1 filler] failures =', JSON.stringify(report.failures));
    expect(report.allHardPass).toBe(false);
    expect(report.failures).toContain('no_filler');
  });

  it('FABRICATED number (not within ±25% of any engine fact) → numbers_from_engine fails', () => {
    const bad = goodConclusion();
    // 87% appears in prose but no fact near it (facts: 12, 20, 61).
    bad.k2Text = 'Wskaźnik retencji sięga 87% według analizy zespołu.';
    const report = validateConclusion(bad);
    console.log('[ox §1 fabricated] failures =', JSON.stringify(report.failures));
    expect(report.allHardPass).toBe(false);
    expect(report.failures).toContain('numbers_from_engine');
  });

  it('NUMBER that IS in the engine facts → numbers_from_engine passes (no false positive)', () => {
    const ok = goodConclusion();
    ok.k2Text = 'Klient A odpowiada za 61% przychodu — zgodnie z modelem.';
    const report = validateConclusion(ok);
    expect(report.numbers_from_engine).toBe('pass');
  });

  it('FE twin blocks identically to the server gate (same bad input, same verdict)', () => {
    const bad = goodConclusion();
    bad.k3Actions = bad.k3Actions.concat([
      { action: 'A3', whyFirst: 'w3', ownerRole: 'X' },
      { action: 'A4', whyFirst: 'w4', ownerRole: 'Y' },
    ]);
    const server = validateConclusion(bad);
    const fe = validateConclusionFE(bad as any);
    expect(fe.allHardPass).toBe(server.allHardPass);
    expect(fe.allHardPass).toBe(false);
  });
});

// ===========================================================================
// 2. ★ Grounding guard — anti-fabrication core: number NOT in source ⇒ downgrade
// ===========================================================================
describe('OXFORD §2 — grounding guard downgrades fabricated numbers (fact → hypothesis)', () => {
  it('fact-stamped number ABSENT from sources → downgraded to hypothesis + logged', () => {
    const parsed = {
      items: [
        {
          evidenceType: 'fact',
          confidence: 5,
          provenance: 'Platform data',
          content: 'Firma ma 25 inicjatyw, z czego 14 anulowanych.',
        },
      ],
    };
    // Grounding sources carry NEITHER 25 nor 14.
    const sources = ['Klient działa w regionie DACH. Zespół liczy osiem osób.'];
    const { output, downgrades } = validateGrounding(parsed, sources);

    console.log('[ox §2 fabricated] downgrades =', JSON.stringify(downgrades));
    expect(downgrades.length).toBeGreaterThan(0);
    expect(output.items[0].evidenceType).toBe('hypothesis');
    expect(output.items[0].confidence).toBe(2);
    expect(output.items[0].requires_evidence).toBe(true);
    const numbers = downgrades.map((d) => d.number);
    expect(numbers).toContain('25');
    expect(numbers).toContain('14');
  });

  it('number PRESENT in the grounding source → stays a fact (no false downgrade)', () => {
    const parsed = {
      items: [
        {
          evidenceType: 'fact',
          confidence: 5,
          provenance: 'Platform data',
          content: 'Portfel liczy 25 inicjatyw.',
        },
      ],
    };
    const sources = ['Zarejestrowano 25 inicjatyw w portfelu klienta.'];
    const { output, downgrades } = validateGrounding(parsed, sources);
    console.log('[ox §2 grounded] downgrades =', JSON.stringify(downgrades));
    expect(downgrades.length).toBe(0);
    expect(output.items[0].evidenceType).toBe('fact');
    expect(output.items[0].confidence).toBe(5);
  });
});

// ===========================================================================
// 3. Finance publication gate — `if (!allHardPass) continue` really drops
// ===========================================================================
describe('OXFORD §3 — finance report gate only emits publishable conclusions', () => {
  it('every conclusion returned by buildFinanceReportConclusions passed the hard gate', () => {
    const out = buildFinanceReportConclusions([breachingRatio()], NARRATOR_ORG, {
      language: 'pl',
      topN: 3,
    });
    console.log('[ox §3] published count =', out.length);
    // The invariant the gate guarantees: nothing non-publishable can be in `out`.
    for (const item of out) {
      expect(item.validation.allHardPass).toBe(true);
    }
    // And the gate predicate itself is a real filter: a hand-built broken
    // conclusion is judged non-publishable (would hit `continue`).
    const broken = goodConclusion();
    broken.k4Text = '';
    broken.k4Horizon = '';
    expect(validateConclusion(broken).allHardPass).toBe(false);
  });
});

// ===========================================================================
// 4. ★ SERVER GAP CLOSED — tool→conclusion bridge NOW re-validates before it
//    persists. extractToolConclusion() stays PURE (still reshapes any W2
//    summary), but persistToolSessionConclusion() runs a lighter, shape-
//    appropriate anti-slop gate (no_filler + numbers_from_engine + a minimal
//    completeness check) and REFUSES to write a candidate that trips it.
//    Regression guard: (a) a slop/fabricated verdict is NOT written;
//                      (b) a clean, engine-grounded verdict IS written.
// ===========================================================================
describe('OXFORD §4 — SERVER GAP CLOSED: tool bridge gates before persist', () => {
  const badAnswers = {
    summary: {
      // Pure slop ("zoptymalizować procesy" ∈ FILLER_PHRASES_PL) + invented 87%.
      verdict: 'Należy zoptymalizować procesy, aby poprawić komunikację i wzrost 87%.',
      executiveSummary: 'Rekomendujemy dynamiczny rozwój technologii w organizacji.',
    },
    // The one accepted element carries NEITHER the filler nor the number 87.
    items: [{ id: 'i1', text: 'Sygnał', state: 'confirmed' }],
  };

  const goodAnswers = {
    summary: {
      // Verdict-first, no filler; every number (12, 20) is present in accepted evidence.
      verdict: 'Marża brutto 12% wobec progu 20% — rentowność wymaga korekty ceny.',
      executiveSummary: 'Klient A odpowiada za 61% przychodu, co koncentruje ryzyko erozji marży.',
    },
    items: [
      { id: 'i1', text: 'Marża brutto wynosi 12% wobec progu 20% zapisanego w modelu.', state: 'confirmed' },
      { id: 'i2', text: 'Klient A = 61% przychodu.', state: 'confirmed' },
    ],
  };

  it('a bad W2 conclusion (filler + fabricated number) is NOT persisted server-side', async () => {
    // The FULL 12-gate would also reject it — but it rejects for the WRONG reasons
    // (missing K4/K3 shape a tool verdict never has), which is why the bridge uses
    // the lighter gate. Shown here only to document the intent.
    const asFullConclusion: ValidatableConclusion = {
      headline: badAnswers.summary.verdict,
      k1Text: badAnswers.summary.verdict,
      k1FactRefs: [],
      k2Text: badAnswers.summary.executiveSummary,
      k2FactRefs: [],
      k3Actions: [],
      k4Text: '',
      k4Horizon: '',
      confidence: 'low',
      language: 'pl',
      facts: {},
    };
    expect(validateConclusion(asFullConclusion).allHardPass).toBe(false);

    // Extraction stays PURE — it still yields a candidate.
    const candidate = extractToolConclusion({
      sessionId: 'odbior--ox--sess-bad',
      toolType: 'swot',
      name: 'odbior--ox--bad-conclusion',
      answers: badAnswers,
      confidenceAvg: 1,
    });
    expect(candidate).not.toBeNull();

    // The LIGHTER quality gate fires on the slop AND the fabricated number.
    const quality = validateToolConclusionQuality(candidate!, badAnswers);
    console.log('[ox §4 bad] quality failures =', JSON.stringify(quality.failures));
    expect(quality.ok).toBe(false);
    expect(quality.failures).toContain('no_filler');
    expect(quality.failures).toContain('numbers_from_engine');

    // And persistence ACTUALLY refuses to write — createConclusion is never called.
    let writes = 0;
    const spyWriter = {
      createConclusion: async () => {
        writes += 1;
      },
    };
    const wrote = await persistToolSessionConclusion(
      {
        sessionId: 'odbior--ox--sess-bad',
        toolType: 'swot',
        name: 'odbior--ox--bad-conclusion',
        answers: badAnswers,
        confidenceAvg: 1,
        organizationId: 'odbior--ox--org',
        actorUserId: 'odbior--ox--user',
      },
      spyWriter
    );
    expect(wrote).toBe(false);
    expect(writes).toBe(0);
  });

  it('a clean W2 conclusion (no filler, numbers grounded in accepted evidence) IS persisted', async () => {
    const candidate = extractToolConclusion({
      sessionId: 'odbior--ox--sess-good',
      toolType: 'swot',
      name: 'odbior--ox--good-conclusion',
      answers: goodAnswers,
      confidenceAvg: 4,
    });
    expect(candidate).not.toBeNull();

    // No false positive: a legitimate tool verdict passes the lighter gate.
    const quality = validateToolConclusionQuality(candidate!, goodAnswers);
    console.log('[ox §4 good] quality failures =', JSON.stringify(quality.failures));
    expect(quality.ok).toBe(true);
    expect(quality.failures).toEqual([]);

    // Persistence writes it exactly once, verbatim.
    let writes = 0;
    let captured: { statement?: string } | null = null;
    const spyWriter = {
      createConclusion: async (p: { statement?: string }) => {
        writes += 1;
        captured = p;
      },
    };
    const wrote = await persistToolSessionConclusion(
      {
        sessionId: 'odbior--ox--sess-good',
        toolType: 'swot',
        name: 'odbior--ox--good-conclusion',
        answers: goodAnswers,
        confidenceAvg: 4,
        organizationId: 'odbior--ox--org',
        actorUserId: 'odbior--ox--user',
      },
      spyWriter
    );
    expect(wrote).toBe(true);
    expect(writes).toBe(1);
    expect(captured!.statement).toContain('Marża brutto 12%');
  });
});
