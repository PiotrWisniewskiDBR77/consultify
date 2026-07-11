// @vitest-environment node
/**
 * F1/L1 — initiativeGeneratorBrain: tor szybki brief → pełna inicjatywa.
 * Część kręgosłupa inicjatyw (INITIATIVE_SYSTEM_SSOT §F1, D1/D2/D10/D12).
 *
 * Czysta orkiestracja: wstrzykujemy mock serwisu generacji (vi.mock NA singletonie
 * dla ścieżki defaultDeps + jawny deps dla reszty) — ZERO LLM, ZERO DB.
 * Weryfikuje: proposeCards (6 rdzenia + opcjonalne wg typu), pełny fill,
 * auto-heal (regen DOKŁADNIE raz przy <próg), fail-soft, język.
 */
import { describe, expect, it, vi } from 'vitest';

// Mock the section generator singleton so importing the brain never touches an
// LLM/DB. Tests primarily inject their own deps, but defaultDeps() uses this.
vi.mock('../../../server/src/services/initiativeGenerationService.js', () => {
  return {
    __esModule: true,
    REVIEW_PASS_THRESHOLD: 90,
    default: {
      generateSectionContent: vi.fn(async (sectionKey: string) => ({
        content: `default-content for ${sectionKey}`,
        isJson: false,
        tokensUsed: 1,
        model: 'mock',
        review: { score: 95, verdict: 'PASS', failedValidators: [], qualityGaps: [], fixes: [], sectionKey, model: 'mock', degraded: false },
      })),
    },
  };
});

import {
  CORE_SECTION_KEYS,
  OPTIONAL_LIBRARY_KEYS,
  defaultDeps,
  generateFullInitiative,
  normalizeInitiativeType,
  proposeCards,
  type GeneratorDeps,
  type SectionGenerator,
} from '../../../server/src/services/initiative/initiativeGeneratorBrain.ts';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a mock generator whose review score is configurable per key + per call. */
function makeGen(opts?: {
  scoreFor?: (key: string, call: number) => number;
  contentFor?: (key: string, call: number) => string;
  throwFor?: (key: string) => boolean;
}): { gen: SectionGenerator; spy: ReturnType<typeof vi.fn>; calls: () => string[] } {
  const callCount: Record<string, number> = {};
  const spy = vi.fn(async (sectionKey: string, context: any) => {
    callCount[sectionKey] = (callCount[sectionKey] || 0) + 1;
    const call = callCount[sectionKey];
    if (opts?.throwFor?.(sectionKey)) throw new Error(`boom:${sectionKey}`);
    const score = opts?.scoreFor ? opts.scoreFor(sectionKey, call) : 95;
    const content = opts?.contentFor
      ? opts.contentFor(sectionKey, call)
      : `content[${sectionKey}#${call}] lang=${context?.language}`;
    return {
      content,
      isJson: false,
      tokensUsed: 1,
      model: 'mock',
      review: {
        score,
        verdict: score >= 90 ? 'PASS' : 'FAIL',
        failedValidators: [],
        qualityGaps: [],
        fixes: [],
        sectionKey,
        model: 'mock',
        degraded: false,
      },
    };
  });
  const gen: SectionGenerator = { generateSectionContent: spy as any };
  return { gen, spy, calls: () => spy.mock.calls.map((c: any[]) => c[0] as string) };
}

function depsFor(gen: SectionGenerator, passThreshold = 90): GeneratorDeps {
  return { generationService: gen, passThreshold };
}

// ── proposeCards ─────────────────────────────────────────────────────────────

