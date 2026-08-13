/**
 * Finance v3 canonical — Valuation Advisor GENERATOR (Gate D / Fala 7).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 9 ("Valuation Advisor"): after a fresh compute and BEFORE approval, produce facts,
 * hypotheses, risks, questions and recommended actions, each with evidence, impact and
 * confidence; compare variants; change no data and approve nothing.
 *
 * Schema: `WP-D09_valuation_schema_ADR.md` section 12 (`finance_valuation_advisor_outputs` +
 * `finance_valuation_advisor_output_variants`, freeze-on-approval / stale-on-recompute triggers,
 * AI-output policy columns). Sequencing: `BUGFIX_IF19_ADVISOR_SEQUENCING_report.md` —
 * `artifactVersionService.createComputeSnapshot()` is the ONLY sanctioned way to obtain the
 * `compute_snapshot_id` this table requires while the variant is still pre-approval; this service
 * is the first production caller of that function (it was added for exactly this consumer).
 *
 * ---------------------------------------------------------------------------------------------
 * RULE-BASED NOW, AI-BASED LATER — SAME DATA CONTRACT (explicit scope decision)
 * ---------------------------------------------------------------------------------------------
 * This generator is DETERMINISTIC and RULE-BASED. It calls no external LLM API, opens no network
 * socket, and consumes no model budget. Every sentence it emits is assembled from numbers it read
 * out of the canonical valuation tables, through a fixed catalogue of thresholds
 * (`ADVISOR_THRESHOLDS`) and a fixed catalogue of rules (`ADVISOR_RULES`, ids `ADV-R*`/`ADV-C*`).
 * Given the same rows it always produces byte-identical output.
 *
 * The handoff's "wymagana polityka AI" (provider/model/prompt version, residency/no-training,
 * cost/rate limit, evidence digest, hallucination evaluation) is about a FUTURE LLM-based Advisor.
 * Those columns are `NOT NULL` in the schema today, so this generator fills them honestly for what
 * it actually is — `ai_provider='CONSULTIFY_RULE_ENGINE'`, `ai_model='valuation-advisor-rules'`,
 * `ai_prompt_version` = the rule-catalogue version, `ai_residency_region='IN_PROCESS_NO_EGRESS'`,
 * `ai_estimated_cost_decimal=0` — rather than inventing a provider it never called. Swapping the
 * rule engine for an LLM later is a change of ONE function (`evaluateAdvisorRules`) plus the
 * provenance constant: the persisted shape, the freeze/staleness mechanics, the evidence-pointer
 * contract and both public entry points stay exactly as they are.
 *
 * ---------------------------------------------------------------------------------------------
 * READS RESULTS, COMPUTES NOTHING
 * ---------------------------------------------------------------------------------------------
 * The Advisor never re-derives a valuation number. It reads what `valuationComputeService` and
 * friends already persisted (`finance_valuation_methods.result_ev_decimal`,
 * `finance_valuation_terminal.terminal_share_pct`, `finance_valuation_wacc_inputs.wacc_computed_pct`,
 * the EV→Equity bridge, the 5×5 sensitivity cells) and reasons ABOUT those results. The only
 * arithmetic it performs is comparison arithmetic over already-computed values (a difference, a
 * ratio, a dispersion) — never a discount factor, never a terminal value. Where an aggregate
 * already exists as a canonical function it is reused rather than re-implemented
 * (`valuationComputeService.computeWeightedRecommendation`,
 * `valuationSensitivityService.findMonotonicityViolation`).
 */

import { createHash, randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import * as artifactVersionService from './artifactVersionService.js';
import { computeWeightedRecommendation, type MethodRow, type MethodType } from './valuationComputeService.js';
import { findMonotonicityViolation, type SensitivityCellValue } from './valuationSensitivityService.js';

// =============================================================================================
// 1. Provenance / policy constants
// =============================================================================================

/**
 * Bumped whenever the rule catalogue or any threshold changes — persisted as `ai_prompt_version`
 * so an Advisor row is always attributable to the exact rule set that produced it (the rule-engine
 * equivalent of pinning a prompt version, which is what that column exists for).
 */
export const ADVISOR_RULES_VERSION = 'rules-v1.0.0';

export const ADVISOR_GENERATOR_PROVENANCE = {
  provider: 'CONSULTIFY_RULE_ENGINE',
  model: 'valuation-advisor-rules',
  promptVersion: ADVISOR_RULES_VERSION,
  /** Nothing leaves the process: no LLM API, no network call, no third-party data processor. */
  residencyRegion: 'IN_PROCESS_NO_EGRESS',
  noTrainingCommitment: true,
  estimatedCostDecimal: 0,
  rateLimitBucket: null as string | null,
} as const;

/**
 * Every threshold the rule catalogue keys off, in one place, so the report's rule table and the
 * code cannot drift apart and so a future org-level override has a single seam to attach to.
 */
export const ADVISOR_THRESHOLDS = {
  /** Terminal value share of EV above which the result is considered terminal-dominated. */
  terminalShareHighPct: 75,
  /** Above this, the same finding is raised at HIGH rather than MEDIUM confidence. */
  terminalShareVeryHighPct: 85,
  /** WACC − g below this (in percentage points) makes the Gordon denominator numerically fragile. */
  narrowGordonSpreadPp: 2,
  /** |g − reinvestment_rate × ROIC| above this (pp) means terminal g is not reconciled. */
  impliedGTolerancePp: 0.5,
  /** (max−min)/mean across READY methods above this (%) is "low method agreement". */
  methodDispersionPct: 20,
  /** Above this (%) the same dispersion finding is raised at HIGH confidence. */
  methodDispersionSeverePct: 40,
  /** Sensitivity band width as % of the base cell above which the result is "wide". */
  sensitivityWideBandPct: 60,
  /** |target debt% − current debt%| above this (pp) is a financing-transition question. */
  capitalStructureDivergencePp: 15,
  /** |Σ bridge adjustments| / EV above this (%) means the bridge dominates the equity result. */
  bridgeAdjustmentDominancePct: 50,
  /** |ΔEV| between two variants above this (%) is a material variant gap. */
  variantMaterialEvGapPct: 25,
  /** |ΔWACC| between two variants at or above this (pp) can explain a material EV gap. */
  variantExplanatoryWaccGapPp: 1,
  /** |Δterminal share| between two variants below this (pp) counts as "same terminal profile". */
  variantSimilarTerminalSharePp: 5,
} as const;

// =============================================================================================
// 2. Public shapes
// =============================================================================================

export type AdvisorOutputKind = 'FACT' | 'HYPOTHESIS' | 'RISK' | 'QUESTION' | 'ACTION';
export type AdvisorConfidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type AdvisorHallucinationEvalStatus = 'NOT_EVALUATED' | 'PASSED' | 'FLAGGED';

/**
 * A pointer to the EXACT cell a finding was read from — table, column, row id, and the value as
 * observed at generation time. This is what makes an Advisor finding auditable ("evidence" in the
 * handoff's sense) and what `evaluateEvidenceGrounding()` re-reads to prove the finding is not
 * quoting a number that does not exist in the database.
 */
export interface AdvisorEvidencePointer {
  table: EvidenceTable;
  column: string;
  rowId: string | null;
  observedValue: number | string | null;
  label: string;
}

export interface AdvisorEvidenceRef {
  ruleId: string;
  generator: 'RULE_ENGINE';
  rulesVersion: string;
  pointers: AdvisorEvidencePointer[];
  /** Values the rule derived by comparing pointers (a delta, a ratio) — never a re-computed valuation. */
  derived: Record<string, number | string | boolean | null>;
  /** Unit of `impactDecimal`, so a consumer never has to guess whether it is money, % or pp. */
  impactUnit: 'CURRENCY' | 'PCT' | 'PP' | 'COUNT' | null;
}

export interface AdvisorFinding {
  ruleId: string;
  outputKind: AdvisorOutputKind;
  title: string;
  narrative: string;
  evidenceRef: AdvisorEvidenceRef;
  driverRef: string | null;
  impactDecimal: number | null;
  confidence: AdvisorConfidence | null;
  isComparison: boolean;
  /** Only for comparison findings — populated into `finance_valuation_advisor_output_variants`. */
  comparedVariants: { businessVersionId: string; role: 'PRIMARY' | 'COMPARED_AGAINST' }[];
}

export interface PersistedAdvisorFinding extends AdvisorFinding {
  id: string;
  hallucinationEvalStatus: AdvisorHallucinationEvalStatus;
}

// =============================================================================================
// 3. Evidence allow-list (used by the grounding check; also documents the Advisor's read surface)
// =============================================================================================

export type EvidenceTable =
  | 'finance_valuation_methods'
  | 'finance_valuation_terminal'
  | 'finance_valuation_wacc_inputs'
  | 'finance_valuation_ev_equity_bridge'
  | 'finance_valuation_sensitivity_cells'
  | 'finance_valuation_sensitivity_grids'
  | 'finance_business_versions';

/**
 * Closed allow-list: `evaluateEvidenceGrounding()` builds a `SELECT <column> FROM <table> WHERE
 * <pk> = ?` from a pointer, so both identifiers must be validated against a literal list before
 * they reach SQL. A pointer naming anything outside this map is itself a FLAGGED finding — a rule
 * inventing an evidence location is exactly the failure mode the check exists to catch.
 */
const EVIDENCE_COLUMN_ALLOWLIST: Record<EvidenceTable, readonly string[]> = {
  finance_valuation_methods: ['result_ev_decimal', 'weight_pct', 'readiness', 'result_value_status', 'method_type'],
  finance_valuation_terminal: [
    'terminal_share_pct',
    'terminal_value_decimal',
    'g_pct',
    'exit_multiple_value',
    'reinvestment_rate_pct',
    'roic_pct',
    'convention',
  ],
  finance_valuation_wacc_inputs: [
    'wacc_computed_pct',
    'beta_unlevered',
    'beta_relevered',
    'risk_free_rate_pct',
    'equity_risk_premium_pct',
    'cost_of_debt_pretax_pct',
    'cash_tax_rate_pct',
    'target_capital_structure_debt_pct',
    'target_capital_structure_equity_pct',
    'current_capital_structure_debt_pct',
    'current_capital_structure_equity_pct',
  ],
  finance_valuation_ev_equity_bridge: ['enterprise_value_decimal', 'equity_value_decimal', 'as_of_date'],
  finance_valuation_sensitivity_cells: ['cell_value_decimal', 'row_axis_value', 'column_axis_value'],
  finance_valuation_sensitivity_grids: ['grid_status', 'grid_label'],
  finance_business_versions: ['freshness', 'status'],
};

const EVIDENCE_PK_COLUMN: Partial<Record<EvidenceTable, string>> = {
  finance_business_versions: 'business_version_id',
};

// =============================================================================================
// 4. Snapshot of everything the Advisor is allowed to look at (one read, no writes)
// =============================================================================================

export interface AdvisorTerminalRow {
  id: string;
  method_id: string;
  method_type: MethodType;
  convention: 'GORDON_GROWTH' | 'EXIT_MULTIPLE';
  g_pct: string | null;
  exit_multiple_value: string | null;
  reinvestment_rate_pct: string | null;
  roic_pct: string | null;
  terminal_value_decimal: string | null;
  terminal_share_pct: string | null;
  is_primary: boolean;
}

export interface AdvisorBridgeComponentRow {
  id: string;
  sequence_order: number;
  component_kind: string;
  sign: 'SUBTRACT_FROM_EV' | 'ADD_TO_EV';
  amount_decimal: string;
}

export interface AdvisorGridSnapshot {
  id: string;
  method_id: string;
  grid_label: string;
  row_axis_variable: string;
  column_axis_variable: string;
  grid_status: 'DRAFT' | 'COMPLETE';
  cells: {
    id: string;
    row_index: number;
    col_index: number;
    row_axis_value: string | null;
    column_axis_value: string | null;
    cell_value_decimal: string | null;
    is_base_cell: boolean;
  }[];
}

export interface ValuationAdvisorSnapshot {
  organizationId: string;
  businessVersionId: string;
  artifactId: string;
  status: string;
  freshness: string;
  variant: { id: string; case_id: string; name: string; description: string | null } | null;
  wacc: Record<string, string | null> & { id: string } | null;
  methods: MethodRow[];
  terminal: AdvisorTerminalRow[];
  bridge: { header: { id: string; as_of_date: string; enterprise_value_decimal: string | null; equity_value_decimal: string | null }; components: AdvisorBridgeComponentRow[] } | null;
  grids: AdvisorGridSnapshot[];
  usableCompsByMethodId: Record<string, number>;
}

// =============================================================================================
// Pakiet B3 (Valuation HTTP Surface) — public read entry point for the "Wyniki" (results) HTTP
// endpoint. `loadSnapshotInternal` below already reads every table the results contract needs
// (methods/wacc/terminal/bridge/grids, org-scoped, one JOIN each) — this is a thin org/existence
// check plus a pass-through to it, so the results router does not re-implement ~60 lines of the
// exact same SQL a second time. Zero new reads, zero new domain logic.
// =============================================================================================

export type LoadValuationSnapshotResult = { ok: true; snapshot: ValuationAdvisorSnapshot } | { ok: false; code: 'VARIANT_NOT_FOUND' | 'ORGANIZATION_MISMATCH'; message: string };

export async function loadValuationSnapshot(organizationId: string, businessVersionId: string): Promise<LoadValuationSnapshotResult> {
  const bv = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ business_version_id: string; organization_id: string; artifact_id: string; status: string; freshness: string }>(
      `SELECT business_version_id, organization_id, artifact_id, status, freshness FROM finance_business_versions WHERE business_version_id = ?`,
      [businessVersionId]
    )
  );
  if (!bv) return { ok: false, code: 'VARIANT_NOT_FOUND', message: `No finance_business_versions row for ${businessVersionId}` };
  if (bv.organization_id !== organizationId) {
    return { ok: false, code: 'ORGANIZATION_MISMATCH', message: `Variant ${businessVersionId} does not belong to organization ${organizationId}` };
  }
  const snapshot = await loadSnapshotInternal(organizationId, businessVersionId, bv);
  return { ok: true, snapshot };
}

