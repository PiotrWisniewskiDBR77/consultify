/**
 * Pakiet G (Prediction) — testy czystej logiki domenowej `predictionScenarioModel.ts`.
 *
 * Uruchamiać z KORZENIA repo (`vitest run src/components/Finance/Prediction/__tests__/predictionScenarioModel.test.ts`)
 * — z katalogu `server/` vitest zgłasza „No test files found" + exit 1 (patrz CLAUDE.md).
 *
 * Kontrole negatywne (obowiązkowe per test bramkujący) są opisane w komentarzu przy każdym bloku —
 * zweryfikowane RĘCZNIE podczas pisania (chwilowe zepsucie funkcji -> test czerwienieje -> cofnięcie),
 * a tam gdzie to naturalne, jako osobna asercja "brak nakładania NIE jest flagowany" w tym samym pliku.
 */
import { describe, expect, it } from 'vitest';

import {
  acceptWarningException,
  acknowledgeCriticalDataException,
  assertBaseEqualsBaseline,
  buildMaterialProvenance,
  checkBalanceSheetTie,
  checkFacilityCompliance,
  computeCovenantHeadroom,
  computeFacilityUtilization,
  computeLiquidityHeadroom,
  computeScenarioComparison,
  computeScenarioComparisonCell,
  createEmptyScenarioDraft,
  detectClientSideOverlaps,
  driverMissingValueToWarningException,
  evaluateExceptionLedgerForCompute,
  impactChainEffectiveFraction,
  isAnalyticsMaterialityMisusedForBalanceCheck,
  isBaseModeStructurallyPassthrough,
  markAssumptionChanged,
  MathUndefinedError,
  reconcileStatementsAndSchedules,
  resolveDriverValue,
  resolveMaterialException,
  resolveResultFreshness,
  scenarioModeToTrack,
  solveBreakEvenDriver,
  validateFinancingPeriodShape,
  validateToleranceHierarchy,
  verifyExactColdReopen,
  type CriticalDataException,
  type DraftDriverOverride,
  type DraftFinancingEvent,
  type DraftImpact,
  type DraftInitiative,
  type MaterialException,
  type ScenarioDraft,
  type WarningException,
} from '../predictionScenarioModel';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeInitiative(overrides: Partial<DraftInitiative> = {}): DraftInitiative {
  return {
    id: 'init-1',
    initiativeCode: 'PROD-EFF-5PCT',
    name: 'Poprawa efektywności produkcji o 5%',
    description: 'Redukcja COGS przez optymalizację linii produkcyjnej',
    source: 'MANAGEMENT_PLAN',
    owner: 'Jan Kowalski (COO)',
    confidencePct: 70,
    defaultStartPeriodId: 'p-2026-03',
    defaultRampMonths: 3,
    defaultDurationMonths: null,
    implementationCostDecimal: 150_000,
    status: 'CONFIRMED',
    ...overrides,
  };
}

function makeImpact(overrides: Partial<DraftImpact> = {}): DraftImpact {
  return {
    id: 'impact-1',
    initiativeId: 'init-1',
    assumptionLabel: '5% redukcja COGS od miesiąca 3 ramp-up',
    driverScheduleType: 'cogs_opex',
    driverCode: 'COGS_PCT_OF_REVENUE',
    kpiCatalogId: null,
    statementLineCode: 'COGS',
    entityId: 'entity-1',
    amountKind: 'PERCENT_OF_BASE',
    amountDecimal: -0.05,
    amountUnit: 'RATIO',
    sign: 'NEGATIVE',
    startPeriodId: 'p-2026-03',
    rampMonths: 3,
    durationMonths: null,
    decayPctPerPeriod: null,
    implementationCostDecimal: 150_000,
    confidencePct: 70,
    probabilityPct: 85,
    cannibalizesImpactId: null,
    ...overrides,
  };
}

function makeDriverOverride(overrides: Partial<DraftDriverOverride> = {}): DraftDriverOverride {
  return {
    id: 'ovr-1',
    scheduleType: 'cogs_opex',
    driverCode: 'COGS_PCT_OF_REVENUE',
    entityId: 'entity-1',
    periodId: 'p-2026-03',
    overrideSource: 'MANUAL',
    valueStatus: 'PRESENT_NONZERO',
    valueDecimal: 0.58,
    unit: 'RATIO',
    baselineValueDecimal: 0.6,
    rationale: 'Negocjacje z dostawcą surowca',
    canonicalLineCode: 'COGS',
    ...overrides,
  };
}

