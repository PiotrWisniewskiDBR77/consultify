/**
 * PKG_D (Finance v3 Statements) — dev-render host for `StatementPackWorkspaceV2`.
 *
 * Renders the REAL assembly component (no re-implementation) with injected
 * mock fetchers shaped exactly like the real `financeV2.api` client
 * (StatementLineDto / ReconciliationRunSummaryDto / ReconciliationRunDetailDto
 * / VersionLineageDto) — same pattern as `finance-value-panels.tsx`
 * (`ValueOfficePanel.valueBridgeFetcher`).
 *
 * Purpose: self-verify BEFORE the owner sees it (CLAUDE.md #7) — this screen
 * is dev-only, never shipped to demo, and the production
 * `FinancialStatementPackWorkspace.tsx` still renders its existing bespoke
 * path (the V2 flag stays OFF, unwired from any production screen — see
 * PKG_D_STATEMENTS_report.md §"Co niepokryte").
 *
 * URL: ?screen=finance-statement-pack-workspace-v2[&lang=pl|en][&theme=light|dark]
 *   &state=populated|empty|missing   which data state to mock (default: populated)
 *     populated — realistic P&L lines (PRESENT_NONZERO/PRESENT_ZERO/MISSING/
 *                 NA/NOT_APPLICABLE all present), one reconciliation run with
 *                 MAPPED+DUPLICATE rows, two related artifacts, empty report state
 *     empty     — zero lines, zero reconciliation runs, zero related artifacts
 *                 (proves honest empty states, not fabricated rows)
 *     missing   — listStatementLines rejects (network/server error path)
 */
import React from 'react';

import { StatementPackWorkspaceV2 } from '../../src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2';
import type {
  LineageEdgeDto,
  ReconciliationRunDetailDto,
  ReconciliationRunSummaryDto,
  StatementLineDto,
  VersionLineageDto,
} from '../../src/services/api/financeV2.types';

// AP_MOUNT §A/§C: `StatementPackWorkspaceV2` now reads
// `financeStatementPackWorkspaceV2` itself (not just its caller) and renders
// `null` when OFF — force it ON via the same localStorage-backed local
// override the hook reads at init.
try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem('consultify_feature_flags', JSON.stringify({ ...existing, financeStatementPackWorkspaceV2: true }));
} catch {
  // ignore — harness-only convenience
}

const params = new URLSearchParams(window.location.search);
const state = params.get('state') || 'populated';

function makeLine(overrides: Partial<StatementLineDto> & { stmtLineId: string }): StatementLineDto {
  return {
    stmtLineId: overrides.stmtLineId,
    statementType: 'P&L',
    canonicalLineId: 'canon-revenue',
    lineCode: 'REVENUE',
    entityId: 'entity-dbr77',
    entityCode: 'DBR77',
    periodId: 'p-fy2025',
    periodLabel: 'FY2025',
    accumulationBasis: 'FULL_YEAR',
    consolidationScope: 'CONSOLIDATED',
    value: {
      status: 'PRESENT_NONZERO',
      valueDecimal: '1000000',
      nativeCurrency: 'PLN',
      presentationCurrency: 'PLN',
      unit: 'THOUSANDS',
      multiplier: '1',
      sourceRef: { file: 'trial_balance_fy2025.xlsx', sheet: 'P&L', row: 12 },
      isAdjustment: false,
      adjustmentReason: null,
    },
    signConvention: 'NATURAL',
    accountingPolicy: 'IFRS',
    reclassifiedFromLineId: null,
    createdBy: 'user-analyst-1',
    createdAt: '2026-08-11T09:00:00.000Z',
    updatedAt: '2026-08-11T09:00:00.000Z',
    ...overrides,
  };
}