async function loadSnapshotInternal(
  organizationId: string,
  businessVersionId: string,
  bv: { artifact_id: string; status: string; freshness: string }
): Promise<ValuationAdvisorSnapshot> {
  return withPinnedPostgresTransaction(async (tx) => {
    const variant = await tx.queryOne<{ id: string; case_id: string; name: string; description: string | null }>(
      `SELECT id, case_id, name, description FROM finance_valuation_variants
        WHERE business_version_id = ? AND organization_id = ?`,
      [businessVersionId, organizationId]
    );

    const wacc = await tx.queryOne<Record<string, string | null> & { id: string }>(
      `SELECT * FROM finance_valuation_wacc_inputs WHERE business_version_id = ? AND organization_id = ?`,
      [businessVersionId, organizationId]
    );

    const methods = await tx.queryAll<MethodRow>(
      `SELECT * FROM finance_valuation_methods WHERE business_version_id = ? AND organization_id = ?
        ORDER BY method_type`,
      [businessVersionId, organizationId]
    );

    const terminal = methods.length
      ? await tx.queryAll<AdvisorTerminalRow>(
          `SELECT t.id, t.method_id, m.method_type, t.convention, t.g_pct, t.exit_multiple_value,
                  t.reinvestment_rate_pct, t.roic_pct, t.terminal_value_decimal, t.terminal_share_pct, t.is_primary
             FROM finance_valuation_terminal t
             JOIN finance_valuation_methods m ON m.id = t.method_id
            WHERE m.business_version_id = ? AND m.organization_id = ?
            ORDER BY m.method_type, t.convention`,
          [businessVersionId, organizationId]
        )
      : [];

    const bridgeHeader = await tx.queryOne<{ id: string; as_of_date: string; enterprise_value_decimal: string | null; equity_value_decimal: string | null }>(
      `SELECT id, as_of_date::text AS as_of_date, enterprise_value_decimal, equity_value_decimal
         FROM finance_valuation_ev_equity_bridge WHERE business_version_id = ? AND organization_id = ?`,
      [businessVersionId, organizationId]
    );
    const bridgeComponents = bridgeHeader
      ? await tx.queryAll<AdvisorBridgeComponentRow>(
          `SELECT id, sequence_order, component_kind, sign, amount_decimal
             FROM finance_valuation_ev_equity_bridge_components WHERE bridge_id = ? ORDER BY sequence_order`,
          [bridgeHeader.id]
        )
      : [];

    const gridRows = methods.length
      ? await tx.queryAll<Omit<AdvisorGridSnapshot, 'cells'>>(
          `SELECT g.id, g.method_id, g.grid_label, g.row_axis_variable, g.column_axis_variable, g.grid_status
             FROM finance_valuation_sensitivity_grids g
             JOIN finance_valuation_methods m ON m.id = g.method_id
            WHERE m.business_version_id = ? AND m.organization_id = ?
            ORDER BY g.grid_label`,
          [businessVersionId, organizationId]
        )
      : [];
    const grids: AdvisorGridSnapshot[] = [];
    for (const g of gridRows) {
      const cells = await tx.queryAll<AdvisorGridSnapshot['cells'][number]>(
        `SELECT id, row_index, col_index, row_axis_value, column_axis_value, cell_value_decimal, is_base_cell
           FROM finance_valuation_sensitivity_cells WHERE grid_id = ? ORDER BY row_index, col_index`,
        [g.id]
      );
      grids.push({ ...g, cells });
    }

    // Same predicate as `finance_valuation_methods_check_comps_readiness()` (WP-D09b file 2) and
    // `valuationComputeService.assessCompsReadiness()` — usable = not excluded, value present.
    const usableCompsByMethodId: Record<string, number> = {};
    for (const m of methods) {
      const row = await tx.queryOne<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM finance_valuation_comps
          WHERE method_id = ? AND is_outlier_excluded = false
            AND metric_value_status IN ('PRESENT_ZERO','PRESENT_NONZERO')`,
        [m.id]
      );
      usableCompsByMethodId[m.id] = Number(row?.n ?? 0);
    }

    return {
      organizationId,
      businessVersionId,
      artifactId: bv.artifact_id,
      status: bv.status,
      freshness: bv.freshness,
      variant,
      wacc,
      methods,
      terminal,
      bridge: bridgeHeader ? { header: bridgeHeader, components: bridgeComponents } : null,
      grids,
      usableCompsByMethodId,
    };
  });
}

// =============================================================================================
// 5. Small deterministic helpers (no locale, no Intl — identical output on every machine)
// =============================================================================================

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatAmount(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatPct(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function pointer(
  table: EvidenceTable,
  column: string,
  rowId: string | null,
  observedValue: number | string | null,
  label: string
): AdvisorEvidencePointer {
  return { table, column, rowId, observedValue, label };
}

function finding(f: Omit<AdvisorFinding, 'isComparison' | 'comparedVariants'> & Partial<Pick<AdvisorFinding, 'isComparison' | 'comparedVariants'>>): AdvisorFinding {
  return { isComparison: false, comparedVariants: [], ...f };
}

/** The primary terminal row (`is_primary=true`) of the method that actually produced the headline. */
function primaryTerminal(snapshot: ValuationAdvisorSnapshot): AdvisorTerminalRow | null {
  return snapshot.terminal.find((t) => t.is_primary) ?? null;
}

function readyMethods(snapshot: ValuationAdvisorSnapshot): MethodRow[] {
  return snapshot.methods.filter((m) => m.readiness === 'READY' && num(m.result_ev_decimal) !== null);
}

export type HeadlineEvSource = 'BRIDGE' | 'WEIGHTED_BASKET' | 'SINGLE_READY_METHOD' | 'NONE';

export interface HeadlineEnterpriseValue {
  source: HeadlineEvSource;
  value: number | null;
  pointer: AdvisorEvidencePointer | null;
}

/**
 * One resolution order used by BOTH the single-variant rules and the compare function, so an EV
 * quoted in a comparison can never come from a different layer than the EV quoted in a fact.
 * Preference: the EV the analyst actually bridged to equity, else the weighted basket, else the
 * sole ready method. Never a silent zero — `value: null` when nothing is computed.
 */
export function resolveHeadlineEnterpriseValue(snapshot: ValuationAdvisorSnapshot): HeadlineEnterpriseValue {
  const bridgeEv = snapshot.bridge ? num(snapshot.bridge.header.enterprise_value_decimal) : null;
  if (snapshot.bridge && bridgeEv !== null) {
    return {
      source: 'BRIDGE',
      value: bridgeEv,
      pointer: pointer('finance_valuation_ev_equity_bridge', 'enterprise_value_decimal', snapshot.bridge.header.id, bridgeEv, 'EV→Equity bridge enterprise value'),
    };
  }
  const basket = computeWeightedRecommendation(snapshot.methods);
  if (basket.status === 'READY') {
    return { source: 'WEIGHTED_BASKET', value: basket.weightedEnterpriseValue, pointer: null };
  }
  const ready = readyMethods(snapshot);
  if (ready.length === 1) {
    const value = num(ready[0].result_ev_decimal)!;
    return {
      source: 'SINGLE_READY_METHOD',
      value,
      pointer: pointer('finance_valuation_methods', 'result_ev_decimal', ready[0].id, value, `${ready[0].method_type} enterprise value`),
    };
  }
  return { source: 'NONE', value: null, pointer: null };
}

// =============================================================================================
// 6. THE RULE CATALOGUE — declarative index (kept in sync with the generator report's rule table)
// =============================================================================================

export interface AdvisorRuleDescriptor {
  id: string;
  kind: AdvisorOutputKind;
  trigger: string;
  output: string;
}

export const ADVISOR_RULES: readonly AdvisorRuleDescriptor[] = [
  { id: 'ADV-R01', kind: 'FACT', trigger: 'primary terminal row has terminal_share_pct', output: 'Terminal value share of EV, with the terminal amount' },
  { id: 'ADV-R02', kind: 'HYPOTHESIS', trigger: `terminal_share_pct > ${ADVISOR_THRESHOLDS.terminalShareHighPct}%`, output: 'Result is driven by terminal assumptions, not the explicit forecast (HIGH above 85%)' },
  { id: 'ADV-R03', kind: 'RISK', trigger: `terminal_share_pct > ${ADVISOR_THRESHOLDS.terminalShareHighPct}%`, output: 'Terminal-value concentration risk; impact = terminal amount' },
  { id: 'ADV-R04', kind: 'ACTION', trigger: `terminal_share_pct > ${ADVISOR_THRESHOLDS.terminalShareHighPct}% and no EXIT_MULTIPLE row on that method`, output: 'Add an exit-multiple terminal cross-check' },
  { id: 'ADV-R05', kind: 'RISK', trigger: `WACC − g < ${ADVISOR_THRESHOLDS.narrowGordonSpreadPp}pp`, output: 'Narrow Gordon spread — denominator numerically fragile' },
  { id: 'ADV-R06', kind: 'RISK', trigger: `|g − reinvestment_rate × ROIC| > ${ADVISOR_THRESHOLDS.impliedGTolerancePp}pp`, output: 'Terminal g not reconciled with steady-state reinvestment × ROIC' },
  { id: 'ADV-R07', kind: 'QUESTION', trigger: 'primary Gordon row lacks reinvestment_rate_pct or roic_pct', output: 'On what steady-state reinvestment/ROIC does terminal g rest?' },
  { id: 'ADV-R08', kind: 'FACT', trigger: 'recommendation basket is complete (all members READY)', output: 'Weighted recommendation EV and each method contribution' },
  { id: 'ADV-R09', kind: 'RISK', trigger: 'basket has a member that is not READY', output: 'Recommendation basket incomplete — no weighted result exists' },
  { id: 'ADV-R10', kind: 'RISK', trigger: 'no method is in the recommendation basket', output: 'No weighted basket configured; result rests on unweighted methods' },
  { id: 'ADV-R11', kind: 'RISK', trigger: `≥2 READY methods and dispersion > ${ADVISOR_THRESHOLDS.methodDispersionPct}%`, output: `Low method agreement (HIGH above ${ADVISOR_THRESHOLDS.methodDispersionSeverePct}%)` },
  { id: 'ADV-R12', kind: 'FACT', trigger: '≥2 READY methods', output: 'Method spread: min/max EV and dispersion as % of mean' },
  { id: 'ADV-R13', kind: 'RISK', trigger: 'no TRADING_COMPS/PRECEDENT_TRANSACTIONS method, or one with 0 usable comps', output: 'No market cross-check — intrinsic value unbenchmarked' },
  { id: 'ADV-R14', kind: 'ACTION', trigger: 'same trigger as ADV-R13', output: 'Configure a trading-comps peer set (Not configured, not PLN 0)' },
  { id: 'ADV-R15', kind: 'FACT', trigger: '≥1 COMPLETE sensitivity grid with defined cells', output: 'Sensitivity band min..max and width as % of the base cell' },
  { id: 'ADV-R16', kind: 'RISK', trigger: `band width > ${ADVISOR_THRESHOLDS.sensitivityWideBandPct}% of base cell`, output: 'Wide sensitivity band — point estimate weakly determined' },
  { id: 'ADV-R17', kind: 'RISK', trigger: 'findMonotonicityViolation() returns a violation', output: 'Grid not monotonic in WACC/g — model or grid construction suspect (HIGH)' },
  { id: 'ADV-R18', kind: 'ACTION', trigger: 'no sensitivity grid at all', output: 'Run the 5×5 WACC × terminal-g grid before approval' },
  { id: 'ADV-R19', kind: 'QUESTION', trigger: '≥1 undefined cell (g ≥ WACC) in a grid', output: 'N of 25 cells undefined — is the axis range appropriate?' },
  { id: 'ADV-R20', kind: 'FACT', trigger: 'wacc_computed_pct present', output: 'WACC with cost of equity, after-tax cost of debt and target structure' },
  { id: 'ADV-R21', kind: 'RISK', trigger: 'WACC inputs row missing, or wacc_computed_pct NULL', output: 'Discount rate never computed — EV cannot be relied on' },
  { id: 'ADV-R22', kind: 'QUESTION', trigger: `|target debt% − current debt%| > ${ADVISOR_THRESHOLDS.capitalStructureDivergencePp}pp`, output: 'Is the transition to the target capital structure financeable?' },
  { id: 'ADV-R23', kind: 'RISK', trigger: 'cost_of_debt_pretax_pct < risk_free_rate_pct', output: 'Pre-tax cost of debt below the risk-free rate — inconsistent inputs' },
  { id: 'ADV-R24', kind: 'FACT', trigger: 'EV→Equity bridge exists', output: 'EV → equity with net adjustments and component count' },
  { id: 'ADV-R25', kind: 'ACTION', trigger: 'no EV→Equity bridge', output: 'Complete the EV→Equity bridge before approval' },
  { id: 'ADV-R26', kind: 'RISK', trigger: 'bridge equity value ≤ 0', output: 'Non-positive equity value after the bridge' },
  { id: 'ADV-R27', kind: 'RISK', trigger: `|Σ adjustments| / EV > ${ADVISOR_THRESHOLDS.bridgeAdjustmentDominancePct}%`, output: 'Bridge adjustments dominate the equity result' },
  { id: 'ADV-R28', kind: 'RISK', trigger: "business version freshness != 'CURRENT'", output: 'Advisor ran on a candidate not marked freshly computed' },
  { id: 'ADV-C01', kind: 'FACT', trigger: 'both variants have a headline EV', output: 'ΔEV absolute and %' },
  { id: 'ADV-C02', kind: 'FACT', trigger: 'both variants have wacc_computed_pct', output: 'ΔWACC in pp' },
  { id: 'ADV-C03', kind: 'FACT', trigger: 'both variants have a primary terminal share', output: 'Δterminal share in pp' },
  { id: 'ADV-C04', kind: 'HYPOTHESIS', trigger: `|ΔEV| > ${ADVISOR_THRESHOLDS.variantMaterialEvGapPct}% and |ΔWACC| ≥ ${ADVISOR_THRESHOLDS.variantExplanatoryWaccGapPp}pp`, output: 'The EV gap is largely a discount-rate effect' },
  { id: 'ADV-C05', kind: 'RISK', trigger: `|ΔEV| > ${ADVISOR_THRESHOLDS.variantMaterialEvGapPct}%, |ΔWACC| < ${ADVISOR_THRESHOLDS.variantExplanatoryWaccGapPp}pp, |Δterminal share| < ${ADVISOR_THRESHOLDS.variantSimilarTerminalSharePp}pp`, output: 'Material EV gap unexplained by rate or terminal profile — check operating assumptions' },
  { id: 'ADV-C06', kind: 'FACT', trigger: 'both variants have a bridged equity value', output: 'Δequity value absolute and %' },
];

// =============================================================================================
// 7. Single-variant rule evaluation — PURE (no I/O), the whole reason the generator is testable
// =============================================================================================

export function evaluateAdvisorRules(snapshot: ValuationAdvisorSnapshot): AdvisorFinding[] {
  const out: AdvisorFinding[] = [];
  const t = ADVISOR_THRESHOLDS;
  const rulesVersion = ADVISOR_RULES_VERSION;

  const ev = (
    ruleId: string,
    pointers: AdvisorEvidencePointer[],
    derived: AdvisorEvidenceRef['derived'],
    impactUnit: AdvisorEvidenceRef['impactUnit']
  ): AdvisorEvidenceRef => ({ ruleId, generator: 'RULE_ENGINE', rulesVersion, pointers, derived, impactUnit });

  // ---- Terminal block -----------------------------------------------------------------------
  const term = primaryTerminal(snapshot);
  const waccPct = snapshot.wacc ? num(snapshot.wacc.wacc_computed_pct) : null;
  const terminalShare = term ? num(term.terminal_share_pct) : null;
  const terminalValue = term ? num(term.terminal_value_decimal) : null;
  const gPct = term ? num(term.g_pct) : null;

  if (term && terminalShare !== null) {
    out.push(
      finding({
        ruleId: 'ADV-R01',
        outputKind: 'FACT',
        title: `Terminal value is ${formatPct(terminalShare)}% of enterprise value`,
        narrative:
          `The ${term.convention === 'GORDON_GROWTH' ? 'Gordon-growth' : 'exit-multiple'} terminal value of the ` +
          `${term.method_type} method contributes ${formatPct(terminalShare)}% of the discounted enterprise value` +
          (terminalValue !== null ? ` (terminal amount ${formatAmount(terminalValue)}).` : '.'),
        evidenceRef: ev(
          'ADV-R01',
          [
            pointer('finance_valuation_terminal', 'terminal_share_pct', term.id, terminalShare, 'Terminal share of EV'),
            ...(terminalValue !== null ? [pointer('finance_valuation_terminal', 'terminal_value_decimal', term.id, terminalValue, 'Terminal value')] : []),
          ],
          { convention: term.convention, methodType: term.method_type },
          'PCT'
        ),
        driverRef: 'TERMINAL_VALUE',
        impactDecimal: terminalShare,
        confidence: 'HIGH',
      })
    );

    if (terminalShare > t.terminalShareHighPct) {
      const severe = terminalShare > t.terminalShareVeryHighPct;
      out.push(
        finding({
          ruleId: 'ADV-R02',
          outputKind: 'HYPOTHESIS',
          title: 'The valuation is driven by terminal assumptions rather than the explicit forecast',
          narrative:
            `With ${formatPct(terminalShare)}% of enterprise value sitting beyond the explicit projection horizon ` +
            `(threshold ${t.terminalShareHighPct}%), the result is more a statement about steady-state growth and ` +
            `margins than about the forecast years themselves. Changes to the explicit period will move EV far less ` +
            `than a change to terminal g or the exit multiple.`,
          evidenceRef: ev(
            'ADV-R02',
            [pointer('finance_valuation_terminal', 'terminal_share_pct', term.id, terminalShare, 'Terminal share of EV')],
            { thresholdPct: t.terminalShareHighPct, severeThresholdPct: t.terminalShareVeryHighPct },
            'PCT'
          ),
          driverRef: 'TERMINAL_VALUE',
          impactDecimal: terminalShare - t.terminalShareHighPct,
          confidence: severe ? 'HIGH' : 'MEDIUM',
        })
      );
      out.push(
        finding({
          ruleId: 'ADV-R03',
          outputKind: 'RISK',
          title: 'Terminal-value concentration',
          narrative:
            `${formatPct(terminalShare)}% of EV is terminal value. A one-notch change in terminal assumptions ` +
            `re-prices the majority of the valuation, so the usual comfort taken from a detailed forecast does not apply here.`,
          evidenceRef: ev(
            'ADV-R03',
            [
              pointer('finance_valuation_terminal', 'terminal_share_pct', term.id, terminalShare, 'Terminal share of EV'),
              ...(terminalValue !== null ? [pointer('finance_valuation_terminal', 'terminal_value_decimal', term.id, terminalValue, 'Terminal value at risk')] : []),
            ],
            { thresholdPct: t.terminalShareHighPct },
            'CURRENCY'
          ),
          driverRef: 'TERMINAL_VALUE',
          impactDecimal: terminalValue,
          confidence: severe ? 'HIGH' : 'MEDIUM',
        })
      );

      const hasExitMultiple = snapshot.terminal.some((row) => row.method_id === term.method_id && row.convention === 'EXIT_MULTIPLE');
      if (!hasExitMultiple) {
        out.push(
          finding({
            ruleId: 'ADV-R04',
            outputKind: 'ACTION',
            title: 'Add an exit-multiple terminal cross-check',
            narrative:
              `The ${term.method_type} method carries a terminal share of ${formatPct(terminalShare)}% with only a ` +
              `${term.convention} terminal row. Adding an EXIT_MULTIPLE row on the same method turns the dominant ` +
              `assumption into something two independent conventions have to agree on.`,
            evidenceRef: ev(
              'ADV-R04',
              [pointer('finance_valuation_terminal', 'convention', term.id, term.convention, 'Only terminal convention present on this method')],
              { methodId: term.method_id, methodType: term.method_type, terminalSharePct: terminalShare },
              null
            ),
            driverRef: 'TERMINAL_VALUE',
            impactDecimal: null,
            confidence: 'MEDIUM',
          })
        );
      }
    }
  }

  if (term && gPct !== null && waccPct !== null) {
    const spread = waccPct - gPct;
    if (spread < t.narrowGordonSpreadPp) {
      out.push(
        finding({
          ruleId: 'ADV-R05',
          outputKind: 'RISK',
          title: `Narrow terminal spread: WACC − g = ${formatPct(spread)}pp`,
          narrative:
            `The Gordon denominator is (WACC − g) = ${formatPct(waccPct)}% − ${formatPct(gPct)}% = ${formatPct(spread)}pp, ` +
            `below the ${t.narrowGordonSpreadPp}pp guardrail. At this spread the terminal value is hypersensitive: a ` +
            `0.5pp move in either input changes it disproportionately, which is a property of the formula, not of the business.`,
          evidenceRef: ev(
            'ADV-R05',
            [
              pointer('finance_valuation_terminal', 'g_pct', term.id, gPct, 'Terminal growth g'),
              ...(snapshot.wacc ? [pointer('finance_valuation_wacc_inputs', 'wacc_computed_pct', snapshot.wacc.id, waccPct, 'Computed WACC')] : []),
            ],
            { spreadPp: spread, thresholdPp: t.narrowGordonSpreadPp },
            'PP'
          ),
          driverRef: 'TERMINAL_SPREAD',
          impactDecimal: spread,
          confidence: 'HIGH',
        })
      );
    }
  }

  if (term && term.convention === 'GORDON_GROWTH') {
    const reinvest = num(term.reinvestment_rate_pct);
    const roic = num(term.roic_pct);
    if (reinvest !== null && roic !== null && gPct !== null) {
      const impliedG = (reinvest * roic) / 100;
      const gap = gPct - impliedG;
      if (Math.abs(gap) > t.impliedGTolerancePp) {
        out.push(
          finding({
            ruleId: 'ADV-R06',
            outputKind: 'RISK',
            title: `Terminal g is not reconciled with reinvestment × ROIC (${formatPct(gap)}pp gap)`,
            narrative:
              `Steady state requires g = reinvestment rate × ROIC. The recorded inputs imply ` +
              `${formatPct(reinvest)}% × ${formatPct(roic)}% = ${formatPct(impliedG)}%, but terminal g is ` +
              `${formatPct(gPct)}% — a ${formatPct(gap)}pp gap. Either the growth is not self-funded or the ` +
              `reinvestment/ROIC pair is stale.`,
            evidenceRef: ev(
              'ADV-R06',
              [
                pointer('finance_valuation_terminal', 'g_pct', term.id, gPct, 'Terminal growth g'),
                pointer('finance_valuation_terminal', 'reinvestment_rate_pct', term.id, reinvest, 'Steady-state reinvestment rate'),
                pointer('finance_valuation_terminal', 'roic_pct', term.id, roic, 'Steady-state ROIC'),
              ],
              { impliedGPct: impliedG, gapPp: gap, tolerancePp: t.impliedGTolerancePp },
              'PP'
            ),
            driverRef: 'TERMINAL_GROWTH',
            impactDecimal: gap,
            confidence: 'HIGH',
          })
        );
      }
    } else if (gPct !== null) {
      out.push(
        finding({
          ruleId: 'ADV-R07',
          outputKind: 'QUESTION',
          title: `What steady-state reinvestment and ROIC support terminal g = ${formatPct(gPct)}%?`,
          narrative:
            `The primary Gordon row records g = ${formatPct(gPct)}% but leaves ` +
            `${reinvest === null ? 'reinvestment_rate_pct' : 'roic_pct'}` +
            `${reinvest === null && roic === null ? ' and roic_pct' : ''} empty, so g = reinvestment × ROIC cannot be ` +
            `checked. Recording both makes the growth assumption falsifiable instead of asserted.`,
          evidenceRef: ev(
            'ADV-R07',
            [
              pointer('finance_valuation_terminal', 'g_pct', term.id, gPct, 'Terminal growth g'),
              pointer('finance_valuation_terminal', 'reinvestment_rate_pct', term.id, reinvest, 'Steady-state reinvestment rate (missing)'),
              pointer('finance_valuation_terminal', 'roic_pct', term.id, roic, 'Steady-state ROIC (missing)'),
            ],
            { reinvestmentPresent: reinvest !== null, roicPresent: roic !== null },
            null
          ),
          driverRef: 'TERMINAL_GROWTH',
          impactDecimal: null,
          confidence: 'MEDIUM',
        })
      );
    }
  }

  // ---- Methods block ------------------------------------------------------------------------
  const basket = computeWeightedRecommendation(snapshot.methods);
  if (basket.status === 'READY') {
    out.push(
      finding({
        ruleId: 'ADV-R08',
        outputKind: 'FACT',
        title: `Weighted recommendation: enterprise value ${formatAmount(basket.weightedEnterpriseValue)}`,
        narrative:
          `The recommendation basket is complete. ` +
          basket.contributions
            .map((c) => `${c.methodType} at ${formatPct(c.weightPct, 1)}% weight contributes ${formatAmount(c.contribution)}`)
            .join('; ') +
          `. Weighted enterprise value = ${formatAmount(basket.weightedEnterpriseValue)}.`,
        evidenceRef: ev(
          'ADV-R08',
          basket.contributions.map((c) => {
            const row = snapshot.methods.find((m) => m.method_type === c.methodType)!;
            return pointer('finance_valuation_methods', 'result_ev_decimal', row.id, c.resultEvDecimal, `${c.methodType} enterprise value`);
          }),
          { weightedEnterpriseValue: basket.weightedEnterpriseValue, basketSize: basket.contributions.length },
          'CURRENCY'
        ),
        driverRef: 'RECOMMENDATION_BASKET',
        impactDecimal: basket.weightedEnterpriseValue,
        confidence: 'HIGH',
      })
    );
  } else if (basket.status === 'INCOMPLETE') {
    out.push(
      finding({
        ruleId: 'ADV-R09',
        outputKind: 'RISK',
        title: 'Recommendation basket is incomplete',
        narrative:
          `Basket member(s) ${basket.notReadyMethodTypes.join(', ')} are not READY, so no weighted recommendation ` +
          `exists. The system deliberately does NOT drop them and re-normalise the remaining weights — that would be ` +
          `a different weighting scheme nobody approved.`,
        evidenceRef: ev(
          'ADV-R09',
          basket.notReadyMethodTypes.map((mt) => {
            const row = snapshot.methods.find((m) => m.method_type === mt)!;
            return pointer('finance_valuation_methods', 'readiness', row.id, row.readiness, `${mt} readiness`);
          }),
          { notReadyMethodTypes: basket.notReadyMethodTypes.join(',') },
          'COUNT'
        ),
        driverRef: 'RECOMMENDATION_BASKET',
        impactDecimal: basket.notReadyMethodTypes.length,
        confidence: 'HIGH',
      })
    );
  } else {
    out.push(
      finding({
        ruleId: 'ADV-R10',
        outputKind: 'RISK',
        title: 'No recommendation basket configured',
        narrative:
          `No method is flagged is_in_recommendation_basket, so there is no weighted recommendation — only ` +
          `individual, unweighted method results. Any headline number quoted from here is one method's opinion.`,
        evidenceRef: ev('ADV-R10', [], { methodCount: snapshot.methods.length }, 'COUNT'),
        driverRef: 'RECOMMENDATION_BASKET',
        impactDecimal: snapshot.methods.length,
        confidence: 'HIGH',
      })
    );
  }

  const ready = readyMethods(snapshot);
  if (ready.length >= 2) {
    const values = ready.map((m) => ({ row: m, value: num(m.result_ev_decimal)! }));
    const sorted = [...values].sort((a, b) => a.value - b.value);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = values.reduce((s, v) => s + v.value, 0) / values.length;
    const dispersionPct = mean === 0 ? 0 : ((max.value - min.value) / Math.abs(mean)) * 100;

    out.push(
      finding({
        ruleId: 'ADV-R12',
        outputKind: 'FACT',
        title: `Method spread: ${formatPct(dispersionPct, 1)}% across ${values.length} ready methods`,
        narrative:
          `${min.row.method_type} gives ${formatAmount(min.value)} and ${max.row.method_type} gives ` +
          `${formatAmount(max.value)}; the range is ${formatPct(dispersionPct, 1)}% of the ${formatAmount(mean)} mean.`,
        evidenceRef: ev(
          'ADV-R12',
          values.map((v) => pointer('finance_valuation_methods', 'result_ev_decimal', v.row.id, v.value, `${v.row.method_type} enterprise value`)),
          { minValue: min.value, maxValue: max.value, meanValue: mean, dispersionPct },
          'PCT'
        ),
        driverRef: 'METHOD_DISPERSION',
        impactDecimal: dispersionPct,
        confidence: 'HIGH',
      })
    );

    if (dispersionPct > t.methodDispersionPct) {
      out.push(
        finding({
          ruleId: 'ADV-R11',
          outputKind: 'RISK',
          title: `Low method agreement (${formatPct(dispersionPct, 1)}% dispersion)`,
          narrative:
            `Methods disagree by ${formatPct(dispersionPct, 1)}% of their mean, above the ${t.methodDispersionPct}% ` +
            `guardrail (${min.row.method_type} ${formatAmount(min.value)} vs ${max.row.method_type} ${formatAmount(max.value)}). ` +
            `A weighted average across methods that disagree this much reports a number no single method supports; the ` +
            `disagreement itself is the finding to explain before approval.`,
          evidenceRef: ev(
            'ADV-R11',
            [
              pointer('finance_valuation_methods', 'result_ev_decimal', min.row.id, min.value, `${min.row.method_type} (low)`),
              pointer('finance_valuation_methods', 'result_ev_decimal', max.row.id, max.value, `${max.row.method_type} (high)`),
            ],
            { dispersionPct, thresholdPct: t.methodDispersionPct, absoluteGap: max.value - min.value },
            'PCT'
          ),
          driverRef: 'METHOD_DISPERSION',
          impactDecimal: dispersionPct,
          confidence: dispersionPct > t.methodDispersionSeverePct ? 'HIGH' : 'MEDIUM',
        })
      );
    }
  }

  const marketMethods = snapshot.methods.filter((m) => m.method_type === 'TRADING_COMPS' || m.method_type === 'PRECEDENT_TRANSACTIONS');
  const marketWithComps = marketMethods.filter((m) => (snapshot.usableCompsByMethodId[m.id] ?? 0) > 0);
  if (marketWithComps.length === 0) {
    const reason = marketMethods.length === 0 ? 'no market method exists on this variant' : 'the market method has no usable peer rows';
    out.push(
      finding({
        ruleId: 'ADV-R13',
        outputKind: 'RISK',
        title: 'No market cross-check — the intrinsic result is unbenchmarked',
        narrative:
          `Trading comparables / precedent transactions are not contributing: ${reason}. The valuation therefore rests ` +
          `entirely on discounted-cash-flow assumptions with nothing external to contradict them. Note this is "Not ` +
          `configured", which is NOT the same as a market value of zero.`,
        evidenceRef: ev(
          'ADV-R13',
          marketMethods.map((m) => pointer('finance_valuation_methods', 'readiness', m.id, m.readiness, `${m.method_type} readiness`)),
          { marketMethodCount: marketMethods.length, usableCompsTotal: marketMethods.reduce((s, m) => s + (snapshot.usableCompsByMethodId[m.id] ?? 0), 0) },
          'COUNT'
        ),
        driverRef: 'COMPS',
        impactDecimal: marketMethods.length,
        confidence: 'HIGH',
      })
    );
    out.push(
      finding({
        ruleId: 'ADV-R14',
        outputKind: 'ACTION',
        title: 'Configure a trading-comps peer set',
        narrative:
          `Add peers to a TRADING_COMPS method (or record explicitly why no comparable set exists for this asset). ` +
          `Even an unweighted cross-check materially raises the defensibility of the DCF result at review.`,
        evidenceRef: ev('ADV-R14', [], { marketMethodCount: marketMethods.length }, null),
        driverRef: 'COMPS',
        impactDecimal: null,
        confidence: 'MEDIUM',
      })
    );
  }

  // ---- Sensitivity block --------------------------------------------------------------------
  const completeGrids = snapshot.grids.filter((g) => g.grid_status === 'COMPLETE');
  if (completeGrids.length === 0) {
    out.push(
      finding({
        ruleId: 'ADV-R18',
        outputKind: 'ACTION',
        title: 'Run the 5×5 WACC × terminal-g sensitivity before approval',
        narrative:
          `No COMPLETE sensitivity grid exists for this variant, so the point estimate is presented without any ` +
          `statement of how wide the plausible band is. The 5×5 grid is the cheapest evidence that the number survives ` +
          `its own assumptions.`,
        evidenceRef: ev('ADV-R18', [], { gridCount: snapshot.grids.length }, 'COUNT'),
        driverRef: 'SENSITIVITY',
        impactDecimal: snapshot.grids.length,
        confidence: 'HIGH',
      })
    );
  }

  for (const grid of completeGrids) {
    const cellValues: SensitivityCellValue[] = grid.cells.map((c) => ({
      rowIndex: c.row_index,
      colIndex: c.col_index,
      rowAxisValue: num(c.row_axis_value) ?? 0,
      columnAxisValue: num(c.column_axis_value) ?? 0,
      cellValueDecimal: num(c.cell_value_decimal),
      isBaseCell: c.is_base_cell,
    }));
    const defined = grid.cells.filter((c) => num(c.cell_value_decimal) !== null);
    const undefinedCount = grid.cells.length - defined.length;
    const baseCell = grid.cells.find((c) => c.is_base_cell) ?? null;
    const baseValue = baseCell ? num(baseCell.cell_value_decimal) : null;

    if (defined.length >= 2) {
      const sortedCells = [...defined].sort((a, b) => num(a.cell_value_decimal)! - num(b.cell_value_decimal)!);
      const lo = sortedCells[0];
      const hi = sortedCells[sortedCells.length - 1];
      const loV = num(lo.cell_value_decimal)!;
      const hiV = num(hi.cell_value_decimal)!;
      const bandPctOfBase = baseValue !== null && baseValue !== 0 ? ((hiV - loV) / Math.abs(baseValue)) * 100 : null;

      out.push(
        finding({
          ruleId: 'ADV-R15',
          outputKind: 'FACT',
          title: `Sensitivity band on "${grid.grid_label}": ${formatAmount(loV)} … ${formatAmount(hiV)}`,
          narrative:
            `Across ${defined.length} defined cells of the ${grid.row_axis_variable} × ${grid.column_axis_variable} grid, ` +
            `enterprise value ranges from ${formatAmount(loV)} to ${formatAmount(hiV)}` +
            (bandPctOfBase !== null ? `, i.e. ${formatPct(bandPctOfBase, 1)}% of the ${formatAmount(baseValue!)} base cell.` : '.'),
          evidenceRef: ev(
            'ADV-R15',
            [
              pointer('finance_valuation_sensitivity_cells', 'cell_value_decimal', lo.id, loV, 'Lowest defined cell'),
              pointer('finance_valuation_sensitivity_cells', 'cell_value_decimal', hi.id, hiV, 'Highest defined cell'),
              ...(baseCell && baseValue !== null ? [pointer('finance_valuation_sensitivity_cells', 'cell_value_decimal', baseCell.id, baseValue, 'Base cell')] : []),
            ],
            { gridId: grid.id, definedCells: defined.length, bandPctOfBase, minValue: loV, maxValue: hiV },
            bandPctOfBase !== null ? 'PCT' : 'CURRENCY'
          ),
          driverRef: 'SENSITIVITY',
          impactDecimal: bandPctOfBase ?? hiV - loV,
          confidence: 'HIGH',
        })
      );

      if (bandPctOfBase !== null && bandPctOfBase > t.sensitivityWideBandPct) {
        out.push(
          finding({
            ruleId: 'ADV-R16',
            outputKind: 'RISK',
            title: `Wide sensitivity band (${formatPct(bandPctOfBase, 1)}% of base)`,
            narrative:
              `The grid spans ${formatPct(bandPctOfBase, 1)}% of the base cell, above the ${t.sensitivityWideBandPct}% ` +
              `guardrail. Presenting a single point estimate from a band this wide overstates precision; the honest ` +
              `output is a range with the base case named inside it.`,
            evidenceRef: ev(
              'ADV-R16',
              [
                pointer('finance_valuation_sensitivity_cells', 'cell_value_decimal', lo.id, loV, 'Lowest defined cell'),
                pointer('finance_valuation_sensitivity_cells', 'cell_value_decimal', hi.id, hiV, 'Highest defined cell'),
              ],
              { bandPctOfBase, thresholdPct: t.sensitivityWideBandPct },
              'PCT'
            ),
            driverRef: 'SENSITIVITY',
            impactDecimal: bandPctOfBase,
            confidence: 'MEDIUM',
          })
        );
      }
    }

    const violation = findMonotonicityViolation(cellValues);
    if (violation) {
      out.push(
        finding({
          ruleId: 'ADV-R17',
          outputKind: 'RISK',
          title: 'Sensitivity grid is not monotonic in WACC / terminal g',
          narrative:
            `Enterprise value must fall as WACC rises and rise as terminal g rises. The grid "${grid.grid_label}" ` +
            `breaks that: ${violation}. Either the grid was assembled from mismatched runs or the underlying model is ` +
            `misbehaving — in both cases the grid cannot be shown to a client as-is.`,
          evidenceRef: ev(
            'ADV-R17',
            [pointer('finance_valuation_sensitivity_grids', 'grid_status', grid.id, grid.grid_status, 'Grid marked COMPLETE')],
            { gridId: grid.id, violation },
            null
          ),
          driverRef: 'SENSITIVITY',
          impactDecimal: null,
          confidence: 'HIGH',
        })
      );
    }

    if (undefinedCount > 0) {
      out.push(
        finding({
          ruleId: 'ADV-R19',
          outputKind: 'QUESTION',
          title: `${undefinedCount} of ${grid.cells.length} sensitivity cells are undefined — is the axis range right?`,
          narrative:
            `${undefinedCount} cells of "${grid.grid_label}" have no value because terminal g reaches or exceeds WACC ` +
            `there, which makes the Gordon formula undefined. That is correct behaviour, but it means part of the grid ` +
            `carries no information — is the axis range still the one you want to show?`,
          evidenceRef: ev(
            'ADV-R19',
            [pointer('finance_valuation_sensitivity_grids', 'grid_label', grid.id, grid.grid_label, 'Grid with undefined cells')],
            { undefinedCount, totalCells: grid.cells.length },
            'COUNT'
          ),
          driverRef: 'SENSITIVITY',
          impactDecimal: undefinedCount,
          confidence: 'MEDIUM',
        })
      );
    }
  }

  // ---- WACC block ---------------------------------------------------------------------------
  if (snapshot.wacc && waccPct !== null) {
    const betaRelevered = num(snapshot.wacc.beta_relevered);
    const riskFree = num(snapshot.wacc.risk_free_rate_pct);
    const erp = num(snapshot.wacc.equity_risk_premium_pct);
    const costOfDebt = num(snapshot.wacc.cost_of_debt_pretax_pct);
    const taxRate = num(snapshot.wacc.cash_tax_rate_pct);
    const targetDebt = num(snapshot.wacc.target_capital_structure_debt_pct);
    const targetEquity = num(snapshot.wacc.target_capital_structure_equity_pct);
    const currentDebt = num(snapshot.wacc.current_capital_structure_debt_pct);
    const costOfEquity = riskFree !== null && erp !== null && betaRelevered !== null ? riskFree + betaRelevered * erp : null;
    const costOfDebtAfterTax = costOfDebt !== null && taxRate !== null ? costOfDebt * (1 - taxRate / 100) : null;

    out.push(
      finding({
        ruleId: 'ADV-R20',
        outputKind: 'FACT',
        title: `WACC = ${formatPct(waccPct)}%`,
        narrative:
          `Discount rate ${formatPct(waccPct)}%` +
          (costOfEquity !== null ? `, built from a cost of equity of ${formatPct(costOfEquity)}% (risk-free ${formatPct(riskFree!)}% + relevered beta ${formatPct(betaRelevered!, 3)} × ERP ${formatPct(erp!)}%)` : '') +
          (costOfDebtAfterTax !== null ? ` and an after-tax cost of debt of ${formatPct(costOfDebtAfterTax)}%` : '') +
          (targetDebt !== null && targetEquity !== null ? `, weighted at ${formatPct(targetDebt, 1)}% debt / ${formatPct(targetEquity, 1)}% equity (target structure)` : '') +
          `.`,
        evidenceRef: ev(
          'ADV-R20',
          [
            pointer('finance_valuation_wacc_inputs', 'wacc_computed_pct', snapshot.wacc.id, waccPct, 'Computed WACC'),
            ...(betaRelevered !== null ? [pointer('finance_valuation_wacc_inputs', 'beta_relevered', snapshot.wacc.id, betaRelevered, 'Relevered beta')] : []),
            ...(costOfDebt !== null ? [pointer('finance_valuation_wacc_inputs', 'cost_of_debt_pretax_pct', snapshot.wacc.id, costOfDebt, 'Pre-tax cost of debt')] : []),
          ],
          { costOfEquityPct: costOfEquity, costOfDebtAfterTaxPct: costOfDebtAfterTax },
          'PCT'
        ),
        driverRef: 'WACC',
        impactDecimal: waccPct,
        confidence: 'HIGH',
      })
    );

    if (targetDebt !== null && currentDebt !== null && Math.abs(targetDebt - currentDebt) > t.capitalStructureDivergencePp) {
      out.push(
        finding({
          ruleId: 'ADV-R22',
          outputKind: 'QUESTION',
          title: `Target capital structure differs from current by ${formatPct(Math.abs(targetDebt - currentDebt), 1)}pp`,
          narrative:
            `WACC is weighted on a target structure of ${formatPct(targetDebt, 1)}% debt while the company currently ` +
            `runs at ${formatPct(currentDebt, 1)}%. Is that transition financeable over the forecast, and does the ` +
            `forecast contain the interest cost of getting there?`,
          evidenceRef: ev(
            'ADV-R22',
            [
              pointer('finance_valuation_wacc_inputs', 'target_capital_structure_debt_pct', snapshot.wacc.id, targetDebt, 'Target debt weight'),
              pointer('finance_valuation_wacc_inputs', 'current_capital_structure_debt_pct', snapshot.wacc.id, currentDebt, 'Current debt weight'),
            ],
            { divergencePp: targetDebt - currentDebt, thresholdPp: t.capitalStructureDivergencePp },
            'PP'
          ),
          driverRef: 'WACC',
          impactDecimal: targetDebt - currentDebt,
          confidence: 'MEDIUM',
        })
      );
    }

    if (costOfDebt !== null && riskFree !== null && costOfDebt < riskFree) {
      out.push(
        finding({
          ruleId: 'ADV-R23',
          outputKind: 'RISK',
          title: 'Pre-tax cost of debt is below the risk-free rate',
          narrative:
            `Cost of debt ${formatPct(costOfDebt)}% is below the risk-free rate ${formatPct(riskFree)}%, which implies a ` +
            `negative credit spread. Unless this is a subsidised facility that has been documented as such, one of the ` +
            `two inputs is wrong and the whole WACC inherits the error.`,
          evidenceRef: ev(
            'ADV-R23',
            [
              pointer('finance_valuation_wacc_inputs', 'cost_of_debt_pretax_pct', snapshot.wacc.id, costOfDebt, 'Pre-tax cost of debt'),
              pointer('finance_valuation_wacc_inputs', 'risk_free_rate_pct', snapshot.wacc.id, riskFree, 'Risk-free rate'),
            ],
            { impliedSpreadPp: costOfDebt - riskFree },
            'PP'
          ),
          driverRef: 'WACC',
          impactDecimal: costOfDebt - riskFree,
          confidence: 'HIGH',
        })
      );
    }
  } else {
    out.push(
      finding({
        ruleId: 'ADV-R21',
        outputKind: 'RISK',
        title: 'Discount rate has never been computed',
        narrative:
          snapshot.wacc === null
            ? `There is no finance_valuation_wacc_inputs row for this variant at all, so no discount rate exists and any enterprise value shown cannot be relied on.`
            : `finance_valuation_wacc_inputs.wacc_computed_pct is NULL — the inputs exist but WACC was never computed from them (deliberately NULL rather than a silent zero).`,
        evidenceRef: ev(
          'ADV-R21',
          snapshot.wacc ? [pointer('finance_valuation_wacc_inputs', 'wacc_computed_pct', snapshot.wacc.id, null, 'Computed WACC (NULL)')] : [],
          { waccInputsRowPresent: snapshot.wacc !== null },
          null
        ),
        driverRef: 'WACC',
        impactDecimal: null,
        confidence: 'HIGH',
      })
    );
  }

  // ---- EV → Equity bridge block ---------------------------------------------------------------
  if (snapshot.bridge) {
    const bridgeEv = num(snapshot.bridge.header.enterprise_value_decimal);
    const equity = num(snapshot.bridge.header.equity_value_decimal);
    const netAdjustments = snapshot.bridge.components.reduce(
      (sum, c) => sum + (c.sign === 'SUBTRACT_FROM_EV' ? -1 : 1) * (num(c.amount_decimal) ?? 0),
      0
    );

    out.push(
      finding({
        ruleId: 'ADV-R24',
        outputKind: 'FACT',
        title: `EV ${bridgeEv !== null ? formatAmount(bridgeEv) : 'n/a'} → equity ${equity !== null ? formatAmount(equity) : 'n/a'}`,
        narrative:
          `The bridge as of ${snapshot.bridge.header.as_of_date} applies ${snapshot.bridge.components.length} ` +
          `component(s) worth ${formatAmount(netAdjustments)} net` +
          (bridgeEv !== null && equity !== null ? `, taking enterprise value ${formatAmount(bridgeEv)} to equity value ${formatAmount(equity)}.` : '.'),
        evidenceRef: ev(
          'ADV-R24',
          [
            ...(bridgeEv !== null ? [pointer('finance_valuation_ev_equity_bridge', 'enterprise_value_decimal', snapshot.bridge.header.id, bridgeEv, 'Bridge enterprise value')] : []),
            ...(equity !== null ? [pointer('finance_valuation_ev_equity_bridge', 'equity_value_decimal', snapshot.bridge.header.id, equity, 'Bridge equity value')] : []),
          ],
          { netAdjustments, componentCount: snapshot.bridge.components.length, asOfDate: snapshot.bridge.header.as_of_date },
          'CURRENCY'
        ),
        driverRef: 'EV_EQUITY_BRIDGE',
        impactDecimal: netAdjustments,
        confidence: 'HIGH',
      })
    );

    if (equity !== null && equity <= 0) {
      out.push(
        finding({
          ruleId: 'ADV-R26',
          outputKind: 'RISK',
          title: 'Equity value is not positive after the bridge',
          narrative:
            `The bridge lands at an equity value of ${formatAmount(equity)}. Debt-like items exceed enterprise value, ` +
            `which is a solvency statement, not a valuation nuance — it must be named explicitly rather than shown as a small number.`,
          evidenceRef: ev(
            'ADV-R26',
            [pointer('finance_valuation_ev_equity_bridge', 'equity_value_decimal', snapshot.bridge.header.id, equity, 'Bridge equity value')],
            { enterpriseValue: bridgeEv },
            'CURRENCY'
          ),
          driverRef: 'EV_EQUITY_BRIDGE',
          impactDecimal: equity,
          confidence: 'HIGH',
        })
      );
    }

    if (bridgeEv !== null && bridgeEv !== 0) {
      const dominancePct = (Math.abs(netAdjustments) / Math.abs(bridgeEv)) * 100;
      if (dominancePct > t.bridgeAdjustmentDominancePct) {
        out.push(
          finding({
            ruleId: 'ADV-R27',
            outputKind: 'RISK',
            title: `Bridge adjustments are ${formatPct(dominancePct, 1)}% of enterprise value`,
            narrative:
              `Net bridge adjustments of ${formatAmount(netAdjustments)} amount to ${formatPct(dominancePct, 1)}% of the ` +
              `${formatAmount(bridgeEv)} enterprise value, above the ${t.bridgeAdjustmentDominancePct}% guardrail. Equity ` +
              `value is then mostly a balance-sheet statement, and each debt-like item deserves the same scrutiny as the DCF itself.`,
            evidenceRef: ev(
              'ADV-R27',
              [pointer('finance_valuation_ev_equity_bridge', 'enterprise_value_decimal', snapshot.bridge.header.id, bridgeEv, 'Bridge enterprise value')],
              { netAdjustments, dominancePct, thresholdPct: t.bridgeAdjustmentDominancePct },
              'PCT'
            ),
            driverRef: 'EV_EQUITY_BRIDGE',
            impactDecimal: dominancePct,
            confidence: 'MEDIUM',
          })
        );
      }
    }
  } else {
    out.push(
      finding({
        ruleId: 'ADV-R25',
        outputKind: 'ACTION',
        title: 'Complete the EV→Equity bridge before approval',
        narrative:
          `No EV→Equity bridge exists, so the variant can only speak about enterprise value. Debt, leases, pensions, ` +
          `minorities, excess cash and dilution all still stand between this number and what a shareholder receives.`,
        evidenceRef: ev('ADV-R25', [], { bridgePresent: false }, null),
        driverRef: 'EV_EQUITY_BRIDGE',
        impactDecimal: null,
        confidence: 'HIGH',
      })
    );
  }

  // ---- Freshness -------------------------------------------------------------------------------
  if (snapshot.freshness !== 'CURRENT') {
    out.push(
      finding({
        ruleId: 'ADV-R28',
        outputKind: 'RISK',
        title: `Advisor ran against a candidate whose freshness is ${snapshot.freshness}`,
        narrative:
          `The Advisor is defined to run on a freshly computed candidate, but this business version is marked ` +
          `${snapshot.freshness}. The findings below describe the numbers currently stored; if a recompute is pending, ` +
          `they will be marked stale automatically when the compute snapshot changes.`,
        evidenceRef: ev(
          'ADV-R28',
          [pointer('finance_business_versions', 'freshness', snapshot.businessVersionId, snapshot.freshness, 'Business version freshness')],
          { freshness: snapshot.freshness },
          null
        ),
        driverRef: 'FRESHNESS',
        impactDecimal: null,
        confidence: 'HIGH',
      })
    );
  }

  return out;
}

