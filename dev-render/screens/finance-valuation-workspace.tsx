/**
 * PKG_H (Finance v3 — Enterprise Valuation) — dev-render host for the REAL
 * `<ValuationWorkspace>` (src/components/Finance/Valuation/ValuationWorkspace.tsx).
 *
 * Purpose (CLAUDE.md rule #7 — Piotr is never the first visual tester): render the REAL
 * production component with server-shaped mock data (per the DTOs measured off
 * `valuation.routes.ts` at base SHA 9604652e27 — see PKG_H_VALUATION_report.md) so the
 * supervisor can attach an actual screenshot as evidence, before Piotr ever opens this screen.
 * `<ValuationWorkspace>` accepts an injectable `api` prop for exactly this reason — this harness
 * supplies fakes shaped like the real B3 responses instead of hitting the network.
 *
 * URL params (in addition to the harness-wide ?lang= & ?theme=):
 *   &step=source|assumptions|methods|results|sensitivity|advisor|export   initial step (default: source)
 *   &sourceLinked=1|0   whether the mock lineage has a source edge (default: 1) — negative-control
 *                       knob for the "Source" step's honest-gap banner (NO_VALUATION_SOURCE_EDGE).
 *   &name=<string>      variant name shown in the bar — negative-control knob proving the harness
 *                        renders the REAL component (not a static image).
 */
import React from 'react';

import type { ValuationWorkspaceApi } from '../../src/components/Finance/Valuation/ValuationWorkspace';
import { ValuationWorkspace } from '../../src/components/Finance/Valuation/ValuationWorkspace';
import type {
  ValuationAdvisorFindingStoredDto,
  ValuationMethodDto,
  ValuationResultsDto,
  ValuationSensitivityGridRawDto,
  ValuationVariantDto,
  ValuationWaccInputsRawDto,
} from '../../src/services/api/financeV2.types';

// AP_MOUNT §A: `ValuationWorkspace` now reads `financeValuationWorkspaceV1`
// itself (not just its caller) and renders `null` when OFF — force it ON via
// the same localStorage-backed local override the hook reads at init.
try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ ...existing, financeValuationWorkspaceV1: true })
  );
} catch {
  // ignore — harness-only convenience
}

const params = new URLSearchParams(window.location.search);
const INITIAL_STEP = (params.get('step') as any) || 'source';
const SOURCE_LINKED = params.get('sourceLinked') !== '0';
const VARIANT_NAME = params.get('name') || 'DBR77 — Wycena FY2026 (Base Case)';
const BV_ID = 'bv-valuation-dbr77-1';

const MOCK_VARIANT: ValuationVariantDto = {
  businessVersionId: BV_ID,
  caseId: 'case-dbr77-1',
  name: VARIANT_NAME,
  description: 'Wariant bazowy — DCF/FCFF + porównywalne transakcje.',
  status: 'IN_REVIEW',
  freshness: 'CURRENT',
  versionNo: 2,
  createdBy: 'user-piotr',
  createdAt: '2026-08-05T09:00:00Z',
};

const MOCK_WACC: ValuationWaccInputsRawDto = {
  id: 'wacc-1',
  organization_id: 'org-1',
  business_version_id: BV_ID,
  risk_free_rate_pct: '4.5',
  equity_risk_premium_pct: '5.2',
  beta_unlevered: '0.85',
  beta_relevered: '1.02',
  target_capital_structure_debt_pct: '30',
  target_capital_structure_equity_pct: '70',
  current_capital_structure_debt_pct: '25',
  current_capital_structure_equity_pct: '75',
  cost_of_debt_pretax_pct: '6.0',
  credit_spread_pct: '1.5',
  cash_tax_rate_pct: '19',
  currency: 'PLN',
  nominal_or_real: 'NOMINAL',
  pre_or_post_tax: 'POST_TAX',
  wacc_computed_pct: '9.3',
};

const MOCK_METHODS: ValuationMethodDto[] = [
  {
    methodId: 'm-dcf',
    methodType: 'DCF_FCFF',
    readiness: 'READY',
    result: { status: 'PRESENT_NONZERO', valueDecimal: '184500000' },
    isInRecommendationBasket: true,
    weightPct: '60',
  },
  {
    methodId: 'm-comps',
    methodType: 'TRADING_COMPS',
    readiness: 'READY',
    result: { status: 'PRESENT_NONZERO', valueDecimal: '201000000' },
    isInRecommendationBasket: true,
    weightPct: '40',
  },
  {
    methodId: 'm-prec',
    methodType: 'PRECEDENT_TRANSACTIONS',
    readiness: 'NOT_CONFIGURED',
    result: { status: 'NA', valueDecimal: null },
    isInRecommendationBasket: false,
    weightPct: null,
  },
  {
    methodId: 'm-asset',
    methodType: 'ASSET_BASED',
    readiness: 'DATA_INCOMPLETE',
    result: { status: 'MISSING', valueDecimal: null },
    isInRecommendationBasket: false,
    weightPct: null,
  },
];