const POPULATED_LINES: StatementLineDto[] = [
  makeLine({ stmtLineId: 'l-rev-fy24', canonicalLineId: 'canon-revenue', lineCode: 'REVENUE', periodId: 'p-fy2024', periodLabel: 'FY2024', value: { status: 'PRESENT_NONZERO', valueDecimal: '8200000', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: { file: 'trial_balance_fy2024.xlsx', row: 12 }, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-rev-fy25', canonicalLineId: 'canon-revenue', lineCode: 'REVENUE', periodId: 'p-fy2025', periodLabel: 'FY2025', value: { status: 'PRESENT_NONZERO', valueDecimal: '9400000', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: { file: 'trial_balance_fy2025.xlsx', row: 12 }, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-cogs-fy24', canonicalLineId: 'canon-cogs', lineCode: 'COGS', periodId: 'p-fy2024', periodLabel: 'FY2024', value: { status: 'PRESENT_NONZERO', valueDecimal: '-5100000', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: { file: 'trial_balance_fy2024.xlsx', row: 18 }, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-cogs-fy25', canonicalLineId: 'canon-cogs', lineCode: 'COGS', periodId: 'p-fy2025', periodLabel: 'FY2025', value: { status: 'PRESENT_NONZERO', valueDecimal: '-5600000', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: { file: 'trial_balance_fy2025.xlsx', row: 18 }, isAdjustment: true, adjustmentReason: 'Jednorazowa korekta odpisu magazynowego' } }),
  makeLine({ stmtLineId: 'l-oneoff-fy24', canonicalLineId: 'canon-oneoff-items', lineCode: 'ONE_OFF', periodId: 'p-fy2024', periodLabel: 'FY2024', value: { status: 'PRESENT_ZERO', valueDecimal: '0', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: null, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-oneoff-fy25', canonicalLineId: 'canon-oneoff-items', lineCode: 'ONE_OFF', periodId: 'p-fy2025', periodLabel: 'FY2025', value: { status: 'MISSING', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: null, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-minority-fy24', canonicalLineId: 'canon-minority-interest', lineCode: 'MINORITY_INTEREST', periodId: 'p-fy2024', periodLabel: 'FY2024', value: { status: 'NOT_APPLICABLE', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: null, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-minority-fy25', canonicalLineId: 'canon-minority-interest', lineCode: 'MINORITY_INTEREST', periodId: 'p-fy2025', periodLabel: 'FY2025', value: { status: 'NOT_APPLICABLE', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: null, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-tax-effective-fy25', canonicalLineId: 'canon-effective-tax-note', lineCode: 'EFF_TAX_NOTE', periodId: 'p-fy2025', periodLabel: 'FY2025', value: { status: 'NA', valueDecimal: null, nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: null, isAdjustment: false, adjustmentReason: null } }),
  makeLine({ stmtLineId: 'l-misc-fy25', canonicalLineId: null, lineCode: 'MISC_UNMAPPED_9001', periodId: 'p-fy2025', periodLabel: 'FY2025', value: { status: 'PRESENT_NONZERO', valueDecimal: '15000', nativeCurrency: 'PLN', presentationCurrency: 'PLN', unit: 'THOUSANDS', multiplier: '1', sourceRef: { file: 'misc_adjustments.csv', row: 4 }, isAdjustment: false, adjustmentReason: null } }),
];

const POPULATED_RUNS: ReconciliationRunSummaryDto[] = [
  {
    reconciliationRunId: 'run-2026-08-11',
    artifactId: 'artifact-statement-pack-dbr77',
    businessVersionId: 'bv-statement-pack-dbr77-3',
    sourceSystem: 'SAP_TRIAL_BALANCE_EXPORT',
    status: 'completed',
    resultQuality: 'WITHIN_TOLERANCE',
    totals: {
      sourceTotal: '9415000',
      mappedTotal: '9400000',
      excludedTotal: '0',
      unmappedTotal: '15000',
      duplicateTotal: '0',
      reclassNetTotal: '0',
      eliminationNetTotal: '0',
      canonicalTotal: '9400000',
      residual: '15000',
      residualPct: '0.16',
    },
    materialityThresholdApplied: '0.5',
    sourceValueCoveragePct: '99.84',
    linkedExceptionId: null,
    coverageExceptionId: null,
    createdAt: '2026-08-11T09:05:00.000Z',
    createdBy: 'user-analyst-1',
  },
];

const POPULATED_RUN_DETAIL: ReconciliationRunDetailDto = {
  reconciliationRunId: 'run-2026-08-11',
  artifactId: 'artifact-statement-pack-dbr77',
  businessVersionId: 'bv-statement-pack-dbr77-3',
  sourceSystem: 'SAP_TRIAL_BALANCE_EXPORT',
  status: 'completed',
  resultQuality: 'WITHIN_TOLERANCE',
  residual: '15000',
  residualPct: '0.16',
  createdAt: '2026-08-11T09:05:00.000Z',
  rows: [
    { id: 'row-rev-fy25', canonicalLineId: 'canon-revenue', entityId: 'entity-dbr77', periodId: 'p-fy2025', bucket: 'MAPPED', sourceAmount: '9400000', mappedAmount: '9400000', duplicateOfRowId: null, reclassTargetLineId: null, eliminationCounterpartyEntityId: null, reasonCode: null, sourceRowRef: { file: 'trial_balance_fy2025.xlsx', sheet: 'P&L', row: 12 } },
    { id: 'row-cogs-fy25', canonicalLineId: 'canon-cogs', entityId: 'entity-dbr77', periodId: 'p-fy2025', bucket: 'MAPPED', sourceAmount: '-5600000', mappedAmount: '-5600000', duplicateOfRowId: null, reclassTargetLineId: null, eliminationCounterpartyEntityId: null, reasonCode: null, sourceRowRef: { file: 'trial_balance_fy2025.xlsx', row: 18 } },
    { id: 'row-misc-fy25', canonicalLineId: null, entityId: 'entity-dbr77', periodId: 'p-fy2025', bucket: 'UNMAPPED', sourceAmount: '15000', mappedAmount: null, duplicateOfRowId: null, reclassTargetLineId: null, eliminationCounterpartyEntityId: null, reasonCode: 'NO_MATCHING_RULE', sourceRowRef: { file: 'misc_adjustments.csv', row: 4 } },
    { id: 'row-dup-1', canonicalLineId: 'canon-revenue', entityId: 'entity-dbr77', periodId: 'p-fy2025', bucket: 'DUPLICATE', sourceAmount: '9400000', mappedAmount: null, duplicateOfRowId: 'row-rev-fy25', reclassTargetLineId: null, eliminationCounterpartyEntityId: null, reasonCode: 'DOUBLE_EXPORT_ROW', sourceRowRef: { file: 'trial_balance_fy2025_retry.xlsx', row: 12 } },
  ],
};

const POPULATED_LINEAGE: VersionLineageDto = {
  businessVersionId: 'bv-statement-pack-dbr77-3',
  ancestors: [],
  descendants: [
    { edgeId: 'edge-analysis-1', sourceVersionId: 'bv-statement-pack-dbr77-3', sourceArtifactType: 'STATEMENT_PACK', targetVersionId: 'bv-analysis-dbr77-1', targetArtifactType: 'HISTORICAL_ANALYSIS', edgeType: 'derived_from', transformationKind: 'analysis_from_statement', assumptionSnapshotHash: null, computeRunId: 'compute-run-1', authorId: 'user-analyst-1', createdAt: '2026-08-11T10:00:00.000Z' },
    { edgeId: 'edge-model-1', sourceVersionId: 'bv-statement-pack-dbr77-3', sourceArtifactType: 'STATEMENT_PACK', targetVersionId: 'bv-model-dbr77-1', targetArtifactType: 'BASELINE_MODEL', edgeType: 'derived_from', transformationKind: 'baseline_from_statement', assumptionSnapshotHash: 'hash-abc123', computeRunId: 'compute-run-2', authorId: 'user-analyst-1', createdAt: '2026-08-11T11:00:00.000Z' },
  ],
};

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const resolveLineLabel = (rowKey: string, canonicalLineId: string | null, lineCode: string | null): string => {
  const LABELS: Record<string, string> = {
    'canon-revenue': 'Przychody ze sprzedaży',
    'canon-cogs': 'Koszt własny sprzedaży (COGS)',
    'canon-oneoff-items': 'Zdarzenia jednorazowe',
    'canon-minority-interest': 'Udziały niekontrolujące',
    'canon-effective-tax-note': 'Efektywna stopa podatkowa (nota)',
  };
  return (canonicalLineId && LABELS[canonicalLineId]) || lineCode || rowKey;
};

function buildFetchers(currentState: string) {
  if (currentState === 'missing') {
    return {
      listLines: () => Promise.reject(new Error('Serwer nie odpowiedział (symulacja błędu sieci)')),
      getLineage: () => delay<VersionLineageDto>({ businessVersionId: 'bv-1', ancestors: [], descendants: [] }),
      listReconciliationRuns: () => delay<ReconciliationRunSummaryDto[]>([]),
      getReconciliationRunDetail: () => Promise.reject(new Error('not configured')),
      generateReportDraft: () => delay({ artifactId: 'report-mock-1', businessVersionId: 'bv-report-mock-1', version: 1 }),
      publishReport: () => delay(undefined),
    };
  }
  if (currentState === 'empty') {
    return {
      listLines: () => delay<StatementLineDto[]>([]),
      getLineage: () => delay<VersionLineageDto>({ businessVersionId: 'bv-1', ancestors: [], descendants: [] }),
      listReconciliationRuns: () => delay<ReconciliationRunSummaryDto[]>([]),
      getReconciliationRunDetail: () => Promise.reject(new Error('not configured')),
      generateReportDraft: () => delay({ artifactId: 'report-mock-1', businessVersionId: 'bv-report-mock-1', version: 1 }),
      publishReport: () => delay(undefined),
    };
  }
  return {
    listLines: () => delay(POPULATED_LINES),
    getLineage: () => delay(POPULATED_LINEAGE),
    listReconciliationRuns: () => delay(POPULATED_RUNS),
    getReconciliationRunDetail: () => delay(POPULATED_RUN_DETAIL),
    generateReportDraft: () => delay({ artifactId: 'report-mock-1', businessVersionId: 'bv-report-mock-1', version: 1 }, 500),
    publishReport: () => delay(undefined, 500),
  };
}

// ── Tożsamość paska (§C) — `StatementPackWorkspaceV2` ładuje ją teraz
// bezpośrednio przez `getFinanceBusinessVersion`/`getFinanceArtifact`
// (financeV2.api.ts named exports, poza `fetchers` DI), więc — tak jak
// `finance-analysis-workspace.tsx` (identyczny wzorzec) — przechwytujemy na
// poziomie `window.fetch`. ─────────────────────────────────────────────────
const BV_ID = 'bv-statement-pack-dbr77-3';
const ARTIFACT_ID = 'artifact-statement-pack-dbr77';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const realFetch = window.fetch.bind(window);
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  if (url.includes(`/api/v8/finance-v2/artifacts/${ARTIFACT_ID}/rename`)) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    return jsonResponse({ data: { artifactId: ARTIFACT_ID, naturalKey: body.naturalKey ?? 'Sprawozdanie DBR77 FY2025' } });
  }
  if (url.includes(`/api/v8/finance-v2/artifacts/${ARTIFACT_ID}`)) {
    return jsonResponse({
      data: {
        artifactId: ARTIFACT_ID,
        artifactType: 'STATEMENT_PACK',
        naturalKey: 'Sprawozdanie DBR77 FY2025',
        createdAt: '2026-07-01T00:00:00Z',
        archivedAt: null,
        archivedReason: null,
        currentBusinessVersion: { businessVersionId: BV_ID, versionNo: 3, version: 1, status: 'DRAFT', freshness: 'CURRENT', freshnessReason: null, riskTier: 'LOW' },
      },
    });
  }
  if (url.includes(`/api/v8/finance-v2/versions/${BV_ID}/transitions`)) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    return jsonResponse({ data: { status: body.action === 'submit_for_review' ? 'READY_FOR_REVIEW' : 'DRAFT', version: 2 } });
  }
  if (url.includes(`/api/v8/finance-v2/versions/${BV_ID}`)) {
    return jsonResponse({
      data: {
        businessVersionId: BV_ID,
        artifactId: ARTIFACT_ID,
        versionNo: 3,
        version: 1,
        status: 'DRAFT',
        freshness: 'CURRENT',
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
        approvedBy: null,
        approvedAt: null,
        reopenReason: null,
        reopenedBy: null,
        reopenedAt: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-08-11T09:05:00Z',
      },
    });
  }
  return realFetch(input as any, init);
}) as typeof window.fetch;

export default function FinanceStatementPackWorkspaceV2Screen(): React.ReactElement {
  const fetchers = buildFetchers(state);

  return (
    <div className="min-h-screen bg-c-bg p-4" data-testid="finance-statement-pack-workspace-v2-screen">
      <div className="mb-2 font-mono text-[10px] text-c-text-muted">state=<b>{state}</b> (populated|empty|missing)</div>
      <div style={{ height: 'calc(100vh - 48px)' }}>
        <StatementPackWorkspaceV2
          businessVersionId="bv-statement-pack-dbr77-3"
          resolveLineLabel={resolveLineLabel}
          fetchers={fetchers}
          onOpenArtifact={(edge: LineageEdgeDto) => {
            // eslint-disable-next-line no-console
            console.log('onOpenArtifact', edge);
          }}
          onCreateNew={(artifactType, sourceBusinessVersionId) => {
            // eslint-disable-next-line no-console
            console.log('onCreateNew', artifactType, sourceBusinessVersionId);
          }}
          onOpenReportResult={(ref) => {
            // eslint-disable-next-line no-console
            console.log('onOpenReportResult', ref);
          }}
        />
      </div>
    </div>
  );
}