// =============================================================================================
// 8. Evidence grounding — the rule engine's honest answer to `ai_hallucination_eval_status`
// =============================================================================================

/**
 * Re-reads every evidence pointer straight from the database and compares it with the value the
 * finding claims to have observed. For a rule engine this covers the ENTIRE hallucination surface:
 * there is no free-text generation, every sentence is assembled from pointer/derived values, so a
 * finding can only be wrong by pointing at a cell that does not exist or by quoting a value the
 * cell does not hold. `PASSED` means every pointer resolved and agreed; `FLAGGED` means at least
 * one did not (unresolvable table/column/row, or a value mismatch).
 *
 * Deliberately NOT hardcoded to `PASSED`: a rule that emits a bogus pointer must be caught by this
 * check, otherwise the column would be decoration.
 */
export async function evaluateEvidenceGrounding(
  findings: readonly AdvisorFinding[]
): Promise<AdvisorHallucinationEvalStatus[]> {
  return withPinnedPostgresTransaction(async (tx) => {
    const statuses: AdvisorHallucinationEvalStatus[] = [];
    for (const f of findings) {
      let ok = true;
      for (const p of f.evidenceRef.pointers) {
        if (p.rowId === null) continue; // structural pointer (e.g. "this column is NULL") — nothing to re-read
        const allowedColumns = EVIDENCE_COLUMN_ALLOWLIST[p.table];
        if (!allowedColumns || !allowedColumns.includes(p.column)) {
          ok = false;
          break;
        }
        const pk = EVIDENCE_PK_COLUMN[p.table] ?? 'id';
        // Both identifiers are validated against the literal allow-list above before interpolation.
        const row = await tx.queryOne<{ v: string | null }>(
          `SELECT ${p.column} AS v FROM ${p.table} WHERE ${pk} = ?`,
          [p.rowId]
        );
        if (!row) {
          ok = false;
          break;
        }
        if (p.observedValue === null) {
          if (row.v !== null) ok = false;
        } else if (typeof p.observedValue === 'number') {
          const actual = num(row.v);
          if (actual === null || Math.abs(actual - p.observedValue) > 1e-9 * Math.max(1, Math.abs(p.observedValue))) ok = false;
        } else if (String(row.v) !== p.observedValue) {
          ok = false;
        }
        if (!ok) break;
      }
      statuses.push(ok ? 'PASSED' : 'FLAGGED');
    }
    return statuses;
  });
}

