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

/**
 * Rodzaj analizy finansowej — kolumna „Rodzaj analizy" na liście Analiz.
 *
 * PRZED (zrzut `evidence/jezyk-j9/po/09-analiza-lista-*.png`, 08.09): kolumna
 * renderowała SUROWĄ wartość z bazy przepuszczoną przez CSS `capitalize`,
 * więc oba języki widziały „Comprehensive" — angielszczyzna dla Polaka
 * i nieprzetłumaczony kod bazy dla Anglika. PLAN językowy §2.6 zakazuje tego
 * wprost: „Enumy i statusy zawsze przez słownik. Zakaz renderowania surowej
 * wartości bazy".
 *
 * Nieznany kod NIE wraca surowy — dostaje uczciwą etykietę „inny rodzaj",
 * bo wyciek kodu bazy na ekran jest właśnie tym defektem, nie obejściem.
 */
const ANALYSIS_TYPE_LABELS: Record<string, { pl: string; en: string }> = {
  comprehensive: { pl: 'Kompleksowa', en: 'Comprehensive' },
  investment_case: { pl: 'Analiza inwestycji', en: 'Investment case' },
  historical: { pl: 'Historyczna', en: 'Historical' },
  ratio: { pl: 'Wskaźnikowa', en: 'Ratio' },
  archived: { pl: 'Zarchiwizowana', en: 'Archived' },
};

const UNKNOWN_ANALYSIS_TYPE = { pl: 'Inny rodzaj', en: 'Other type' } as const;

export function analysisTypeLabel(code: string | null | undefined, isPolish: boolean): string {
  const normalized = String(code ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const labels = ANALYSIS_TYPE_LABELS[normalized] ?? UNKNOWN_ANALYSIS_TYPE;
  return isPolish ? labels.pl : labels.en;
}

export const analysisTypeLabelEntries = ANALYSIS_TYPE_LABELS;

/**
 * Nazwy KANONICZNYCH LINII sprawozdania (P&L / BS / CF).
 *
 * PRZED (zrzut `evidence/jezyk-j9/po/05-modele-podglad-pl.png`, 08.09): podgląd
 * modelu pokazywał POLAKOWI całą tabelę po angielsku — „Cost of goods sold",
 * „Gross profit", „Operating cash flow" — bo `useFinanceSelection.ts` budował
 * wiersze z angielskich `lineName` wpisanych wprost w kod. Moduł miał
 * jednocześnie DRUGI, polski słownik linii (`baseline/baselineLabels.ts`),
 * więc ta sama pozycja nazywała się inaczej w dwóch miejscach produktu.
 *
 * NIE TŁUMACZONE ŚWIADOMIE (nazwy metod/miar, nie kopia interfejsu, zgodnie
 * ze zleceniem J9): EBITDA, EBIT, P&L, BS, CF, CAPEX, OPEX.
 */
const STATEMENT_LINE_LABELS: Record<string, { pl: string; en: string }> = {
  'Revenue': { pl: 'Przychody', en: 'Revenue' },
  'Cost of goods sold': { pl: 'Koszt własny sprzedaży', en: 'Cost of goods sold' },
  'Gross profit': { pl: 'Zysk brutto ze sprzedaży', en: 'Gross profit' },
  'Operating expenses': { pl: 'Koszty operacyjne', en: 'Operating expenses' },
  'EBITDA': { pl: 'EBITDA', en: 'EBITDA' },
  'Depreciation': { pl: 'Amortyzacja', en: 'Depreciation' },
  'EBIT': { pl: 'EBIT', en: 'EBIT' },
  'Interest expense': { pl: 'Koszty odsetek', en: 'Interest expense' },
  'Earnings before tax': { pl: 'Zysk przed opodatkowaniem', en: 'Earnings before tax' },
  'Income tax': { pl: 'Podatek dochodowy', en: 'Income tax' },
  'Net income': { pl: 'Zysk netto', en: 'Net income' },
  'Cash': { pl: 'Gotówka', en: 'Cash' },
  'Accounts receivable': { pl: 'Należności', en: 'Accounts receivable' },
  'Inventory': { pl: 'Zapasy', en: 'Inventory' },
  'Current assets': { pl: 'Aktywa obrotowe', en: 'Current assets' },
  'Property, plant and equipment': { pl: 'Rzeczowe aktywa trwałe', en: 'Property, plant and equipment' },
  'Total assets': { pl: 'Aktywa razem', en: 'Total assets' },
  'Accounts payable': { pl: 'Zobowiązania handlowe', en: 'Accounts payable' },
  'Current liabilities': { pl: 'Zobowiązania krótkoterminowe', en: 'Current liabilities' },
  'Long-term debt': { pl: 'Zadłużenie długoterminowe', en: 'Long-term debt' },
  'Total liabilities': { pl: 'Zobowiązania razem', en: 'Total liabilities' },
  'Equity': { pl: 'Kapitał własny', en: 'Equity' },
  'Total liabilities + equity': { pl: 'Pasywa razem', en: 'Total liabilities + equity' },
  'Depreciation add-back': { pl: 'Korekta o amortyzację', en: 'Depreciation add-back' },
  'Operating cash flow': { pl: 'Przepływy z działalności operacyjnej', en: 'Operating cash flow' },
  'Capital expenditure': { pl: 'Nakłady inwestycyjne', en: 'Capital expenditure' },
  'Investing cash flow': { pl: 'Przepływy z działalności inwestycyjnej', en: 'Investing cash flow' },
  'Financing cash flow': { pl: 'Przepływy z działalności finansowej', en: 'Financing cash flow' },
  'Net change in cash': { pl: 'Zmiana stanu gotówki netto', en: 'Net change in cash' },
  'Closing cash': { pl: 'Gotówka na koniec okresu', en: 'Closing cash' },
};

const NIEZNANA_LINIA = null;

/**
 * Zwraca etykietę linii w języku konta. Dla nazwy spoza słownika oddaje
 * WEJŚCIE bez zmian — tu, w odróżnieniu od enumów, wejściem jest już
 * czytelna nazwa (z bazy albo z API), nie kod maszynowy, więc echo nie
 * wypuszcza na ekran żadnego `SCREAMING_SNAKE`.
 */
export function statementLineLabel(name: string | null | undefined, isPolish: boolean): string {
  const wejscie = String(name ?? '').trim();
  if (!wejscie) return wejscie;
  const wpis = STATEMENT_LINE_LABELS[wejscie] ?? NIEZNANA_LINIA;
  if (!wpis) return wejscie;
  return isPolish ? wpis.pl : wpis.en;
}

export const statementLineLabelEntries = STATEMENT_LINE_LABELS;
