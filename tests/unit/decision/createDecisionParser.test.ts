// @vitest-environment node
/**
 * PROBLEM #2 (naprawa-r4Struct) — parser pól strukturalnych decyzji ROBUST.
 *
 * Cel: przy typowym (różnym) output Claude wypełnić 5/5 pól, nie 2-3/5:
 *   alternatives · risk_impact · consequences_of_inaction · recommendation · assumptions.
 * Plus 2 defekty sędziego BCG:
 *   #1 glitch nagłówka ("**: X") — strip wiodących resztek markdown;
 *   #2 dedup — recommendation ≠ rationale (nie ten sam blob 3×).
 *
 * Czyste helpery (bez DB/LLM) wyeksportowane jako `__test__`.
 */
import { describe, expect, it } from 'vitest';

import { __test__ } from '../../../server/src/services/ai/tools/createDecision.ts';

const {
  stripLeadingHeaderGlitch,
  splitConsequencesAndRecommendation,
  splitRecommendationAndRationale,
  extractAlternatives,
  extractRisks,
  extractAssumptions,
  matchArtifactBlock,
  looseJsonField,
} = __test__;

// ── defekt #1: strip glitcha nagłówka ────────────────────────────────────────

describe('stripLeadingHeaderGlitch (defekt #1)', () => {
  it('usuwa osierocone "**:" z przodu (ucięty **Rekomendacja**: X)', () => {
    expect(stripLeadingHeaderGlitch('**: Wybór Microsoft Azure jako platformy.')).toBe(
      'Wybór Microsoft Azure jako platformy.',
    );
  });
  it('usuwa osierocone "**" i wiodący ":"', () => {
    expect(stripLeadingHeaderGlitch('** Wdrożyć teraz.')).toBe('Wdrożyć teraz.');
    expect(stripLeadingHeaderGlitch(': Wdrożyć teraz.')).toBe('Wdrożyć teraz.');
  });
  it('usuwa pusty pogrubiony nagłówek "****" i kombinacje "**: -"', () => {
    expect(stripLeadingHeaderGlitch('**** Treść')).toBe('Treść');
    expect(stripLeadingHeaderGlitch('**: - Treść')).toBe('Treść');
  });
  it('nie rusza czystej treści', () => {
    expect(stripLeadingHeaderGlitch('Wybór Azure — uzasadniony kosztem.')).toBe(
      'Wybór Azure — uzasadniony kosztem.',
    );
  });
  it('nie tnie pogrubienia w środku treści', () => {
    expect(stripLeadingHeaderGlitch('Wdrożyć **Azure** natychmiast.')).toBe(
      'Wdrożyć **Azure** natychmiast.',
    );
  });

  // FIX R5 — glitch z KOŃCA / osierocony „**" (próbki 1:1 z żywego demo 2026-07-07).
  it('usuwa osierocony "**" po frazie nagłówka (dec1: Selective Build"** — …)', () => {
    expect(
      stripLeadingHeaderGlitch(
        'Strategia hybrydowa "Partner + Selective Build"** — partnerstwo OEM z dostawcą platformy.',
      ),
    ).toBe('Strategia hybrydowa "Partner + Selective Build" — partnerstwo OEM z dostawcą platformy.');
  });
  it('usuwa osierocony "**" przed łamaniem linii (dec2: direct sales**\\n\\nRozpocząć…)', () => {
    expect(
      stripLeadingHeaderGlitch('model hybrydowy partner/reseller + selective direct sales**\n\nRozpocząć od partnerstwa.'),
    ).toBe('model hybrydowy partner/reseller + selective direct sales\n\nRozpocząć od partnerstwa.');
  });
  it('usuwa wiszące "**" / ":" z końca wartości', () => {
    expect(stripLeadingHeaderGlitch('Wdrożyć teraz**')).toBe('Wdrożyć teraz');
    expect(stripLeadingHeaderGlitch('Rekomendacja: zrób X:')).toBe('Rekomendacja: zrób X');
  });
});

// ── consequences + recommendation + rationale (prose) ────────────────────────