function evidenceDigest(f: AdvisorFinding): string {
  return (
    'sha256:' +
    createHash('sha256')
      .update(JSON.stringify({ ruleId: f.ruleId, title: f.title, narrative: f.narrative, evidenceRef: f.evidenceRef }))
      .digest('hex')
  );
}

// =============================================================================================
// 9. generateValuationAdvisorOutput — the public entry point
// =============================================================================================

export type GenerateAdvisorErrorCode =
  | 'VARIANT_NOT_FOUND'
  | 'ORGANIZATION_MISMATCH'
  | 'NOT_A_VALUATION_CASE'
  | 'INVALID_STATUS'
  | 'NOTHING_COMPUTED'
  | 'SNAPSHOT_FAILED';

export interface GenerateValuationAdvisorOutputParams {
  /** `finance_valuation_variants.business_version_id` — the VALUATION_CASE business version being advised on. */
  variantId: string;
  actorId: string;
  /** Optional tenant assertion. When given it must match the row's own organization_id. */
  organizationId?: string;
  /** Default true. `false` runs the rules and returns findings without touching the database. */
  persist?: boolean;
}

export type GenerateValuationAdvisorOutputResult =
  | {
      ok: true;
      organizationId: string;
      variantId: string;
      computeSnapshotId: string | null;
      snapshot: ValuationAdvisorSnapshot;
      findings: PersistedAdvisorFinding[];
      countsByKind: Record<AdvisorOutputKind, number>;
    }
  | { ok: false; code: GenerateAdvisorErrorCode; message: string; currentStatus?: string };

