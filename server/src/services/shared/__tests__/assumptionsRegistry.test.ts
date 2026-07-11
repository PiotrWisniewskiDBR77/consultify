/**
 * Testy jednostkowe wzorca transparentnych założeń (Z114) — rdzeń + przykład Finance.
 * Deterministyczne, bez DB/LLM. Domyka pętlę §6: BRAK→AI-zakłada→lista→edytuj→recompute→diff.
 */
import { describe, expect, it } from 'vitest';

import {
  applyUserEdit,
  auditCoverage,
  buildAiAssumption,
  detectMissingDrivers,
  diffAssumptions,
  listAssumptions,
  markSource,
  type Assumption,
  type RequiredDriver,
} from '../assumptionsRegistry.js';
import {
  FINANCE_SAAS_3STMT,
  FINANCE_SAAS_3STMT_DRIVERS,
  financialDriversToAssumptions,
} from '../assumptionsFinanceDrivers.js';

const req: RequiredDriver[] = [
  { key: 'b.two', label: 'Dwa', unit: '%', benchmarkHint: 0.2 },
  { key: 'a.one', label: 'Jeden', unit: 'EUR', benchmarkHint: 100 },
  { key: 'c.opt', label: 'Opcjonalny', unit: '×', optional: true },
];

const mk = (key: string, value: number | null, source: Assumption['provenance']['source_type'] = 'imported'): Assumption => ({
  key, label: key, value, unit: 'EUR', provenance: { source_type: source },
});

describe('detectMissingDrivers', () => {
  it('wykrywa absent i null_value, pomija optional, sortuje po key', () => {
    const provided = [mk('a.one', 100), mk('b.two', null)];
    const missing = detectMissingDrivers(req, provided);
    expect(missing.map((m) => m.key)).toEqual(['b.two']);
    expect(missing[0].reason).toBe('null_value');
  });

  it('brak klucza → absent z benchmarkHint', () => {
    const missing = detectMissingDrivers(req, [mk('b.two', 0.2)]);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ key: 'a.one', reason: 'absent', benchmarkHint: 100 });
  });

  it('NaN traktowany jak brak', () => {
    const missing = detectMissingDrivers(req, [mk('a.one', Number.NaN), mk('b.two', 0.2)]);
    expect(missing.map((m) => m.key)).toEqual(['a.one']);
  });
});

describe('buildAiAssumption (krok „AI zakłada jawnie")', () => {
  it('opakowuje wartość callera w ai_assumed z rationale/confidence', () => {
    const a = buildAiAssumption({ key: 'a.one', label: 'Jeden', unit: 'EUR' }, 120, {
      rationale: 'brak danych — benchmark SaaS B2B', confidence: 0.6, source_ref: 'Bessemer 2025',
    });
    expect(a.value).toBe(120);
    expect(a.provenance.source_type).toBe('ai_assumed');
    expect(a.provenance.confidence).toBe(0.6);
  });

  it('benchmarked=true → source_type benchmark; confidence clamp do 0..1', () => {
    const a = buildAiAssumption({ key: 'x', label: 'X', unit: '%' }, 0.2, {
      rationale: 'r', confidence: 1.4, benchmarked: true,
    });
    expect(a.provenance.source_type).toBe('benchmark');
    expect(a.provenance.confidence).toBe(1);
  });
});

describe('markSource / applyUserEdit', () => {
  it('markSource nie mutuje oryginału i merge prowieniencji', () => {
    const a = mk('a.one', 100, 'ai_assumed');
    const b = markSource(a, { source_type: 'benchmark', source_ref: 'Gartner 2025' });
    expect(a.provenance.source_type).toBe('ai_assumed'); // oryginał nietknięty
    expect(b.provenance).toMatchObject({ source_type: 'benchmark', source_ref: 'Gartner 2025' });
  });

  it('applyUserEdit ustawia wartość + ślad kto/kiedy + source_type user', () => {
    const a = mk('a.one', 100, 'ai_assumed');
    const e = applyUserEdit(a, 150, 'user-7', '2026-07-11T10:00:00Z', 'korekta CFO');
    expect(e.value).toBe(150);
    expect(e.provenance).toMatchObject({
      source_type: 'user', edited_by: 'user-7', edited_at: '2026-07-11T10:00:00Z', rationale: 'korekta CFO',
    });
  });
});

