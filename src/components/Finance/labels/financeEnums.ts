/**
 * financeEnums — SSOT for backend enum codes rendered raw inside Finance JSX.
 *
 * F-M1 (2026-09-05, `docs/program/PROGRAM_NAPRAWCZY_20260905/
 * F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md` §F-M1): the finance module must
 * never show a backend code (`ready`, `MISSING_CF`, ...) as UI text. A raw
 * code is not a message — it does not say what is wrong or what to do about
 * it (see `statementReadinessCopy.ts` for the pack-level reason-code
 * resolver, which follows the same rule for the 14 `reasonCodes` emitted by
 * `financialStatementPackService.ts`).
 *
 * Scope of THIS file: the per-statement readiness code
 * (`FinancePreviewPanel.tsx`'s `statement.readinessStatus`, derived by
 * `financeTypes.ts#deriveStatementReadinessStatus`), which is interpolated
 * directly into JSX text (not routed through `<EntityStatusChip>`, so it
 * does not get `statusChip.*` translation for free).
 *
 * NOT translated (exempt — these are finance METHOD NAMES, not English UI
 * copy): DCF, FCFF, WACC, EBITDA, NPV, IRR, EV, P/E, EV/S, CAGR, DSO, DIO,
 * DPO, CCC, DSCR, Altman Z.
 */

export type StatementReadinessCode = 'pending' | 'recoverable' | 'ready' | 'rejected';

const STATEMENT_READINESS_LABELS: Record<StatementReadinessCode, { pl: string; en: string }> = {
  pending: { pl: 'Oczekujące', en: 'Pending' },
  recoverable: { pl: 'Do poprawy', en: 'Recoverable' },
  ready: { pl: 'Gotowe', en: 'Ready' },
  rejected: { pl: 'Odrzucone', en: 'Rejected' },
};

const UNKNOWN_STATEMENT_READINESS = { pl: 'Nieznany stan', en: 'Unknown status' } as const;

/**
 * Resolve a per-statement readiness code to a human sentence-case label.
 * Never returns the raw code — an unrecognized value gets the generic
 * "unknown status" label instead of leaking through to the UI.
 */
export function statementReadinessLabel(
  code: string | null | undefined,
  isPolish: boolean
): string {
  const normalized = String(code ?? '')
    .trim()
    .toLowerCase();
  const labels =
    STATEMENT_READINESS_LABELS[normalized as StatementReadinessCode] ??
    UNKNOWN_STATEMENT_READINESS;
  return isPolish ? labels.pl : labels.en;
}

export const statementReadinessLabelEntries = STATEMENT_READINESS_LABELS;