const ADVISOR_FORBIDDEN_STATUSES = ['APPROVED', 'SUPERSEDED', 'ARCHIVED', 'INVALIDATED'];

/**
 * Runs the rule catalogue against a freshly computed, still-unapproved valuation variant and
 * persists the findings as `finance_valuation_advisor_outputs` rows anchored to a PRE-APPROVAL
 * `finance_compute_snapshots` row obtained from `artifactVersionService.createComputeSnapshot()`
 * (IF-19). Writes nothing outside `finance_valuation_advisor_outputs` — no valuation number, no
 * status, no approval. Re-running replaces this generator's own unfrozen, non-comparison findings
 * for the same business version, so the Advisor panel never accumulates duplicates; anything already
 * frozen by approval is untouchable and is left exactly as it is.
 */
export async function generateValuationAdvisorOutput(
  params: GenerateValuationAdvisorOutputParams
): Promise<GenerateValuationAdvisorOutputResult> {
  const bv = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ business_version_id: string; organization_id: string; artifact_id: string; status: string; freshness: string; artifact_type: string }>(
      `SELECT bv.business_version_id, bv.organization_id, bv.artifact_id, bv.status, bv.freshness, a.artifact_type
         FROM finance_business_versions bv
         JOIN finance_artifacts a ON a.artifact_id = bv.artifact_id
        WHERE bv.business_version_id = ?`,
      [params.variantId]
    )
  );
  if (!bv) {
    return { ok: false, code: 'VARIANT_NOT_FOUND', message: `No finance_business_versions row for ${params.variantId}` };
  }
  if (params.organizationId && params.organizationId !== bv.organization_id) {
    return { ok: false, code: 'ORGANIZATION_MISMATCH', message: `Variant ${params.variantId} does not belong to organization ${params.organizationId}` };
  }
  if (bv.artifact_type !== 'VALUATION_CASE') {
    return { ok: false, code: 'NOT_A_VALUATION_CASE', message: `Artifact type is ${bv.artifact_type}, not VALUATION_CASE — the Valuation Advisor has nothing to say about it` };
  }
  if (ADVISOR_FORBIDDEN_STATUSES.includes(bv.status)) {
    return {
      ok: false,
      code: 'INVALID_STATUS',
      message: `The Advisor is pre-approval by definition; business version is ${bv.status}. Reopen creates a new version where the Advisor starts fresh.`,
      currentStatus: bv.status,
    };
  }

  const organizationId = bv.organization_id;
  const snapshot = await loadSnapshotInternal(organizationId, params.variantId, bv);

  // "Fresh computed candidate" checked against DATA, not against a column nothing writes:
  // there must be at least one method carrying a real result to advise on.
  if (readyMethods(snapshot).length === 0) {
    return {
      ok: false,
      code: 'NOTHING_COMPUTED',
      message: `No finance_valuation_methods row for ${params.variantId} is READY with a result — run a valuation compute before asking the Advisor`,
    };
  }

  const findings = evaluateAdvisorRules(snapshot);
  const persist = params.persist !== false;
  if (!persist) {
    return {
      ok: true,
      organizationId,
      variantId: params.variantId,
      computeSnapshotId: null,
      snapshot,
      findings: findings.map((f) => ({ ...f, id: '', hallucinationEvalStatus: 'NOT_EVALUATED' as const })),
      countsByKind: countByKind(findings),
    };
  }

  // IF-19: the ONLY sanctioned way to get a compute_snapshot_id while still pre-approval.
  const snap = await artifactVersionService.createComputeSnapshot({
    organizationId,
    businessVersionId: params.variantId,
    actorId: params.actorId,
  });
  if (!snap.ok) {
    return { ok: false, code: 'SNAPSHOT_FAILED', message: `createComputeSnapshot failed (${snap.code}): ${snap.message}` };
  }

  const groundingStatuses = await evaluateEvidenceGrounding(findings);

  const persisted = await withPinnedPostgresTransaction(async (tx) => {
    // Replace only THIS generator's own unfrozen, non-comparison findings. Frozen rows (post-
    // approval) are protected by trg_finance_advisor_outputs_enforce_freeze anyway; the predicate
    // makes the intent explicit rather than relying on the trigger to reject us.
    await tx.queryRun(
      `DELETE FROM finance_valuation_advisor_outputs
        WHERE business_version_id = ? AND organization_id = ? AND is_comparison = false
          AND is_frozen = false AND ai_provider = ?`,
      [params.variantId, organizationId, ADVISOR_GENERATOR_PROVENANCE.provider]
    );

    const rows: PersistedAdvisorFinding[] = [];
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      const id = uuidv4();
      await tx.queryRun(
        `INSERT INTO finance_valuation_advisor_outputs (
           id, organization_id, business_version_id, compute_snapshot_id, output_kind, title, narrative,
           evidence_ref, driver_ref, impact_decimal, confidence, is_comparison,
           ai_provider, ai_model, ai_prompt_version, ai_residency_region, ai_no_training_commitment,
           ai_estimated_cost_decimal, ai_rate_limit_bucket, ai_evidence_digest, ai_hallucination_eval_status, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          organizationId,
          params.variantId,
          snap.computeSnapshotId,
          f.outputKind,
          f.title,
          f.narrative,
          JSON.stringify(f.evidenceRef),
          f.driverRef,
          f.impactDecimal,
          f.confidence,
          ADVISOR_GENERATOR_PROVENANCE.provider,
          ADVISOR_GENERATOR_PROVENANCE.model,
          ADVISOR_GENERATOR_PROVENANCE.promptVersion,
          ADVISOR_GENERATOR_PROVENANCE.residencyRegion,
          ADVISOR_GENERATOR_PROVENANCE.noTrainingCommitment,
          ADVISOR_GENERATOR_PROVENANCE.estimatedCostDecimal,
          ADVISOR_GENERATOR_PROVENANCE.rateLimitBucket,
          evidenceDigest(f),
          groundingStatuses[i],
          params.actorId,
        ]
      );
      rows.push({ ...f, id, hallucinationEvalStatus: groundingStatuses[i] });
    }
    return rows;
  });

  return {
    ok: true,
    organizationId,
    variantId: params.variantId,
    computeSnapshotId: snap.computeSnapshotId,
    snapshot,
    findings: persisted,
    countsByKind: countByKind(findings),
  };
}

function countByKind(findings: readonly AdvisorFinding[]): Record<AdvisorOutputKind, number> {
  const counts: Record<AdvisorOutputKind, number> = { FACT: 0, HYPOTHESIS: 0, RISK: 0, QUESTION: 0, ACTION: 0 };
  for (const f of findings) counts[f.outputKind] += 1;
  return counts;
}

// =============================================================================================
// 10. compareVariantsForAdvisor — variant compare is a base function of the Case (handoff 9)
// =============================================================================================

export type VariantComparisonMetricName = 'ENTERPRISE_VALUE' | 'EQUITY_VALUE' | 'WACC_PCT' | 'TERMINAL_SHARE_PCT' | 'TERMINAL_G_PCT';

export interface VariantComparisonMetric {
  metric: VariantComparisonMetricName;
  unit: 'CURRENCY' | 'PCT' | 'PP';
  a: number | null;
  b: number | null;
  /** b − a, or null when either side is missing (never a silent zero). */
  delta: number | null;
  /** (b − a) / |a| × 100, only for CURRENCY metrics with a non-zero base. */
  deltaPct: number | null;
}

export type CompareVariantsErrorCode =
  | 'CASE_NOT_FOUND'
  | 'VARIANT_NOT_IN_CASE'
  | 'SAME_VARIANT'
  | 'ORGANIZATION_MISMATCH'
  | 'INVALID_STATUS'
  | 'SNAPSHOT_FAILED';

export interface CompareVariantsParams {
  caseId: string;
  /** Primary variant — `finance_valuation_variants.business_version_id`. */
  variantIdA: string;
  /** Variant compared against. */
  variantIdB: string;
  actorId: string;
  organizationId?: string;
  /** Default false — comparison is a read. `true` writes the findings against variant A, pre-approval. */
  persist?: boolean;
}

export type CompareVariantsResult =
  | {
      ok: true;
      caseId: string;
      organizationId: string;
      variantA: { businessVersionId: string; name: string; snapshot: ValuationAdvisorSnapshot; enterpriseValue: HeadlineEnterpriseValue };
      variantB: { businessVersionId: string; name: string; snapshot: ValuationAdvisorSnapshot; enterpriseValue: HeadlineEnterpriseValue };
      metrics: VariantComparisonMetric[];
      findings: PersistedAdvisorFinding[];
      computeSnapshotId: string | null;
    }
  | { ok: false; code: CompareVariantsErrorCode; message: string };

/**
 * Differences in EV / equity / WACC / terminal share / terminal g between two variants of the SAME
 * Case, plus the comparison findings the differences justify. Reads both variants; changes neither.
 * When `persist` is set, findings are written against variant A with `is_comparison=true` and both
 * variants recorded in `finance_valuation_advisor_output_variants` (PRIMARY / COMPARED_AGAINST) —
 * the many-to-many bridge WP-D09 section 12.4 built for exactly this.
 */
export async function compareVariantsForAdvisor(params: CompareVariantsParams): Promise<CompareVariantsResult> {
  if (params.variantIdA === params.variantIdB) {
    return { ok: false, code: 'SAME_VARIANT', message: 'variantIdA and variantIdB are the same variant' };
  }

  const variantRows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ business_version_id: string; organization_id: string; case_id: string; name: string; artifact_id: string; status: string; freshness: string }>(
      `SELECT v.business_version_id, v.organization_id, v.case_id, v.name, bv.artifact_id, bv.status, bv.freshness
         FROM finance_valuation_variants v
         JOIN finance_business_versions bv ON bv.business_version_id = v.business_version_id
        WHERE v.case_id = ? AND v.business_version_id IN (?, ?)`,
      [params.caseId, params.variantIdA, params.variantIdB]
    )
  );

  const rowA = variantRows.find((r) => r.business_version_id === params.variantIdA);
  const rowB = variantRows.find((r) => r.business_version_id === params.variantIdB);
  if (variantRows.length === 0) {
    return { ok: false, code: 'CASE_NOT_FOUND', message: `No variants of case ${params.caseId} match the requested ids` };
  }
  if (!rowA || !rowB) {
    return {
      ok: false,
      code: 'VARIANT_NOT_IN_CASE',
      message: `Variant ${!rowA ? params.variantIdA : params.variantIdB} is not a variant of case ${params.caseId}`,
    };
  }
  const organizationId = rowA.organization_id;
  if (rowB.organization_id !== organizationId) {
    return { ok: false, code: 'ORGANIZATION_MISMATCH', message: 'The two variants belong to different organizations' };
  }
  if (params.organizationId && params.organizationId !== organizationId) {
    return { ok: false, code: 'ORGANIZATION_MISMATCH', message: `Case ${params.caseId} does not belong to organization ${params.organizationId}` };
  }

  const snapA = await loadSnapshotInternal(organizationId, rowA.business_version_id, rowA);
  const snapB = await loadSnapshotInternal(organizationId, rowB.business_version_id, rowB);
  const evA = resolveHeadlineEnterpriseValue(snapA);
  const evB = resolveHeadlineEnterpriseValue(snapB);

  const waccA = snapA.wacc ? num(snapA.wacc.wacc_computed_pct) : null;
  const waccB = snapB.wacc ? num(snapB.wacc.wacc_computed_pct) : null;
  const termA = primaryTerminal(snapA);
  const termB = primaryTerminal(snapB);
  const shareA = termA ? num(termA.terminal_share_pct) : null;
  const shareB = termB ? num(termB.terminal_share_pct) : null;
  const gA = termA ? num(termA.g_pct) : null;
  const gB = termB ? num(termB.g_pct) : null;
  const equityA = snapA.bridge ? num(snapA.bridge.header.equity_value_decimal) : null;
  const equityB = snapB.bridge ? num(snapB.bridge.header.equity_value_decimal) : null;

  const metric = (
    name: VariantComparisonMetricName,
    unit: VariantComparisonMetric['unit'],
    a: number | null,
    b: number | null
  ): VariantComparisonMetric => ({
    metric: name,
    unit,
    a,
    b,
    delta: a !== null && b !== null ? b - a : null,
    deltaPct: unit === 'CURRENCY' && a !== null && b !== null && a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null,
  });

  const metrics: VariantComparisonMetric[] = [
    metric('ENTERPRISE_VALUE', 'CURRENCY', evA.value, evB.value),
    metric('EQUITY_VALUE', 'CURRENCY', equityA, equityB),
    metric('WACC_PCT', 'PP', waccA, waccB),
    metric('TERMINAL_SHARE_PCT', 'PP', shareA, shareB),
    metric('TERMINAL_G_PCT', 'PP', gA, gB),
  ];

  const t = ADVISOR_THRESHOLDS;
  const findings: AdvisorFinding[] = [];
  const comparedVariants: AdvisorFinding['comparedVariants'] = [
    { businessVersionId: rowA.business_version_id, role: 'PRIMARY' },
    { businessVersionId: rowB.business_version_id, role: 'COMPARED_AGAINST' },
  ];
  const driverRef = `VARIANT_COMPARE:${rowB.business_version_id}`;
  const cmpEv = (ruleId: string, pointers: AdvisorEvidencePointer[], derived: AdvisorEvidenceRef['derived'], impactUnit: AdvisorEvidenceRef['impactUnit']): AdvisorEvidenceRef => ({
    ruleId,
    generator: 'RULE_ENGINE',
    rulesVersion: ADVISOR_RULES_VERSION,
    pointers,
    derived: { ...derived, variantA: rowA.name, variantB: rowB.name },
    impactUnit,
  });

  const evMetric = metrics[0];
  if (evMetric.a !== null && evMetric.b !== null) {
    findings.push(
      finding({
        ruleId: 'ADV-C01',
        outputKind: 'FACT',
        title: `Enterprise value: "${rowB.name}" is ${formatAmount(Math.abs(evMetric.delta!))} ${evMetric.delta! >= 0 ? 'higher' : 'lower'} than "${rowA.name}"`,
        narrative:
          `"${rowA.name}" values the business at ${formatAmount(evMetric.a)} (${evA.source}); "${rowB.name}" at ` +
          `${formatAmount(evMetric.b)} (${evB.source}). Difference ${formatAmount(evMetric.delta!)}` +
          (evMetric.deltaPct !== null ? ` (${formatPct(evMetric.deltaPct, 1)}%).` : '.'),
        evidenceRef: cmpEv(
          'ADV-C01',
          [evA.pointer, evB.pointer].filter((p): p is AdvisorEvidencePointer => p !== null),
          { evA: evMetric.a, evB: evMetric.b, delta: evMetric.delta, deltaPct: evMetric.deltaPct, sourceA: evA.source, sourceB: evB.source },
          'CURRENCY'
        ),
        driverRef,
        impactDecimal: evMetric.delta,
        confidence: 'HIGH',
        isComparison: true,
        comparedVariants,
      })
    );
  }

  const waccMetric = metrics[2];
  if (waccMetric.a !== null && waccMetric.b !== null) {
    findings.push(
      finding({
        ruleId: 'ADV-C02',
        outputKind: 'FACT',
        title: `Discount rate differs by ${formatPct(waccMetric.delta!)}pp`,
        narrative: `"${rowA.name}" discounts at ${formatPct(waccMetric.a)}%, "${rowB.name}" at ${formatPct(waccMetric.b)}% — a ${formatPct(waccMetric.delta!)}pp difference.`,
        evidenceRef: cmpEv(
          'ADV-C02',
          [
            pointer('finance_valuation_wacc_inputs', 'wacc_computed_pct', snapA.wacc!.id, waccMetric.a, `WACC of "${rowA.name}"`),
            pointer('finance_valuation_wacc_inputs', 'wacc_computed_pct', snapB.wacc!.id, waccMetric.b, `WACC of "${rowB.name}"`),
          ],
          { waccA: waccMetric.a, waccB: waccMetric.b, deltaPp: waccMetric.delta },
          'PP'
        ),
        driverRef,
        impactDecimal: waccMetric.delta,
        confidence: 'HIGH',
        isComparison: true,
        comparedVariants,
      })
    );
  }

  const shareMetric = metrics[3];
  if (shareMetric.a !== null && shareMetric.b !== null) {
    findings.push(
      finding({
        ruleId: 'ADV-C03',
        outputKind: 'FACT',
        title: `Terminal share differs by ${formatPct(shareMetric.delta!)}pp`,
        narrative:
          `Terminal value accounts for ${formatPct(shareMetric.a)}% of EV in "${rowA.name}" and ${formatPct(shareMetric.b)}% ` +
          `in "${rowB.name}". The variant with the higher share is the one more exposed to steady-state assumptions.`,
        evidenceRef: cmpEv(
          'ADV-C03',
          [
            pointer('finance_valuation_terminal', 'terminal_share_pct', termA!.id, shareMetric.a, `Terminal share of "${rowA.name}"`),
            pointer('finance_valuation_terminal', 'terminal_share_pct', termB!.id, shareMetric.b, `Terminal share of "${rowB.name}"`),
          ],
          { shareA: shareMetric.a, shareB: shareMetric.b, deltaPp: shareMetric.delta },
          'PP'
        ),
        driverRef,
        impactDecimal: shareMetric.delta,
        confidence: 'HIGH',
        isComparison: true,
        comparedVariants,
      })
    );
  }

  const materialGap = evMetric.deltaPct !== null && Math.abs(evMetric.deltaPct) > t.variantMaterialEvGapPct;
  const waccExplains = waccMetric.delta !== null && Math.abs(waccMetric.delta) >= t.variantExplanatoryWaccGapPp;
  const terminalSimilar = shareMetric.delta !== null && Math.abs(shareMetric.delta) < t.variantSimilarTerminalSharePp;

  if (materialGap && waccExplains) {
    findings.push(
      finding({
        ruleId: 'ADV-C04',
        outputKind: 'HYPOTHESIS',
        title: 'The enterprise-value gap between the variants is largely a discount-rate effect',
        narrative:
          `EV differs by ${formatPct(evMetric.deltaPct!, 1)}% while the discount rate differs by ` +
          `${formatPct(waccMetric.delta!)}pp in the opposite direction of the value move. Before attributing the gap to ` +
          `operating performance, confirm how much of it survives at a common WACC — the sensitivity grid already ` +
          `answers this for the base variant.`,
        evidenceRef: cmpEv(
          'ADV-C04',
          [
            pointer('finance_valuation_wacc_inputs', 'wacc_computed_pct', snapA.wacc!.id, waccMetric.a!, `WACC of "${rowA.name}"`),
            pointer('finance_valuation_wacc_inputs', 'wacc_computed_pct', snapB.wacc!.id, waccMetric.b!, `WACC of "${rowB.name}"`),
          ],
          { evDeltaPct: evMetric.deltaPct, waccDeltaPp: waccMetric.delta, thresholdPct: t.variantMaterialEvGapPct },
          'PCT'
        ),
        driverRef,
        impactDecimal: evMetric.deltaPct,
        confidence: Math.abs(waccMetric.delta!) >= 2 * t.variantExplanatoryWaccGapPp ? 'HIGH' : 'MEDIUM',
        isComparison: true,
        comparedVariants,
      })
    );
  }

  if (materialGap && !waccExplains && terminalSimilar) {
    findings.push(
      finding({
        ruleId: 'ADV-C05',
        outputKind: 'RISK',
        title: 'Material EV gap not explained by discount rate or terminal profile',
        narrative:
          `EV differs by ${formatPct(evMetric.deltaPct!, 1)}% although the two variants discount within ` +
          `${formatPct(Math.abs(waccMetric.delta ?? 0))}pp of each other and carry terminal shares within ` +
          `${formatPct(Math.abs(shareMetric.delta ?? 0))}pp. The entire gap therefore sits in the operating forecast, ` +
          `where it is least visible — name the two or three drivers responsible before either variant goes to review.`,
        evidenceRef: cmpEv(
          'ADV-C05',
          [evA.pointer, evB.pointer].filter((p): p is AdvisorEvidencePointer => p !== null),
          { evDeltaPct: evMetric.deltaPct, waccDeltaPp: waccMetric.delta, terminalShareDeltaPp: shareMetric.delta },
          'PCT'
        ),
        driverRef,
        impactDecimal: evMetric.deltaPct,
        confidence: 'HIGH',
        isComparison: true,
        comparedVariants,
      })
    );
  }

  const equityMetric = metrics[1];
  if (equityMetric.a !== null && equityMetric.b !== null) {
    findings.push(
      finding({
        ruleId: 'ADV-C06',
        outputKind: 'FACT',
        title: `Equity value differs by ${formatAmount(equityMetric.delta!)}`,
        narrative:
          `After the EV→Equity bridge, "${rowA.name}" leaves ${formatAmount(equityMetric.a)} to shareholders and ` +
          `"${rowB.name}" ${formatAmount(equityMetric.b)}` +
          (equityMetric.deltaPct !== null ? ` — a ${formatPct(equityMetric.deltaPct, 1)}% difference.` : '.'),
        evidenceRef: cmpEv(
          'ADV-C06',
          [
            pointer('finance_valuation_ev_equity_bridge', 'equity_value_decimal', snapA.bridge!.header.id, equityMetric.a, `Equity value of "${rowA.name}"`),
            pointer('finance_valuation_ev_equity_bridge', 'equity_value_decimal', snapB.bridge!.header.id, equityMetric.b, `Equity value of "${rowB.name}"`),
          ],
          { equityA: equityMetric.a, equityB: equityMetric.b, delta: equityMetric.delta, deltaPct: equityMetric.deltaPct },
          'CURRENCY'
        ),
        driverRef,
        impactDecimal: equityMetric.delta,
        confidence: 'HIGH',
        isComparison: true,
        comparedVariants,
      })
    );
  }

  if (params.persist !== true) {
    return {
      ok: true,
      caseId: params.caseId,
      organizationId,
      variantA: { businessVersionId: rowA.business_version_id, name: rowA.name, snapshot: snapA, enterpriseValue: evA },
      variantB: { businessVersionId: rowB.business_version_id, name: rowB.name, snapshot: snapB, enterpriseValue: evB },
      metrics,
      findings: findings.map((f) => ({ ...f, id: '', hallucinationEvalStatus: 'NOT_EVALUATED' as const })),
      computeSnapshotId: null,
    };
  }

  if (ADVISOR_FORBIDDEN_STATUSES.includes(rowA.status)) {
    return { ok: false, code: 'INVALID_STATUS', message: `Cannot persist comparison findings: primary variant is ${rowA.status} (Advisor is pre-approval by definition)` };
  }

  const snap = await artifactVersionService.createComputeSnapshot({
    organizationId,
    businessVersionId: rowA.business_version_id,
    actorId: params.actorId,
  });
  if (!snap.ok) {
    return { ok: false, code: 'SNAPSHOT_FAILED', message: `createComputeSnapshot failed (${snap.code}): ${snap.message}` };
  }

  const groundingStatuses = await evaluateEvidenceGrounding(findings);

  const persisted = await withPinnedPostgresTransaction(async (tx) => {
    // Scoped by driver_ref so a re-compare of A-vs-B never disturbs a stored A-vs-C comparison.
    await tx.queryRun(
      `DELETE FROM finance_valuation_advisor_output_variants WHERE advisor_output_id IN (
         SELECT id FROM finance_valuation_advisor_outputs
          WHERE business_version_id = ? AND organization_id = ? AND is_comparison = true
            AND is_frozen = false AND driver_ref = ? AND ai_provider = ?
       )`,
      [rowA.business_version_id, organizationId, driverRef, ADVISOR_GENERATOR_PROVENANCE.provider]
    );
    await tx.queryRun(
      `DELETE FROM finance_valuation_advisor_outputs
        WHERE business_version_id = ? AND organization_id = ? AND is_comparison = true
          AND is_frozen = false AND driver_ref = ? AND ai_provider = ?`,
      [rowA.business_version_id, organizationId, driverRef, ADVISOR_GENERATOR_PROVENANCE.provider]
    );

    const rows: PersistedAdvisorFinding[] = [];
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      const id = uuidv4();
      await tx.queryRun(
        `INSERT INTO finance_valuation_advisor_outputs (
           id, organization_id, business_version_id, compute_snapshot_id, output_kind, title, narrative,
           evidence_ref, driver_ref, impact_decimal, confidence, is_comparison,
           ai_provider, ai_model, ai_prompt_version, ai_residency_region, ai_no_training_commitment,
           ai_estimated_cost_decimal, ai_rate_limit_bucket, ai_evidence_digest, ai_hallucination_eval_status, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          organizationId,
          rowA.business_version_id,
          snap.computeSnapshotId,
          f.outputKind,
          f.title,
          f.narrative,
          JSON.stringify(f.evidenceRef),
          f.driverRef,
          f.impactDecimal,
          f.confidence,
          ADVISOR_GENERATOR_PROVENANCE.provider,
          ADVISOR_GENERATOR_PROVENANCE.model,
          ADVISOR_GENERATOR_PROVENANCE.promptVersion,
          ADVISOR_GENERATOR_PROVENANCE.residencyRegion,
          ADVISOR_GENERATOR_PROVENANCE.noTrainingCommitment,
          ADVISOR_GENERATOR_PROVENANCE.estimatedCostDecimal,
          ADVISOR_GENERATOR_PROVENANCE.rateLimitBucket,
          evidenceDigest(f),
          groundingStatuses[i],
          params.actorId,
        ]
      );
      for (const cv of f.comparedVariants) {
        await tx.queryRun(
          `INSERT INTO finance_valuation_advisor_output_variants (advisor_output_id, compared_business_version_id, organization_id, role)
           VALUES (?, ?, ?, ?)`,
          [id, cv.businessVersionId, organizationId, cv.role]
        );
      }
      rows.push({ ...f, id, hallucinationEvalStatus: groundingStatuses[i] });
    }
    return rows;
  });

  return {
    ok: true,
    caseId: params.caseId,
    organizationId,
    variantA: { businessVersionId: rowA.business_version_id, name: rowA.name, snapshot: snapA, enterpriseValue: evA },
    variantB: { businessVersionId: rowB.business_version_id, name: rowB.name, snapshot: snapB, enterpriseValue: evB },
    metrics,
    findings: persisted,
    computeSnapshotId: snap.computeSnapshotId,
  };
}

