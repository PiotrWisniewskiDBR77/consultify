/**
 * Finance v3 canonical — Enterprise Valuation compute, Terminal Value layer (Gate D / Fala 7, WP-D10).
 *
 * Program: handoff section 9 ("Terminal: g < WACC, g = reinvestment rate × ROIC, steady-state
 * margins/CAPEX/WC, Gordon i exit multiple jako jawne warianty/cross-checki"). Schema:
 * `WP-D09_valuation_schema_ADR.md` section 8 (`finance_valuation_terminal`, `UNIQUE(method_id,
 * convention)` — up to one `GORDON_GROWTH` + one `EXIT_MULTIPLE` row per method,
 * `trg_finance_valuation_terminal_check_g_below_wacc` a DB trigger rejecting `g >= WACC` at INSERT/
 * UPDATE time).
 *
 * `assertGBelowWacc()` below is the SAME rule as that DB trigger, checked here FIRST so a caller
 * gets a clear, typed rejection before ever attempting the INSERT the DB trigger would also reject
 * (ADR section 3 zadanie point 3 — "walidacja g<WACC (już wymuszona w DB, ale serwis powinien dać
 * czytelny błąd przed próbą zapisu, nie polegać wyłącznie na trigger reject)"). The DB trigger
 * remains the authoritative enforcement point (defense in depth, same "app-level mirror, DB is
 * still the source of truth" discipline `lineageService.ts`'s `validateEdgeRank()` already
 * established for the lineage-cycle rule) — this module can only drift out of sync with it if
 * someone edits one side and not the other.
 */

import { randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';

// ---------------------------------------------------------------------------
// Gordon Growth
// ---------------------------------------------------------------------------

export type TerminalErrorCode = 'G_MUST_BE_LESS_THAN_WACC' | 'INVALID_EXIT_MULTIPLE_INPUT';

export type GordonTerminalResult =
  | { ok: true; terminalValue: number }
  | { ok: false; code: TerminalErrorCode; message: string };

/** Mirrors `finance_valuation_terminal_check_g_below_wacc()` (WP-D09b migration file 2, section 3) — checked BEFORE any DB write is attempted. */
export function assertGBelowWacc(gPct: number, waccPct: number): { ok: true } | { ok: false; code: 'G_MUST_BE_LESS_THAN_WACC'; message: string } {
  if (gPct >= waccPct) {
    return {
      ok: false,
      code: 'G_MUST_BE_LESS_THAN_WACC',
      message: `terminal growth g_pct (${gPct}) must be strictly less than computed WACC (${waccPct}) — Gordon Growth is undefined/negative otherwise`,
    };
  }
  return { ok: true };
}

/**
 * `TV = FCFF_terminal * (1 + g) / (WACC - g)`. `fcffTerminalYear` and the returned `terminalValue`
 * are both in the SAME full presentation-currency units `valuationFcffService.computeFcffSeries()`
 * already normalized to — this function does no unit/multiplier handling of its own, by design (it
 * operates purely on already-normalized scalars).
 */
export function computeGordonTerminalValue(params: { fcffTerminalYear: number; gPct: number; waccPct: number }): GordonTerminalResult {
  const gate = assertGBelowWacc(params.gPct, params.waccPct);
  if (!gate.ok) return gate;
  const g = params.gPct / 100;
  const wacc = params.waccPct / 100;
  const terminalValue = (params.fcffTerminalYear * (1 + g)) / (wacc - g);
  return { ok: true, terminalValue };
}

// ---------------------------------------------------------------------------
// Exit multiple (cross-check convention)
// ---------------------------------------------------------------------------

export type ExitMultipleResult = { ok: true; terminalValue: number } | { ok: false; code: 'INVALID_EXIT_MULTIPLE_INPUT'; message: string };

/** `TV = terminalMetricValue * exitMultiple` (e.g. terminal-year EBITDA * EV/EBITDA multiple). */
export function computeExitMultipleTerminalValue(params: { terminalMetricValue: number; exitMultiple: number }): ExitMultipleResult {
  if (params.exitMultiple <= 0) {
    return { ok: false, code: 'INVALID_EXIT_MULTIPLE_INPUT', message: `exit_multiple_value must be > 0, got ${params.exitMultiple}` };
  }
  return { ok: true, terminalValue: params.terminalMetricValue * params.exitMultiple };
}

/** `terminal_share_pct = PV(terminal value) / Enterprise Value` — the "high terminal share" flag input (handoff section 9). */
export function computeTerminalSharePct(presentValueOfTerminal: number, enterpriseValue: number): number | null {
  if (enterpriseValue === 0) return null;
  return (presentValueOfTerminal / enterpriseValue) * 100;
}

/**
 * `g = reinvestment_rate × ROIC` — a DOCUMENTED reasonableness cross-check (ADR section 8), never a
 * hard rule: an analyst may deliberately choose a `g` that does not match this simplified identity,
 * with `rationale` explaining why (same class of judgment call as `finance_baseline_assumptions
 * .rationale`). Returns the implied `g` for the caller to compare against the chosen `g_pct`, never
 * throws/rejects.
 */
export function impliedGFromReinvestmentRoic(reinvestmentRatePct: number, roicPct: number): number {
  return (reinvestmentRatePct / 100) * (roicPct / 100) * 100;
}

// ---------------------------------------------------------------------------
// DB write
// ---------------------------------------------------------------------------

export interface TerminalRowInput {
  organizationId: string;
  methodId: string;
  convention: 'GORDON_GROWTH' | 'EXIT_MULTIPLE';
  gPct?: number | null;
  exitMultipleValue?: number | null;
  reinvestmentRatePct?: number | null;
  roicPct?: number | null;
  terminalValueDecimal: number;
  terminalSharePct?: number | null;
  isPrimary: boolean;
  rationale?: string | null;
  createdBy: string;
}

/**
 * INSERTs one `finance_valuation_terminal` row. Callers MUST have already run
 * `assertGBelowWacc()`/`computeGordonTerminalValue()` for a `GORDON_GROWTH` row — this function does
 * not re-derive WACC (it does not know the method's business_version_id's WACC without another
 * round trip the orchestrator already has cheaply available) but the DB's own
 * `trg_finance_valuation_terminal_check_g_below_wacc` trigger is still the final, authoritative gate
 * on every INSERT regardless of what this service already checked.
 */
export async function writeTerminalRow(input: TerminalRowInput): Promise<{ id: string }> {
  if (input.convention === 'GORDON_GROWTH' && (input.gPct === null || input.gPct === undefined)) {
    throw new Error('writeTerminalRow: GORDON_GROWTH convention requires gPct');
  }
  if (input.convention === 'EXIT_MULTIPLE' && (input.exitMultipleValue === null || input.exitMultipleValue === undefined)) {
    throw new Error('writeTerminalRow: EXIT_MULTIPLE convention requires exitMultipleValue');
  }
  const id = uuidv4();
  await withPinnedPostgresTransaction((tx) =>
    tx.queryRun(
      `INSERT INTO finance_valuation_terminal (
         id, organization_id, method_id, convention, g_pct, exit_multiple_value,
         reinvestment_rate_pct, roic_pct, terminal_value_decimal, terminal_share_pct, is_primary,
         rationale, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (method_id, convention) DO UPDATE SET
         g_pct = EXCLUDED.g_pct, exit_multiple_value = EXCLUDED.exit_multiple_value,
         reinvestment_rate_pct = EXCLUDED.reinvestment_rate_pct, roic_pct = EXCLUDED.roic_pct,
         terminal_value_decimal = EXCLUDED.terminal_value_decimal, terminal_share_pct = EXCLUDED.terminal_share_pct,
         is_primary = EXCLUDED.is_primary, rationale = EXCLUDED.rationale, updated_at = now()`,
      [
        id,
        input.organizationId,
        input.methodId,
        input.convention,
        input.convention === 'GORDON_GROWTH' ? input.gPct ?? null : null,
        input.convention === 'EXIT_MULTIPLE' ? input.exitMultipleValue ?? null : null,
        input.reinvestmentRatePct ?? null,
        input.roicPct ?? null,
        input.terminalValueDecimal,
        input.terminalSharePct ?? null,
        input.isPrimary,
        input.rationale ?? null,
        input.createdBy,
      ]
    )
  );
  return { id };
}

// ---------------------------------------------------------------------------
// Pakiet B3 (Valuation HTTP Surface) — thin reader
// ---------------------------------------------------------------------------

export interface TerminalRow {
  id: string;
  organization_id: string;
  method_id: string;
  convention: 'GORDON_GROWTH' | 'EXIT_MULTIPLE';
  g_pct: string | null;
  exit_multiple_value: string | null;
  reinvestment_rate_pct: string | null;
  roic_pct: string | null;
  terminal_value_decimal: string | null;
  terminal_share_pct: string | null;
  is_primary: boolean;
  rationale: string | null;
}

/** Up to two rows per method (one `GORDON_GROWTH`, one `EXIT_MULTIPLE` cross-check — `UNIQUE(method_id, convention)`). */
export async function listTerminalRows(organizationId: string, methodId: string): Promise<TerminalRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<TerminalRow>(
      `SELECT t.* FROM finance_valuation_terminal t
         JOIN finance_valuation_methods m ON m.id = t.method_id
        WHERE t.method_id = ? AND t.organization_id = ? AND m.organization_id = ?
        ORDER BY t.convention`,
      [methodId, organizationId, organizationId]
    )
  );
}
