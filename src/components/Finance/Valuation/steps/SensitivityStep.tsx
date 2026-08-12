/**
 * Step 5/7 — Sensitivity (DEC-FIN-005 point 4): the 5×5 WACC × terminal-g grid. OWN-FIN-002
 * history: a grid SHAPE bug once crashed the entire view — this step renders the grid through
 * `assertSensitivityGridIntegrity` (shape + monotonicity, coordinator correction) FIRST, and
 * only renders the table once both gates pass; a failing gate is shown as an explicit banner
 * instead of a crash or a silently-wrong table.
 *
 * ★ HONEST GAP: B3 exposes no "list grids for a method" endpoint (only
 * `GET .../sensitivity/:gridLabel`, which requires already knowing the label) — this step lets
 * the user type the label (defaulting to the `'PRIMARY'` convention this package assumes, since
 * no discovery endpoint exists to confirm the real convention other packages use).
 */
import React, { useState } from 'react';

import type { ValuationMethodDto, ValuationSensitivityGridRawDto, ValuationWeightedRecommendationDto } from '@/services/api/financeV2.types';

import { assertSensitivityGridIntegrity } from '../valuationMath';

export interface SensitivityStepProps {
  businessVersionId: string;
  methodsData: { methods: ValuationMethodDto[]; weightedRecommendation: ValuationWeightedRecommendationDto } | null;
  getGrid: (methodId: string, gridLabel: string) => Promise<ValuationSensitivityGridRawDto>;
}

export function SensitivityStep(props: SensitivityStepProps): React.ReactElement {
  const { methodsData, getGrid } = props;
  const [methodId, setMethodId] = useState<string>('');
  const [gridLabel, setGridLabel] = useState('PRIMARY');
  const [grid, setGrid] = useState<ValuationSensitivityGridRawDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const methods = methodsData?.methods ?? [];
  const effectiveMethodId = methodId || methods[0]?.methodId || '';

  async function handleLoad(): Promise<void> {
    if (!effectiveMethodId) return;
    setLoading(true);
    setLoadError(null);
    setGrid(null);
    try {
      const g = await getGrid(effectiveMethodId, gridLabel);
      setGrid(g);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Nie udało się wczytać siatki wrażliwości.');
    } finally {
      setLoading(false);
    }
  }

  const cellsForIntegrityCheck = grid
    ? grid.cells.map((c) => ({
        rowIndex: c.row_index,
        colIndex: c.col_index,
        rowAxisValue: c.row_axis_value === null ? 0 : Number(c.row_axis_value),
        columnAxisValue: c.column_axis_value === null ? 0 : Number(c.column_axis_value),
        cellValueDecimal: c.cell_value_decimal === null ? null : Number(c.cell_value_decimal),
        isBaseCell: c.is_base_cell,
      }))
    : [];
  const integrity = grid ? assertSensitivityGridIntegrity(cellsForIntegrityCheck) : null;

  return (
    <div className="max-w-3xl space-y-4" data-testid="valuation-sensitivity-step">
      <h2 className="text-sm font-semibold text-c-text">Wrażliwość — WACC × wzrost terminalny (5×5)</h2>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
          Metoda
          <select
            data-testid="sensitivity-method-select"
            value={effectiveMethodId}
            onChange={(e) => setMethodId(e.target.value)}
            className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-c-text"
          >
            {methods.map((m) => (
              <option key={m.methodId} value={m.methodId}>
                {m.methodType}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-c-text-secondary">
          Etykieta siatki
          <input
            data-testid="sensitivity-grid-label"
            value={gridLabel}
            onChange={(e) => setGridLabel(e.target.value)}
            className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-c-text"
          />
        </label>
        <button
          type="button"
          data-testid="sensitivity-load-button"
          disabled={!effectiveMethodId || loading}
          onClick={handleLoad}
          className="inline-flex min-h-[2.75rem] items-center rounded-xl border border-c-border-subtle bg-c-surface px-3 text-xs font-semibold text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
        >
          {loading ? 'Wczytywanie…' : 'Wczytaj siatkę'}
        </button>
      </div>

      {loadError && (
        <p role="alert" className="text-xs text-c-danger" data-testid="sensitivity-load-error">
          {loadError}
        </p>
      )}

      {grid && integrity && (
        <>
          <div
            role="status"
            data-testid="sensitivity-integrity-banner"
            data-ok={integrity.ok}
            className={`rounded-lg border px-3 py-2 text-xs ${integrity.ok ? 'border-c-success/30 bg-c-success/10 text-c-success' : 'border-c-danger/30 bg-c-danger/10 text-c-danger'}`}
          >
            {!integrity.shape.ok && integrity.shape.message}
            {integrity.shape.ok && integrity.monotonicityViolation && `Naruszenie monotoniczności: ${integrity.monotonicityViolation}`}
            {integrity.ok && 'Siatka 5×5: kształt i monotoniczność OK.'}
          </div>

          {integrity.ok && (
            <table className="border-collapse text-center text-xs" data-testid="sensitivity-grid-table"> {/* §27-exempt: numeryczna macierz 5x5 (WACC x g), nie lista rekordów */}
              <caption className="sr-only">Siatka wrażliwości EV: wiersze = wzrost terminalny g, kolumny = WACC</caption>
              <thead>
                <tr>
                  <th className="p-1 text-c-text-muted">g \ WACC</th>
                  {[1, 2, 3, 4, 5].map((c) => {
                    const cell = grid.cells.find((x) => x.col_index === c);
                    return (
                      <th key={c} className="p-1 text-c-text-muted">
                        {cell?.column_axis_value ?? c}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((r) => (
                  <tr key={r}>
                    <th className="p-1 text-c-text-muted">{grid.cells.find((x) => x.row_index === r)?.row_axis_value ?? r}</th>
                    {[1, 2, 3, 4, 5].map((c) => {
                      const cell = grid.cells.find((x) => x.row_index === r && x.col_index === c);
                      return (
                        <td
                          key={c}
                          data-testid={`sensitivity-cell-${r}-${c}`}
                          className={`border border-c-border-subtle p-1.5 ${cell?.is_base_cell ? 'bg-c-surface-raised font-semibold text-c-text' : 'text-c-text-secondary'}`}
                        >
                          {cell?.cell_value_decimal ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default SensitivityStep;