// =============================================================================================
// 11. Read-back helper (used by the UI/export layer and by the tests' freeze assertions)
// =============================================================================================

export interface StoredAdvisorOutputRow {
  id: string;
  business_version_id: string;
  compute_snapshot_id: string;
  output_kind: AdvisorOutputKind;
  title: string;
  narrative: string;
  evidence_ref: AdvisorEvidenceRef;
  driver_ref: string | null;
  impact_decimal: string | null;
  confidence: AdvisorConfidence | null;
  is_comparison: boolean;
  is_frozen: boolean;
  frozen_at: string | null;
  is_stale: boolean;
  ai_provider: string;
  ai_prompt_version: string;
  ai_hallucination_eval_status: AdvisorHallucinationEvalStatus;
}

export async function listAdvisorOutputs(organizationId: string, businessVersionId: string): Promise<StoredAdvisorOutputRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<StoredAdvisorOutputRow>(
      `SELECT id, business_version_id, compute_snapshot_id, output_kind, title, narrative, evidence_ref,
              driver_ref, impact_decimal, confidence, is_comparison, is_frozen, frozen_at::text AS frozen_at,
              is_stale, ai_provider, ai_prompt_version, ai_hallucination_eval_status
         FROM finance_valuation_advisor_outputs
        WHERE organization_id = ? AND business_version_id = ?
        ORDER BY output_kind, title`,
      [organizationId, businessVersionId]
    )
  );
}
