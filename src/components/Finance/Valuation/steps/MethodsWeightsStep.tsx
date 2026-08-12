/**
 * Step 3/7 — Methods & weights (DEC-FIN-005 point 2): every method is COMPLETE or N/A (never a
 * false PLN 0 — rendered via `<ValuationValueCell>`), basket weights sum to 100% (validated
 * live, client-side, via `validateBasketWeights` before the batch PATCH is even sent), and
 * cross-checks are never weighted.
 */
import React, { useEffect, useState } from 'react';

import type { ValuationMethodDto, ValuationMethodType, ValuationWeightedRecommendationDto } from '@/services/api/financeV2.types';
import { ValuationMethodTypeValues, valuationMethodReadinessLabel, valuationMethodTypeLabel } from '@/services/api/financeV2.types';
import type { ValuationBasketUpdate } from '@/services/api/financeV2.api';

import { ValuationValueCell } from '../ValuationValueCell';
import { validateBasketWeights } from '../valuationMath';

export interface MethodsWeightsStepProps {
  methodsData: { methods: ValuationMethodDto[]; weightedRecommendation: ValuationWeightedRecommendationDto } | null;
  onCreateMethod: (methodType: ValuationMethodType) => Promise<void>;
  onSaveBasket: (updates: ValuationBasketUpdate[]) => Promise<void>;
}

interface DraftRow {
  methodId: string;
  isInRecommendationBasket: boolean;
  weightPct: number | null;
}

function toDraftRows(methods: readonly ValuationMethodDto[]): DraftRow[] {
  return methods.map((m) => ({ methodId: m.methodId, isInRecommendationBasket: m.isInRecommendationBasket, weightPct: m.weightPct === null ? null : Number(m.weightPct) }));
}

export function MethodsWeightsStep(props: MethodsWeightsStepProps): React.ReactElement {
  const { methodsData, onCreateMethod, onSaveBasket } = props;
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newMethodType, setNewMethodType] = useState<ValuationMethodType>('DCF_FCFF');

  useEffect(() => {
    if (methodsData) setDraftRows(toDraftRows(methodsData.methods));
  }, [methodsData]);

  if (!methodsData) {
    return (
      <p className="text-xs text-c-text-muted" data-testid="methods-step-loading">
        Wczytywanie metod…
      </p>
    );
  }

  const { methods, weightedRecommendation } = methodsData;
  const validation = validateBasketWeights(draftRows);

  function updateRow(methodId: string, patch: Partial<DraftRow>): void {
    setDraftRows((rows) => rows.map((r) => (r.methodId === methodId ? { ...r, ...patch } : r)));
  }

  async function handleSaveBasket(): Promise<void> {
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveBasket(draftRows);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Zapis koszyka wag nie powiódł się.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4" data-testid="valuation-methods-step">
      <h2 className="text-sm font-semibold text-c-text">Metody wyceny i wagi koszyka rekomendacji</h2>

      {/* §27-exempt: wewnętrzna tabela edytora koszyka metod wyceny (edycja checkbox/waga per wiersz), nie ekran listowy modułu — docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md */}
      <table className="w-full text-left text-xs" data-testid="methods-table" data-canon="§27-exempt">
        <thead>
          <tr className="border-b border-c-border-subtle text-c-text-muted">
            <th className="py-1.5 pr-2">Metoda</th>
            <th className="py-1.5 pr-2">Gotowość</th>
            <th className="py-1.5 pr-2">Wynik (EV)</th>
            <th className="py-1.5 pr-2">W koszyku</th>
            <th className="py-1.5 pr-2">Waga %</th>
          </tr>
        </thead>
        <tbody>
          {methods.map((m) => {
            const row = draftRows.find((r) => r.methodId === m.methodId);
            return (
              <tr key={m.methodId} className="border-b border-c-border-subtle/60" data-testid={`method-row-${m.methodType}`}>
                <td className="py-1.5 pr-2 text-c-text">{valuationMethodTypeLabel(m.methodType)}</td>
                <td className="py-1.5 pr-2 text-c-text-muted">{valuationMethodReadinessLabel(m.readiness)}</td>
                <td className="py-1.5 pr-2">
                  <ValuationValueCell status={m.result.status} valueDecimal={m.result.valueDecimal} />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="checkbox"
                    data-testid={`method-basket-checkbox-${m.methodType}`}
                    checked={row?.isInRecommendationBasket ?? false}
                    onChange={(e) => updateRow(m.methodId, { isInRecommendationBasket: e.target.checked, weightPct: e.target.checked ? (row?.weightPct ?? 0) : null })}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <input
                    type="number"
                    data-testid={`method-weight-input-${m.methodType}`}
                    disabled={!row?.isInRecommendationBasket}
                    value={row?.weightPct ?? ''}
                    onChange={(e) => updateRow(m.methodId, { weightPct: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-16 rounded-md border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-c-text disabled:opacity-40"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div
        role="status"
        data-testid="basket-weight-validation"
        data-valid={validation.ok}
        className={`rounded-lg border px-3 py-2 text-xs ${validation.ok ? 'border-c-success/30 bg-c-success/10 text-c-success' : 'border-c-danger/30 bg-c-danger/10 text-c-danger'}`}
      >
        {validation.basketSumPct === null
          ? 'Koszyk jest pusty — brak metod do zważenia.'
          : `Suma wag koszyka: ${validation.basketSumPct}% ${validation.sumMatches100 ? '(OK, = 100%)' : '(MUSI wynosić dokładnie 100%)'}`}
        {validation.issues.length > 0 && (
          <ul className="mt-1 list-disc pl-4">
            {validation.issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        )}
      </div>

      {weightedRecommendation.status === 'READY' && (
        <p className="text-xs text-c-text-muted" data-testid="weighted-recommendation-summary">
          Ważona rekomendacja: <span className="font-mono text-c-text">{weightedRecommendation.weightedEnterpriseValue.toLocaleString('pl-PL')}</span>
        </p>
      )}
      {weightedRecommendation.status === 'INCOMPLETE' && (
        <p className="text-xs text-c-warning" data-testid="weighted-recommendation-incomplete">
          Rekomendacja niekompletna — metody w koszyku bez gotowego wyniku:{' '}
          {weightedRecommendation.notReadyMethodTypes.map(valuationMethodTypeLabel).join(', ')}
        </p>
      )}

      {saveError && (
        <p role="alert" className="text-xs text-c-danger" data-testid="basket-save-error">
          {saveError}
        </p>
      )}

      <button
        type="button"
        data-testid="basket-save-button"
        disabled={saving || !validation.ok}
        onClick={handleSaveBasket}
        className="inline-flex min-h-[2.75rem] items-center rounded-xl bg-c-text px-4 text-xs font-semibold text-c-surface shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
      >
        {saving ? 'Zapisywanie…' : 'Zapisz koszyk wag'}
      </button>

      <div className="flex items-center gap-2 border-t border-c-border-subtle pt-4">
        <select
          data-testid="new-method-type-select"
          value={newMethodType}
          onChange={(e) => setNewMethodType(e.target.value as ValuationMethodType)}
          className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text"
        >
          {ValuationMethodTypeValues.map((t) => (
            <option key={t} value={t}>
              {valuationMethodTypeLabel(t)}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid="add-method-button"
          onClick={() => onCreateMethod(newMethodType)}
          className="inline-flex min-h-[2.75rem] items-center rounded-xl border border-c-border-subtle bg-c-surface px-3 text-xs font-semibold text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Dodaj metodę
        </button>
      </div>
    </div>
  );
}

export default MethodsWeightsStep;
