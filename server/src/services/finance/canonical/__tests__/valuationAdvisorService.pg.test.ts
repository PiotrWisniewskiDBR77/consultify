/**
 * Valuation Advisor GENERATOR — real PostgreSQL integration test.
 *
 * Covers `server/src/services/finance/canonical/valuationAdvisorService.ts` (rule-based, no LLM)
 * against the ACTUAL migrated Gate B/D schema — the D09/D09b tables, the basket weight-sum and
 * comps-readiness triggers, the g<WACC trigger, the 25-cell sensitivity gate, and above all the
 * Advisor freeze-on-approval / no-new-after-approval triggers. A mocked schema could not prove any
 * of that, which is the whole point of this file being a `.pg.test.ts`.
 *
 * Same env contract as every other `.pg.test.ts` in this repo (`RUN_DB_TESTS=1`, `MOCK_DB=false`,
 * `DATABASE_URL=postgresql://...`), `describe.skipIf`-gated so a run with no database reports
 * SKIPPED instead of a false green.
 *
 * HOW TO RUN (own throwaway/ephemeral cluster only — NEVER the shared local Postgres, never demo):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/valuationAdvisorService.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Valuation Advisor generator — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let advisor: typeof import('../valuationAdvisorService.js');

  const orgId = `org-finv3-advisor-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;
  const caseId = randomUUID();

  /** Everything a fixture variant needs; every field maps 1:1 onto a real D09 table. */
  interface VariantSpec {
    name: string;
    freshness: 'NEVER_COMPUTED' | 'CURRENT';
    wacc: {
      riskFree: number;
      erp: number;
      betaUnlevered: number;
      betaRelevered: number;
      targetDebt: number;
      currentDebt: number;
      costOfDebtPretax: number;
      cashTax: number;
      waccComputed: number;
    };
    /** DCF_FCFF is always the basket flagship; extra methods are optional cross-checks/basket members. */
    dcfEv: number;
    dcfWeightPct: number;
    /** Optional TRADING_COMPS method WITH peers (needed for the comps-readiness trigger). */
    compsEv: number | null;
    compsWeightPct: number | null;
    compsPeerCount: number;
    /** Optional unweighted ASSET_BASED cross-check. */
    assetBasedEv: number | null;
    terminal: {
      gPct: number;
      terminalValue: number;
      terminalSharePct: number;
      reinvestmentRatePct: number | null;
      roicPct: number | null;
    };
    bridge: { enterpriseValue: number; debt: number; cash: number } | null;
    /** Base EV of a synthetic, strictly monotonic 5x5 grid; null = no grid at all. */
    sensitivityBaseEv: number | null;
  }

  interface BuiltVariant {
    businessVersionId: string;
    workingRevisionId: string;
    version: number;
    name: string;
  }

  async function buildVariant(spec: VariantSpec): Promise<BuiltVariant> {
    const created = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'VALUATION_CASE',
      createdBy: preparerId,
    });
    const bvId = created.businessVersion.business_version_id;

    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO finance_valuation_variants (id, organization_id, business_version_id, case_id, name, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), orgId, bvId, caseId, spec.name, preparerId]
      );

      // --- WACC bundle (must exist BEFORE the terminal row: the g<WACC trigger reads it) ---
      await tx.queryRun(
        `INSERT INTO finance_valuation_wacc_inputs (
           id, organization_id, business_version_id, risk_free_rate_pct, equity_risk_premium_pct,
           beta_unlevered, beta_relevered, target_capital_structure_debt_pct, target_capital_structure_equity_pct,
           current_capital_structure_debt_pct, current_capital_structure_equity_pct, cost_of_debt_pretax_pct,
           cash_tax_rate_pct, currency, nominal_or_real, pre_or_post_tax, wacc_computed_pct, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLN', 'NOMINAL', 'POST_TAX', ?, ?)`,
        [
          randomUUID(), orgId, bvId, spec.wacc.riskFree, spec.wacc.erp, spec.wacc.betaUnlevered, spec.wacc.betaRelevered,
          spec.wacc.targetDebt, 100 - spec.wacc.targetDebt, spec.wacc.currentDebt, 100 - spec.wacc.currentDebt,
          spec.wacc.costOfDebtPretax, spec.wacc.cashTax, spec.wacc.waccComputed, preparerId,
        ]
      );

      // --- DCF_FCFF (basket flagship) ---
      const dcfId = randomUUID();
      await tx.queryRun(
        `INSERT INTO finance_valuation_methods (
           id, organization_id, business_version_id, method_type, readiness, result_value_status,
           result_ev_decimal, is_in_recommendation_basket, weight_pct, created_by
         ) VALUES (?, ?, ?, 'DCF_FCFF', 'READY', 'PRESENT_NONZERO', ?, true, ?, ?)`,
        [dcfId, orgId, bvId, spec.dcfEv, spec.dcfWeightPct, preparerId]
      );

      // --- TRADING_COMPS: inserted NOT_CONFIGURED first, peers next, then promoted to READY.
      // finance_valuation_methods_check_comps_readiness() is a NON-deferred BEFORE trigger, so a
      // comps method can only become READY once its peer rows already exist — and peer rows FK to
      // the method. Insert order is therefore method -> comps -> UPDATE, not a workaround but the
      // only sequence the schema permits.
      if (spec.compsEv !== null) {
        const compsId = randomUUID();
        await tx.queryRun(
          `INSERT INTO finance_valuation_methods (
             id, organization_id, business_version_id, method_type, readiness, result_value_status, created_by
           ) VALUES (?, ?, ?, 'TRADING_COMPS', 'NOT_CONFIGURED', 'MISSING', ?)`,
          [compsId, orgId, bvId, preparerId]
        );
        for (let i = 0; i < spec.compsPeerCount; i++) {
          await tx.queryRun(
            `INSERT INTO finance_valuation_comps (
               id, organization_id, method_id, peer_name, metric_type, metric_value_status, metric_value_decimal, created_by
             ) VALUES (?, ?, ?, ?, 'EV_EBITDA', 'PRESENT_NONZERO', ?, ?)`,
            [randomUUID(), orgId, compsId, `Peer ${i + 1}`, 7.5 + i * 0.5, preparerId]
          );
        }
        await tx.queryRun(
          `UPDATE finance_valuation_methods
              SET readiness = 'READY', result_value_status = 'PRESENT_NONZERO', result_ev_decimal = ?,
                  is_in_recommendation_basket = ?, weight_pct = ?
            WHERE id = ?`,
          [spec.compsEv, spec.compsWeightPct !== null, spec.compsWeightPct, compsId]
        );
      }

      if (spec.assetBasedEv !== null) {
        await tx.queryRun(
          `INSERT INTO finance_valuation_methods (
             id, organization_id, business_version_id, method_type, readiness, result_value_status,
             result_ev_decimal, is_in_recommendation_basket, created_by
           ) VALUES (?, ?, ?, 'ASSET_BASED', 'READY', 'PRESENT_NONZERO', ?, false, ?)`,
          [randomUUID(), orgId, bvId, spec.assetBasedEv, preparerId]
        );
      }

      // --- Terminal (primary Gordon row on the DCF method) ---
      await tx.queryRun(
        `INSERT INTO finance_valuation_terminal (
           id, organization_id, method_id, convention, g_pct, reinvestment_rate_pct, roic_pct,
           terminal_value_decimal, terminal_share_pct, is_primary, created_by
         ) VALUES (?, ?, ?, 'GORDON_GROWTH', ?, ?, ?, ?, ?, true, ?)`,
        [
          randomUUID(), orgId, dcfId, spec.terminal.gPct, spec.terminal.reinvestmentRatePct, spec.terminal.roicPct,
          spec.terminal.terminalValue, spec.terminal.terminalSharePct, preparerId,
        ]
      );

      // --- EV -> Equity bridge ---
      if (spec.bridge) {
        const bridgeId = randomUUID();
        const equity = spec.bridge.enterpriseValue - spec.bridge.debt + spec.bridge.cash;
        await tx.queryRun(
          `INSERT INTO finance_valuation_ev_equity_bridge (
             id, organization_id, business_version_id, as_of_date, enterprise_value_decimal, equity_value_decimal, created_by
           ) VALUES (?, ?, ?, DATE '2025-12-31', ?, ?, ?)`,
          [bridgeId, orgId, bvId, spec.bridge.enterpriseValue, equity, preparerId]
        );
        await tx.queryRun(
          `INSERT INTO finance_valuation_ev_equity_bridge_components (
             id, organization_id, bridge_id, sequence_order, component_kind, sign, amount_decimal, as_of_date, created_by
           ) VALUES (?, ?, ?, 1, 'DEBT', 'SUBTRACT_FROM_EV', ?, DATE '2025-12-31', ?)`,
          [randomUUID(), orgId, bridgeId, spec.bridge.debt, preparerId]
        );
        await tx.queryRun(
          `INSERT INTO finance_valuation_ev_equity_bridge_components (
             id, organization_id, bridge_id, sequence_order, component_kind, sign, amount_decimal, as_of_date, created_by
           ) VALUES (?, ?, ?, 2, 'CASH', 'ADD_TO_EV', ?, DATE '2025-12-31', ?)`,
          [randomUUID(), orgId, bridgeId, spec.bridge.cash, preparerId]
        );
      }

      // --- 5x5 sensitivity grid, strictly monotonic by construction ---
      if (spec.sensitivityBaseEv !== null) {
        const gridId = randomUUID();
        await tx.queryRun(
          `INSERT INTO finance_valuation_sensitivity_grids (
             id, organization_id, method_id, grid_label, row_axis_variable, column_axis_variable, grid_status, created_by
           ) VALUES (?, ?, ?, 'WACC x terminal g', 'TERMINAL_G_PCT', 'WACC_PCT', 'DRAFT', ?)`,
          [gridId, orgId, dcfId, preparerId]
        );
        for (let r = 1; r <= 5; r++) {
          for (let c = 1; c <= 5; c++) {
            // EV rises with terminal g (rows) and falls as WACC rises (columns) — the exact
            // property findMonotonicityViolation() checks.
            const value = spec.sensitivityBaseEv * (1 + 0.05 * (r - 3) - 0.05 * (c - 3));
            await tx.queryRun(
              `INSERT INTO finance_valuation_sensitivity_cells (
                 id, organization_id, grid_id, row_index, col_index, row_axis_value, column_axis_value,
                 cell_value_decimal, is_base_cell, created_by
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                randomUUID(), orgId, gridId, r, c,
                spec.terminal.gPct + (r - 3) * 0.25, spec.wacc.waccComputed + (c - 3) * 0.5,
                value, r === 3 && c === 3, preparerId,
              ]
            );
          }
        }
        await tx.queryRun(`UPDATE finance_valuation_sensitivity_grids SET grid_status = 'COMPLETE' WHERE id = ?`, [gridId]);
      }

      if (spec.freshness === 'CURRENT') {
        await tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId]);
      }
      return null;
    });

    return {
      businessVersionId: bvId,
      workingRevisionId: created.workingRevision.working_revision_id,
      version: created.businessVersion.version,
      name: spec.name,
    };
  }

  /** Healthy base case: moderate terminal share, two agreeing methods, full bridge, monotonic grid. */
  const BASE_SPEC: VariantSpec = {
    name: 'Base case',
    freshness: 'CURRENT',
    wacc: { riskFree: 4, erp: 5.5, betaUnlevered: 0.9, betaRelevered: 1.1, targetDebt: 30, currentDebt: 10, costOfDebtPretax: 6, cashTax: 19, waccComputed: 9.5 },
    dcfEv: 1_000_000,
    dcfWeightPct: 60,
    compsEv: 1_100_000,
    compsWeightPct: 40,
    compsPeerCount: 3,
    assetBasedEv: null,
    terminal: { gPct: 2.5, terminalValue: 600_000, terminalSharePct: 60, reinvestmentRatePct: 25, roicPct: 10 },
    bridge: { enterpriseValue: 1_000_000, debt: 200_000, cash: 50_000 },
    sensitivityBaseEv: 1_000_000,
  };

  /** Stressed downside: terminal-dominated, narrow spread, no comps, no grid, negative equity. */
  const DOWNSIDE_SPEC: VariantSpec = {
    name: 'Downside',
    freshness: 'NEVER_COMPUTED',
    wacc: { riskFree: 4, erp: 7, betaUnlevered: 1.3, betaRelevered: 1.7, targetDebt: 30, currentDebt: 10, costOfDebtPretax: 3.5, cashTax: 19, waccComputed: 13 },
    dcfEv: 600_000,
    dcfWeightPct: 100,
    compsEv: null,
    compsWeightPct: null,
    compsPeerCount: 0,
    assetBasedEv: 1_000_000,
    terminal: { gPct: 11.5, terminalValue: 520_000, terminalSharePct: 86.7, reinvestmentRatePct: null, roicPct: null },
    bridge: { enterpriseValue: 600_000, debt: 650_000, cash: 20_000 },
    sensitivityBaseEv: null,
  };

  let base: BuiltVariant;
  let downside: BuiltVariant;
  let baseResult: Awaited<ReturnType<typeof import('../valuationAdvisorService.js').generateValuationAdvisorOutput>>;
  let downsideResult: Awaited<ReturnType<typeof import('../valuationAdvisorService.js').generateValuationAdvisorOutput>>;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    advisor = await import('../valuationAdvisorService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV3 Valuation Advisor Test Org'])
    );
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO finance_valuation_cases (case_id, organization_id, name, created_by) VALUES (?, ?, ?, ?)`, [
        caseId, orgId, 'Advisor generator test case', preparerId,
      ])
    );

    base = await buildVariant(BASE_SPEC);
    downside = await buildVariant(DOWNSIDE_SPEC);

    baseResult = await advisor.generateValuationAdvisorOutput({ variantId: base.businessVersionId, actorId: preparerId, organizationId: orgId });
    downsideResult = await advisor.generateValuationAdvisorOutput({ variantId: downside.businessVersionId, actorId: preparerId, organizationId: orgId });
  }, 120_000);

  // -------------------------------------------------------------------------------------------
  // 1. The generator produces non-trivial output, anchored to a PRE-APPROVAL compute snapshot
  // -------------------------------------------------------------------------------------------

  it('writes findings against a pre-approval compute snapshot while the variant is still DRAFT (IF-19 path)', async () => {
    expect(baseResult.ok).toBe(true);
    if (!baseResult.ok) throw new Error('unreachable');
    expect(baseResult.computeSnapshotId).toBeTruthy();

    const stored = await advisor.listAdvisorOutputs(orgId, base.businessVersionId);
    expect(stored.length).toBe(baseResult.findings.length);
    expect(stored.every((r) => r.compute_snapshot_id === baseResult.computeSnapshotId)).toBe(true);
    // Pre-approval: nothing frozen, nothing stale.
    expect(stored.every((r) => r.is_frozen === false && r.is_stale === false)).toBe(true);

    const bv = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ status: string }>(`SELECT status FROM finance_business_versions WHERE business_version_id = ?`, [base.businessVersionId])
    );
    expect(bv?.status).toBe('DRAFT');
  });

  it('produces non-empty facts, and every finding carries evidence, a driver and a confidence where the kind implies one', () => {
    if (!baseResult.ok || !downsideResult.ok) throw new Error('unreachable');
    for (const result of [baseResult, downsideResult]) {
      expect(result.findings.length).toBeGreaterThan(3);
      expect(result.countsByKind.FACT).toBeGreaterThan(0);
      for (const f of result.findings) {
        expect(f.title.length).toBeGreaterThan(10);
        expect(f.narrative.length).toBeGreaterThan(40);
        expect(f.evidenceRef.ruleId).toBe(f.ruleId);
        expect(f.evidenceRef.generator).toBe('RULE_ENGINE');
        expect(f.driverRef).toBeTruthy();
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(f.confidence);
      }
    }
  });

  it('the two variants produce DIFFERENT and non-identical facts, hypotheses and risks', () => {
    if (!baseResult.ok || !downsideResult.ok) throw new Error('unreachable');
    const baseRules = baseResult.findings.map((f) => f.ruleId).sort();
    const downRules = downsideResult.findings.map((f) => f.ruleId).sort();
    expect(baseRules).not.toEqual(downRules);

    // The downside variant is the one that trips the qualitative rules.
    expect(baseResult.countsByKind.HYPOTHESIS).toBe(0);
    expect(downsideResult.countsByKind.HYPOTHESIS).toBeGreaterThan(0);
    expect(downsideResult.countsByKind.RISK).toBeGreaterThan(baseResult.countsByKind.RISK);
    expect(downsideResult.countsByKind.ACTION).toBeGreaterThan(baseResult.countsByKind.ACTION);

    // Even the rules that fire for BOTH carry different numbers — not a boilerplate template.
    const baseTerminalFact = baseResult.findings.find((f) => f.ruleId === 'ADV-R01')!;
    const downTerminalFact = downsideResult.findings.find((f) => f.ruleId === 'ADV-R01')!;
    expect(baseTerminalFact.narrative).not.toBe(downTerminalFact.narrative);
    expect(baseTerminalFact.impactDecimal).toBe(60);
    expect(downTerminalFact.impactDecimal).toBe(86.7);
  });

  it('fires exactly the rules the base-case fixture is built to trip (and none of the stress rules)', () => {
    if (!baseResult.ok) throw new Error('unreachable');
    const fired = new Set(baseResult.findings.map((f) => f.ruleId));
    // Healthy: terminal share 60%, complete basket, 9.5% dispersion, full bridge, monotonic grid.
    expect([...fired].sort()).toEqual(['ADV-R01', 'ADV-R08', 'ADV-R12', 'ADV-R15', 'ADV-R20', 'ADV-R22', 'ADV-R24']);
    for (const notFired of ['ADV-R02', 'ADV-R03', 'ADV-R05', 'ADV-R11', 'ADV-R13', 'ADV-R18', 'ADV-R26', 'ADV-R28']) {
      expect(fired.has(notFired)).toBe(false);
    }
  });

  it('fires the terminal-dominance, narrow-spread, no-comps, dispersion, bridge and freshness rules on the downside variant', () => {
    if (!downsideResult.ok) throw new Error('unreachable');
    const byRule = new Map(downsideResult.findings.map((f) => [f.ruleId, f]));

    // terminal_share 86.7% > 85% => HIGH-confidence hypothesis + risk + exit-multiple action
    expect(byRule.get('ADV-R02')?.outputKind).toBe('HYPOTHESIS');
    expect(byRule.get('ADV-R02')?.confidence).toBe('HIGH');
    expect(byRule.get('ADV-R03')?.impactDecimal).toBe(520_000);
    expect(byRule.get('ADV-R04')?.outputKind).toBe('ACTION');
    // WACC 13% - g 11.5% = 1.5pp < 2pp guardrail
    expect(byRule.get('ADV-R05')?.impactDecimal).toBeCloseTo(1.5, 9);
    // reinvestment/ROIC absent => the question, not the reconciliation risk
    expect(byRule.has('ADV-R07')).toBe(true);
    expect(byRule.has('ADV-R06')).toBe(false);
    // DCF 600k vs ASSET_BASED 1 000k => 50% dispersion (> 40% severe threshold)
    expect(byRule.get('ADV-R11')?.confidence).toBe('HIGH');
    expect(byRule.get('ADV-R11')?.impactDecimal).toBeCloseTo(50, 9);
    // no comps method at all
    expect(byRule.has('ADV-R13')).toBe(true);
    expect(byRule.has('ADV-R14')).toBe(true);
    // no sensitivity grid
    expect(byRule.get('ADV-R18')?.outputKind).toBe('ACTION');
    // cost of debt 3.5% < risk-free 4.0%
    expect(byRule.get('ADV-R23')?.impactDecimal).toBeCloseTo(-0.5, 9);
    // equity 600k - 650k + 20k = -30k, adjustments 105% of EV
    expect(byRule.get('ADV-R26')?.impactDecimal).toBe(-30_000);
    expect(byRule.get('ADV-R27')?.confidence).toBe('MEDIUM');
    // freshness NEVER_COMPUTED
    expect(byRule.has('ADV-R28')).toBe(true);
  });

  it('is deterministic: two evaluations of the same snapshot are byte-identical', async () => {
    if (!baseResult.ok) throw new Error('unreachable');
    const first = advisor.evaluateAdvisorRules(baseResult.snapshot);
    const second = advisor.evaluateAdvisorRules(baseResult.snapshot);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('records rule-engine provenance rather than inventing an LLM provider, and costs nothing', async () => {
    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ ai_provider: string; ai_model: string; ai_prompt_version: string; ai_estimated_cost_decimal: string | null; ai_no_training_commitment: boolean; ai_evidence_digest: string }>(
        `SELECT ai_provider, ai_model, ai_prompt_version, ai_estimated_cost_decimal, ai_no_training_commitment, ai_evidence_digest
           FROM finance_valuation_advisor_outputs WHERE business_version_id = ?`,
        [base.businessVersionId]
      )
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.ai_provider).toBe('CONSULTIFY_RULE_ENGINE');
      expect(r.ai_model).toBe('valuation-advisor-rules');
      expect(r.ai_prompt_version).toBe(advisor.ADVISOR_RULES_VERSION);
      expect(Number(r.ai_estimated_cost_decimal)).toBe(0);
      expect(r.ai_no_training_commitment).toBe(true);
      expect(r.ai_evidence_digest.startsWith('sha256:')).toBe(true);
    }
    // Digests differ per finding — one shared constant would make the column useless.
    expect(new Set(rows.map((r) => r.ai_evidence_digest)).size).toBe(rows.length);
  });

  // -------------------------------------------------------------------------------------------
  // 2. Evidence grounding is a real check, not a hardcoded PASSED
  // -------------------------------------------------------------------------------------------

  it('marks every generated finding PASSED because each evidence pointer re-reads to the same value', async () => {
    const rows = await advisor.listAdvisorOutputs(orgId, downside.businessVersionId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ai_hallucination_eval_status === 'PASSED')).toBe(true);
  });

  it('FLAGS a finding whose evidence pointer does not resolve, and one that quotes a value the cell does not hold', async () => {
    if (!baseResult.ok) throw new Error('unreachable');
    const real = baseResult.findings.find((f) => f.ruleId === 'ADV-R20')!;
    const realPointer = real.evidenceRef.pointers[0];

    const nonExistentRow = {
      ...real,
      evidenceRef: { ...real.evidenceRef, pointers: [{ ...realPointer, rowId: randomUUID() }] },
    };
    const wrongValue = {
      ...real,
      evidenceRef: { ...real.evidenceRef, pointers: [{ ...realPointer, observedValue: 999.99 }] },
    };
    const forbiddenColumn = {
      ...real,
      evidenceRef: { ...real.evidenceRef, pointers: [{ ...realPointer, column: 'created_by' }] },
    };

    const statuses = await advisor.evaluateEvidenceGrounding([real, nonExistentRow, wrongValue, forbiddenColumn]);
    expect(statuses).toEqual(['PASSED', 'FLAGGED', 'FLAGGED', 'FLAGGED']);
  });

  // -------------------------------------------------------------------------------------------
  // 3. Idempotency / no data mutation
  // -------------------------------------------------------------------------------------------

  it('re-running replaces its own findings instead of accumulating duplicates, and reuses the same snapshot', async () => {
    if (!baseResult.ok) throw new Error('unreachable');
    const before = await advisor.listAdvisorOutputs(orgId, base.businessVersionId);
    const again = await advisor.generateValuationAdvisorOutput({ variantId: base.businessVersionId, actorId: preparerId, organizationId: orgId });
    expect(again.ok).toBe(true);
    if (!again.ok) throw new Error('unreachable');
    expect(again.computeSnapshotId).toBe(baseResult.computeSnapshotId); // createComputeSnapshot() reuse

    const after = await advisor.listAdvisorOutputs(orgId, base.businessVersionId);
    expect(after.length).toBe(before.length);
    expect(after.map((r) => r.title).sort()).toEqual(before.map((r) => r.title).sort());
    expect(new Set(after.map((r) => r.id)).size).toBe(after.length);
  });

  it('changes no valuation data: method results, WACC and the bridge are byte-identical after generation', async () => {
    const fingerprint = async () =>
      withPinnedPostgresTransaction(async (tx) => {
        const methods = await tx.queryAll(
          `SELECT method_type, readiness, result_value_status, result_ev_decimal, weight_pct
             FROM finance_valuation_methods WHERE business_version_id = ? ORDER BY method_type`,
          [base.businessVersionId]
        );
        const wacc = await tx.queryOne(`SELECT wacc_computed_pct, beta_relevered FROM finance_valuation_wacc_inputs WHERE business_version_id = ?`, [base.businessVersionId]);
        const bridge = await tx.queryOne(`SELECT enterprise_value_decimal, equity_value_decimal FROM finance_valuation_ev_equity_bridge WHERE business_version_id = ?`, [base.businessVersionId]);
        return JSON.stringify({ methods, wacc, bridge });
      });

    const before = await fingerprint();
    await advisor.generateValuationAdvisorOutput({ variantId: base.businessVersionId, actorId: preparerId, organizationId: orgId });
    expect(await fingerprint()).toBe(before);
  });

  it('refuses to advise on an artifact that is not a VALUATION_CASE, and on a variant with nothing computed', async () => {
    const analysis = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'HISTORICAL_ANALYSIS', createdBy: preparerId });
    const wrongType = await advisor.generateValuationAdvisorOutput({ variantId: analysis.businessVersion.business_version_id, actorId: preparerId, organizationId: orgId });
    expect(wrongType.ok).toBe(false);
    if (wrongType.ok) throw new Error('unreachable');
    expect(wrongType.code).toBe('NOT_A_VALUATION_CASE');

    const emptyCase = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: preparerId });
    const nothing = await advisor.generateValuationAdvisorOutput({ variantId: emptyCase.businessVersion.business_version_id, actorId: preparerId, organizationId: orgId });
    expect(nothing.ok).toBe(false);
    if (nothing.ok) throw new Error('unreachable');
    expect(nothing.code).toBe('NOTHING_COMPUTED');

    const wrongOrg = await advisor.generateValuationAdvisorOutput({ variantId: base.businessVersionId, actorId: preparerId, organizationId: `org-other-${randomUUID()}` });
    expect(wrongOrg.ok).toBe(false);
    if (wrongOrg.ok) throw new Error('unreachable');
    expect(wrongOrg.code).toBe('ORGANIZATION_MISMATCH');
  });

  // -------------------------------------------------------------------------------------------
  // 4. compareVariantsForAdvisor
  // -------------------------------------------------------------------------------------------

  it('computes EV / equity / WACC / terminal differences between two variants of the same Case', async () => {
    const cmp = await advisor.compareVariantsForAdvisor({
      caseId,
      variantIdA: base.businessVersionId,
      variantIdB: downside.businessVersionId,
      actorId: preparerId,
      organizationId: orgId,
    });
    expect(cmp.ok).toBe(true);
    if (!cmp.ok) throw new Error('unreachable');

    const byMetric = new Map(cmp.metrics.map((m) => [m.metric, m]));
    expect(byMetric.get('ENTERPRISE_VALUE')).toMatchObject({ a: 1_000_000, b: 600_000, delta: -400_000, deltaPct: -40 });
    expect(byMetric.get('EQUITY_VALUE')).toMatchObject({ a: 850_000, b: -30_000 });
    expect(byMetric.get('WACC_PCT')).toMatchObject({ a: 9.5, b: 13, delta: 3.5 });
    expect(byMetric.get('TERMINAL_SHARE_PCT')?.delta).toBeCloseTo(26.7, 9);
    expect(byMetric.get('TERMINAL_G_PCT')?.delta).toBeCloseTo(9, 9);

    const rules = cmp.findings.map((f) => f.ruleId).sort();
    expect(rules).toEqual(['ADV-C01', 'ADV-C02', 'ADV-C03', 'ADV-C04', 'ADV-C06']);
    // 40% EV gap WITH a 3.5pp WACC gap => the discount-rate hypothesis, not the unexplained-gap risk.
    expect(cmp.findings.find((f) => f.ruleId === 'ADV-C04')?.outputKind).toBe('HYPOTHESIS');
    expect(cmp.findings.some((f) => f.ruleId === 'ADV-C05')).toBe(false);
    expect(cmp.findings.every((f) => f.isComparison)).toBe(true);
    // Read-only by default.
    expect(cmp.computeSnapshotId).toBeNull();
  });

  it('rejects a variant that does not belong to the requested Case, and a self-comparison', async () => {
    const foreign = await buildVariant({ ...BASE_SPEC, name: 'Foreign variant' });
    // Re-home it under a different case so it is a real "not in this case" situation.
    const otherCaseId = randomUUID();
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`INSERT INTO finance_valuation_cases (case_id, organization_id, name, created_by) VALUES (?, ?, ?, ?)`, [otherCaseId, orgId, 'Other case', preparerId]);
      await tx.queryRun(`UPDATE finance_valuation_variants SET case_id = ? WHERE business_version_id = ?`, [otherCaseId, foreign.businessVersionId]);
      return null;
    });

    const notInCase = await advisor.compareVariantsForAdvisor({ caseId, variantIdA: base.businessVersionId, variantIdB: foreign.businessVersionId, actorId: preparerId });
    expect(notInCase.ok).toBe(false);
    if (notInCase.ok) throw new Error('unreachable');
    expect(notInCase.code).toBe('VARIANT_NOT_IN_CASE');

    const same = await advisor.compareVariantsForAdvisor({ caseId, variantIdA: base.businessVersionId, variantIdB: base.businessVersionId, actorId: preparerId });
    expect(same.ok).toBe(false);
    if (same.ok) throw new Error('unreachable');
    expect(same.code).toBe('SAME_VARIANT');
  });

  it('persists comparison findings with both variants recorded in the many-to-many bridge', async () => {
    const cmp = await advisor.compareVariantsForAdvisor({
      caseId,
      variantIdA: downside.businessVersionId, // primary = downside, so the base variant stays approvable below
      variantIdB: base.businessVersionId,
      actorId: preparerId,
      organizationId: orgId,
      persist: true,
    });
    expect(cmp.ok).toBe(true);
    if (!cmp.ok) throw new Error('unreachable');
    expect(cmp.computeSnapshotId).toBeTruthy();

    const stored = await advisor.listAdvisorOutputs(orgId, downside.businessVersionId);
    const comparisonRows = stored.filter((r) => r.is_comparison);
    expect(comparisonRows.length).toBe(cmp.findings.length);

    const bridgeRows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ advisor_output_id: string; compared_business_version_id: string; role: string }>(
        `SELECT advisor_output_id, compared_business_version_id, role
           FROM finance_valuation_advisor_output_variants
          WHERE advisor_output_id = ANY(?) ORDER BY role`,
        [comparisonRows.map((r) => r.id)]
      )
    );
    expect(bridgeRows.length).toBe(comparisonRows.length * 2);
    expect(new Set(bridgeRows.map((r) => r.role))).toEqual(new Set(['PRIMARY', 'COMPARED_AGAINST']));
    expect(new Set(bridgeRows.filter((r) => r.role === 'PRIMARY').map((r) => r.compared_business_version_id))).toEqual(new Set([downside.businessVersionId]));

    // Re-persisting the same pair replaces, never duplicates.
    const again = await advisor.compareVariantsForAdvisor({
      caseId, variantIdA: downside.businessVersionId, variantIdB: base.businessVersionId,
      actorId: preparerId, organizationId: orgId, persist: true,
    });
    expect(again.ok).toBe(true);
    const storedAgain = (await advisor.listAdvisorOutputs(orgId, downside.businessVersionId)).filter((r) => r.is_comparison);
    expect(storedAgain.length).toBe(comparisonRows.length);
  });

  // -------------------------------------------------------------------------------------------
  // 5. Freeze on approval (IF-19 / WP-D09b section 12.3) — the whole point of the pre-approval path
  // -------------------------------------------------------------------------------------------

  it('freezes the generated findings on approval and refuses to generate new ones afterwards', async () => {
    const variant = await buildVariant({ ...BASE_SPEC, name: 'Approval subject' });
    const generated = await advisor.generateValuationAdvisorOutput({ variantId: variant.businessVersionId, actorId: preparerId, organizationId: orgId });
    expect(generated.ok).toBe(true);
    if (!generated.ok) throw new Error('unreachable');
    expect(generated.findings.length).toBeGreaterThan(0);

    const beforeApproval = await advisor.listAdvisorOutputs(orgId, variant.businessVersionId);
    expect(beforeApproval.every((r) => r.is_frozen === false)).toBe(true);

    let version = variant.version;
    const submitted = await artifactVersionService.transition({
      organizationId: orgId, businessVersionId: variant.businessVersionId, action: 'submit_for_review',
      actorId: preparerId, role: 'preparer', expectedVersion: version,
    });
    if (!submitted.ok) throw new Error(`submit failed: ${JSON.stringify(submitted)}`);
    version = submitted.businessVersion.version;
    const started = await artifactVersionService.transition({
      organizationId: orgId, businessVersionId: variant.businessVersionId, action: 'start_review',
      actorId: approverId, role: 'approver', expectedVersion: version,
    });
    if (!started.ok) throw new Error(`start_review failed: ${JSON.stringify(started)}`);
    version = started.businessVersion.version;

    const approved = await artifactVersionService.approveVersion({
      organizationId: orgId, businessVersionId: variant.businessVersionId, actorId: approverId, role: 'approver', expectedVersion: version,
    });
    expect(approved.ok).toBe(true);
    if (!approved.ok) throw new Error('unreachable');
    // approveVersion() reused the Advisor's own pre-approval snapshot (IF-19 fix, section 4.2).
    expect(approved.computeSnapshotId).toBe(generated.computeSnapshotId);

    const afterApproval = await advisor.listAdvisorOutputs(orgId, variant.businessVersionId);
    expect(afterApproval.length).toBe(beforeApproval.length);
    expect(afterApproval.every((r) => r.is_frozen === true && r.frozen_at !== null)).toBe(true);
    // freeze ran before stale-marking (trigger name ordering), so nothing is stale.
    expect(afterApproval.every((r) => r.is_stale === false)).toBe(true);

    const afterwards = await advisor.generateValuationAdvisorOutput({ variantId: variant.businessVersionId, actorId: preparerId, organizationId: orgId });
    expect(afterwards.ok).toBe(false);
    if (afterwards.ok) throw new Error('unreachable');
    expect(afterwards.code).toBe('INVALID_STATUS');
    expect(afterwards.currentStatus).toBe('APPROVED');

    // And the frozen rows are physically immutable — the DB trigger, not just the service.
    await expect(
      withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`UPDATE finance_valuation_advisor_outputs SET title = 'tampered' WHERE id = ?`, [afterApproval[0].id])
      )
    ).rejects.toThrow(/frozen/i);
  }, 120_000);

  // -------------------------------------------------------------------------------------------
  // 6. Degenerate fixtures — the rules the healthy/stressed pair does NOT reach
  // -------------------------------------------------------------------------------------------

  /**
   * A variant assembled to trip the "something is structurally missing or wrong" rules the two
   * headline fixtures cannot reach: no WACC row at all (R21), no basket (R10), no bridge (R25),
   * a terminal g that contradicts reinvestment x ROIC (R06), and a grid that is simultaneously
   * wide (R16), non-monotonic (R17) and partly undefined (R19).
   */
  it('fires the structural-gap rules: no WACC, no basket, no bridge, bad g, wide/non-monotonic/partial grid', async () => {
    const created = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: preparerId });
    const bvId = created.businessVersion.business_version_id;
    const dcfId = randomUUID();
    const gridId = randomUUID();

    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO finance_valuation_variants (id, organization_id, business_version_id, case_id, name, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), orgId, bvId, caseId, 'Degenerate', preparerId]
      );
      // No finance_valuation_wacc_inputs row at all => ADV-R21, and the g<WACC trigger has nothing
      // to compare against, which is exactly the state the rule exists to report.
      await tx.queryRun(
        `INSERT INTO finance_valuation_methods (
           id, organization_id, business_version_id, method_type, readiness, result_value_status,
           result_ev_decimal, is_in_recommendation_basket, created_by
         ) VALUES (?, ?, ?, 'DCF_FCFF', 'READY', 'PRESENT_NONZERO', ?, false, ?)`,
        [dcfId, orgId, bvId, 500_000, preparerId]
      );
      // g = 8% but reinvestment 50% x ROIC 10% implies 5% => 3pp gap (> 0.5pp tolerance)
      await tx.queryRun(
        `INSERT INTO finance_valuation_terminal (
           id, organization_id, method_id, convention, g_pct, reinvestment_rate_pct, roic_pct,
           terminal_value_decimal, terminal_share_pct, is_primary, created_by
         ) VALUES (?, ?, ?, 'GORDON_GROWTH', 8, 50, 10, ?, 40, true, ?)`,
        [randomUUID(), orgId, dcfId, 200_000, preparerId]
      );
      await tx.queryRun(
        `INSERT INTO finance_valuation_sensitivity_grids (
           id, organization_id, method_id, grid_label, row_axis_variable, column_axis_variable, grid_status, created_by
         ) VALUES (?, ?, ?, 'Broken grid', 'TERMINAL_G_PCT', 'WACC_PCT', 'DRAFT', ?)`,
        [gridId, orgId, dcfId, preparerId]
      );
      for (let r = 1; r <= 5; r++) {
        for (let c = 1; c <= 5; c++) {
          // Three structurally undefined cells (g >= WACC corner) => ADV-R19.
          const undefinedCell = r === 5 && c <= 3;
          // Deliberately anti-monotonic in the column direction => ADV-R17, and spanning
          // 200 000..900 000 around a 500 000 base => 140% band => ADV-R16.
          const value = undefinedCell ? null : 200_000 + (c - 1) * 175_000;
          await tx.queryRun(
            `INSERT INTO finance_valuation_sensitivity_cells (
               id, organization_id, grid_id, row_index, col_index, row_axis_value, column_axis_value,
               cell_value_decimal, is_base_cell, created_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [randomUUID(), orgId, gridId, r, c, 8 + (r - 3) * 0.25, 10 + (c - 3) * 0.5, r === 3 && c === 3 ? 500_000 : value, r === 3 && c === 3, preparerId]
          );
        }
      }
      await tx.queryRun(`UPDATE finance_valuation_sensitivity_grids SET grid_status = 'COMPLETE' WHERE id = ?`, [gridId]);
      return null;
    });

    const result = await advisor.generateValuationAdvisorOutput({ variantId: bvId, actorId: preparerId, organizationId: orgId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const fired = new Set(result.findings.map((f) => f.ruleId));

    expect(fired.has('ADV-R21')).toBe(true); // no WACC row
    expect(fired.has('ADV-R20')).toBe(false); // ...so no WACC fact
    expect(fired.has('ADV-R10')).toBe(true); // no basket
    expect(fired.has('ADV-R25')).toBe(true); // no bridge
    expect(fired.has('ADV-R06')).toBe(true); // g contradicts reinvestment x ROIC
    expect(fired.has('ADV-R07')).toBe(false); // ...both inputs ARE present, so not the question
    expect(fired.has('ADV-R16')).toBe(true); // wide band
    expect(fired.has('ADV-R17')).toBe(true); // non-monotonic
    expect(fired.has('ADV-R19')).toBe(true); // 3 undefined cells
    expect(result.findings.find((f) => f.ruleId === 'ADV-R19')?.impactDecimal).toBe(3);
    expect(result.findings.find((f) => f.ruleId === 'ADV-R06')?.impactDecimal).toBeCloseTo(3, 9);
    expect(result.findings.every((f) => f.evidenceRef.rulesVersion === advisor.ADVISOR_RULES_VERSION)).toBe(true);
  }, 120_000);

  it('fires ADV-R09 when a basket member is not READY (weights still sum to 100)', async () => {
    const created = await artifactVersionService.createArtifact({ organizationId: orgId, artifactType: 'VALUATION_CASE', createdBy: preparerId });
    const bvId = created.businessVersion.business_version_id;

    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(
        `INSERT INTO finance_valuation_variants (id, organization_id, business_version_id, case_id, name, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), orgId, bvId, caseId, 'Half-baked basket', preparerId]
      );
      await tx.queryRun(
        `INSERT INTO finance_valuation_methods (
           id, organization_id, business_version_id, method_type, readiness, result_value_status,
           result_ev_decimal, is_in_recommendation_basket, weight_pct, created_by
         ) VALUES (?, ?, ?, 'DCF_FCFF', 'READY', 'PRESENT_NONZERO', ?, true, 60, ?)`,
        [randomUUID(), orgId, bvId, 700_000, preparerId]
      );
      // In the basket, weighted, but never configured — the exact state ADV-R09 reports, and the
      // reason the engine refuses to silently re-normalise the remaining 60% up to 100%.
      await tx.queryRun(
        `INSERT INTO finance_valuation_methods (
           id, organization_id, business_version_id, method_type, readiness, result_value_status,
           is_in_recommendation_basket, weight_pct, created_by
         ) VALUES (?, ?, ?, 'TRADING_COMPS', 'NOT_CONFIGURED', 'MISSING', true, 40, ?)`,
        [randomUUID(), orgId, bvId, preparerId]
      );
      return null;
    });

    const result = await advisor.generateValuationAdvisorOutput({ variantId: bvId, actorId: preparerId, organizationId: orgId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const r09 = result.findings.find((f) => f.ruleId === 'ADV-R09');
    expect(r09).toBeDefined();
    expect(r09!.narrative).toContain('TRADING_COMPS');
    expect(result.findings.some((f) => f.ruleId === 'ADV-R08')).toBe(false); // no weighted result exists
    expect(result.findings.some((f) => f.ruleId === 'ADV-R10')).toBe(false); // a basket DOES exist
  }, 120_000);

  it('fires ADV-C05 when a material EV gap is NOT explained by the discount rate or terminal profile', async () => {
    // Same WACC, same terminal share, EV 40% lower — the gap can only sit in the operating forecast.
    const twin = await buildVariant({
      ...BASE_SPEC,
      name: 'Same rate, lower forecast',
      dcfEv: 600_000,
      compsEv: 620_000,
      bridge: { enterpriseValue: 600_000, debt: 200_000, cash: 50_000 },
      sensitivityBaseEv: 600_000,
    });

    const cmp = await advisor.compareVariantsForAdvisor({
      caseId, variantIdA: base.businessVersionId, variantIdB: twin.businessVersionId, actorId: preparerId, organizationId: orgId,
      persist: true, // so the catalogue-coverage guard below sees ADV-C05 in the database too
    });
    expect(cmp.ok).toBe(true);
    if (!cmp.ok) throw new Error('unreachable');

    const rules = cmp.findings.map((f) => f.ruleId).sort();
    expect(rules).toContain('ADV-C05');
    expect(rules).not.toContain('ADV-C04'); // WACC is identical, so the rate hypothesis must not fire
    const c05 = cmp.findings.find((f) => f.ruleId === 'ADV-C05')!;
    expect(c05.outputKind).toBe('RISK');
    expect(c05.confidence).toBe('HIGH');
    expect(c05.impactDecimal).toBeCloseTo(-40, 9);
  }, 120_000);

  // -------------------------------------------------------------------------------------------
  // 7. The documented rule catalogue matches the code
  // -------------------------------------------------------------------------------------------

  it('exposes a rule catalogue with unique ids that covers every rule the fixtures actually fired', () => {
    if (!baseResult.ok || !downsideResult.ok) throw new Error('unreachable');
    const catalogue = new Set(advisor.ADVISOR_RULES.map((r) => r.id));
    expect(catalogue.size).toBe(advisor.ADVISOR_RULES.length);
    for (const f of [...baseResult.findings, ...downsideResult.findings]) {
      expect(catalogue.has(f.ruleId)).toBe(true);
      const descriptor = advisor.ADVISOR_RULES.find((r) => r.id === f.ruleId)!;
      expect(descriptor.kind).toBe(f.outputKind);
    }
  });

  /**
   * Coverage guard: every rule in the published catalogue must actually have fired against the real
   * database somewhere in this file. Adding a rule without a fixture that reaches it turns this red,
   * which is the only way to stop the catalogue drifting into rules nobody has ever seen execute.
   */
  it('every rule in the catalogue was exercised by a fixture and landed in the database', async () => {
    const rows = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ rule_id: string }>(
        `SELECT DISTINCT evidence_ref->>'ruleId' AS rule_id
           FROM finance_valuation_advisor_outputs WHERE organization_id = ?`,
        [orgId]
      )
    );
    const firedInDb = new Set(rows.map((r) => r.rule_id));
    const missing = advisor.ADVISOR_RULES.map((r) => r.id).filter((id) => !firedInDb.has(id));
    expect(missing).toEqual([]);
    expect(firedInDb.size).toBe(advisor.ADVISOR_RULES.length);
  });
});
