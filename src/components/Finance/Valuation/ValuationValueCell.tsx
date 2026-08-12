/**
 * `ValuationValueCell` — the ONE place every numeric result in this workspace renders through.
 *
 * CLAUDE.md kanon (OWN-FIN-021 point 3): "metoda jest KOMPLETNA albo N/A. NIGDY fałszywe zero."
 * `PRESENT_ZERO`/`PRESENT_NONZERO`/`MISSING`/`NA`/`NOT_APPLICABLE` are FIVE distinct states — this
 * component renders all five distinctly:
 *   - PRESENT_ZERO / PRESENT_NONZERO → the formatted number (via `formatFinanceValueForDisplay`,
 *     Pakiet C, already proven to never render MISSING/NA as "0").
 *   - MISSING → "— Brak danych (luka źródłowa)" — a data gap, could be filled later.
 *   - NA → "— Analityk oznaczył: nie dotyczy" — an analyst judgment call, not a gap.
 *   - NOT_APPLICABLE → "— Pole strukturalnie nie istnieje dla tej linii/branży" — structural, not a
 *     judgment call.
 * The distinguishing REASON is always visible as text next to the glyph (never color-only,
 * a11y) — this is what the coordinator's correction means by "dwie różne informacje dla
 * użytkownika, żadna z nich to nie PLN 0".
 */
import React from 'react';

import { financeValueDisplayReasonLabel, formatFinanceValueForDisplay, type FinanceValueStatus } from '@/services/api/financeV2.types';

export interface ValuationValueCellProps {
  status: FinanceValueStatus;
  /** Decimal string or already-parsed number — `null` for any non-present status. */
  valueDecimal: string | number | null;
  /** Applied only to a present value, e.g. "PLN" — never printed next to the "—" glyph. */
  unitSuffix?: string;
  formatNumber?: (n: number) => string;
  className?: string;
}

export function ValuationValueCell(props: ValuationValueCellProps): React.ReactElement {
  const { status, valueDecimal, unitSuffix, formatNumber, className } = props;
  const valueDecimalStr = valueDecimal === null ? null : String(valueDecimal);
  const display = formatFinanceValueForDisplay({ status, valueDecimal: valueDecimalStr }, formatNumber);
  const reason = financeValueDisplayReasonLabel(status);

  if (display.isMissingLikeGlyph) {
    return (
      <span className={className} data-testid="valuation-value-cell" data-value-status={status}>
        <span aria-hidden="true">{display.text}</span>
        <span className="ml-1 text-xs text-c-text-muted">{reason ?? 'Brak wartości'}</span>
      </span>
    );
  }
  return (
    <span className={className} data-testid="valuation-value-cell" data-value-status={status}>
      {display.text}
      {unitSuffix ? <span className="ml-1 text-c-text-muted">{unitSuffix}</span> : null}
    </span>
  );
}

export default ValuationValueCell;
