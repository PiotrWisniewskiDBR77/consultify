/**
 * Workbook template i18n — DEC-461/F7b (2026-09-14).
 *
 * The template registry (`index.ts`) surfaces human-facing strings (title,
 * description, param labels/groups) through `GET /api/workbook/templates`.
 * Those strings used to be hardcoded Polish literals. EN is now the default —
 * every literal in the registry is an English string — and `t()` looks up the
 * Polish translation from this dictionary ONLY when the resolved locale is
 * `pl`. Unknown/missing keys fall back to the English string itself, so a
 * missed translation degrades to English rather than throwing or leaking a
 * raw dictionary key.
 *
 * Locale resolution mirrors the DEC-510 pattern used by
 * `services/report/reportLocale.ts`: users.language → users.locale →
 * organizations.default_language → 'en'. See `resolveWorkbookLocale` in
 * `routes/workbook.routes.ts`.
 */

export type WorkbookLocale = 'en' | 'pl';

export function normalizeWorkbookLocale(value: unknown): WorkbookLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace('_', '-').split('-')[0];
  return normalized === 'en' || normalized === 'pl' ? normalized : null;
}

/** English string → Polish translation. English is the default; this is opt-in. */
const PL_DICT: Record<string, string> = {
  // Shared field labels (reused across templates)
  'Company name': 'Nazwa spółki',
  Currency: 'Waluta',
  General: 'Ogólne',

  // threeScenarioPnL
  'Income statement — 3 scenarios × 3 years': 'Rachunek wyników — 3 scenariusze × 3 lata',
  'Parametric P&L (Base/Bull/Bear) over 3 years: revenue→COGS→gross profit→OPEX→EBITDA→D&A→EBIT→interest→EBT→tax→net profit→margin, every line a formula, inputs on an Assumptions sheet, a Comparison sheet.':
    'Parametryczny P&L (Base/Bull/Bear) na 3 lata: przychody→COGS→zysk brutto→OPEX→EBITDA→D&A→EBIT→odsetki→EBT→podatek→zysk netto→marża, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusz Porównanie.',
  'First forecast year': 'Pierwszy rok prognozy',
  'Base-year revenue': 'Przychód roku bazowego',
  'Revenue growth %/year': 'Wzrost przychodów %/rok',
  'COGS % of revenue': 'COGS % przychodów',
  'OPEX % of revenue': 'OPEX % przychodów',
  'Depreciation & amortization (D&A) % of revenue': 'Amortyzacja (D&A) % przychodów',
  'Interest % of revenue': 'Odsetki % przychodów',
  'Tax rate %': 'Stopa podatkowa %',
  'Base (baseline)': 'Base (bazowy)',
  'Bull (optimistic)': 'Bull (optymistyczny)',
  'Bear (pessimistic)': 'Bear (pesymistyczny)',

  // operatingBudget
  'Operating budget — 12 months': 'Budżet operacyjny — 12 miesięcy',
  'Parametric 12-month operating budget: revenue→variable costs→margin→fixed costs (rent/salaries/marketing/other)→total costs→operating result→cumulative result→margin %, every line a formula, a TOTAL (year) column, inputs on an Assumptions sheet, a Summary sheet.':
    'Parametryczny budżet operacyjny 12-miesięczny: przychody→koszty zmienne→marża→koszty stałe (czynsz/wynagrodzenia/marketing/pozostałe)→koszty razem→wynik operacyjny→wynik narastająco→marża %, każda pozycja jako formuła, kolumna RAZEM (rok), wejścia na arkuszu Założenia, arkusz Podsumowanie.',
  'Budget year': 'Rok budżetu',
  'Revenue, month 1': 'Przychód m-c 1',
  'Revenue growth m/m %': 'Wzrost przychodów m/m %',
  'Revenue': 'Przychody',
  'Variable costs % of revenue': 'Koszty zmienne % przychodów',
  'Variable costs': 'Koszty zmienne',
  'Rent (month 1)': 'Czynsz (m-c 1)',
  'Fixed costs': 'Koszty stałe',
  'Salaries (month 1)': 'Wynagrodzenia (m-c 1)',
  'Marketing (month 1)': 'Marketing (m-c 1)',
  'Other fixed costs (month 1)': 'Pozostałe koszty stałe (m-c 1)',
  'Fixed cost growth m/m %': 'Wzrost kosztów stałych m/m %',

  // dcfValuation
  'DCF valuation (Discounted Cash Flow)': 'Wycena DCF (Discounted Cash Flow)',
  'Simple DCF valuation: FCF projection over the chosen horizon→discount factor→discounted FCF→terminal value (Gordon)→Enterprise Value→Equity Value→value per share, every line a formula, inputs on an Assumptions sheet, FCF Projection and Valuation sheets.':
    'Prosta wycena metodą DCF: projekcja FCF na zadany horyzont→współczynnik dyskontowy→zdyskontowany FCF→wartość rezydualna (Gordon)→Enterprise Value→Equity Value→wartość na akcję, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusze Projekcja FCF i Wycena.',
  'Valuation year (year 0)': 'Rok wyceny (rok 0)',
  'Base-year FCF (year 0)': 'FCF rok bazowy (rok 0)',
  'FCF growth (forecast) % per year': 'Wzrost FCF (prognoza) % rocznie',
  Projection: 'Projekcja',
  'Forecast horizon (years)': 'Horyzont prognozy (lata)',
  'WACC (discount rate) %': 'WACC (stopa dyskontowa) %',
  Discounting: 'Dyskontowanie',
  'Terminal growth (g) %': 'Wzrost terminalny (g) %',
  'Net debt': 'Dług netto',
  'EV → Equity bridge': 'Mostek EV → Equity',
  'Shares outstanding': 'Liczba akcji',

  // breakEven
  'Break-even analysis (BEP)': 'Analiza progu rentowności (Break-Even)',
  'Parametric break-even analysis: unit margin→BEP volume→BEP revenue→margin of safety, a sensitivity table across several volume levels, every line a formula, inputs on an Assumptions sheet.':
    'Parametryczna analiza progu rentowności: marża jednostkowa→wolumen BEP→przychód BEP→margines bezpieczeństwa, tabela wrażliwości wyniku dla kilku poziomów wolumenu, każda pozycja jako formuła, wejścia na arkuszu Założenia.',
  'Unit price': 'Cena jednostkowa',
  'Variable cost per unit': 'Koszt zmienny na sztukę',
  Costs: 'Koszty',
  'Planned sales volume (units)': 'Planowany wolumen sprzedaży (szt.)',
  Sales: 'Sprzedaż',

  // cashflow12m
  'Cash-flow forecast — 12 months': 'Prognoza przepływów pieniężnych — 12 miesięcy',
  'Parametric 12-month cash-flow forecast: inflows (revenue with payment delay)→outflows (costs)→net flow m/m→cumulative balance, every line a formula, a TOTAL (year) column, inputs on an Assumptions sheet, a Summary sheet.':
    'Parametryczna prognoza cash-flow 12-miesięczna: wpływy (przychód z opóźnieniem płatności)→wypływy (koszty)→przepływ netto m/m→saldo narastające, każda pozycja jako formuła, kolumna RAZEM (rok), wejścia na arkuszu Założenia, arkusz Podsumowanie.',
  'Forecast year': 'Rok prognozy',
  'Opening balance': 'Saldo początkowe',
  'Payment delay (months)': 'Opóźnienie płatności (miesiące)',
  'Costs, month 1': 'Koszty m-c 1',
  'Cost growth m/m %': 'Wzrost kosztów m/m %',

  // unitEconomics
  'SaaS unit economics': 'Ekonomia jednostkowa SaaS',
  'Parametric SaaS unit economics: LTV=ARPU×margin/churn, LTV/CAC, CAC payback period=CAC/(ARPU×margin), NRR, plus a 12-month customer/MRR projection with m/m churn, every line a formula, inputs on an Assumptions sheet, Metrics and 12m Projection sheets.':
    'Parametryczna ekonomia jednostkowa SaaS: LTV=ARPU×marża/churn, LTV/CAC, okres zwrotu CAC=CAC/(ARPU×marża), NRR, oraz 12-miesięczna projekcja klientów/MRR z churnem m/m, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusze Metryki i Projekcja 12m.',
  'Starting MRR': 'MRR startowy',
  'Churn m/m %': 'Churn m/m %',
  'Input metrics': 'Metryki wejściowe',
  'CAC (customer acquisition cost)': 'CAC (koszt pozyskania klienta)',
  'Gross margin %': 'Marża brutto %',
  'ARPU (revenue / customer / month)': 'ARPU (przychód / klient / m-c)',

  // loanAmortization
  'Loan amortization schedule': 'Harmonogram spłaty kredytu (amortyzacja)',
  'Parametric loan schedule: annuity payment (arithmetic formula, not PMT), payment split into interest and principal, declining balance month by month to zero, a TOTAL row with sums and closing balance, every line a formula, inputs on an Assumptions sheet, a Schedule sheet.':
    'Parametryczny harmonogram kredytu: rata annuitetowa (formuła arytmetyczna, nie PMT), podział raty na odsetki i kapitał, saldo malejące miesiąc po miesiącu do zera, wiersz RAZEM z sumami i saldem końcowym, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusz Harmonogram.',
  'Loan amount': 'Kwota kredytu',
  'Annual interest rate %': 'Oprocentowanie roczne %',
  'Loan terms': 'Warunki kredytu',
  'Term (months)': 'Okres (miesiące)',

  // projectViability
  'Project viability assessment (NPV/IRR)': 'Ocena opłacalności projektu (NPV/IRR)',
  'Parametric project viability assessment: net cash-flow projection (year 0 = investment, years 1..N = operations with tax and residual value)→NPV→IRR→profitability index (PI)→simple and discounted payback period, plus an NPV sensitivity grid across discount rate and cash-flow level, every line a formula, inputs on an Assumptions sheet, Cash Flows, Results and Sensitivity sheets.':
    'Parametryczna ocena opłacalności projektu: projekcja przepływów pieniężnych netto (rok 0 = inwestycja, lata 1..N = eksploatacja z podatkiem i wartością rezydualną)→NPV→IRR→wskaźnik rentowności (PI)→okres zwrotu prosty i zdyskontowany, plus siatka wrażliwości NPV na stopę dyskontową i poziom przepływów, każda pozycja jako formuła, wejścia na arkuszu Założenia, arkusze Przepływy, Wyniki i Wrażliwość.',
  'Project name': 'Nazwa projektu',
  'First year of operation (year 1)': 'Pierwszy rok eksploatacji (rok 1)',
  'Initial outlay (investment)': 'Nakład początkowy (inwestycja)',
  Investment: 'Inwestycja',
  'Gross operating cash flow — year 1': 'Przepływ operacyjny brutto — rok 1',
  'Cash-flow growth % per year': 'Wzrost przepływów % rocznie',
  'Cash flows': 'Przepływy',
  'Project horizon (years)': 'Horyzont projektu (lata)',
  'Discount rate (required rate of return)': 'Stopa dyskontowa (wymagana stopa zwrotu)',
  'Residual value (end of horizon)': 'Wartość rezydualna (koniec horyzontu)',
  'Tax rate (on operating cash flow)': 'Stopa podatkowa (od przepływu operacyjnego)',

  // benefitsRealization
  'Benefits Realization — program value': 'Benefits Realization — wartość programu',
  'Board-ready benefits model: controlled assumptions and evidence owners, risk-adjusted plan, YTD realization, gap, ROI and a one-page Executive Summary.':
    'Board-ready model korzyści: kontrolowane założenia i właściciele dowodów, plan risk-adjusted, realizacja YTD, luka, ROI oraz jednokartkowe Executive Summary.',
  'Program name': 'Nazwa programu',
  'Investment outlay': 'Nakład inwestycyjny',
  'Implementation cost': 'Koszt wdrożenia',
  Value: 'Wartość',
  'Revenue benefit': 'Korzyść przychodowa',
  'Cost reduction': 'Redukcja kosztów',
  'Working capital': 'Kapitał obrotowy',
  'Estimation confidence': 'Pewność estymacji',
  Control: 'Kontrola',
  'YTD plan realization': 'Realizacja planu YTD',
};

/**
 * Resolve `en` to itself, `pl` to its dictionary translation (falling back to
 * `en` when no translation is registered — never throws, never leaks a key).
 */
export function t(locale: WorkbookLocale, en: string): string {
  if (locale === 'pl') {
    return PL_DICT[en] ?? en;
  }
  return en;
}