describe('splitConsequencesAndRecommendation', () => {
  it('rozdziela konsekwencje i rekomendację po markerze "Rekomendacja:"', () => {
    const prose = `Jeśli nie zdecydujemy w 30 dni, tracimy okno wdrożeniowe i ~200k PLN.

**Rekomendacja**: Wdrożyć Azure w Q1. Uzasadnienie: najniższy TCO i gotowe kompetencje zespołu.`;
    const r = splitConsequencesAndRecommendation(prose);
    expect(r.consequences).toContain('tracimy okno');
    expect(r.recommendation).toBe('Wdrożyć Azure w Q1.');
    expect(r.rationale).toContain('najniższy TCO');
    // defekt #2: recommendation != rationale
    expect(r.recommendation).not.toBe(r.rationale);
    // defekt #1: brak osieroconego "**:"
    expect(r.recommendation.startsWith('**')).toBe(false);
  });

  it('marker EN "Recommendation:" + rozdział zdanie/uzasadnienie', () => {
    const prose = `Inaction costs ~$50k/quarter.

Recommendation: Adopt option B now. It has the lowest risk and fastest payback.`;
    const r = splitConsequencesAndRecommendation(prose);
    expect(r.recommendation).toBe('Adopt option B now.');
    expect(r.rationale).toContain('lowest risk');
  });

  it('brak markera → całość to konsekwencje, recommendation/rationale puste', () => {
    const r = splitConsequencesAndRecommendation('Sama proza bez wyraźnej rekomendacji.');
    expect(r.consequences).toBe('Sama proza bez wyraźnej rekomendacji.');
    expect(r.recommendation).toBe('');
    expect(r.rationale).toBe('');
  });
});

describe('splitRecommendationAndRationale (defekt #2 dedup)', () => {
  it('krótka rekomendacja bez uzasadnienia → rationale pusty (bez duplikacji)', () => {
    const r = splitRecommendationAndRationale('Wdrożyć Azure.');
    expect(r.recommendation).toBe('Wdrożyć Azure.');
    expect(r.rationale).toBe('');
  });
  it('pierwsze zdanie = rekomendacja, reszta (nietrywialna) = uzasadnienie', () => {
    const r = splitRecommendationAndRationale(
      'Wybrać dostawcę A. Ma najniższy koszt całkowity i najkrótszy czas wdrożenia w porównaniu do B i C.',
    );
    expect(r.recommendation).toBe('Wybrać dostawcę A.');
    expect(r.rationale).toContain('najniższy koszt');
    expect(r.recommendation).not.toBe(r.rationale);
  });
});

// ── FIX r6bExtract (defekt #3) — rationale NIE ucięty na starcie ──────────────

describe('splitRecommendationAndRationale — pełne otwarcie rationale (defekt #3)', () => {
  it('marker + PROZA po nim ("Uzasadnienie wyboru tej opcji…") → zachowuje początek', () => {
    const body =
      'Wdrożyć strategię hybrydową Partner + Build.\n' +
      'Uzasadnienie wyboru tej opcji nad alternatywami: (1) skraca time-to-GA o 40-60%, (2) kontrola IP.';
    const r = splitRecommendationAndRationale(body);
    expect(r.recommendation).toBe('Wdrożyć strategię hybrydową Partner + Build.');
    // KLUCZ: rationale zaczyna się od PEŁNEGO „Uzasadnienie wyboru…", nie od „wyboru…"/„tej…".
    expect(r.rationale.startsWith('Uzasadnienie wyboru tej opcji')).toBe(true);
    expect(r.rationale).toContain('40-60%');
  });

  it('marker + CZYSTY separator ("Uzasadnienie: <treść>") → zdejmuje marker (bez regresji)', () => {
    const body = 'Wybór dostawcy A.\nUzasadnienie: najniższy TCO i szybki payback w porównaniu do B.';
    const r = splitRecommendationAndRationale(body);
    expect(r.recommendation).toBe('Wybór dostawcy A.');
    expect(r.rationale).toBe('najniższy TCO i szybki payback w porównaniu do B.');
  });

  it('bold + dwukropek ("**Uzasadnienie:** X") nadal czysto zdejmowany', () => {
    const body = 'Wdrożyć Azure.\n\n**Uzasadnienie:** najniższy TCO oraz gotowe kompetencje zespołu.';
    const r = splitRecommendationAndRationale(body);
    expect(r.rationale).toBe('najniższy TCO oraz gotowe kompetencje zespołu.');
  });
});

// ── FIX r6bExtract (defekt #2) — assumptions bez boilerplate-atrapy ───────────