function makeFinancing(overrides: Partial<DraftFinancingEvent> = {}): DraftFinancingEvent {
  return {
    id: 'fin-1',
    financingKind: 'FACILITY_DRAWDOWN',
    entityId: 'entity-1',
    periodId: 'p-2026-03',
    payload: { amount: 500_000, rate: 0.06 },
    rationale: 'Finansowanie CAPEX rozbudowy',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tryby scenariusza (A/B/C)
// ---------------------------------------------------------------------------

describe('scenarioModeToTrack — trzy tryby budowy', () => {
  it('mapuje STANDARD_BASE/UPSIDE/DOWNSIDE na tryb A (STANDARD)', () => {
    expect(scenarioModeToTrack('STANDARD_BASE')).toBe('STANDARD');
    expect(scenarioModeToTrack('STANDARD_UPSIDE')).toBe('STANDARD');
    expect(scenarioModeToTrack('STANDARD_DOWNSIDE')).toBe('STANDARD');
  });
  it('mapuje DRIVER_OVERRIDE na tryb B', () => {
    expect(scenarioModeToTrack('DRIVER_OVERRIDE')).toBe('DRIVER_OVERRIDE');
  });
  it('mapuje FUNDAMENTAL_INITIATIVE na tryb C', () => {
    expect(scenarioModeToTrack('FUNDAMENTAL_INITIATIVE')).toBe('FUNDAMENTAL_INITIATIVE');
  });
});

// ---------------------------------------------------------------------------
// ★ Base == Baseline
// ---------------------------------------------------------------------------

describe('Base == Baseline (OWN-FIN-020)', () => {
  it('STANDARD_BASE bez żadnych nadpisań/inicjatyw/finansowania jest strukturalnie passthrough', () => {
    const draft = createEmptyScenarioDraft({ name: 'Base' });
    expect(isBaseModeStructurallyPassthrough(draft)).toBe(true);
  });

  it('KONTROLA NEGATYWNA: STANDARD_BASE z choćby jednym driver override PRZESTAJE być passthrough', () => {
    const draft: ScenarioDraft = { ...createEmptyScenarioDraft({ name: 'Base' }), driverOverrides: [makeDriverOverride()] };
    expect(isBaseModeStructurallyPassthrough(draft)).toBe(false);
  });

  it('KONTROLA NEGATYWNA: tryb inny niż STANDARD_BASE nigdy nie jest "passthrough" nawet bez żadnych zmian', () => {
    const draft = createEmptyScenarioDraft({ name: 'Upside', scenarioMode: 'STANDARD_UPSIDE' });
    expect(isBaseModeStructurallyPassthrough(draft)).toBe(false);
  });

  it('assertBaseEqualsBaseline: identyczne mapy wartości => equal:true', () => {
    const values = { 'REVENUE::p1': 100, 'EBITDA::p1': 20 };
    expect(assertBaseEqualsBaseline(values, { ...values })).toEqual({ equal: true });
  });

  it('KONTROLA NEGATYWNA: jedna rozbieżna komórka => equal:false z listą kluczy', () => {
    const base = { 'REVENUE::p1': 100, 'EBITDA::p1': 20 };
    const baseline = { 'REVENUE::p1': 100, 'EBITDA::p1': 21 };
    const result = assertBaseEqualsBaseline(base, baseline);
    expect(result).toEqual({ equal: false, diffKeys: ['EBITDA::p1'] });
  });
});

// ---------------------------------------------------------------------------
// ★★ Wykrywanie nakładania się wpływów / double counting
// ---------------------------------------------------------------------------

describe('detectClientSideOverlaps — double counting', () => {
  it('dwie inicjatywy uderzające w TĘ SAMĄ linię/okres/podmiot są WYKRYTE (sourceCount=2), nie sumowane po cichu', () => {
    const initiative2 = makeInitiative({ id: 'init-2', initiativeCode: 'AUTOMATION-COGS', defaultStartPeriodId: 'p-2026-03' });
    const impact1 = makeImpact({ id: 'impact-1', initiativeId: 'init-1' });
    const impact2 = makeImpact({ id: 'impact-2', initiativeId: 'init-2', amountDecimal: -0.03 });

    const draft = {
      driverOverrides: [],
      initiatives: [makeInitiative(), initiative2],
      impacts: [impact1, impact2],
      financing: [],
    };

    const findings = detectClientSideOverlaps(draft);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ entityId: 'entity-1', canonicalLineCode: 'COGS', periodId: 'p-2026-03', sourceCount: 2 });
    expect(findings[0].sources.map((s) => s.sourceId).sort()).toEqual(['impact-1', 'impact-2']);
  });

  it('driver override + impact_chain na TĘ SAMĄ komórkę też się liczy jako nakładanie (mieszane typy źródeł)', () => {
    const draft = {
      driverOverrides: [makeDriverOverride()], // COGS, entity-1, p-2026-03
      initiatives: [makeInitiative()],
      impacts: [makeImpact()], // COGS, entity-1, p-2026-03
      financing: [],
    };
    const findings = detectClientSideOverlaps(draft);
    expect(findings).toHaveLength(1);
    expect(findings[0].sourceCount).toBe(2);
    expect(findings[0].sources.map((s) => s.sourceType).sort()).toEqual(['DRIVER_OVERRIDE', 'INITIATIVE_IMPACT']);
  });

  it('financing FACILITY_DRAWDOWN + driver override na LONG_TERM_DEBT w tym samym okresie jest wykryty', () => {
    const draft = {
      driverOverrides: [makeDriverOverride({ id: 'ovr-debt', scheduleType: 'debt_maturity', canonicalLineCode: 'LONG_TERM_DEBT', driverCode: 'PRINCIPAL' })],
      initiatives: [],
      impacts: [],
      financing: [makeFinancing()], // FACILITY_DRAWDOWN -> LONG_TERM_DEBT + INTEREST_EXPENSE
    };
    const findings = detectClientSideOverlaps(draft);
    const debtFinding = findings.find((f) => f.canonicalLineCode === 'LONG_TERM_DEBT');
    expect(debtFinding).toBeDefined();
    expect(debtFinding?.sourceCount).toBe(2);
  });

  it('KONTROLA NEGATYWNA — brak nakładania: dwie inicjatywy w RÓŻNE linie NIE są flagowane', () => {
    const impact1 = makeImpact({ id: 'impact-1', statementLineCode: 'COGS' });
    const impact2 = makeImpact({ id: 'impact-2', statementLineCode: 'OPEX', initiativeId: 'init-2' });
    const draft = {
      driverOverrides: [],
      initiatives: [makeInitiative(), makeInitiative({ id: 'init-2', initiativeCode: 'OPEX-INIT' })],
      impacts: [impact1, impact2],
      financing: [],
    };
    expect(detectClientSideOverlaps(draft)).toHaveLength(0);
  });

  it('KONTROLA NEGATYWNA — brak nakładania: ta sama linia, ale RÓŻNE okresy NIE są flagowane', () => {
    const impact1 = makeImpact({ id: 'impact-1', startPeriodId: 'p-2026-03' });
    const impact2 = makeImpact({ id: 'impact-2', startPeriodId: 'p-2026-06', initiativeId: 'init-2' });
    const draft = {
      driverOverrides: [],
      initiatives: [makeInitiative(), makeInitiative({ id: 'init-2', initiativeCode: 'LATER' })],
      impacts: [impact1, impact2],
      financing: [],
    };
    expect(detectClientSideOverlaps(draft)).toHaveLength(0);
  });

  it('wynik jest deterministyczny niezależnie od kolejności wejścia (sortowanie w pamięci, nie kolejność iteracji)', () => {
    const impact1 = makeImpact({ id: 'impact-1' });
    const impact2 = makeImpact({ id: 'impact-2', initiativeId: 'init-2', amountDecimal: -0.03 });
    const initiative2 = makeInitiative({ id: 'init-2', initiativeCode: 'AUTOMATION-COGS' });
    const draftA = { driverOverrides: [], initiatives: [makeInitiative(), initiative2], impacts: [impact1, impact2], financing: [] };
    const draftB = { driverOverrides: [], initiatives: [initiative2, makeInitiative()], impacts: [impact2, impact1], financing: [] };
    expect(detectClientSideOverlaps(draftA)).toEqual(detectClientSideOverlaps(draftB));
  });

  it('impact bez rozwiązywalnego okresu (brak startPeriodId i brak default na inicjatywie) jest pomijany, nie crashuje', () => {
    const orphanInitiative = makeInitiative({ id: 'init-orphan', defaultStartPeriodId: null });
    const impact1 = makeImpact({ id: 'impact-1', initiativeId: 'init-orphan', startPeriodId: null });
    const impact2 = makeImpact({ id: 'impact-2', initiativeId: 'init-orphan', startPeriodId: null, amountDecimal: -0.02 });
    const draft = { driverOverrides: [], initiatives: [orphanInitiative], impacts: [impact1, impact2], financing: [] };
    expect(detectClientSideOverlaps(draft)).toHaveLength(0);
  });
});

