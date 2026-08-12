/**
 * Step 2/7 — Assumptions: the shared WACC/capital-structure inputs every method reads from
 * (`finance_valuation_wacc_inputs`, one row per variant). Terminal-growth assumptions are
 * per-method (see Methods & weights / Sensitivity) — this step is scoped to what B3 actually
 * models as variant-level "assumptions".
 *
 * Renders `assertWaccConsistency` (nominal/real, pre/post-tax, currency — coordinator correction)
 * as a visible, named gate, not a silent pass/fail — the FCFF currency used for the check is the
 * WACC's own currency field until an actual FCFF run supplies a measured one (there is no
 * currency-only endpoint), documented inline.
 */
import React, { useState } from 'react';

import type { ValuationWaccInputsRawDto } from '@/services/api/financeV2.types';
import type { UpsertValuationWaccInputsParams } from '@/services/api/financeV2.api';

import { assertWaccConsistency } from '../valuationMath';

export interface AssumptionsStepProps {
  wacc: ValuationWaccInputsRawDto | null;
  onSave: (params: UpsertValuationWaccInputsParams) => Promise<void>;
}

function numOrNull(v: string | null): number | null {
  return v === null || v === '' ? null : Number(v);
}

export function AssumptionsStep(props: AssumptionsStepProps): React.ReactElement {
  const { wacc, onSave } = props;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [draft, setDraft] = useState<UpsertValuationWaccInputsParams>(() => ({
    currency: wacc?.currency ?? 'PLN',
    nominalOrReal: wacc?.nominal_or_real ?? 'NOMINAL',
    preOrPostTax: wacc?.pre_or_post_tax ?? 'POST_TAX',
    riskFreeRatePct: numOrNull(wacc?.risk_free_rate_pct ?? null),
    equityRiskPremiumPct: numOrNull(wacc?.equity_risk_premium_pct ?? null),
    betaUnlevered: numOrNull(wacc?.beta_unlevered ?? null),
    targetCapitalStructureDebtPct: numOrNull(wacc?.target_capital_structure_debt_pct ?? null),
    targetCapitalStructureEquityPct: numOrNull(wacc?.target_capital_structure_equity_pct ?? null),
    currentCapitalStructureDebtPct: numOrNull(wacc?.current_capital_structure_debt_pct ?? null),
    currentCapitalStructureEquityPct: numOrNull(wacc?.current_capital_structure_equity_pct ?? null),
    costOfDebtPretaxPct: numOrNull(wacc?.cost_of_debt_pretax_pct ?? null),
    creditSpreadPct: numOrNull(wacc?.credit_spread_pct ?? null),
    cashTaxRatePct: numOrNull(wacc?.cash_tax_rate_pct ?? null),
  }));

  // The engine's own FCFF is always NOMINAL/PLN-or-whatever-the-statement-currency-is — until a
  // real DCF run exists, the honest comparison is "does WACC's own declared convention satisfy
  // the engine's fixed NOMINAL/POST_TAX requirement", using WACC's own currency as the target
  // (a currency MISMATCH can only be detected once an actual FCFF currency is known).
  const consistency = assertWaccConsistency({ nominalOrReal: draft.nominalOrReal, preOrPostTax: draft.preOrPostTax, currency: draft.currency }, draft.currency);

  function setField<K extends keyof UpsertValuationWaccInputsParams>(key: K, value: UpsertValuationWaccInputsParams[K]): void {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Zapis nie powiódł się.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-4" data-testid="valuation-assumptions-step">
      <h2 className="text-sm font-semibold text-c-text">Założenia — WACC i struktura kapitału</h2>

      <div
        role="status"
        data-testid="wacc-consistency-banner"
        data-consistent={consistency.ok}
        className={`rounded-lg border px-3 py-2 text-xs ${consistency.ok ? 'border-c-success/30 bg-c-success/10 text-c-success' : 'border-c-danger/30 bg-c-danger/10 text-c-danger'}`}
      >
        {consistency.ok
          ? 'Spójność nominal/real, pre/post-tax i waluty: OK.'
          : !consistency.ok && consistency.message}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
          Waluta
          <input
            data-testid="wacc-currency"
            className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-sm text-c-text"
            value={draft.currency}
            onChange={(e) => setField('currency', e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
          Nominalna / realna
          <select
            data-testid="wacc-nominal-or-real"
            className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-sm text-c-text"
            value={draft.nominalOrReal}
            onChange={(e) => setField('nominalOrReal', e.target.value as 'NOMINAL' | 'REAL')}
          >
            <option value="NOMINAL">Nominalna</option>
            <option value="REAL">Realna</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
          Przed / po opodatkowaniu
          <select
            data-testid="wacc-pre-or-post-tax"
            className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-sm text-c-text"
            value={draft.preOrPostTax}
            onChange={(e) => setField('preOrPostTax', e.target.value as 'PRE_TAX' | 'POST_TAX')}
          >
            <option value="PRE_TAX">Przed opodatkowaniem</option>
            <option value="POST_TAX">Po opodatkowaniu</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
          Stopa wolna od ryzyka (%)
          <input
            type="number"
            data-testid="wacc-risk-free-rate"
            className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-sm text-c-text"
            value={draft.riskFreeRatePct ?? ''}
            onChange={(e) => setField('riskFreeRatePct', e.target.value === '' ? null : Number(e.target.value))}
          />
        </label>
      </div>

      {wacc?.wacc_computed_pct !== undefined && wacc?.wacc_computed_pct !== null && (
        <p className="text-xs text-c-text-muted">
          Ostatnio obliczony WACC: <span className="font-mono text-c-text">{wacc.wacc_computed_pct}%</span>
        </p>
      )}

      {saveError && (
        <p role="alert" className="text-xs text-c-danger" data-testid="wacc-save-error">
          {saveError}
        </p>
      )}

      <button
        type="button"
        data-testid="wacc-save-button"
        disabled={saving}
        onClick={handleSave}
        className="inline-flex min-h-[2.75rem] items-center rounded-xl bg-c-text px-4 text-xs font-semibold text-c-surface shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
      >
        {saving ? 'Zapisywanie…' : 'Zapisz założenia WACC'}
      </button>
    </div>
  );
}

export default AssumptionsStep;