describe('listAssumptions (status + needsReview do UI)', () => {
  it('mapuje statusy i flaguje ai_assumed / missing / low-confidence do przeglądu', () => {
    const items: Assumption[] = [
      mk('imported.x', 10, 'imported'),
      { key: 'assumed.x', value: 5, unit: '%', provenance: { source_type: 'ai_assumed', confidence: 0.8 } },
      { key: 'edited.x', value: 7, unit: '%', provenance: { source_type: 'user' } },
      mk('missing.x', null, 'imported'),
      { key: 'lowconf.x', value: 3, unit: '%', provenance: { source_type: 'benchmark', confidence: 0.2 } },
    ];
    const listed = listAssumptions(items);
    const byKey = Object.fromEntries(listed.map((l) => [l.key, l]));
    expect(byKey['imported.x'].status).toBe('sourced');
    expect(byKey['imported.x'].needsReview).toBe(false);
    expect(byKey['assumed.x'].status).toBe('assumed');
    expect(byKey['assumed.x'].needsReview).toBe(true);
    expect(byKey['edited.x'].status).toBe('edited');
    expect(byKey['missing.x'].status).toBe('missing');
    expect(byKey['missing.x'].needsReview).toBe(true);
    expect(byKey['lowconf.x'].needsReview).toBe(true); // sourced ale niska pewność
    // sortowanie stabilne po key
    expect(listed.map((l) => l.key)).toEqual([...listed.map((l) => l.key)].sort());
  });
});

describe('diffAssumptions (ślad rewizji → recompute delta)', () => {
  it('added / removed / value_changed z deltami / source_changed', () => {
    const before = [mk('a', 100, 'ai_assumed'), mk('b', 50), mk('d', 10)];
    const after = [
      mk('a', 100, 'user'), // tylko źródło
      applyUserEdit(mk('b', 50), 60, 'u1', '2026-07-11T00:00:00Z'), // wartość 50→60
      mk('c', 5), // added
      // 'd' usunięty
    ];
    const diff = diffAssumptions(before, after);
    const byKey = Object.fromEntries(diff.map((d) => [d.key, d]));
    expect(byKey['a'].kind).toBe('source_changed');
    expect(byKey['a']).toMatchObject({ fromSource: 'ai_assumed', toSource: 'user' });
    expect(byKey['b'].kind).toBe('value_changed');
    expect(byKey['b'].deltaAbs).toBe(10);
    expect(byKey['b'].deltaPct).toBeCloseTo(0.2);
    expect(byKey['c'].kind).toBe('added');
    expect(byKey['d'].kind).toBe('removed');
    expect(diff.map((d) => d.key)).toEqual(['a', 'b', 'c', 'd']); // posortowane
  });

  it('deltaPct undefined gdy from=0 (brak dzielenia przez zero)', () => {
    const diff = diffAssumptions([mk('a', 0)], [mk('a', 5)]);
    expect(diff[0].kind).toBe('value_changed');
    expect(diff[0].deltaAbs).toBe(5);
    expect(diff[0].deltaPct).toBeUndefined();
  });
});

describe('Finance example — mostek FinancialDrivers → rejestr', () => {
  it('mapuje pola liczbowe, brakujące → null (wykrywalne)', () => {
    const partial = { saasPricePerSeatMonth: 40, grossMargin: 0.8 };
    const assumptions = financialDriversToAssumptions(partial, { sourceRef: 'upload:dbr77.xlsx' });
    const byKey = Object.fromEntries(assumptions.map((a) => [a.key, a]));
    expect(byKey['saas.price_per_seat_month'].value).toBe(40);
    expect(byKey['saas.price_per_seat_month'].provenance.source_type).toBe('imported');
    expect(byKey['cost.gross_margin'].value).toBe(0.8);
    expect(byKey['ue.cac'].value).toBeNull(); // brak w partial
  });

  it('per-klucz nadpisanie source_type', () => {
    const a = financialDriversToAssumptions(
      { cac: 1500 },
      { defaultSourceType: 'imported', sourceTypeByKey: { 'ue.cac': 'user' } },
    );
    const cac = a.find((x) => x.key === 'ue.cac');
    expect(cac?.provenance.source_type).toBe('user');
  });

  it('opcjonalny opex_leverage nie liczy się jako brak w audycie', () => {
    // pełny komplet wymaganych, bez opex_leverage
    const full: Record<string, number> = {
      saasPricePerSeatMonth: 40, saasSeatsStart: 500, saasSeatGrowthYoY: 1.6, grossChurnAnnual: 0.12,
      nrr: 1.1, servicesRevenueStart: 200000, servicesGrowthYoY: 0.3, grossMargin: 0.8,
      smPctRevenue: 0.45, rdPctRevenue: 0.24, gaPctRevenue: 0.2, daPctRevenue: 0.02,
      cac: 1500, arpuAnnual: 5000, startingCash: 1000000, fundingRaised: 2000000, taxRate: 0.19,
    };
    const assumptions = financialDriversToAssumptions(full);
    const audit = auditCoverage(FINANCE_SAAS_3STMT, FINANCE_SAAS_3STMT_DRIVERS, assumptions);
    expect(audit.complete).toBe(true);
    expect(audit.coverage).toBe(1);
    expect(audit.missing).toHaveLength(0);
  });
});