const MOCK_RESULTS: ValuationResultsDto = {
  businessVersionId: BV_ID,
  variant: { id: 'variant-1', case_id: 'case-dbr77-1', name: VARIANT_NAME, description: null },
  status: 'IN_REVIEW',
  freshness: 'CURRENT',
  headlineEnterpriseValue: {
    source: 'WEIGHTED_BASKET',
    value: 191400000,
    pointer: null,
  },
  weightedRecommendation: {
    status: 'READY',
    weightedEnterpriseValue: 191400000,
    contributions: [
      {
        methodType: 'DCF_FCFF',
        weightPct: 60,
        resultEvDecimal: 184500000,
        contribution: 110700000,
      },
      {
        methodType: 'TRADING_COMPS',
        weightPct: 40,
        resultEvDecimal: 201000000,
        contribution: 80400000,
      },
    ],
  },
  methods: MOCK_METHODS,
  wacc: MOCK_WACC as any,
  terminal: [
    {
      id: 't-1',
      method_id: 'm-dcf',
      method_type: 'DCF_FCFF',
      convention: 'GORDON_GROWTH',
      g_pct: '2.5',
      exit_multiple_value: null,
      reinvestment_rate_pct: '38',
      roic_pct: '6.6',
      terminal_value_decimal: '142000000',
      terminal_share_pct: '58.3',
      is_primary: true,
    },
  ],
  bridge: {
    header: {
      id: 'bridge-1',
      as_of_date: '2026-08-01',
      enterprise_value_decimal: '191400000',
      equity_value_decimal: '171400000',
    },
    components: [
      {
        id: 'bc-1',
        sequence_order: 1,
        component_kind: 'DEBT',
        sign: 'SUBTRACT_FROM_EV',
        amount_decimal: '25000000',
      },
      {
        id: 'bc-2',
        sequence_order: 2,
        component_kind: 'CASH',
        sign: 'ADD_TO_EV',
        amount_decimal: '5000000',
      },
    ],
  },
  sensitivityGrids: [],
  usableCompsByMethodId: { 'm-comps': 7 },
  methodAgreementWarnings: [
    {
      ruleId: 'ADV-R11',
      kind: 'RISK',
      title: 'Rozbieżność metod',
      narrative: 'DCF i porównywalne różnią się o 8,2% — w normie, ale warto odnotować.',
      confidence: 'MEDIUM',
    },
  ],
};

function buildMonotonicGrid(): ValuationSensitivityGridRawDto {
  const cells: ValuationSensitivityGridRawDto['cells'] = [];
  const waccAxis = [7.3, 8.3, 9.3, 10.3, 11.3];
  const gAxis = [0.5, 1.5, 2.5, 3.5, 4.5];
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 5; c++) {
      const g = gAxis[r - 1];
      const wacc = waccAxis[c - 1];
      const undefinedCell = g >= wacc;
      const value = undefinedCell
        ? null
        : Math.round(184500000 * (1 + (g - 2.5) * 0.04 - (wacc - 9.3) * 0.06));
      cells.push({
        id: `cell-${r}-${c}`,
        row_index: r,
        col_index: c,
        row_axis_value: String(g),
        column_axis_value: String(wacc),
        cell_value_decimal: value === null ? null : String(value),
        is_base_cell: r === 3 && c === 3,
      });
    }
  }
  return {
    grid: {
      id: 'grid-1',
      organization_id: 'org-1',
      method_id: 'm-dcf',
      grid_label: 'PRIMARY',
      row_axis_variable: 'terminal_g_pct',
      column_axis_variable: 'wacc_pct',
      grid_status: 'COMPLETE',
    },
    cells,
  };
}

const MOCK_ADVISOR_FINDINGS: ValuationAdvisorFindingStoredDto[] = [
  {
    id: 'f-1',
    business_version_id: BV_ID,
    compute_snapshot_id: 'snap-1',
    output_kind: 'FACT',
    title: 'Udział wartości terminalnej w EV: 58,3%',
    narrative:
      'Wartość terminalna metody DCF/FCFF stanowi 58,3% wyliczonej EV — mierzone bezpośrednio z tabeli terminal.',
    evidence_ref: {
      ruleId: 'ADV-R01',
      generator: 'RULE_ENGINE',
      rulesVersion: '1',
      pointers: [
        {
          table: 'finance_valuation_terminal',
          column: 'terminal_share_pct',
          rowId: 't-1',
          observedValue: 58.3,
          label: 'Udział wartości terminalnej',
        },
      ],
      derived: {},
      impactUnit: 'PCT',
    },
    driver_ref: 'TERMINAL_SHARE',
    impact_decimal: '58.3',
    confidence: 'HIGH',
    is_comparison: false,
    is_frozen: false,
    frozen_at: null,
    is_stale: false,
    ai_provider: 'rule-engine',
    ai_prompt_version: '1',
    ai_hallucination_eval_status: 'PASSED',
  },
  {
    id: 'f-2',
    business_version_id: BV_ID,
    compute_snapshot_id: 'snap-1',
    output_kind: 'HYPOTHESIS',
    title: 'Terminal g nie jest w pełni spójne z reinwestycja × ROIC',
    narrative:
      'Wejścia sugerują implikowane g ≈ 2,5% (38% reinwestycji × 6,6% ROIC), zbieżne z przyjętym g=2,5% — brak istotnej rozbieżności.',
    evidence_ref: {
      ruleId: 'ADV-R06',
      generator: 'RULE_ENGINE',
      rulesVersion: '1',
      pointers: [],
      derived: { impliedG: 2.5 },
      impactUnit: 'PP',
    },
    driver_ref: 'TERMINAL_G_CONSISTENCY',
    impact_decimal: null,
    confidence: 'MEDIUM',
    is_comparison: false,
    is_frozen: false,
    frozen_at: null,
    is_stale: false,
    ai_provider: 'rule-engine',
    ai_prompt_version: '1',
    ai_hallucination_eval_status: 'PASSED',
  },
];