describe('F1 — proposeCards (D2/D10)', () => {
  it('zawsze zwraca 7 kart rdzenia (D10 + raid) w kanonicznej kolejności', () => {
    const r = proposeCards('general', 'manual');
    // FIX 1a (naprawa-r4Struct): raid dołączone do rdzenia, aby key_risks zawsze
    // się generowało i hydratowało (było puste na żywym demo).
    expect(r.core).toEqual([
      'problemDefinition',
      'targetState',
      'kpis',
      'scope',
      'control',
      'raid',
      'financialImpact',
    ]);
    expect(r.core).toHaveLength(7);
    expect(CORE_SECTION_KEYS).toHaveLength(7);
    // raid jest częścią rdzenia (weryfikacja wprost pod FIX 1a).
    expect(CORE_SECTION_KEYS).toContain('raid');
  });

  it('proponuje opcjonalne karty zależne od typu (cost ≠ people)', () => {
    const cost = proposeCards('cost-reduction');
    const people = proposeCards('people-upskilling');
    expect(cost.type).toBe('cost');
    expect(people.type).toBe('people');
    expect(cost.proposed).toContain('financialAnalysis');
    expect(people.proposed).toContain('skillsGap');
    // type-driven divergence is real
    expect(cost.proposed).not.toEqual(people.proposed);
  });

  it('proponowane karty NIGDY nie nakładają się na rdzeń', () => {
    const r = proposeCards('transformation', 'assessment');
    const coreSet = new Set(r.core);
    for (const k of r.proposed) expect(coreSet.has(k as any)).toBe(false);
  });

  it('każda proponowana karta należy do biblioteki opcjonalnej', () => {
    const r = proposeCards('technology');
    const lib = new Set(OPTIONAL_LIBRARY_KEYS as readonly string[]);
    for (const k of r.proposed) expect(lib.has(k)).toBe(true);
  });

  it('źródło audit/assessment dokłada kartę gates; pilot dokłada pilot', () => {
    expect(proposeCards('general', 'audit').proposed).toContain('gates');
    expect(proposeCards('general', 'pilot_session').proposed).toContain('pilot');
  });

  it('nieznany/pusty typ → bucket general (deterministycznie)', () => {
    expect(proposeCards().type).toBe('general');
    expect(proposeCards('').type).toBe('general');
    expect(proposeCards('completely-unknown-xyz').type).toBe('general');
  });

  it('normalizeInitiativeType mapuje słowa kluczowe na buckety', () => {
    expect(normalizeInitiativeType('Regulatory compliance')).toBe('regulatory');
    expect(normalizeInitiativeType('AI automation platform')).toBe('technology');
    expect(normalizeInitiativeType('OPEX savings')).toBe('cost');
    expect(normalizeInitiativeType('pilot MVP')).toBe('pilot');
  });
});

// ── generateFullInitiative — happy path ──────────────────────────────────────

describe('F1 — generateFullInitiative (pełny fill)', () => {
  it('wypełnia WSZYSTKIE 7 kart rdzenia z mock-serwisu', async () => {
    const { gen, calls } = makeGen();
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-1', brief: 'brief' });

    expect(Object.keys(r.cards).sort()).toEqual([...CORE_SECTION_KEYS].sort());
    expect(r.qualitySummary.total).toBe(7);
    expect(r.qualitySummary.filled).toBe(7);
    expect(r.qualitySummary.failed).toBe(0);
    expect(r.qualitySummary.healed).toBe(0);
    // every core key was generated exactly once (no heal on PASS)
    expect(calls().sort()).toEqual([...CORE_SECTION_KEYS].sort());
  });

  it('przekazuje brief jako summary i język do kontekstu generacji', async () => {
    const { gen, spy } = makeGen();
    await generateFullInitiative(depsFor(gen), {
      initiativeId: 'i-2',
      brief: 'mój brief biznesowy',
      sourceType: 'audit',
      language: 'pl',
    });
    const firstCtx = spy.mock.calls[0][1] as any;
    expect(firstCtx.language).toBe('pl');
    expect(firstCtx.summary).toBe('mój brief biznesowy');
    expect(firstCtx.sourceLineage).toBe('audit');
  });

  // §6 downstream Insight seeds (#57/Z60) — insightMaterializationService.
  // deriveInitiativeSeedContext() → generateFullInitiative's insightSeeds
  // input, merged into baseContext so KPI/control cards inherit instead of
  // guessing an owner/baseline→target from nothing.
  it('przekazuje insightSeeds jako seedOwnerRole/seedKpiSeeds do kontekstu generacji', async () => {
    const { gen, spy } = makeGen();
    await generateFullInitiative(depsFor(gen), {
      initiativeId: 'i-2b',
      sourceType: 'interview_insight',
      insightSeeds: {
        seedOwnerRole: 'Head of Customer Ops',
        seedKpiSeeds: 'czas obsługi zapytania (~5 dni → 1 dzień, 2 kwartały)',
      },
    });
    const firstCtx = spy.mock.calls[0][1] as any;
    expect(firstCtx.seedOwnerRole).toBe('Head of Customer Ops');
    expect(firstCtx.seedKpiSeeds).toBe('czas obsługi zapytania (~5 dni → 1 dzień, 2 kwartały)');
  });

  it('bez insightSeeds kontekst NIE ma pól seed* (istniejący tor brief-only niezmieniony)', async () => {
    const { gen, spy } = makeGen();
    await generateFullInitiative(depsFor(gen), { initiativeId: 'i-2c', brief: 'brief bez insightu' });
    const firstCtx = spy.mock.calls[0][1] as any;
    expect(firstCtx.seedOwnerRole).toBeUndefined();
    expect(firstCtx.seedKpiSeeds).toBeUndefined();
  });

  it('insightSeeds z pustymi polami nie zaśmieca kontekstu (fail-soft, additive)', async () => {
    const { gen, spy } = makeGen();
    await generateFullInitiative(depsFor(gen), { initiativeId: 'i-2d', insightSeeds: {} });
    const firstCtx = spy.mock.calls[0][1] as any;
    expect(firstCtx.seedOwnerRole).toBeUndefined();
    expect(firstCtx.seedKpiSeeds).toBeUndefined();
  });

  it('respektuje język (en) — propaguje do każdej karty', async () => {
    const { gen, spy } = makeGen({ contentFor: (k, c) => `EN ${k}#${c}` });
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-3', language: 'en' });
    expect(r.language).toBe('en');
    for (const call of spy.mock.calls) {
      expect((call[1] as any).language).toBe('en');
    }
  });

  it('domyślny język = pl gdy nie podano', async () => {
    const { gen } = makeGen();
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-3b' });
    expect(r.language).toBe('pl');
  });

  it('cardKeys override pozwala wypełnić wybrany podzbiór', async () => {
    const { gen, calls } = makeGen();
    const r = await generateFullInitiative(depsFor(gen), {
      initiativeId: 'i-4',
      cardKeys: ['problemDefinition', 'kpis'],
    });
    expect(Object.keys(r.cards).sort()).toEqual(['kpis', 'problemDefinition']);
    expect(calls().sort()).toEqual(['kpis', 'problemDefinition']);
  });

  it('liczy averageScore i belowThreshold w qualitySummary', async () => {
    const { gen } = makeGen({ scoreFor: () => 95 });
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-5' });
    expect(r.qualitySummary.averageScore).toBe(95);
    expect(r.qualitySummary.belowThreshold).toEqual([]);
  });
});