describe('extractAssumptions (defekt #2 — realne założenia, nie atrapa)', () => {
  it('wyłuskuje REALNE założenia z żywej narracji (liczby/markery), nie boilerplate', () => {
    // 1:1 z żywej decyzji 2cfe3e3f (demo 2026-07-07).
    const narr =
      'Strategia hybrydowa "Partner + Selective Build".\n' +
      'Uzasadnienie: (1) skraca time-to-GA o 40-60% vs pure build (szacunek: eliminacja 12-18 miesięcy), ' +
      '(2) zachowuje kontrolę IP.\n' +
      '**Horyzont:** Decyzja partnera do 14 dni, podpisanie umowy do 45 dni.';
    const a = extractAssumptions(narr, 'pl');
    expect(a.length).toBeGreaterThan(0);
    // ŻADNE założenie nie jest generycznym placeholderem-atrapą:
    expect(a.some((x: any) => /niezweryfikowana na danych na żywo/i.test(x.assumption))).toBe(false);
    // Realna, skwantyfikowana teza jest obecna:
    expect(a.some((x: any) => /40-60%/.test(x.assumption))).toBe(true);
    // Każde założenie ma confidence + whatWouldChangeIt (falsyfikowalność §5):
    for (const x of a) {
      expect(['low', 'medium', 'high']).toContain(x.confidence);
      expect(x.whatWouldChangeIt.length).toBeGreaterThan(0);
    }
  });

  it('narracja bez liczb i bez markera → PUSTA tablica (lepiej puste niż atrapa)', () => {
    expect(extractAssumptions('Wdrożyć Azure teraz. To dobra opcja dla zespołu.', 'pl')).toEqual([]);
    expect(extractAssumptions('', 'pl')).toEqual([]);
  });

  it('szacunek/estimate/~ → confidence=medium; twarda liczba → high', () => {
    const soft = extractAssumptions('Zwrot ~20% w 6 miesięcy wg szacunku.', 'pl');
    expect(soft[0].confidence).toBe('medium');
    const hard = extractAssumptions('Kontrakt wart 500k PLN rocznie od 10 klientów.', 'pl');
    expect(hard[0].confidence).toBe('high');
  });

  it('EN: "Assuming …" wyłuskane', () => {
    const a = extractAssumptions('Adopt option B. Assuming 20% adoption and a 6 month payback.', 'en');
    expect(a.some((x: any) => /assuming 20%/i.test(x.assumption))).toBe(true);
  });
});

// ── alternatives: parsed → artifact:comparison → loose JSON ───────────────────

describe('extractAlternatives (PROBLEM #2 robust)', () => {
  it('bierze czyste parsedContent.alternatives', () => {
    const parsed = { alternatives: [{ title: 'A' }, { title: 'B' }] };
    expect(extractAlternatives(parsed, '')).toHaveLength(2);
  });

  it('fallback: blok ```artifact:comparison``` gdy parsedContent puste', () => {
    const raw = [
      'Oto porównanie opcji:',
      '```artifact:comparison:Porównanie dostawców',
      JSON.stringify({
        options: [
          { name: 'Azure', pros: ['skalowalność'], cons: ['koszt'] },
          { name: 'On-prem', pros: ['kontrola'], cons: ['CAPEX'] },
        ],
      }),
      '```',
    ].join('\n');
    const alts = extractAlternatives(undefined, raw)!;
    expect(alts).toHaveLength(2);
    expect(alts[0].title).toBe('Azure');
    expect(alts[0].pros).toEqual(['skalowalność']);
  });

  it('fallback: luźny {"alternatives":[…]} w prozie', () => {
    const raw = 'Blah blah {"alternatives":[{"title":"Opcja 1"}]} koniec.';
    const alts = extractAlternatives(undefined, raw)!;
    expect(alts[0].title).toBe('Opcja 1');
  });

  it('brak jakichkolwiek danych → null (bez zaślepki)', () => {
    expect(extractAlternatives(undefined, 'nic tu nie ma')).toBeNull();
  });
});

// ── risks: parsed → artifact:matrix → loose JSON ──────────────────────────────

describe('extractRisks (PROBLEM #2 robust)', () => {
  it('bierze czyste parsedContent.risks', () => {
    const parsed = { risks: [{ title: 'R1', probability: 'high', impact: 'high' }] };
    expect(extractRisks(parsed, '')).toHaveLength(1);
  });

  it('fallback: blok ```artifact:matrix``` (items z x/y)', () => {
    const raw = [
      '```artifact:matrix:Macierz ryzyk',
      JSON.stringify({
        items: [
          { name: 'Opóźnienie integracji', probability: 'medium', impact: 'high', mitigation: 'Bufor' },
        ],
      }),
      '```',
    ].join('\n');
    const risks = extractRisks(undefined, raw)!;
    expect(risks).toHaveLength(1);
    expect(risks[0].title).toBe('Opóźnienie integracji');
    expect(risks[0].mitigation).toBe('Bufor');
  });

  it('fallback: luźny {"risks":[…]} w prozie', () => {
    const raw = 'tekst {"risks":[{"title":"Ryzyko X","probability":"low","impact":"medium"}]} tekst';
    const risks = extractRisks(undefined, raw)!;
    expect(risks[0].title).toBe('Ryzyko X');
  });

  it('brak danych → null', () => {
    expect(extractRisks(undefined, 'proza bez ryzyk')).toBeNull();
  });
});

