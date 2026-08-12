/**
 * FinancialCaseView — top-level Financial Case screen for the Idea Table
 * (Matryca) artifact. Program E / epic E09 (doc 09 §7.3/§7.4, doc 11 E09).
 *
 * Composition:
 *   FinancialDriverTable        — driver/period editing surface (left/main)
 *   FinancialCaseSummaryPanel   — compact case summary + evidence health +
 *                                 stale/recompute status (right rail)
 *   FinancialCharts             — cumulative cash flow / composition /
 *                                 scenario range / sensitivity
 *   FinancialConversionActions  — honestly-disabled Convert entry points
 *
 * THE SEAM: this component takes `computeFn` as a prop (see
 * `FinancialComputeFn` in `financialTypes.ts`), defaulting to
 * `computeIdeaFinancialCase` from `./engineAdapter` — the adapter that
 * connects this UI to `src/services/ideaFinance` (Program E / epic E09; see
 * `engineAdapter.ts` header for the full mapping/limitations). A caller can
 * still override `computeFn` explicitly (tests, a future server-side engine).
 *
 * Mounted from `IdeaTableTool` (via `FinancialCaseDialog`, Program D/E,
 * §7.3) behind `isIdeaFinancialCaseEnabled()`
 * (`src/utils/ideaFinancialCaseFlag.ts`, default OFF) per CLAUDE.md #7.
 *
 * `onStatusChange` (optional) reports `fc.status` on every change — epic B4
 * uses this to feed `ideaDecisionGovernance`'s approval gate a REAL
 * financial-freshness signal instead of the honest-but-inert
 * `UNWIRED_FINANCIAL_FRESHNESS_PROVIDER` default. See `IdeaTableTool.tsx`.
 */
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { computeIdeaFinancialCase } from './engineAdapter';
import { FinancialCaseSummaryPanel } from './FinancialCaseSummaryPanel';
import { FinancialCharts } from './FinancialCharts';
import { FinancialConversionActions } from './FinancialConversionActions';
import { createEmptyDriver } from './financialDefaults';
import { FinancialDriverTable } from './FinancialDriverTable';
import type {
  FinancialCaseInput,
  FinancialCaseResult,
  FinancialCaseStatus,
  FinancialComputeFn,
} from './financialTypes';
import { useFinancialCase } from './useFinancialCase';

export interface FinancialCaseViewProps {
  initialCase?: FinancialCaseInput;
  /** Defaults to the real engine adapter (`computeIdeaFinancialCase`). Pass
   * `null` explicitly to force the honest "blocked" state (e.g. tests that
   * want to exercise the not-wired path). */
  computeFn?: FinancialComputeFn | null;
  onCaseChange?: (next: FinancialCaseInput) => void;
  readOnly?: boolean;
  /** Reports the live stale/fresh status — see file header (epic B4). */
  onStatusChange?: (status: FinancialCaseStatus, lastComputedAt: string | null) => void;
  /**
   * S6-E09: reports the last COMPUTED snapshot so the persistence layer can
   * store it alongside the inputs. `onCaseChange` carries inputs only; without
   * this, a saved case would reopen with drivers but no numbers and no way to
   * tell "never computed" from "computed, snapshot lost". `null` is passed
   * honestly whenever there is no valid result (empty/stale/blocked/error) —
   * a stale result is never forwarded as if it still described the inputs.
   */
  onResultChange?: (result: FinancialCaseResult | null, lastComputedAt: string | null) => void;
}

export const FinancialCaseView: React.FC<FinancialCaseViewProps> = ({
  initialCase,
  computeFn,
  onCaseChange,
  readOnly = false,
  onStatusChange,
  onResultChange,
}) => {
  const { t } = useTranslation();
  const resolvedComputeFn = computeFn === null ? undefined : (computeFn ?? computeIdeaFinancialCase);
  const fc = useFinancialCase({ initialCase, computeFn: resolvedComputeFn, onCaseChange });

  useEffect(() => {
    onStatusChange?.(fc.status, fc.lastComputedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc.status, fc.lastComputedAt]);

  // Only a `fresh` result describes the CURRENT inputs. Any other status means
  // the stored snapshot would be a lie about the drivers it ships next to, so
  // we forward null instead (Z3: never present a number that no longer holds).
  useEffect(() => {
    const isFresh = fc.status === 'fresh';
    onResultChange?.(isFresh ? fc.result : null, isFresh ? fc.lastComputedAt : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc.status, fc.result, fc.lastComputedAt]);

  const handleAddDriver = useCallback(
    (kind: 'cost' | 'benefit') => {
      fc.addDriver(createEmptyDriver(kind));
    },
    [fc]
  );

  return (
    <div className="flex flex-col xl:flex-row gap-3 p-3 h-full min-h-0 overflow-auto">
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <FinancialDriverTable
          caseMeta={fc.caseMeta}
          drivers={fc.drivers}
          onAddDriver={handleAddDriver}
          onUpdateDriver={fc.updateDriver}
          onRemoveDriver={fc.removeDriver}
          readOnly={readOnly}
        />
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary mb-2 px-1">
            {t('ideas.financial.analytics', 'Analytics')}
          </h4>
          <FinancialCharts result={fc.result} status={fc.status} currency={fc.caseMeta.currency} />
        </div>
      </div>
      <div className="w-full xl:w-72 flex-shrink-0 flex flex-col gap-3">
        <FinancialCaseSummaryPanel
          caseMeta={fc.caseMeta}
          drivers={fc.drivers}
          status={fc.status}
          errorMessage={fc.errorMessage}
          lastComputedAt={fc.lastComputedAt}
          engineWired={fc.engineWired}
          onRecompute={fc.recompute}
        />
        <FinancialConversionActions status={fc.status} />
      </div>
    </div>
  );
};

export default FinancialCaseView;