// ── auto-heal (D12) ──────────────────────────────────────────────────────────

describe('F1 — auto-heal (D12)', () => {
  it('regeneruje DOKŁADNIE raz kartę poniżej progu (2 wywołania, healed=1)', async () => {
    // problemDefinition: 1st call <90, 2nd call ok. Reszta od razu PASS.
    const { gen, spy } = makeGen({
      scoreFor: (key, call) => (key === 'problemDefinition' && call === 1 ? 40 : 96),
    });
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-6' });

    const pdCalls = spy.mock.calls.filter((c: any[]) => c[0] === 'problemDefinition');
    expect(pdCalls).toHaveLength(2); // exactly ONE regen
    const kpiCalls = spy.mock.calls.filter((c: any[]) => c[0] === 'kpis');
    expect(kpiCalls).toHaveLength(1); // PASS → no heal
    expect(r.qualitySummary.healed).toBe(1);
    // final content comes from the 2nd (healed) attempt
    expect(r.cards.problemDefinition).toContain('#2');
  });

  it('NIE regeneruje drugi raz gdy heal nadal poniżej progu (max 1 heal)', async () => {
    const { gen, spy } = makeGen({ scoreFor: () => 10 }); // always sub-threshold
    const r = await generateFullInitiative(depsFor(gen), {
      initiativeId: 'i-7',
      cardKeys: ['scope'],
    });
    const scopeCalls = spy.mock.calls.filter((c: any[]) => c[0] === 'scope');
    expect(scopeCalls).toHaveLength(2); // 1 initial + 1 heal, never 3
    expect(r.qualitySummary.healed).toBe(1);
    expect(r.qualitySummary.belowThreshold).toContain('scope');
  });

  it('respektuje wstrzyknięty passThreshold (np. 80)', async () => {
    const { gen, spy } = makeGen({ scoreFor: () => 85 }); // 85 ≥ 80 → no heal
    const r = await generateFullInitiative(depsFor(gen, 80), {
      initiativeId: 'i-8',
      cardKeys: ['kpis'],
    });
    expect(spy.mock.calls.filter((c: any[]) => c[0] === 'kpis')).toHaveLength(1);
    expect(r.qualitySummary.healed).toBe(0);
  });

  it('heal który rzuca → zachowuje pierwszą próbę (nie hard-fail)', async () => {
    let n = 0;
    const spy = vi.fn(async (sectionKey: string) => {
      n += 1;
      if (n === 1) {
        return {
          content: 'first attempt content',
          isJson: false,
          tokensUsed: 1,
          model: 'mock',
          review: { score: 30, verdict: 'FAIL', failedValidators: [], qualityGaps: [], fixes: [], sectionKey, model: 'mock', degraded: false },
        };
      }
      throw new Error('heal exploded');
    });
    const gen: SectionGenerator = { generateSectionContent: spy as any };
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-9', cardKeys: ['scope'] });
    expect(r.cards.scope).toBe('first attempt content'); // kept first attempt
    expect(r.qualitySummary.failed).toBe(0); // not a hard failure
    expect(r.qualitySummary.healed).toBe(0); // heal threw → did NOT heal
    expect(spy).toHaveBeenCalledTimes(2); // attempted exactly one regen
  });
});

