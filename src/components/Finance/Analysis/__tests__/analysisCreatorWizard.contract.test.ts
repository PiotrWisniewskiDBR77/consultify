/**
 * Pakiet E — testy `analysisCreatorWizard.contract.ts`. Kontrole negatywne
 * wymagane brifem: "nie da się przeskoczyć kroku", "★ ZAKAZ pustej analizy
 * bez wyjścia" na poziomie samego kreatora (payload `null` gdy KPI=0),
 * rekomendacja branżowa jest ADDYTYWNA (nie kasuje ręcznego wyboru).
 */
import { describe, expect, it } from 'vitest';

import type { AnalysisKpiCatalogEntryLike } from '../analysisKpiCatalog';
import {
  ANALYSIS_CREATOR_STEPS,
  buildAnalysisCreatorDraftPayload,
  canNavigateToStep,
  createInitialAnalysisCreatorState,
  isStepComplete,
  nextStep,
  previousStep,
  runAnalysisPreflightCheck,
  toggleKpiSelected,
  applyIndustryRecommendations,
  type AnalysisCreatorState,
} from '../analysisCreatorWizard.contract';

describe('createInitialAnalysisCreatorState', () => {
  it('zaczyna na source_version, wszystko puste', () => {
    const state = createInitialAnalysisCreatorState();
    expect(state.currentStep).toBe('source_version');
    expect(state.sourceVersionId).toBeNull();
    expect(state.selectedKpiCodes).toEqual([]);
  });
});

describe('isStepComplete / nextStep — gate liniowy', () => {
  it('KONTROLA NEGATYWNA: nextStep(source_version niekompletny) ⇒ null, nie przechodzi cicho dalej', () => {
    const state = createInitialAnalysisCreatorState();
    expect(isStepComplete('source_version', state)).toBe(false);
    expect(nextStep(state)).toBeNull();
  });

  it('po wybraniu źródła nextStep przechodzi do periods', () => {
    const state: AnalysisCreatorState = { ...createInitialAnalysisCreatorState(), sourceVersionId: 'bv-stmt-1' };
    expect(nextStep(state)).toBe('periods');
  });

  it('pełna ścieżka: source→periods→industry_goal→kpi_selection→preflight→create_compute', () => {
    let state: AnalysisCreatorState = createInitialAnalysisCreatorState();
    state = { ...state, sourceVersionId: 'bv-stmt-1' };
    expect(nextStep(state)).toBe('periods');
    state = { ...state, currentStep: 'periods', selectedPeriodIds: ['p-2025'] };
    expect(nextStep(state)).toBe('industry_goal');
    state = { ...state, currentStep: 'industry_goal', industryCode: 'SAAS' };
    expect(nextStep(state)).toBe('kpi_selection');
    state = { ...state, currentStep: 'kpi_selection', selectedKpiCodes: ['REVENUE_GROWTH_YOY'] };
    expect(nextStep(state)).toBe('preflight');
    state = { ...state, currentStep: 'preflight' };
    expect(nextStep(state)).toBe('create_compute');
    state = { ...state, currentStep: 'create_compute' };
    expect(nextStep(state)).toBeNull(); // koniec kreatora
  });

  it('previousStep z pierwszego kroku ⇒ null', () => {
    expect(previousStep(createInitialAnalysisCreatorState())).toBeNull();
  });
});

