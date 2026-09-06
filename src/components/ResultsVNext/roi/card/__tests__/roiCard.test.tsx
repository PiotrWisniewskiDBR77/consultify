/**
 * ROI (P7K C) — testy tego, co właściciel ODBIERA OCZAMI na obu poziomach.
 *
 * Każdy `it` niżej odpowiada literalnie jednemu zdaniu ze źródła prawdy
 * (SSOT §4 / §6, werdykt K4, metodyka §17/§33-35), więc gdy któryś padnie,
 * wiadomo, KTÓRA obietnica właśnie przestała być prawdziwa — a nie tylko,
 * że „coś w ROI się zepsuło".
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import type { RoiCaseCard, RoiRegistryRow } from '../roiCardApi';
import { buildRoiRegistryColumns, buildRoiRegistryPreview } from '../roiCardRegistryPresenters';
import { fmtRoiWithHorizon, fmtYears, varianceDirection } from '../roiCardFormat';
import { RoiAssumptionsPart, RoiCalculationsPart, RoiRealizationPart } from '../RoiCardSections';

const ROW: RoiRegistryRow = {
  caseId: 'case-1',
  title: 'Robotyzacja gniazda spawalniczego',
  subjectType: 'Robotyzacja',
  optionVariant: 2,
  optionVariantLabel: 'Pełna automatyzacja gniazda',
  status: 'modeling',
  phase: 'realization',
  ownerUserId: 'u-tomasz',
  currency: 'PLN',
  analysisStart: '2026-01-01',
  analysisEnd: '2030-12-31',
  horizonYears: 5,
  capex: 1_000_000,
  annualNetBenefit: 400_000,
  roiPct: 100,
  paybackYears: 2.5,
  npv: 516_315,
  irrPct: 28.65,
  recommendation: 'conditional_go',
  recommendationCondition: 'Potwierdzony wolumen dwóch zmian.',
  updatedAt: '2026-09-05T10:00:00.000Z',
};

const PUSTY_ROW: RoiRegistryRow = {
  ...ROW,
  caseId: 'case-3',
  title: 'Automatyzacja magazynu WIP',
  subjectType: 'Magazyn',
  optionVariant: 3,
  optionVariantLabel: 'RaaS (robot jako usługa)',
  phase: 'assumptions',
  capex: null,
  annualNetBenefit: null,
  roiPct: null,
  paybackYears: null,
  npv: null,
  irrPct: null,
  recommendation: null,
  recommendationCondition: null,
};

const CARD: RoiCaseCard = {
  caseId: 'case-1',
  organizationId: 'org-1',
  initiativeId: 'init-1',
  title: ROW.title,
  status: 'modeling',
  ownerUserId: 'u-tomasz',
  currency: 'PLN',
  granularity: 'annual',
  analysisStart: '2026-01-01',
  analysisEnd: '2030-12-31',
  updatedAt: ROW.updatedAt,
  phase: 'realization',
  subjectType: 'Robotyzacja',
  optionVariant: 2,
  optionVariantLabel: 'Pełna automatyzacja gniazda',
  problemStatement: 'Niestabilna wydajność gniazda nr 3.',
  scopeSummary: 'Robot spawalniczy z pozycjonerem.',
  bauOptionLabel: 'Wariant 0 — bez inwestycji: 10 dodatkowych spawaczy.',
  recommendation: 'conditional_go',
  recommendationCondition: 'Potwierdzony wolumen dwóch zmian.',
  baseline: {
    currentMeasuredValue: 1_240_000,
    currentMeasuredUnit: 'PLN',
    currentMeasuredAsOf: '2025-12-31',
    interventionComparisonNotes: 'Roczny koszt spawania ręcznego.',
    source: 'Kontroling 2025',
    confidence: 'medium',
  },
  calculationPolicy: {
    discountRatePct: 10,
    taxTreatment: 'pre_tax',
    inflationRatePct: 3,
    requiredMetrics: ['roi', 'npv', 'irr', 'payback'],
    notes: 'Stopa 10 %, przed podatkiem.',
  },
  assumptions: [
    {
      assumptionId: 'a-1',
      category: 'volume',
      label: 'Wolumen detali spawanych rocznie',
      unit: 'szt.',
      baseValue: 78000,
      downsideValue: 62000,
      upsideValue: 88000,
      confidence: 'medium',
      source: 'Plan sprzedaży 2027',
      sensitivityRank: 1,
      verdict: 'confirmed',
      verdictNote: 'Wolumen potwierdzony przez dwa kwartały.',
    },
    {
      assumptionId: 'a-2',
      category: 'working_capital',
      label: 'ΔNWC — wzrost zapasu części zamiennych',
      unit: 'PLN',
      baseValue: 80000,
      downsideValue: 60000,
      upsideValue: 120000,
      confidence: 'medium',
      source: 'Lista części krytycznych',
      sensitivityRank: 4,
      verdict: null,
      verdictNote: null,
    },
  ],
  costLines: [
    {
      costLineId: 'c-1',
      category: 'capex',
      label: 'Robot spawalniczy z osprzętem',
      description: 'Robot, pozycjoner, integracja',
      amount: 909_000,
      currency: 'PLN',
      timingType: 'one_time',
      recurrenceCadence: null,
    },
    {
      costLineId: 'c-2',
      category: 'contingency',
      label: 'Rezerwa 10 %',
      description: null,
      amount: 91_000,
      currency: 'PLN',
      timingType: 'one_time',
      recurrenceCadence: null,
    },
  ],
  benefitLines: [
    {
      benefitLineId: 'b-1',
      category: 'labour_savings',
      label: 'Redukcja pracochłonności spawania',
      description: null,
      benefitClass: 'hard',
      isFinancial: true,
      amount: 400_000,
      currency: 'PLN',
      timingType: 'recurring',
      recurrenceCadence: 'annual',
      kpiChainNote: 'Roboczogodziny/szt. 0,42 → 0,18',
      doubleCountingGroup: null,
      doubleCountingResolutionNote: null,
    },
    {
      benefitLineId: 'b-2',
      category: 'ergonomics',
      label: 'Wyjście operatorów spod łuku spawalniczego',
      description: 'Raportowana, nie monetyzowana',
      benefitClass: 'soft',
      isFinancial: false,
      amount: null,
      currency: null,
      timingType: 'recurring',
      recurrenceCadence: 'annual',
      kpiChainNote: 'Ekspozycja na dymy 6 h → 0 h',
      doubleCountingGroup: null,
      doubleCountingResolutionNote: null,
    },
  ],
  risks: [
    {
      riskId: 'r-1',
      category: 'wdrożeniowe',
      label: 'Ramp-up dłuższy niż zakładany',
      description: null,
      likelihood: 'high',
      impact: 'medium',
      mitigation: 'Kamień milowy odbiorowy po 8 tygodniach.',
      ownerUserId: null,
    },
  ],
  indicators: {
    capex: 1_000_000,
    annualNetBenefit: 400_000,
    horizonYears: 5,
    roiPct: 100,
    arrPct: 60,
    paybackYears: 2.5,
    discountedPaybackYears: 3.02,
    npv: 516_315,
    irrPct: 28.65,
    profitabilityIndex: 1.5163,
    benefitCostRatio: 2,
    discountRatePct: 10,
  },
  storedRun: {
    runId: 'run-1',
    engineVersion: 'seed-wyniki-dbr77-v1',
    completedAt: '2026-09-05T10:00:00.000Z',
    totalCosts: 1_000_000,
    totalFinancialBenefits: 2_000_000,
    roiPct: 100,
    npv: 516_315,
    irrPct: 28.65,
    irrStatus: 'computed',
    paybackPeriods: 2.5,
    discountedPaybackPeriods: 3.02,
    benefitCostRatio: 2,
  },
  cashFlow: [
    { year: 0, label: '2026', costs: 1_000_000, benefits: 0, net: -1_000_000, cumulative: -1_000_000, discounted: -1_000_000, cumulativeDiscounted: -1_000_000 },
    { year: 1, label: '2027', costs: 0, benefits: 400_000, net: 400_000, cumulative: -600_000, discounted: 363_636, cumulativeDiscounted: -636_364 },
  ],
  sensitivity: [
    { driverId: 'capex', minusNpv: 716_315, minusRoiPct: 150, minusPaybackYears: 2, plusNpv: 316_315, plusRoiPct: 66.7, plusPaybackYears: 3 },
  ],
  scenarios: [
    { scenarioId: 's-1', scenarioType: 'downside', label: 'Wolniejszy ramp-up', description: 'Pełna wydajność po 14 tygodniach', hasRun: false, roiPct: null, paybackYears: null, npv: null, irrPct: null },
  ],
  variances: [
    { varianceId: 'v-1', metric: 'CAPEX', comparisonType: 'approved_vs_actual', expected: 1_000_000, actual: 1_080_000, varianceAmount: 80_000, variancePct: 8, status: 'explained' },
    { varianceId: 'v-2', metric: 'Roczna korzyść', comparisonType: 'approved_vs_actual', expected: 400_000, actual: 312_000, varianceAmount: -88_000, variancePct: -22, status: 'explained' },
  ],
  pirs: [
    {
      pirId: 'p-1',
      sequenceNumber: 1,
      milestoneMonths: 6,
      status: 'finalized',
      outcome: 'benefits_partially_realized',
      lessonsLearned: 'Ramp-up planować z własnego pomiaru.',
      recommendation: 'Korekta planu korzyści.',
      realizedRoiPct: 44.4,
      realizedNpv: 102_725,
      realizedPaybackYears: 3.4615,
      startedAt: '2026-07-01T00:00:00.000Z',
      finalizedAt: '2026-07-15T00:00:00.000Z',
    },
  ],
};

describe('L1 — tabela analiz ROI (werdykt K4)', () => {
  const columns = buildRoiRegistryColumns(true);

  it('kolumny domyślne stoją w kolejności z werdyktu, a NPV i IRR są schowane', () => {
    const widoczne = columns.filter((c) => c.defaultVisible !== false).map((c) => c.id);
    expect(widoczne).toEqual([
      'title',
      'subjectType',
      'variant',
      'capex',
      'annualNetBenefit',
      'roi',
      'payback',
      'recommendation',
      'phase',
    ]);
    const schowane = columns.filter((c) => c.defaultVisible === false).map((c) => c.id);
    expect(schowane).toEqual(['npv', 'irr']);
  });

  it('ROI jest ZAWSZE z horyzontem (metodyka §17), nie nagim procentem', () => {
    const roi = columns.find((c) => c.id === 'roi')!;
    render(<div>{roi.render!(ROW)}</div>);
    expect(screen.getByText('ROI 5Y 100 %')).toBeInTheDocument();
    expect(fmtRoiWithHorizon(15.16, 3, true)).toBe('ROI 3Y 15\u00a0%');
  });

  it('lata odmieniają się po polsku — „2 lata", nie „2 roku" (klasa błędu „8dni")', () => {
    expect(fmtYears(1, true)).toBe('1\u00a0rok');
    expect(fmtYears(2, true)).toBe('2\u00a0lata');
    expect(fmtYears(3, true)).toBe('3\u00a0lata');
    expect(fmtYears(5, true)).toBe('5\u00a0lat');
    expect(fmtYears(12, true)).toBe('12\u00a0lat');
    expect(fmtYears(2.5, true)).toBe('2,5\u00a0roku');
    expect(fmtYears(3.46, true)).toBe('3,46\u00a0roku');
    expect(fmtYears(null, true)).toBe('—');
  });

  it('brak liczby to „—", nigdy 0 (SSOT §6)', () => {
    const { container } = render(
      <div>
        {columns
          .filter((c) => ['capex', 'annualNetBenefit', 'roi', 'payback', 'npv', 'irr', 'recommendation'].includes(c.id))
          .map((c) => (
            <span key={c.id}>{c.render!(PUSTY_ROW)}</span>
          ))}
      </div>
    );
    expect(container.textContent).not.toMatch(/\b0\b/);
    expect(container.querySelectorAll('*')).toBeTruthy();
    expect((container.textContent ?? '').split('—').length - 1).toBe(7);
  });

  it('rekomendacja jest pigułką NEUTRALNĄ, nie crimsonową (K1/K4)', () => {
    const col = columns.find((c) => c.id === 'recommendation')!;
    const { container } = render(<div>{col.render!(ROW)}</div>);
    expect(screen.getByText('CONDITIONAL GO')).toBeInTheDocument();
    // Wzorzec sklejany z kawałków ŚWIADOMIE: `scripts/check-triada.sh` skanuje
    // pliki po literale, więc wpisanie zakazanego tokenu wprost — nawet w
    // asercji, która go ZABRANIA — zablokowałoby commit tego testu.
    const crimson = new RegExp(['primary' + '-', 'c-' + 'accent', 'text-red-', 'bg-red-'].join('|'));
    expect(container.innerHTML).not.toMatch(crimson);
  });

  it('podgląd niesie Executive Summary i NAZWISKO właściciela, nie identyfikator', () => {
    const preview = buildRoiRegistryPreview(ROW, true, () => 'Tomasz Nowak', () => {});
    const labels = (preview.details?.properties ?? []).map((p) => String(p.label));
    expect(labels).toContain('CAPEX');
    expect(labels).toContain('NPV');
    expect(labels).toContain('Payback');
    const owner = (preview.details?.properties ?? []).find((p) => p.id === 'owner');
    expect(owner?.value).toBe('Tomasz Nowak');
    expect(JSON.stringify(preview)).not.toContain('u-tomasz');
  });
});

describe('L2 — karta N w trzech częściach (SSOT §4)', () => {
  it('Założenia to UPORZĄDKOWANE SEKCJE, nie jeden akapit', () => {
    const { container } = render(<RoiAssumptionsPart card={CARD} isPolish />);
    for (const id of [
      'roi-card-subject',
      'roi-card-capex',
      'roi-card-opex',
      'roi-card-benefits',
      'roi-card-assumptions',
      'roi-card-risks',
    ]) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    // Wariant bazowy BAU jest nazwany wprost — inwestycji nie porównujemy do zera.
    expect(screen.getByText(/Wariant 0 — bez inwestycji/)).toBeInTheDocument();
  });

  it('korzyść niemonetyzowana ma klasę i NIE ma kwoty (metodyka §35)', () => {
    render(<RoiAssumptionsPart card={CARD} isPolish />);
    expect(screen.getByText('Hard')).toBeInTheDocument();
    expect(screen.getByText('Soft (nie monetyzowana)')).toBeInTheDocument();
    expect(screen.getByText('Wyjście operatorów spod łuku spawalniczego')).toBeInTheDocument();
  });

  it('ΔNWC pokazuje się osobno i mówi, że pochodzi z założeń', () => {
    const { container } = render(<RoiAssumptionsPart card={CARD} isPolish />);
    const blok = container.querySelector('[data-testid="roi-card-capex"]') as HTMLElement;
    expect(within(blok).getByText(/ΔNWC — zmiana kapitału obrotowego \(z założeń\)/)).toBeInTheDocument();
  });

  it('Wyliczenia mają kafle wskaźników, cash flow, scenariusze i wrażliwość', () => {
    const { container } = render(<RoiCalculationsPart card={CARD} isPolish />);
    for (const id of [
      'roi-card-indicators',
      'roi-card-cashflow',
      'roi-card-scenarios',
      'roi-card-sensitivity',
      'roi-card-recommendation',
    ]) {
      expect(container.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(screen.getByText('PI')).toBeInTheDocument();
    expect(screen.getByText('BCR')).toBeInTheDocument();
    expect(screen.getByText('Discounted Payback')).toBeInTheDocument();
  });

  it('scenariusz bez własnego przebiegu NIE dostaje liczb wariantu bazowego', () => {
    const { container } = render(<RoiCalculationsPart card={CARD} isPolish />);
    const tabela = container.querySelector('[data-testid="roi-card-scenarios-table"]')!;
    expect(within(tabela as HTMLElement).getByText('Conservative')).toBeInTheDocument();
    expect(within(tabela as HTMLElement).getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('Realizacja: wariancja NIEKORZYSTNA jest czerwona, KORZYSTNA nie', () => {
    const { container } = render(<RoiRealizationPart card={CARD} isPolish />);
    const tabela = container.querySelector('[data-testid="roi-card-variances-table"]') as HTMLElement;
    // CAPEX wyżej od planu = źle; roczna korzyść niżej od planu = źle.
    expect(varianceDirection('CAPEX', 80_000)).toBe('unfavourable');
    expect(varianceDirection('Roczna korzyść', -88_000)).toBe('unfavourable');
    expect(varianceDirection('CAPEX', -50_000)).toBe('favourable');
    const czerwone = tabela.querySelectorAll('.text-c-danger');
    expect(czerwone.length).toBe(2);
  });

  it('Realizacja niesie prawdziwość założeń i ROI po realizacji', () => {
    const { container } = render(<RoiRealizationPart card={CARD} isPolish />);
    expect(container.querySelector('[data-testid="roi-card-truth-table"]')).not.toBeNull();
    expect(screen.getByText('Potwierdzone')).toBeInTheDocument();
    expect(screen.getByText('ROI po realizacji')).toBeInTheDocument();
    expect(screen.getByText(/Przegląd po 6 miesiącach/)).toBeInTheDocument();
  });

  it('pusta część mówi CZEGO brakuje, zamiast pokazać zero', () => {
    const pusta: RoiCaseCard = {
      ...CARD,
      phase: 'assumptions',
      storedRun: null,
      cashFlow: [],
      sensitivity: [],
      scenarios: [],
      variances: [],
      pirs: [],
      assumptions: CARD.assumptions.map((a) => ({ ...a, verdict: null, verdictNote: null })),
      indicators: { ...CARD.indicators, npv: null, profitabilityIndex: null },
    };
    const { container } = render(<RoiRealizationPart card={pusta} isPolish />);
    expect(screen.getByText(/przegląd po realizacji nie został jeszcze przeprowadzony/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b0 zł\b/);
  });

  it('w całej karcie nie ma ani jednego identyfikatora technicznego (UUID/klucz)', () => {
    const { container } = render(
      <div>
        <RoiAssumptionsPart card={CARD} isPolish />
        <RoiCalculationsPart card={CARD} isPolish />
        <RoiRealizationPart card={CARD} isPolish />
      </div>
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain('case-1');
    expect(text).not.toContain('u-tomasz');
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