// ── fail-soft ────────────────────────────────────────────────────────────────

describe('F1 — fail-soft', () => {
  it('jedna karta rzuca → reszta i tak się wypełnia', async () => {
    const { gen } = makeGen({ throwFor: (k) => k === 'kpis' });
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-10' });

    expect(r.cards.kpis).toBeUndefined(); // failed card absent from cards map
    expect(r.qualitySummary.failed).toBe(1);
    expect(r.qualitySummary.filled).toBe(6); // 7 core − 1 failed
    const failedOutcome = r.outcomes.find((o) => o.key === 'kpis')!;
    expect(failedOutcome.failed).toBe(true);
    expect(failedOutcome.error).toContain('boom');
  });

  it('wszystkie karty rzucają → puste cards, failed=7, brak wyjątku', async () => {
    const { gen } = makeGen({ throwFor: () => true });
    const r = await generateFullInitiative(depsFor(gen), { initiativeId: 'i-11' });
    expect(Object.keys(r.cards)).toHaveLength(0);
    expect(r.qualitySummary.failed).toBe(7);
    expect(r.qualitySummary.averageScore).toBeNull();
  });
});

// ── defaultDeps (singleton wiring) ───────────────────────────────────────────

describe('F1 — defaultDeps()', () => {
  it('używa zamockowanego singletona z progiem REVIEW_PASS_THRESHOLD', async () => {
    const deps = defaultDeps();
    expect(deps.passThreshold).toBe(90);
    const r = await generateFullInitiative(deps, { initiativeId: 'i-12', cardKeys: ['scope'] });
    expect(r.cards.scope).toContain('default-content for scope');
  });
});

// ── R3 enablement: structured JSON capture (parsedContent → clean field-JSON) ──
describe('F1 — structured JSON capture for typed-column hydration (R3)', () => {
  it('stores parsedContent as CLEAN field-JSON in cards (not the fenced raw string)', async () => {
    const fields = { inScope: ['Moduł zamówień'], outOfScope: ['Migracja'], killCriteria: ['ROI<0'] };
    const gen: SectionGenerator = {
      generateSectionContent: vi.fn(async (sectionKey: string) => ({
        content: '```json\n' + JSON.stringify(fields) + '\n```', // fenced raw
        isJson: true,
        parsedContent: fields, // structured, already parsed
        tokensUsed: 1,
        model: 'mock',
        review: { score: 95, verdict: 'PASS', failedValidators: [], qualityGaps: [], fixes: [], sectionKey, model: 'mock', degraded: false },
      })),
    } as any;
    const r = await generateFullInitiative({ generationService: gen, passThreshold: 90 }, {
      initiativeId: 'i-r3',
      cardKeys: ['scope'],
    });
    // card content is the clean JSON (no markdown fences) → R3 parseJsonLoose hydrates cleanly
    expect(r.cards.scope).toBe(JSON.stringify(fields));
    expect(r.cards.scope).not.toContain('```');
    expect(JSON.parse(r.cards.scope)).toEqual(fields);
  });

  it('prose sections (no parsedContent) keep their text unchanged', async () => {
    const gen: SectionGenerator = {
      generateSectionContent: vi.fn(async (sectionKey: string) => ({
        content: `prose for ${sectionKey}`,
        isJson: false,
        tokensUsed: 1,
        model: 'mock',
        review: { score: 95, verdict: 'PASS', failedValidators: [], qualityGaps: [], fixes: [], sectionKey, model: 'mock', degraded: false },
      })),
    } as any;
    const r = await generateFullInitiative({ generationService: gen, passThreshold: 90 }, {
      initiativeId: 'i-prose',
      cardKeys: ['problemDefinition'],
    });
    expect(r.cards.problemDefinition).toBe('prose for problemDefinition');
  });
});