describe('Pętla §6 end-to-end (usuń ~30% wejścia → AI uzupełnia jawnie → edycja → diff)', () => {
  it('BRAK→AI-zakłada→lista→edytuj→recompute-diff', () => {
    // 1. wejście z brakami (usunięte ~30% z 17 wymaganych: 5 pól)
    const partial: Record<string, number> = {
      saasPricePerSeatMonth: 40, saasSeatsStart: 500, saasSeatGrowthYoY: 1.6, grossChurnAnnual: 0.12,
      nrr: 1.1, servicesRevenueStart: 200000, servicesGrowthYoY: 0.3, grossMargin: 0.8,
      smPctRevenue: 0.45, rdPctRevenue: 0.24, gaPctRevenue: 0.2, daPctRevenue: 0.02,
      // BRAK: cac, arpuAnnual, startingCash, fundingRaised, taxRate
    };
    let assumptions = financialDriversToAssumptions(partial);

    // wykrycie braków — deterministycznie
    const missing = detectMissingDrivers(FINANCE_SAAS_3STMT_DRIVERS, assumptions);
    expect(missing.map((m) => m.key).sort()).toEqual(
      ['capital.funding', 'capital.starting_cash', 'tax.rate', 'ue.arpu_annual', 'ue.cac'].sort(),
    );

    // 2. AI uzupełnia JAWNIE (wartości z callera/LLM; tu z benchmarkHint) → merge do rejestru
    const filled = missing.map((m) =>
      buildAiAssumption(m, m.benchmarkHint ?? 0, {
        rationale: `brak w imporcie — benchmark ${m.label}`, confidence: 0.55, source_ref: 'benchmark FP&A',
      }),
    );
    const filledKeys = new Set(filled.map((f) => f.key));
    assumptions = [...assumptions.filter((a) => !filledKeys.has(a.key)), ...filled];

    // 3. lista + audyt: komplet, ale 5 pozycji do przeglądu (ai_assumed)
    const audit = auditCoverage(FINANCE_SAAS_3STMT, FINANCE_SAAS_3STMT_DRIVERS, assumptions);
    expect(audit.complete).toBe(true);
    expect(audit.assumedKeys.sort()).toEqual(
      ['capital.funding', 'capital.starting_cash', 'tax.rate', 'ue.arpu_annual', 'ue.cac'].sort(),
    );

    // 4. użytkownik edytuje jedno ai_assumed → recompute-diff pokazuje deltę + zmianę źródła
    const before = assumptions;
    const idx = assumptions.findIndex((a) => a.key === 'ue.cac');
    const after = [...assumptions];
    after[idx] = applyUserEdit(assumptions[idx], 2000, 'cfo-1', '2026-07-11T12:00:00Z', 'CFO: realny CAC');

    const diff = diffAssumptions(before, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({
      key: 'ue.cac', kind: 'value_changed', from: 1500, to: 2000, deltaAbs: 500,
      fromSource: 'ai_assumed', toSource: 'user',
    });

    // po edycji cac już nie „do przeglądu"
    const audit2 = auditCoverage(FINANCE_SAAS_3STMT, FINANCE_SAAS_3STMT_DRIVERS, after);
    expect(audit2.assumedKeys).not.toContain('ue.cac');
    expect(listAssumptions(after).find((l) => l.key === 'ue.cac')?.status).toBe('edited');
  });
});
