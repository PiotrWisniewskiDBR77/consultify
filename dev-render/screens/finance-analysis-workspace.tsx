/**
 * Pakiet E — dev-render host for the REAL `<AnalysisWorkspace>`
 * (src/components/Finance/Analysis/AnalysisWorkspace.tsx) — CLAUDE.md rule #7:
 * ekran renderowany i zrzucany PRZEZ AGENTA, zanim Piotr go zobaczy.
 *
 * `AnalysisWorkspace` woła named exports z `financeV2.api.ts` bezpośrednio
 * (nie przez mutowalny obiekt `FinanceV2Api`), więc monkey-patchowanie tego
 * obiektu (wzorzec `V8FinanceApi.getModels = …` z finance-model-workspace.tsx)
 * nie zadziałałoby — bindingi ESM już są przechwycone przy imporcie. Ten
 * harness przechwytuje więc na poziomie `window.fetch` (bezpieczne tu: dev-render
 * nie ma żadnego prawdziwego backendu za sobą i tak).
 *
 * URL: ?screen=finance-analysis-workspace[&lang=pl|en][&theme=light|dark]
 *   &scene=draft-empty|draft-with-kpis|approved|missing-values (default: draft-empty)
 */
import React from 'react';

import { AnalysisWorkspace } from '../../src/components/Finance/Analysis/AnalysisWorkspace';
import type { AnalysisCreatorPeriodOption, AnalysisCreatorSourceOption } from '../../src/components/Finance/Analysis/analysisCreatorWizard.contract';

// AP_MOUNT §A: `AnalysisWorkspace` now reads `financeAnalysisWorkspaceV1`
// itself (not just its caller) and renders `null` when OFF — force it ON via
// the same localStorage-backed local override the hook reads at init.
try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem('consultify_feature_flags', JSON.stringify({ ...existing, financeAnalysisWorkspaceV1: true }));
} catch {
  // ignore — harness-only convenience
}

const params = new URLSearchParams(window.location.search);
type Scene = 'draft-empty' | 'draft-with-kpis' | 'approved' | 'missing-values';
const scene: Scene = (params.get('scene') as Scene) || 'draft-empty';

const ARTIFACT_ID = 'art-demo-analysis-1';
const BUSINESS_VERSION_ID = 'bv-demo-analysis-1';

const CATALOG = [
  {
    kpiCatalogId: 'cat-1',
    kpiCode: 'GROSS_MARGIN_PCT',
    catalogVersion: 1,
    status: 'ACTIVE',
    tier: 'UNIVERSAL',
    industryCode: null,
    category: 'Rentowność',
    kpiName: 'Marża brutto',
    description: '(Przychody - COGS) / Przychody',
    unitType: 'PERCENT',
    compileStatus: 'COMPILED',
    resolvedOutputUnit: 'PERCENT',
    periodConvention: 'POINT_IN_TIME',
    negativeDenominatorPolicy: 'FORCE_NA',
    requiredCanonicalLineCodes: ['REVENUE', 'COGS'],
  },
  {
    kpiCatalogId: 'cat-2',
    kpiCode: 'EBITDA_MARGIN_PCT',
    catalogVersion: 1,
    status: 'ACTIVE',
    tier: 'UNIVERSAL',
    industryCode: null,
    category: 'Rentowność',
    kpiName: 'Marża EBITDA',
    description: 'EBITDA / Przychody',
    unitType: 'PERCENT',
    compileStatus: 'COMPILED',
    resolvedOutputUnit: 'PERCENT',
    periodConvention: 'POINT_IN_TIME',
    negativeDenominatorPolicy: 'FORCE_NA',
    requiredCanonicalLineCodes: ['REVENUE', 'EBITDA'],
  },
  {
    kpiCatalogId: 'cat-3',
    kpiCode: 'INVENTORY_DAYS',
    catalogVersion: 1,
    status: 'ACTIVE',
    tier: 'INDUSTRY',
    industryCode: 'MANUFACTURING',
    category: 'Operacje',
    kpiName: 'Dni zapasów',
    description: '(Zapasy / COGS) * 365',
    unitType: 'DAYS',
    compileStatus: 'COMPILED',
    resolvedOutputUnit: 'DAYS',
    periodConvention: 'POINT_IN_TIME',
    negativeDenominatorPolicy: 'FORCE_NA',
    requiredCanonicalLineCodes: ['INVENTORY', 'COGS'],
  },
];