// ── INTEGRACJA: typowy pełny output Claude → 5/5 pól ──────────────────────────

describe('parser decyzji — 5/5 pól z realistycznego output Claude', () => {
  it('alternatives + risks + consequences + recommendation + rationale wszystkie obecne', () => {
    // Realistyczny scenariusz: sekcje JSON sparsowały się CZYSTO (alt+risk),
    // consequences to proza z markerem rekomendacji i uzasadnienia.
    const altParsed = {
      alternatives: [
        { title: 'Azure', pros: ['skala'], cons: ['koszt'] },
        { title: 'Nie robić nic', pros: [], cons: ['stagnacja'] },
      ],
    };
    const riskParsed = {
      risks: [
        { title: 'Vendor lock-in', probability: 'medium', impact: 'high', mitigation: 'multi-cloud' },
        { title: 'Koszt migracji', probability: 'high', impact: 'medium', mitigation: 'faza pilotażu' },
      ],
    };
    const consProse =
      'W 30 dni bez decyzji tracimy okno budżetowe (~300k PLN).\n\n' +
      '**Rekomendacja**: Wdrożyć Azure w Q1. Uzasadnienie: najniższy TCO i gotowe kompetencje.';

    const alternatives = extractAlternatives(altParsed, '');
    const risks = extractRisks(riskParsed, '');
    const split = splitConsequencesAndRecommendation(consProse);

    // 5/5 pól niepuste:
    expect(alternatives && alternatives.length).toBeTruthy();
    expect(risks && risks.length).toBeTruthy();
    expect(split.consequences).toBeTruthy();
    expect(split.recommendation).toBeTruthy();
    expect(split.rationale).toBeTruthy();
    // dedup: rekomendacja i uzasadnienie różne, brak glitcha
    expect(split.recommendation).not.toBe(split.rationale);
    expect(split.recommendation).toBe('Wdrożyć Azure w Q1.');
  });

  it('output "free-chat" Teresy (artifact blocks + proza) → nadal 5/5', () => {
    // Gdy sekcje JSON NIE sparsowały się czysto, a Teresa dała bloki artefaktowe.
    const altRaw =
      'Porównuję opcje:\n```artifact:comparison:Opcje\n' +
      JSON.stringify({ options: [{ name: 'A' }, { name: 'B' }] }) +
      '\n```';
    const riskRaw =
      '```artifact:matrix:Ryzyka\n' +
      JSON.stringify({ items: [{ name: 'R1', probability: 'high', impact: 'high' }] }) +
      '\n```';
    const consProse = 'Bez decyzji: rosnący dług.\n\nRecommendation: Go with A. It is cheaper and faster to deploy.';

    const alternatives = extractAlternatives(undefined, altRaw);
    const risks = extractRisks(undefined, riskRaw);
    const split = splitConsequencesAndRecommendation(consProse);

    expect(alternatives).toHaveLength(2);
    expect(risks).toHaveLength(1);
    expect(split.consequences).toBeTruthy();
    expect(split.recommendation).toBe('Go with A.');
    expect(split.rationale).toContain('cheaper');
  });
});

// ── niskopoziomowe helpery ────────────────────────────────────────────────────

describe('matchArtifactBlock / looseJsonField', () => {
  it('matchArtifactBlock parsuje comparison z :Title', () => {
    const obj = matchArtifactBlock('```artifact:comparison:X\n{"a":1}\n```', 'comparison');
    expect(obj).toEqual({ a: 1 });
  });
  it('matchArtifactBlock zwraca null dla złego JSON', () => {
    expect(matchArtifactBlock('```artifact:matrix\n{niepoprawny}\n```', 'matrix')).toBeNull();
  });
  it('looseJsonField wyłuskuje zbalansowaną tablicę', () => {
    const arr = looseJsonField('x "risks": [{"n":[1,2]},{"m":3}] y', 'risks');
    expect(arr).toEqual([{ n: [1, 2] }, { m: 3 }]);
  });
});