describe('impactChainEffectiveFraction — ramp/duration/decay (port bit-identyczny z serwerem)', () => {
  it('brak ramp/duration => fraction=1 od razu', () => {
    expect(impactChainEffectiveFraction(0, null, null, null)).toBe(1);
    expect(impactChainEffectiveFraction(5, null, null, null)).toBe(1);
  });
  it('ramp 3 miesiące: 1/3, 2/3, 1', () => {
    expect(impactChainEffectiveFraction(0, 3, null, null)).toBeCloseTo(1 / 3);
    expect(impactChainEffectiveFraction(1, 3, null, null)).toBeCloseTo(2 / 3);
    expect(impactChainEffectiveFraction(2, 3, null, null)).toBe(1);
  });
  it('po zakończeniu duration bez decay => fraction=0 (czysty koniec)', () => {
    expect(impactChainEffectiveFraction(12, null, 12, null)).toBe(0);
  });
  it('przed startem (monthsSinceStart < 0) => 0', () => {
    expect(impactChainEffectiveFraction(-1, null, null, null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Finansowanie tylko w Prediction — kształt payload
// ---------------------------------------------------------------------------

describe('validateFinancingPeriodShape', () => {
  it('zdarzenie punktowe (FACILITY_DRAWDOWN) wymaga periodId', () => {
    expect(validateFinancingPeriodShape({ financingKind: 'FACILITY_DRAWDOWN', periodId: 'p-2026-03' })).toEqual({ ok: true });
    expect(validateFinancingPeriodShape({ financingKind: 'FACILITY_DRAWDOWN', periodId: null }).ok).toBe(false);
  });
  it('polityka horyzont-szeroka (MIN_CASH_POLICY) wymaga periodId=null', () => {
    expect(validateFinancingPeriodShape({ financingKind: 'MIN_CASH_POLICY', periodId: null })).toEqual({ ok: true });
    expect(validateFinancingPeriodShape({ financingKind: 'MIN_CASH_POLICY', periodId: 'p-2026-03' }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Porównania — absolutne, Δ, %
// ---------------------------------------------------------------------------

describe('computeScenarioComparisonCell / computeScenarioComparison', () => {
  it('liczy absolutny delta i procent poprawnie', () => {
    const cell = computeScenarioComparisonCell('REVENUE', 'p1', 120, 100);
    expect(cell.absoluteDelta).toBe(20);
    expect(cell.percentDelta).toBeCloseTo(0.2);
  });
  it('baseline=0 daje percentDelta:null (niezdefiniowane), NIE 0 ani błąd', () => {
    const cell = computeScenarioComparisonCell('REVENUE', 'p1', 50, 0);
    expect(cell.absoluteDelta).toBe(50);
    expect(cell.percentDelta).toBeNull();
  });
  it('brak danych (null) w scenariuszu lub baseline daje absoluteDelta:null, nigdy 0', () => {
    const cell = computeScenarioComparisonCell('REVENUE', 'p1', null, 100);
    expect(cell.absoluteDelta).toBeNull();
    expect(cell.percentDelta).toBeNull();
  });
  it('computeScenarioComparison scala klucze obu map w deterministycznej kolejności', () => {
    const scenario = { 'REVENUE::p1': 120, 'EBITDA::p1': 30 };
    const baseline = { 'REVENUE::p1': 100 };
    const rows = computeScenarioComparison(scenario, baseline);
    expect(rows.map((r) => `${r.lineCode}::${r.periodId}`)).toEqual(['EBITDA::p1', 'REVENUE::p1']);
    expect(rows.find((r) => r.lineCode === 'EBITDA')?.baselineValue).toBeNull();
  });
});

describe('computeLiquidityHeadroom', () => {
  it('liczy zapas płynności gdy polityka min cash jest zdefiniowana', () => {
    expect(computeLiquidityHeadroom(500_000, 200_000)).toEqual({ cash: 500_000, minCashPolicy: 200_000, liquidityHeadroom: 300_000 });
  });
  it('brak polityki min cash => liquidityHeadroom:null (exception, nie 0)', () => {
    expect(computeLiquidityHeadroom(500_000, null).liquidityHeadroom).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ★★ DEC-FIN-009 — exceptions vs twarda blokada
// ---------------------------------------------------------------------------

describe('DEC-FIN-009 — brak danych => exception + akceptacja, NIE blokada', () => {
  it('MISSING driver value zwraca exception z opcjami rozstrzygnięcia, nie throw', () => {
    const result = resolveDriverValue({ valueStatus: 'MISSING', valueDecimal: null, driverCode: 'DSO_DAYS', periodId: 'p-2026-03' });
    expect(result.kind).toBe('exception');
    if (result.kind === 'exception') {
      expect(result.requiresExplicitAcceptance).toBe(true);
      expect(result.proposedResolutions.length).toBeGreaterThan(0);
    }
  });
  it('PRESENT_NONZERO zwraca value, nie exception', () => {
    const result = resolveDriverValue({ valueStatus: 'PRESENT_NONZERO', valueDecimal: 42, driverCode: 'DSO_DAYS', periodId: 'p1' });
    expect(result).toEqual({ kind: 'value', value: 42 });
  });
});

describe('DEC-FIN-009 — dzielenie przez zero => TWARDA ODMOWA', () => {
  it('computeCovenantHeadroom z EBITDA=0 RZUCA MathUndefinedError (nie Infinity, nie null cichy)', () => {
    expect(() => computeCovenantHeadroom({ netDebt: 1_000_000, ebitda: 0, covenantMaxNetDebtToEbitda: 3.5 })).toThrow(MathUndefinedError);
  });
  it('KONTROLA NEGATYWNA: EBITDA != 0 NIE rzuca, liczy normalnie', () => {
    const result = computeCovenantHeadroom({ netDebt: 1_000_000, ebitda: 500_000, covenantMaxNetDebtToEbitda: 3.5 });
    expect(result.netDebtToEbitda).toBe(2);
    expect(result.headroomRatio).toBe(1.5);
  });
  it('MathUndefinedError niesie blockingCategory=UNDEFINED_MATH i severity=SECURITY (dla DB exception ledger, gdy zapis powstanie)', () => {
    try {
      computeCovenantHeadroom({ netDebt: 100, ebitda: 0, covenantMaxNetDebtToEbitda: 3 });
      expect.fail('powinno rzucić');
    } catch (err) {
      expect(err).toBeInstanceOf(MathUndefinedError);
      expect((err as MathUndefinedError).blockingCategory).toBe('UNDEFINED_MATH');
      expect((err as MathUndefinedError).severity).toBe('SECURITY');
    }
  });
});

// ---------------------------------------------------------------------------
// ★★★ DEC-FIN-009 pełna, pięciopoziomowa wersja — poziomy 2, 4, 5 (wymóg koordynatora)
// ---------------------------------------------------------------------------

describe('DEC-FIN-009 pełna wersja — poziom 2 (Warning: akceptacja Z UZASADNIENIEM)', () => {
  const baseEntry: WarningException = {
    id: 'exc-w-1',
    level: 'WARNING',
    reasonCode: 'MISSING_KPI_ACTUAL',
    message: 'Brak aktualnego KPI dla okresu p-2026-04',
    createdAt: '2026-08-10T09:00:00Z',
    acceptance: null,
  };

  it('akceptacja BEZ uzasadnienia jest ODRZUCONA (ok:false), nie throw, nie cicha akceptacja', () => {
    const result = acceptWarningException(baseEntry, { acceptedBy: 'analyst@firm.pl', justification: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/wymagane|nie jest opcjonalne/i);
  });

  it('akceptacja Z uzasadnieniem PRZECHODZI i zapisuje kto/kiedy/dlaczego', () => {
    const result = acceptWarningException(baseEntry, {
      acceptedBy: 'analyst@firm.pl',
      justification: 'Zweryfikowano ręcznie z raportem sprzedaży za kwiecień.',
      nowIso: '2026-08-11T10:00:00Z',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.acceptance).toEqual({
        acceptedBy: 'analyst@firm.pl',
        justification: 'Zweryfikowano ręcznie z raportem sprzedaży za kwiecień.',
        acceptedAt: '2026-08-11T10:00:00Z',
      });
    }
  });

  it('KONTROLA NEGATYWNA: wpis poziomu Warning (zaakceptowany lub nie) NIGDY nie blokuje compute — tylko podnosi materialStatus do conditional', () => {
    const acceptedResult = acceptWarningException(baseEntry, { acceptedBy: 'a@firm.pl', justification: 'ok, sprawdzone' });
    expect(acceptedResult.ok).toBe(true);
    const acceptedEntry = acceptedResult.ok ? acceptedResult.entry : baseEntry;
    const gateUnaccepted = evaluateExceptionLedgerForCompute([baseEntry]);
    const gateAccepted = evaluateExceptionLedgerForCompute([acceptedEntry]);
    expect(gateUnaccepted.allowed).toBe(true);
    expect(gateAccepted.allowed).toBe(true);
    expect(gateAccepted.materialStatus).toBe('conditional');
  });
});

describe('DEC-FIN-009 pełna wersja — poziom 3 (Material: ocena wpływu + maker-checker)', () => {
  const baseEntry: MaterialException = {
    id: 'exc-m-1',
    level: 'MATERIAL',
    reasonCode: 'ASSUMPTION_OVERRIDE_LARGE_DEVIATION',
    message: 'Nadpisanie DSO_DAYS odchyla się o 40% od baseline',
    createdAt: '2026-08-10T09:00:00Z',
    resolution: null,
  };

  it('preparedBy === approvedBy jest ODRZUCONE (maker-checker wymaga dwóch różnych osób)', () => {
    const result = resolveMaterialException(baseEntry, { preparedBy: 'jan@firm.pl', approvedBy: 'jan@firm.pl', impactAssessment: 'Wpływ +200k PLN na EBITDA' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/maker-checker|różnymi osobami/i);
  });

  it('brak oceny wpływu jest ODRZUCONE', () => {
    const result = resolveMaterialException(baseEntry, { preparedBy: 'jan@firm.pl', approvedBy: 'anna@firm.pl', impactAssessment: '' });
    expect(result.ok).toBe(false);
  });

  it('DWIE różne osoby + ocena wpływu PRZECHODZI', () => {
    const result = resolveMaterialException(baseEntry, {
      preparedBy: 'jan@firm.pl',
      approvedBy: 'anna@firm.pl',
      impactAssessment: 'Wpływ +200k PLN na EBITDA, ryzyko średnie.',
      nowIso: '2026-08-11T12:00:00Z',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.resolution).toEqual({
        preparedBy: 'jan@firm.pl',
        approvedBy: 'anna@firm.pl',
        impactAssessment: 'Wpływ +200k PLN na EBITDA, ryzyko średnie.',
        resolvedAt: '2026-08-11T12:00:00Z',
      });
    }
  });
});

describe('DEC-FIN-009 pełna wersja — poziom 4 (Critical data: compute/export PRZECHODZĄ, wynik provisional)', () => {
  const criticalEntry: CriticalDataException = {
    id: 'exc-c-1',
    level: 'CRITICAL_DATA',
    reasonCode: 'SOURCE_STATEMENT_UNRECONCILED',
    message: 'Pakiet sprawozdań źródłowych nie jest w pełni uzgodniony za Q1 2026',
    createdAt: '2026-08-10T09:00:00Z',
    acknowledgement: null,
  };

  it('★ CORE: compute JEST DOZWOLONY (allowed:true) mimo wyjątku Critical Data — to NIE jest blokada', () => {
    const gate = evaluateExceptionLedgerForCompute([criticalEntry]);
    expect(gate.allowed).toBe(true);
    expect(gate.blockedBy).toHaveLength(0);
  });

  it('★ CORE: wynik dostaje status "provisional", nie "clean" ani "conditional"', () => {
    const gate = evaluateExceptionLedgerForCompute([criticalEntry]);
    expect(gate.materialStatus).toBe('provisional');
  });

  it('★ CORE: materiał zbudowany przy tym rejestrze pokazuje jakość/wyjątki/autora — status provisional, nie zablokowany dokument', () => {
    const provenance = buildMaterialProvenance({ ledger: [criticalEntry], author: 'system@finance-v3' });
    expect(provenance.status).toBe('provisional');
    expect(provenance.qualitySummary).toMatch(/Provisional|Tymczasowy/i);
    expect(provenance.exceptions).toContain(criticalEntry);
    expect(provenance.author).toBe('system@finance-v3');
  });

  it('KONTROLA NEGATYWNA: to samo dzieje się NIEZALEŻNIE od tego, czy ktoś potwierdził wyjątek (acknowledgement nie jest bramką)', () => {
    const ackResult = acknowledgeCriticalDataException(criticalEntry, { acknowledgedBy: 'cfo@firm.pl', justification: 'Świadomie akceptujemy ryzyko na czas przeglądu.' });
    expect(ackResult.ok).toBe(true);
    const acknowledgedEntry = ackResult.ok ? ackResult.entry : criticalEntry;
    const gateBefore = evaluateExceptionLedgerForCompute([criticalEntry]);
    const gateAfter = evaluateExceptionLedgerForCompute([acknowledgedEntry]);
    expect(gateBefore.allowed).toBe(true);
    expect(gateAfter.allowed).toBe(true);
    expect(gateBefore.materialStatus).toBe(gateAfter.materialStatus);
  });

  it('acknowledgeCriticalDataException BEZ uzasadnienia jest odrzucone jako operacja (audytowo), choć NIE wpływa na compute gate', () => {
    const result = acknowledgeCriticalDataException(criticalEntry, { acknowledgedBy: 'cfo@firm.pl', justification: '' });
    expect(result.ok).toBe(false);
  });
});

describe('DEC-FIN-009 pełna wersja — poziom 5 (Security/tenant/matematyka niezdefiniowana => TWARDA BLOKADA)', () => {
  it('★ CORE: obecność WYŁĄCZNIE wpisu poziomu 5 daje allowed:false', () => {
    const gate = evaluateExceptionLedgerForCompute([
      { id: 'exc-s-1', level: 'SECURITY_OR_UNDEFINED_MATH', reasonCode: 'CROSS_TENANT_REFERENCE', message: 'businessVersionId spoza organizacji', createdAt: '2026-08-10T09:00:00Z', blockingCategory: 'TENANT_BOUNDARY' },
    ]);
    expect(gate.allowed).toBe(false);
    expect(gate.blockedBy).toHaveLength(1);
  });

  it('★ KONTRAST z poziomem 4: mieszany rejestr (Critical Data + poziom 5) NADAL jest zablokowany — poziom 5 wygrywa zawsze', () => {
    const criticalEntry: CriticalDataException = {
      id: 'exc-c-1',
      level: 'CRITICAL_DATA',
      reasonCode: 'SOURCE_STATEMENT_UNRECONCILED',
      message: 'nieuzgodnione',
      createdAt: '2026-08-10T09:00:00Z',
      acknowledgement: null,
    };
    const blocker = {
      id: 'exc-s-2',
      level: 'SECURITY_OR_UNDEFINED_MATH' as const,
      reasonCode: 'DIVISION_BY_ZERO',
      message: 'EBITDA=0',
      createdAt: '2026-08-10T09:05:00Z',
      blockingCategory: 'UNDEFINED_MATH' as const,
    };
    const gate = evaluateExceptionLedgerForCompute([criticalEntry, blocker]);
    expect(gate.allowed).toBe(false);
    expect(gate.blockedBy.map((e) => e.id)).toEqual(['exc-s-2']);
  });

  it('KONTROLA NEGATYWNA: rejestr BEZ wpisu poziomu 5 (nawet z Info/Warning/Material/CriticalData) nigdy nie blokuje', () => {
    const gate = evaluateExceptionLedgerForCompute([
      { id: 'i1', level: 'INFO', reasonCode: 'AUTO', message: 'auto note', createdAt: '2026-08-10T09:00:00Z' },
      { id: 'w1', level: 'WARNING', reasonCode: 'X', message: 'x', createdAt: '2026-08-10T09:00:00Z', acceptance: null },
      { id: 'm1', level: 'MATERIAL', reasonCode: 'Y', message: 'y', createdAt: '2026-08-10T09:00:00Z', resolution: null },
      { id: 'c1', level: 'CRITICAL_DATA', reasonCode: 'Z', message: 'z', createdAt: '2026-08-10T09:00:00Z', acknowledgement: null },
    ]);
    expect(gate.allowed).toBe(true);
  });
});

describe('driverMissingValueToWarningException — most między skrótem a pełnym rejestrem', () => {
  it('konwertuje exception z resolveDriverValue na poprawny wpis poziomu Warning', () => {
    const resolution = resolveDriverValue({ valueStatus: 'MISSING', valueDecimal: null, driverCode: 'DSO_DAYS', periodId: 'p1' });
    if (resolution.kind !== 'exception') throw new Error('expected exception');
    const entry = driverMissingValueToWarningException('exc-w-99', resolution, '2026-08-12T00:00:00Z');
    expect(entry.level).toBe('WARNING');
    expect(entry.reasonCode).toBe('MISSING_DRIVER_VALUE');
    expect(entry.acceptance).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ★★ Progi tolerancji — trójstopniowe, nie mieszać
// ---------------------------------------------------------------------------

describe('Progi tolerancji — trzy poziomy, nie mieszać', () => {
  const validThresholds = { technicalEquationTolerance: 1, sourceToCanonicalTolerance: 0.01, analyticsMaterialityTolerance: 5000 };

  it('poprawna hierarchia (source->canonical < technical < materiality) przechodzi walidację', () => {
    expect(validateToleranceHierarchy(validThresholds)).toEqual({ ok: true });
  });

  it('KONTROLA NEGATYWNA: source->canonical LUŹNIEJSZY niż technical jest odrzucony', () => {
    const bad = { ...validThresholds, sourceToCanonicalTolerance: 2 };
    expect(validateToleranceHierarchy(bad).ok).toBe(false);
  });

  it('KONTROLA NEGATYWNA: materiality CIAŚNIEJSZY niż technical jest odrzucony', () => {
    const bad = { ...validThresholds, analyticsMaterialityTolerance: 0.5 };
    expect(validateToleranceHierarchy(bad).ok).toBe(false);
  });

  it('checkBalanceSheetTie używa WYŁĄCZNIE technicalEquationTolerance', () => {
    expect(checkBalanceSheetTie(1_000_000, 1_000_000.5, validThresholds)).toEqual({ tied: true });
    expect(checkBalanceSheetTie(1_000_000, 1_000_003, validThresholds)).toEqual({ tied: false, diff: 3 });
  });

  it('★ CORE zakaz kanonu: max(1 jednostka źródłowa, 0.1%) (materiality) NIE MOŻE być użyty do dowodu równości bilansu — wykryte jako antywzorzec', () => {
    const misused = isAnalyticsMaterialityMisusedForBalanceCheck(validThresholds.analyticsMaterialityTolerance, validThresholds);
    expect(misused).toBe(true);
  });

  it('KONTROLA NEGATYWNA: użycie WŁAŚCIWEGO progu (technical) NIE jest flagowane jako antywzorzec', () => {
    const ok = isAnalyticsMaterialityMisusedForBalanceCheck(validThresholds.technicalEquationTolerance, validThresholds);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Stale marking — zmiana założeń oznacza wyniki jako stale, nie kasuje, nie przelicza automatycznie
// ---------------------------------------------------------------------------

describe('resolveResultFreshness / markAssumptionChanged', () => {
  it('nigdy nie liczono => NEVER_COMPUTED', () => {
    const draft = createEmptyScenarioDraft({ name: 'x', nowIso: '2026-08-01T00:00:00Z' });
    expect(resolveResultFreshness(draft)).toBe('NEVER_COMPUTED');
  });

  it('compute PO ostatniej zmianie założeń => CURRENT', () => {
    const draft: ScenarioDraft = { ...createEmptyScenarioDraft({ name: 'x' }), lastAssumptionChangeAt: '2026-08-01T00:00:00Z', lastComputeAt: '2026-08-02T00:00:00Z' };
    expect(resolveResultFreshness(draft)).toBe('CURRENT');
  });

  it('zmiana założeń PO ostatnim compute => STALE (wyniki NIE są kasowane — nadal istnieją w draft, tylko flaga się zmienia)', () => {
    const computed: ScenarioDraft = { ...createEmptyScenarioDraft({ name: 'x' }), lastAssumptionChangeAt: '2026-08-01T00:00:00Z', lastComputeAt: '2026-08-02T00:00:00Z' };
    const changed = markAssumptionChanged(computed, '2026-08-03T00:00:00Z');
    expect(resolveResultFreshness(changed)).toBe('STALE');
    // lastComputeAt (dowód "wyniki istnieją") jest zachowane, nie wyzerowane:
    expect(changed.lastComputeAt).toBe('2026-08-02T00:00:00Z');
  });
});

// ---------------------------------------------------------------------------
// ★★ WP-D04 DoD — uzupełnienie kanonu (druga korekta koordynatora)
// ---------------------------------------------------------------------------

describe('financing respektuje FACILITY — limit kredytowy', () => {
  const limit = { entityId: 'entity-1', facilityLimitDecimal: 1_000_000 };

  it('drawdown w granicach limitu jest OK', () => {
    const events = [{ id: 'f1', financingKind: 'FACILITY_DRAWDOWN' as const, payload: { amount: 600_000 }, periodId: 'p-2026-01' }];
    expect(checkFacilityCompliance(events, limit)).toEqual({ ok: true });
  });

  it('★ CORE: drawdown PRZEKRACZAJĄCY limit jest WYKRYTY jako naruszenie, nie cicho zaakceptowany', () => {
    const events = [
      { id: 'f1', financingKind: 'FACILITY_DRAWDOWN' as const, payload: { amount: 600_000 }, periodId: 'p-2026-01' },
      { id: 'f2', financingKind: 'FACILITY_DRAWDOWN' as const, payload: { amount: 500_000 }, periodId: 'p-2026-02' },
    ];
    const result = checkFacilityCompliance(events, limit);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.breaches).toHaveLength(1);
      expect(result.breaches[0].closingBalance).toBe(1_100_000);
      expect(result.breaches[0].headroom).toBe(-100_000);
    }
  });

  it('KONTROLA NEGATYWNA: naruszenie W ŚRODKU horyzontu, "naprawione" późniejszą spłatą, jest NADAL wykryte (breach musi być sprawdzony po KAŻDYM zdarzeniu, nie tylko na końcu)', () => {
    const events = [
      { id: 'f1', financingKind: 'FACILITY_DRAWDOWN' as const, payload: { amount: 1_200_000 }, periodId: 'p-2026-01' }, // natychmiastowe naruszenie
      { id: 'f2', financingKind: 'DISCRETIONARY_REPAYMENT' as const, payload: { amount: 500_000 }, periodId: 'p-2026-02' }, // balance=700k, z powrotem w limicie
    ];
    const result = checkFacilityCompliance(events, limit);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.breaches).toHaveLength(1);
      expect(result.breaches[0].eventId).toBe('f1');
    }
  });

  it('repayment przed drawdown w TYM SAMYM okresie (mirror kolejności serwera) — kolejność zmienia wynik pośredni, nie końcowy', () => {
    const points = computeFacilityUtilization(
      [
        { id: 'drawdown', financingKind: 'FACILITY_DRAWDOWN' as const, payload: { amount: 100 }, periodId: 'p1' },
        { id: 'repay', financingKind: 'DISCRETIONARY_REPAYMENT' as const, payload: { amount: 50 }, periodId: 'p1' },
      ],
      limit
    );
    // repayment (rank 0) przetwarzany PRZED drawdown (rank 1) w tym samym okresie:
    expect(points[0].eventId).toBe('repay');
    expect(points[0].closingBalance).toBe(0); // Math.max(0, 0-50)
    expect(points[1].eventId).toBe('drawdown');
    expect(points[1].closingBalance).toBe(100);
  });
});

describe('statements/schedules RECONCILE', () => {
  const thresholds = { technicalEquationTolerance: 1 };

  it('gdy CF cash i harmonogram długu zgadzają się z BS w granicach progu technicznego => reconciled:true', () => {
    const result = reconcileStatementsAndSchedules({ periodId: 'p1', cfClosingCash: 500_000.4, bsCash: 500_000, debtScheduleClosingBalance: 1_000_000, bsLongTermDebt: 1_000_000.3 }, thresholds);
    expect(result.reconciled).toBe(true);
  });

  it('★ CORE: rozjazd cash MIĘDZY sprawozdaniami jest WYKRYTY, nie zamieciony', () => {
    const result = reconcileStatementsAndSchedules({ periodId: 'p1', cfClosingCash: 500_100, bsCash: 500_000, debtScheduleClosingBalance: 1_000_000, bsLongTermDebt: 1_000_000 }, thresholds);
    expect(result.cashTies).toBe(false);
    expect(result.reconciled).toBe(false);
    expect(result.cashDiff).toBe(100);
  });

  it('★ CORE: rozjazd harmonogramu długu wobec BS jest WYKRYTY niezależnie od cash', () => {
    const result = reconcileStatementsAndSchedules({ periodId: 'p1', cfClosingCash: 500_000, bsCash: 500_000, debtScheduleClosingBalance: 1_000_500, bsLongTermDebt: 1_000_000 }, thresholds);
    expect(result.debtTies).toBe(false);
    expect(result.reconciled).toBe(false);
  });

  it('KONTROLA NEGATYWNA: różnica DOKŁADNIE na granicy progu jest jeszcze "tied" (<=, nie <)', () => {
    const result = reconcileStatementsAndSchedules({ periodId: 'p1', cfClosingCash: 500_001, bsCash: 500_000, debtScheduleClosingBalance: 1_000_000, bsLongTermDebt: 1_000_000 }, thresholds);
    expect(result.cashTies).toBe(true);
  });
});

describe('reverse stress / break-even — solveBreakEvenDriver', () => {
  it('znajduje driverValue, przy którym monotoniczna funkcja osiąga zadany próg (np. płynność = 0)', () => {
    // Symulowana "płynność" jako funkcja jednego drivera (np. DSO_DAYS): rośnie z driverValue.
    const liquidityFn = (dso: number) => 500_000 - dso * 8_000; // liniowa, monotoniczna malejąca
    const result = solveBreakEvenDriver({ lowerBound: 0, upperBound: 200, targetValue: 0, evaluate: liquidityFn });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.driverValue).toBeCloseTo(62.5, 3);
      expect(Math.abs(result.achievedValue)).toBeLessThan(1e-3);
    }
  });

  it('★ CORE: to jest ODWROTNOŚĆ zwykłego compute — sprawdza, że rozwiązanie faktycznie odtwarza próg podstawiając je z powrotem do tej samej funkcji', () => {
    const covenantFn = (netDebtDelta: number) => (1_000_000 + netDebtDelta) / 500_000; // net debt / EBITDA rośnie z netDebtDelta
    const result = solveBreakEvenDriver({ lowerBound: -900_000, upperBound: 2_000_000, targetValue: 3.5, evaluate: covenantFn });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(covenantFn(result.driverValue)).toBeCloseTo(3.5, 4);
    }
  });

  it('KONTROLA NEGATYWNA: próg poza zakresem (nie bracketed) zwraca ok:false, nie zgadnięty wynik', () => {
    const alwaysPositive = () => 100;
    const result = solveBreakEvenDriver({ lowerBound: 0, upperBound: 10, targetValue: 0, evaluate: alwaysPositive });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_BRACKETED');
  });
});

describe('EXACT COLD REOPEN — draft musi dawać identyczny odcisk po symulowanym zamknięciu/otwarciu', () => {
  it('draft z pełnym kompletem (overrides/initiatives/impacts/financing) przechodzi round-trip identycznie', () => {
    const draft: ScenarioDraft = {
      ...createEmptyScenarioDraft({ name: 'Fundamental scenario', scenarioMode: 'FUNDAMENTAL_INITIATIVE', nowIso: '2026-08-12T00:00:00Z' }),
      businessVersionId: 'bv-123',
      driverOverrides: [makeDriverOverride()],
      initiatives: [makeInitiative()],
      impacts: [makeImpact()],
      financing: [makeFinancing()],
    };
    const result = verifyExactColdReopen(draft);
    expect(result.ok).toBe(true);
  });

  it('odcisk jest NIEZALEŻNY od kolejności wstawiania rekordów w tablicach (sortowanie po id)', () => {
    const impact1 = makeImpact({ id: 'impact-1' });
    const impact2 = makeImpact({ id: 'impact-2', amountDecimal: -0.02 });
    const draftA: ScenarioDraft = { ...createEmptyScenarioDraft({ name: 'x', nowIso: '2026-08-12T00:00:00Z' }), impacts: [impact1, impact2] };
    const draftB: ScenarioDraft = { ...createEmptyScenarioDraft({ name: 'x', nowIso: '2026-08-12T00:00:00Z' }), impacts: [impact2, impact1] };
    const fpA = verifyExactColdReopen(draftA);
    const fpB = verifyExactColdReopen(draftB);
    expect(fpA.ok && fpB.ok).toBe(true);
    if (fpA.ok && fpB.ok) expect(fpA.fingerprint).toBe(fpB.fingerprint);
  });

  it('KONTROLA NEGATYWNA: draft z RÓŻNĄ wartością (nie tylko kolejnością) daje RÓŻNY odcisk — dowód, że fingerprint faktycznie mierzy treść, nie jest stałą', () => {
    const draftA: ScenarioDraft = { ...createEmptyScenarioDraft({ name: 'x', nowIso: '2026-08-12T00:00:00Z' }), driverOverrides: [makeDriverOverride({ valueDecimal: 0.5 })] };
    const draftB: ScenarioDraft = { ...createEmptyScenarioDraft({ name: 'x', nowIso: '2026-08-12T00:00:00Z' }), driverOverrides: [makeDriverOverride({ valueDecimal: 0.6 })] };
    const fpA = verifyExactColdReopen(draftA);
    const fpB = verifyExactColdReopen(draftB);
    expect(fpA.ok && fpB.ok).toBe(true);
    if (fpA.ok && fpB.ok) expect(fpA.fingerprint).not.toBe(fpB.fingerprint);
  });
});
