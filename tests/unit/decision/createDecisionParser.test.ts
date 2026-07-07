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