function kpiValue(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    kpiCatalogId: 'cat-1',
    category: 'Rentowność',
    tier: 'UNIVERSAL',
    unitType: 'PERCENT',
    entityId: 'ent-demo-1',
    qualityFlag: null,
    deltaVsPriorPeriod: null,
    deltaPctVsPriorPeriod: null,
    interpretationText: null,
    benchmark: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-10T00:00:00Z',
    ...overrides,
  };
}

const KPI_VALUES_BY_SCENE: Record<Scene, Record<string, unknown>[]> = {
  'draft-empty': [],
  'draft-with-kpis': [
    kpiValue({ kpiValueId: 'kv-gm-2025', kpiCode: 'GROSS_MARGIN_PCT', kpiName: 'Marża brutto', periodId: 'p-2025', value: { status: 'PRESENT_NONZERO', valueDecimal: '0.35', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' } }),
    kpiValue({ kpiValueId: 'kv-gm-2026', kpiCode: 'GROSS_MARGIN_PCT', kpiName: 'Marża brutto', periodId: 'p-2026', value: { status: 'PRESENT_NONZERO', valueDecimal: '0.4', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' }, interpretationText: 'Marża rośnie dzięki niższym kosztom materiałów.' }),
    kpiValue({ kpiValueId: 'kv-eb-2025', kpiCode: 'EBITDA_MARGIN_PCT', kpiName: 'Marża EBITDA', periodId: 'p-2025', value: { status: 'PRESENT_NONZERO', valueDecimal: '0.12', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' } }),
    kpiValue({ kpiValueId: 'kv-eb-2026', kpiCode: 'EBITDA_MARGIN_PCT', kpiName: 'Marża EBITDA', periodId: 'p-2026', value: { status: 'PRESENT_ZERO', valueDecimal: '0', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' } }),
    kpiValue({ kpiValueId: 'kv-inv-2026', kpiCode: 'INVENTORY_DAYS', kpiName: 'Dni zapasów', category: 'Operacje', tier: 'INDUSTRY', periodId: 'p-2026', value: { status: 'NA', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'DAYS', multiplier: '1' } }),
  ],
  approved: [
    kpiValue({ kpiValueId: 'kv-gm-2026', kpiCode: 'GROSS_MARGIN_PCT', kpiName: 'Marża brutto', periodId: 'p-2026', value: { status: 'PRESENT_NONZERO', valueDecimal: '0.4', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' } }),
  ],
  'missing-values': [
    kpiValue({ kpiValueId: 'kv-gm-2026', kpiCode: 'GROSS_MARGIN_PCT', kpiName: 'Marża brutto', periodId: 'p-2026', value: { status: 'MISSING', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'UNITS', multiplier: '1' } }),
    kpiValue({ kpiValueId: 'kv-inv-2026', kpiCode: 'INVENTORY_DAYS', kpiName: 'Dni zapasów', category: 'Operacje', tier: 'INDUSTRY', periodId: 'p-2026', value: { status: 'NOT_APPLICABLE', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'DAYS', multiplier: '1' } }),
  ],
};

const STATUS_BY_SCENE: Record<Scene, string> = {
  'draft-empty': 'DRAFT',
  'draft-with-kpis': 'DRAFT',
  approved: 'APPROVED',
  'missing-values': 'DRAFT',
};

const NAME_BY_SCENE: Record<Scene, string> = {
  'draft-empty': 'Nowa analiza (bez wskaźników)',
  'draft-with-kpis': 'Analiza FY2026 — DBR77',
  approved: 'Analiza FY2025 (zatwierdzona)',
  'missing-values': 'Analiza z lukami danych',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  if (url.includes('/api/v8/finance-v2/artifacts/') && url.includes('/rename')) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    return jsonResponse({ data: { artifactId: ARTIFACT_ID, naturalKey: body.naturalKey ?? NAME_BY_SCENE[scene] } });
  }
  if (url.includes(`/api/v8/finance-v2/artifacts/${ARTIFACT_ID}`)) {
    return jsonResponse({
      data: {
        artifactId: ARTIFACT_ID,
        artifactType: 'HISTORICAL_ANALYSIS',
        naturalKey: NAME_BY_SCENE[scene],
        createdAt: '2026-07-01T00:00:00Z',
        archivedAt: null,
        archivedReason: null,
        currentBusinessVersion: {
          businessVersionId: BUSINESS_VERSION_ID,
          versionNo: scene === 'approved' ? 2 : 1,
          version: 1,
          status: STATUS_BY_SCENE[scene],
          freshness: scene === 'draft-with-kpis' ? 'CURRENT' : 'NEVER_COMPUTED',
          freshnessReason: null,
          riskTier: 'LOW',
        },
      },
    });
  }
  if (url.includes(`/api/v8/finance-v2/versions/${BUSINESS_VERSION_ID}`)) {
    return jsonResponse({
      data: {
        businessVersionId: BUSINESS_VERSION_ID,
        artifactId: ARTIFACT_ID,
        versionNo: scene === 'approved' ? 2 : 1,
        version: 1,
        status: STATUS_BY_SCENE[scene],
        freshness: scene === 'draft-with-kpis' ? 'CURRENT' : 'NEVER_COMPUTED',
        freshnessReason: null,
        staleSince: null,
        riskTier: 'LOW',
        versionKind: 'MAIN',
        parentVersionId: null,
        supersededByVersionId: null,
        computeSnapshotId: null,
        computeRunId: null,
        contentSemanticHash: null,
        submittedBy: null,
        submittedAt: null,
        approvedBy: scene === 'approved' ? 'user-piotr-demo' : null,
        approvedAt: scene === 'approved' ? '2026-08-01T00:00:00Z' : null,
        reopenReason: null,
        reopenedBy: null,
        reopenedAt: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-08-01T00:00:00Z',
      },
    });
  }
  if (url.includes('/api/v8/finance-v2/analysis/kpi-catalog')) {
    return jsonResponse({ data: CATALOG });
  }
  if (url.includes('/api/v8/finance-v2/analysis/') && url.includes('/kpi-values')) {
    return jsonResponse({ data: KPI_VALUES_BY_SCENE[scene] });
  }
  if (url.includes('/api/v8/finance-v2/analysis/') && url.includes('/compute')) {
    return jsonResponse({ data: { jobId: 'job-demo-1', jobStatus: 'succeeded', resultsCount: KPI_VALUES_BY_SCENE[scene].length, results: [], readiness: null } });
  }
  return realFetch(input as any, init);
}) as typeof window.fetch;

const CREATOR_SOURCE_OPTIONS: AnalysisCreatorSourceOption[] = [
  {
    statementPackArtifactId: 'art-stmt-1',
    statementPackVersionId: 'bv-stmt-1',
    versionNo: 2,
    label: 'Pakiet sprawozdań FY2025 (zatwierdzony)',
    status: 'APPROVED',
    entityId: 'ent-demo-1',
    entityLabel: 'DBR77 Sp. z o.o.',
  },
];
const CREATOR_PERIOD_OPTIONS: AnalysisCreatorPeriodOption[] = [
  { periodId: 'p-2025', label: '2025', isForecast: false, chronologicalIndex: 0 },
  { periodId: 'p-2026', label: '2026 (prognoza)', isForecast: true, chronologicalIndex: 1 },
];
const CREATOR_AVAILABLE_LINE_CODES = ['REVENUE', 'COGS', 'EBITDA'];

export function FinanceAnalysisWorkspaceScreen(): React.ReactElement {
  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-c-bg">
      <AnalysisWorkspace
        key={scene}
        artifactId={ARTIFACT_ID}
        businessVersionId={BUSINESS_VERSION_ID}
        role="preparer"
        onNavigateBack={() => {}}
        creatorSourceOptions={CREATOR_SOURCE_OPTIONS}
        creatorPeriodOptions={CREATOR_PERIOD_OPTIONS}
        creatorAvailableLineCodes={CREATOR_AVAILABLE_LINE_CODES}
      />
    </div>
  );
}

export default FinanceAnalysisWorkspaceScreen;