function makeMockApi(): ValuationWorkspaceApi {
  return {
    getValuationVariant: async () => MOCK_VARIANT,
    // ★ FIXC (martwa przestrzeń, gate-e): `getAncestors()` (server, `lineageService.ts`) is a
    // RECURSIVE CTE that walks the whole chain feeding into a version, not just the direct edge —
    // a real valuation typically descends Statement Pack -> Baseline -> Scenario -> Valuation.
    // This harness previously supplied only ONE edge, which under-represented what `SourceStep`
    // can legitimately receive and (before the same-session fix) is why the step under-rendered.
    // Shape/edgeType/transformationKind conventions here match the ALREADY-EXISTING multi-edge
    // demo chain in `dev-render/screens/finance-statement-pack-workspace-v2.tsx`
    // (`derived_from`/`baseline_from_statement`) — not a new fabricated convention.
    getFinanceVersionLineage: async () => ({
      businessVersionId: BV_ID,
      ancestors: SOURCE_LINKED
        ? [
            {
              edgeId: 'edge-stmt-baseline-1',
              sourceVersionId: 'bv-statement-pack-fy2025-approved',
              sourceArtifactType: 'STATEMENT_PACK',
              targetVersionId: 'bv-baseline-fy2025-approved',
              targetArtifactType: 'BASELINE_MODEL',
              edgeType: 'derived_from',
              transformationKind: 'baseline_from_statement',
              assumptionSnapshotHash: null,
              computeRunId: 'run-baseline-1',
              authorId: 'user-analyst-1',
              createdAt: '2026-08-01T08:00:00Z',
            },
            {
              edgeId: 'edge-baseline-scenario-1',
              sourceVersionId: 'bv-baseline-fy2025-approved',
              sourceArtifactType: 'BASELINE_MODEL',
              targetVersionId: 'bv-prediction-demo-1',
              targetArtifactType: 'PREDICTION_SCENARIO',
              edgeType: 'derived_from',
              transformationKind: 'scenario_from_baseline',
              assumptionSnapshotHash: 'sha256:def456…',
              computeRunId: 'run-scenario-1',
              authorId: 'user-piotr',
              createdAt: '2026-08-03T10:30:00Z',
            },
            {
              edgeId: 'edge-scenario-valuation-1',
              sourceVersionId: 'bv-prediction-demo-1',
              sourceArtifactType: 'PREDICTION_SCENARIO',
              targetVersionId: BV_ID,
              targetArtifactType: 'VALUATION_CASE',
              edgeType: 'VALUATION_SOURCE',
              transformationKind: 'VALUATION_FROM_SCENARIO',
              assumptionSnapshotHash: 'sha256:abc123…',
              computeRunId: 'run-valuation-1',
              authorId: 'user-piotr',
              createdAt: '2026-08-05T09:05:00Z',
            },
          ]
        : [],
      descendants: [],
    }),
    getValuationWaccInputs: async () => MOCK_WACC,
    upsertValuationWaccInputs: async (_bv, params) => ({ ...MOCK_WACC, ...(params as any) }),
    listValuationMethods: async () => ({
      methods: MOCK_METHODS,
      weightedRecommendation: MOCK_RESULTS.weightedRecommendation,
    }),
    createValuationMethod: async () => MOCK_METHODS[0],
    setValuationMethodBasketWeights: async () => ({
      methods: MOCK_METHODS,
      weightedRecommendation: MOCK_RESULTS.weightedRecommendation,
    }),
    getValuationResults: async () => MOCK_RESULTS,
    getValuationSensitivityGrid: async () => buildMonotonicGrid(),
    generateValuationAdvisorOutput: async () => ({
      variantId: BV_ID,
      computeSnapshotId: 'snap-2',
      findings: [],
      countsByKind: { FACT: 0, HYPOTHESIS: 0, RISK: 0, QUESTION: 0, ACTION: 0 },
    }),
    listValuationAdvisorOutputs: async () => MOCK_ADVISOR_FINDINGS,
  };
}

export default function FinanceValuationWorkspaceScreen(): React.ReactElement {
  return (
    <ValuationWorkspace
      businessVersionId={BV_ID}
      api={makeMockApi()}
      initialStepId={INITIAL_STEP}
    />
  );
}