describe('canNavigateToStep — KONTROLA NEGATYWNA: nie da się przeskoczyć kroku', () => {
  it('kpi_selection NIEOSIĄGALNE, gdy periods puste (nawet z wybranym źródłem)', () => {
    const state: AnalysisCreatorState = { ...createInitialAnalysisCreatorState(), sourceVersionId: 'bv-1' };
    expect(canNavigateToStep('kpi_selection', state)).toBe(false);
  });

  it('preflight NIEOSIĄGALNE, gdy KPI nie wybrano — ★ ZAKAZ pustej analizy egzekwowany też w nawigacji', () => {
    const state: AnalysisCreatorState = {
      ...createInitialAnalysisCreatorState(),
      sourceVersionId: 'bv-1',
      selectedPeriodIds: ['p-2025'],
      industryCode: 'GENERAL',
      selectedKpiCodes: [],
    };
    expect(canNavigateToStep('preflight', state)).toBe(false);
  });

  it('wszystkie kroki kompletne ⇒ create_compute osiągalne', () => {
    const state: AnalysisCreatorState = {
      currentStep: 'create_compute',
      sourceVersionId: 'bv-1',
      selectedPeriodIds: ['p-2025'],
      industryCode: 'GENERAL',
      goal: null,
      selectedKpiCodes: ['REVENUE_GROWTH_YOY'],
    };
    expect(canNavigateToStep('create_compute', state)).toBe(true);
  });

  it('source_version zawsze osiągalne (pierwszy krok, brak warunków wstępnych)', () => {
    expect(canNavigateToStep('source_version', createInitialAnalysisCreatorState())).toBe(true);
  });
});

describe('toggleKpiSelected — add/remove', () => {
  it('dodaje nieobecny kod, usuwa obecny (idempotentny toggle)', () => {
    let state = createInitialAnalysisCreatorState();
    state = toggleKpiSelected(state, 'GROSS_MARGIN_PCT');
    expect(state.selectedKpiCodes).toEqual(['GROSS_MARGIN_PCT']);
    state = toggleKpiSelected(state, 'EBITDA_MARGIN_PCT');
    expect(state.selectedKpiCodes).toEqual(['GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT']);
    state = toggleKpiSelected(state, 'GROSS_MARGIN_PCT');
    expect(state.selectedKpiCodes).toEqual(['EBITDA_MARGIN_PCT']);
  });
});

describe('applyIndustryRecommendations — ADDYTYWNE, nie kasuje ręcznego wyboru', () => {
  const catalog: AnalysisKpiCatalogEntryLike[] = [
    { kpiCode: 'REVENUE_GROWTH_YOY', tier: 'UNIVERSAL', industryCode: null, status: 'ACTIVE' },
    { kpiCode: 'NET_REVENUE_RETENTION', tier: 'INDUSTRY', industryCode: 'SAAS', status: 'ACTIVE' },
    { kpiCode: 'CUSTOM_MY_KPI', tier: 'ORG_CUSTOM', industryCode: null, status: 'ACTIVE' },
  ];

  it('KONTROLA NEGATYWNA: bez industryCode ⇒ no-op, selekcja niezmieniona', () => {
    const state: AnalysisCreatorState = { ...createInitialAnalysisCreatorState(), selectedKpiCodes: ['CUSTOM_MY_KPI'] };
    const after = applyIndustryRecommendations(state, catalog);
    expect(after.selectedKpiCodes).toEqual(['CUSTOM_MY_KPI']);
  });

  it('z industryCode ⇒ DOKŁADA rekomendacje, NIE usuwa ręcznie dodanego CUSTOM_MY_KPI (dowód: additive, nie replace)', () => {
    const state: AnalysisCreatorState = {
      ...createInitialAnalysisCreatorState(),
      industryCode: 'SAAS',
      selectedKpiCodes: ['CUSTOM_MY_KPI'],
    };
    const after = applyIndustryRecommendations(state, catalog);
    expect(after.selectedKpiCodes).toContain('CUSTOM_MY_KPI');
    expect(after.selectedKpiCodes).toContain('REVENUE_GROWTH_YOY');
    expect(after.selectedKpiCodes).toContain('NET_REVENUE_RETENTION');
  });
});

