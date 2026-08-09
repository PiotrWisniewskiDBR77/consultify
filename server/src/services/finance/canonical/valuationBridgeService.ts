/**
 * Finance v3 canonical — Enterprise Valuation compute, EV→Equity bridge layer (Gate D / Fala 7,
 * WP-D10).
 *
 * Program: handoff section 9 ("EV→Equity: debt, leases, pensions/provisions, minorities/NCI,
 * associates/investments, restricted/excess cash i non-operating assets, options/dilution i
 * debt-like items, aligned as-of"). Schema: `WP-D09_valuation_schema_ADR.md` section 9
 * (`finance_valuation_ev_equity_bridge` header + `_components` child, `as_of` alignment enforced by
 * `finance_bridge_check_as_of_alignment()`, a HARD block — ADR section 15 pt.1: read here as the
 * same class of problem as a "matematycznie nieokreślona operacja", stricter than DEC-FIN-009's
 * Info/Warning/Material/Critical tiers).
 *
 * `assertAsOfAlignment()` mirrors that DB trigger exactly (same reasoning as
 * `valuationTerminalService.ts`'s `assertGBelowWacc()` mirroring the g<WACC trigger) — checked
 * BEFORE any INSERT is attempted, per the task's own instruction ("DB trigger już to wymusza z D09b,
 * serwis daje czytelny błąd wcześniej").
 */

import { randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type BridgeComponentKind =
  | 'DEBT'
  | 'LEASES'
  | 'PENSIONS_PROVISIONS'
  | 'MINORITIES'
  | 'ASSOCIATES_INVESTMENTS'
  | 'CASH'
  | 'RESTRICTED_CASH'
  | 'NON_OPERATING_ASSETS'
  | 'OPTIONS_DILUTION'
  | 'OTHER';

export type BridgeComponentSign = 'SUBTRACT_FROM_EV' | 'ADD_TO_EV';

export interface BridgeComponentInput {
  sequenceOrder: number;
  componentKind: BridgeComponentKind;
  sign: BridgeComponentSign;
  /** Always a non-negative magnitude — direction comes exclusively from `sign` (WP-D09 section 9: "explicit, not inferred from amount sign"). */
  amountDecimal: number;
  asOfDate: string; // ISO date
  rationale?: string | null;
}

export type BridgeErrorCode = 'AS_OF_MISMATCH' | 'NEGATIVE_AMOUNT';

export type AssertAsOfResult = { ok: true } | { ok: false; code: 'AS_OF_MISMATCH'; message: string };

/** Mirrors `finance_bridge_check_as_of_alignment()` (WP-D09b migration file 2, section 4). */
export function assertAsOfAlignment(headerAsOfDate: string, components: readonly Pick<BridgeComponentInput, 'asOfDate' | 'componentKind'>[]): AssertAsOfResult {
  for (const c of components) {
    if (c.asOfDate !== headerAsOfDate) {
      return {
        ok: false,
        code: 'AS_OF_MISMATCH',
        message: `component ${c.componentKind} as_of_date (${c.asOfDate}) does not match bridge header as_of_date (${headerAsOfDate})`,
      };
    }
  }
  return { ok: true };
}

export interface ComputeEquityValueResult {
  ok: true;
  equityValueDecimal: number;
  breakdown: { componentKind: BridgeComponentKind; sign: BridgeComponentSign; signedAmount: number }[];
}

export type ComputeEquityValueError = { ok: false; code: BridgeErrorCode; message: string };

/**
 * `EquityValue = EnterpriseValue + Σ(signed components)` where `SUBTRACT_FROM_EV` contributes
 * `-amountDecimal` and `ADD_TO_EV` contributes `+amountDecimal` — e.g. DEBT/LEASES/PENSIONS/
 * MINORITIES/OPTIONS_DILUTION are conventionally `SUBTRACT_FROM_EV`, CASH/ASSOCIATES_INVESTMENTS/
 * NON_OPERATING_ASSETS conventionally `ADD_TO_EV`, but the sign is always taken from the EXPLICIT
 * `sign` field (never inferred from `componentKind`), matching the schema's own "explicit, not
 * inferred" decision.
 */
export function computeEquityValue(
  enterpriseValue: number,
  components: readonly BridgeComponentInput[]
): ComputeEquityValueResult | ComputeEquityValueError {
  for (const c of components) {
    if (c.amountDecimal < 0) {
      return { ok: false, code: 'NEGATIVE_AMOUNT', message: `component ${c.componentKind} has a negative amountDecimal (${c.amountDecimal}) — magnitude must be non-negative, direction comes from sign` };
    }
  }
  const breakdown = components.map((c) => ({
    componentKind: c.componentKind,
    sign: c.sign,
    signedAmount: c.sign === 'SUBTRACT_FROM_EV' ? -c.amountDecimal : c.amountDecimal,
  }));
  const equityValueDecimal = enterpriseValue + breakdown.reduce((sum, b) => sum + b.signedAmount, 0);
  return { ok: true, equityValueDecimal, breakdown };
}

// ---------------------------------------------------------------------------
// DB write
// ---------------------------------------------------------------------------

export interface WriteBridgeParams {
  organizationId: string;
  businessVersionId: string;
  asOfDate: string;
  enterpriseValueDecimal: number;
  equityValueDecimal: number;
  components: readonly BridgeComponentInput[];
  createdBy: string;
}

export type WriteBridgeResult = { ok: true; bridgeId: string } | ComputeEquityValueError;

export async function writeBridge(params: WriteBridgeParams): Promise<WriteBridgeResult> {
  const alignment = assertAsOfAlignment(params.asOfDate, params.components);
  if (!alignment.ok) return alignment;

  const bridgeId = uuidv4();
  await withPinnedPostgresTransaction(async (tx) => {
    await tx.queryRun(
      `INSERT INTO finance_valuation_ev_equity_bridge (
         id, organization_id, business_version_id, as_of_date, enterprise_value_decimal, equity_value_decimal, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (business_version_id) DO UPDATE SET
         as_of_date = EXCLUDED.as_of_date, enterprise_value_decimal = EXCLUDED.enterprise_value_decimal,
         equity_value_decimal = EXCLUDED.equity_value_decimal, updated_at = now()
       RETURNING id`,
      [bridgeId, params.organizationId, params.businessVersionId, params.asOfDate, params.enterpriseValueDecimal, params.equityValueDecimal, params.createdBy]
    );
    const headerId = (
      await tx.queryOne<{ id: string }>(`SELECT id FROM finance_valuation_ev_equity_bridge WHERE business_version_id = ?`, [params.businessVersionId])
    )?.id;
    if (!headerId) throw new Error('writeBridge: header row not found after upsert');

    // Additive-only replace: delete this bridge's own components (never another bridge's — scoped
    // by bridge_id) then re-insert the full, freshly-validated set in the SAME transaction, so a
    // recompute never leaves a stale component alongside a new one at the same sequence_order.
    await tx.queryRun(`DELETE FROM finance_valuation_ev_equity_bridge_components WHERE bridge_id = ?`, [headerId]);
    for (const c of params.components) {
      await tx.queryRun(
        `INSERT INTO finance_valuation_ev_equity_bridge_components (
           id, organization_id, bridge_id, sequence_order, component_kind, sign, amount_decimal, as_of_date, rationale, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), params.organizationId, headerId, c.sequenceOrder, c.componentKind, c.sign, c.amountDecimal, c.asOfDate, c.rationale ?? null, params.createdBy]
      );
    }
    return headerId;
  });

  return { ok: true, bridgeId };
}