describe('runAnalysisPreflightCheck', () => {
  const catalog = [
    { kpiCode: 'GROSS_MARGIN_PCT', kpiName: 'Marża brutto', requiredCanonicalLineCodes: ['REVENUE', 'COGS'] },
    { kpiCode: 'EBITDA_MARGIN_PCT', kpiName: 'Marża EBITDA', requiredCanonicalLineCodes: ['REVENUE', 'EBITDA'] },
  ];

  it('wszystkie wymagane kody dostępne ⇒ ok:true, issues puste', () => {
    const result = runAnalysisPreflightCheck({
      selectedKpiCodes: ['GROSS_MARGIN_PCT'],
      catalog,
      availableLineCodes: ['REVENUE', 'COGS', 'OPEX'],
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('KONTROLA NEGATYWNA: brakujący kod źródłowy (EBITDA niedostępne) ⇒ ok:false, issue wskazuje DOKŁADNIE brakujący kod', () => {
    const result = runAnalysisPreflightCheck({
      selectedKpiCodes: ['GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT'],
      catalog,
      availableLineCodes: ['REVENUE', 'COGS'],
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].kpiCode).toBe('EBITDA_MARGIN_PCT');
    expect(result.issues[0].missingLineCodes).toEqual(['EBITDA']);
  });

  it('kolejność issues jest deterministyczna (posortowana po kpiCode) niezależnie od kolejności wejścia', () => {
    const forward = runAnalysisPreflightCheck({
      selectedKpiCodes: ['EBITDA_MARGIN_PCT', 'GROSS_MARGIN_PCT'],
      catalog,
      availableLineCodes: [],
    });
    const reversed = runAnalysisPreflightCheck({
      selectedKpiCodes: ['GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT'],
      catalog,
      availableLineCodes: [],
    });
    expect(forward.issues.map((i) => i.kpiCode)).toEqual(reversed.issues.map((i) => i.kpiCode));
    expect(forward.issues.map((i) => i.kpiCode)).toEqual(['EBITDA_MARGIN_PCT', 'GROSS_MARGIN_PCT']);
  });
});

describe('buildAnalysisCreatorDraftPayload — ★ ZAKAZ pustej analizy: null dopóki NIEKOMPLETNE', () => {
  it('KONTROLA NEGATYWNA: stan początkowy (wszystko puste) ⇒ null', () => {
    expect(buildAnalysisCreatorDraftPayload(createInitialAnalysisCreatorState())).toBeNull();
  });

  it('KONTROLA NEGATYWNA: wszystko wypełnione OPRÓCZ selectedKpiCodes ⇒ nadal null (to jest LITERALNY zakaz pustej analizy)', () => {
    const state: AnalysisCreatorState = {
      currentStep: 'preflight',
      sourceVersionId: 'bv-1',
      selectedPeriodIds: ['p-2025'],
      industryCode: 'GENERAL',
      goal: 'GENERAL_OVERVIEW',
      selectedKpiCodes: [],
    };
    expect(buildAnalysisCreatorDraftPayload(state)).toBeNull();
  });

  it('wszystkie pola wypełnione ⇒ payload kompletny', () => {
    const state: AnalysisCreatorState = {
      currentStep: 'preflight',
      sourceVersionId: 'bv-1',
      selectedPeriodIds: ['p-2025', 'p-2026'],
      industryCode: 'MANUFACTURING',
      goal: 'BENCHMARK_COMPARISON',
      selectedKpiCodes: ['GROSS_MARGIN_PCT', 'INVENTORY_DAYS'],
    };
    const payload = buildAnalysisCreatorDraftPayload(state);
    expect(payload).not.toBeNull();
    expect(payload).toEqual({
      sourceStatementPackVersionId: 'bv-1',
      selectedPeriodIds: ['p-2025', 'p-2026'],
      industryCode: 'MANUFACTURING',
      goal: 'BENCHMARK_COMPARISON',
      selectedKpiCodes: ['GROSS_MARGIN_PCT', 'INVENTORY_DAYS'],
    });
  });
});

describe('ANALYSIS_CREATOR_STEPS — kolejność dosłownie z brifu', () => {
  it('source/version → okresy → branża/cel → KPI → preflight → create & compute', () => {
    expect(ANALYSIS_CREATOR_STEPS).toEqual([
      'source_version',
      'periods',
      'industry_goal',
      'kpi_selection',
      'preflight',
      'create_compute',
    ]);
  });
});
