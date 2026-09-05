/**
 * financeLineLabels — kody linii kanonicznych sprawozdania → NAZWY POZYCJI po polsku.
 *
 * ★ POWÓD (audyt FIN 2026-09-06, `evidence/audyt-mvp-20260906/FIN/RAPORT_FIN.md`
 * defekt #4, zrzut `03e-canonical-direct.png`): tabela pakietu sprawozdania
 * renderowała w kolumnie LINIA surowy `lineCode` — 119 wierszy `AP`, `CASH`,
 * `CURRENT_ASSETS`, `RETAINED_EARNINGS_CURRENT`… Kod kanoniczny nie jest nazwą
 * pozycji; CFO czyta „Zobowiązania handlowe", nie „AP".
 *
 * ŹRÓDŁA (w tej kolejności pierwszeństwa, bez zgadywania):
 *   1. `server/scripts/data/cdprojekt-2025.json` — nazwy przepisane DOSŁOWNIE
 *      z PDF skonsolidowanego sprawozdania Grupy Kapitałowej CD PROJEKT
 *      (pole `key` przy danym `code`). 119 kodów.
 *   2. Ręczna terminologia sprawozdawcza PL dla kodów taksonomii, których PDF
 *      nie zawiera (122 kodów) — polskie odpowiedniki pozycji MSSF/UoR.
 *   3. `financial_statement_lines.line_name_pl` z migracji repo, gdy niesie
 *      realną polską nazwę, a nie echo kodu (5 kodów).
 *
 * Zakres = PEŁNY katalog kodów systemowych taksonomii `financial_statement_lines`
 * (246 kodów, `organization_id IS NULL`), nie tylko pakiet CD PROJEKT —
 * inaczej naprawa byłaby „poprawna w 1 z N" i odrosłaby przy pierwszym innym
 * sprawozdaniu.
 *
 * Kod SPOZA tego katalogu (linia własna organizacji) NIE dostaje zmyślonej
 * nazwy: `financeLineLabel` cofa się najpierw do nazwy z DTO (taksonomia
 * organizacji, `lineNamePl`/`lineName`), a dopiero potem do uczciwego
 * „Nieznana pozycja (KOD)".
 */

export interface FinanceLineLabel {
  pl: string;
  en: string;
}

export const FINANCE_LINE_LABELS: Readonly<Record<string, FinanceLineLabel>> = {
  ACTUARIAL_RESERVE: { pl: "Rezerwa aktuarialna", en: "Actuarial Reserve" },
  AP: { pl: "Zobowiązania handlowe", en: "Accounts Payable" },
  AP_TRADE: { pl: "Zobowiązania handlowe", en: "Ap Trade" },
  AR: { pl: "Należności handlowe", en: "Accounts Receivable" },
  AR_OTHER: { pl: "Pozostałe należności", en: "Ar Other" },
  AR_TRADE: { pl: "Należności handlowe", en: "Ar Trade" },
  ASSETS_HELD_FOR_SALE: { pl: "Aktywa przeznaczone do sprzedaży", en: "Assets Held For Sale" },
  CAPEX: { pl: "Nabycie aktywów niematerialnych oraz rzeczowych aktywów trwałych", en: "Capital Expenditures" },
  CAPEX_GROWTH: { pl: "Nakłady inwestycyjne rozwojowe", en: "Capex Growth" },
  CAPEX_INTANGIBLES: { pl: "Nakłady na prace rozwojowe [wydatek]", en: "Capex Intangibles" },
  CAPEX_MAINTENANCE: { pl: "Nakłady inwestycyjne odtworzeniowe", en: "Capex Maintenance" },
  CASH: { pl: "Środki pieniężne i ekwiwalenty środków pieniężnych", en: "Cash & Cash Equivalents" },
  CASH_OPERATING: { pl: "Środki pieniężne operacyjne", en: "Cash Operating" },
  CASH_RESTRICTED: { pl: "Środki pieniężne o ograniczonej możliwości dysponowania", en: "Cash Restricted" },
  CBN_EXTERNAL_SERVICES: { pl: "Koszty rodzajowe — usługi obce", en: "Cbn External Services" },
  CBN_INVENTORY_CHANGE: { pl: "Koszty rodzajowe — zmiana stanu produktów", en: "Cbn Inventory Change" },
  CBN_MATERIALS_ENERGY: { pl: "Koszty rodzajowe — zużycie materiałów i energii", en: "Cbn Materials Energy" },
  CBN_OPERATING_RESULT: { pl: "Wynik operacyjny (układ rodzajowy)", en: "Cbn Operating Result" },
  CBN_OTHER_BY_NATURE: { pl: "Koszty rodzajowe — pozostałe", en: "Cbn Other By Nature" },
  CBN_OWN_WORK_CAPITALISED: { pl: "Koszty rodzajowe — świadczenia na własne potrzeby", en: "Cbn Own Work Capitalised" },
  CBN_PAYROLL: { pl: "Koszty rodzajowe — wynagrodzenia", en: "Cbn Payroll" },
  CBN_SOCIAL_SECURITY: { pl: "Koszty rodzajowe — ubezpieczenia społeczne i inne świadczenia", en: "Cbn Social Security" },
  CBN_TAXES_FEES: { pl: "Koszty rodzajowe — podatki i opłaty", en: "Cbn Taxes Fees" },
  CBN_TOTAL_BY_NATURE: { pl: "Koszty rodzajowe razem", en: "Cbn Total By Nature" },
  CFF: { pl: "Przepływy pieniężne netto z działalności finansowej", en: "Financing Cash Flow" },
  CFI: { pl: "Przepływy pieniężne netto z działalności inwestycyjnej", en: "Investing Cash Flow" },
  CFO: { pl: "Przepływy pieniężne netto z działalności operacyjnej", en: "Operating Cash Flow" },
  CHANGE_WC: { pl: "Zmiana stanu kapitału obrotowego", en: "Change Wc" },
  CHANGE_WC_AP: { pl: "Zmiana stanu zobowiązań z wyjątkiem pożyczek i kredytów", en: "Change Wc Ap" },
  CHANGE_WC_AR: { pl: "Zmiana stanu należności", en: "Change Wc Ar" },
  CHANGE_WC_INVENTORY: { pl: "Zmiana stanu zapasów", en: "Change Wc Inventory" },
  CHANGE_WC_OTHER: { pl: "Zmiana stanu pozostałych aktywów i pasywów", en: "Change Wc Other" },
  CHANGE_WC_PREPAIDS: { pl: "Zmiana stanu rozliczeń międzyokresowych", en: "Change Wc Prepaids" },
  CHANGE_WC_PROVISIONS: { pl: "Zmiana stanu rezerw", en: "Change Wc Provisions" },
  CHANGE_WC_RESTRICTED_CASH: { pl: "Zmiana stanu środków o ograniczonej możliwości dysponowania", en: "Change Wc Restricted Cash" },
  CLOSING_CASH: { pl: "Środki pieniężne na koniec okresu", en: "Closing Cash" },
  COGS: { pl: "Koszty sprzedanych produktów, usług, towarów i materiałów", en: "Cost of Goods Sold" },
  COGS_LABOR: { pl: "Koszt własny — wynagrodzenia", en: "Cogs Labor" },
  COGS_LABOR_CONTRACTORS: { pl: "Koszt własny — usługi podwykonawców", en: "Cogs Labor Contractors" },
  COGS_LABOR_PAYROLL: { pl: "Koszt własny — płace bezpośrednie", en: "Cogs Labor Payroll" },
  COGS_MATERIALS: { pl: "Wartość sprzedanych towarów i materiałów", en: "Cogs Materials" },
  COGS_MATERIALS_FREIGHT: { pl: "Koszt własny — transport materiałów", en: "Cogs Materials Freight" },
  COGS_MATERIALS_RAW: { pl: "Koszt własny — materiały bezpośrednie", en: "Cogs Materials Raw" },
  COGS_OTHER: { pl: "Koszt własny — pozostałe", en: "Cogs Other" },
  COGS_SEGMENT: { pl: "Koszt własny — segment", en: "Cogs Segment" },
  COMPREHENSIVE_INCOME: { pl: "Suma dochodów całkowitych, w tym:", en: "Comprehensive Income" },
  COMPREHENSIVE_INCOME_PARENT: { pl: "Całkowite dochody przypadające akcjonariuszom jednostki dominującej", en: "Comprehensive Income Parent" },
  CONTRACT_ASSETS: { pl: "Aktywa z tytułu umów z klientami", en: "Contract Assets" },
  CONTRACT_LIABILITIES: { pl: "Zobowiązania z tytułu umów z klientami", en: "Contract Liabilities" },
  CURRENT_ASSETS: { pl: "AKTYWA OBROTOWE", en: "Current Assets" },
  CURRENT_LIABILITIES: { pl: "ZOBOWIĄZANIA KRÓTKOTERMINOWE", en: "Current Liabilities" },
  CURRENT_PORTION_LTD: { pl: "Krótkoterminowa część zobowiązań długoterminowych", en: "Current Portion Ltd" },
  CURRENT_TAX_RECEIVABLE: { pl: "Należności z tytułu bieżącego podatku dochodowego", en: "Current Tax Receivable" },
  DEBT_DRAWDOWN: { pl: "Zaciągnięcie zadłużenia", en: "Debt Drawdown" },
  DEBT_DRAWDOWN_BANK: { pl: "Zaciągnięcie kredytów bankowych", en: "Debt Drawdown Bank" },
  DEBT_DRAWDOWN_LEASE: { pl: "Zaciągnięcie zobowiązań leasingowych", en: "Debt Drawdown Lease" },
  DEBT_REPAYMENT: { pl: "Spłata zadłużenia", en: "Debt Repayment" },
  DEBT_REPAYMENT_BANK: { pl: "Spłata kredytów bankowych", en: "Debt Repayment Bank" },
  DEBT_REPAYMENT_LEASE: { pl: "Spłata zobowiązań leasingowych", en: "Debt Repayment Lease" },
  DEFERRED_REVENUE_CURRENT: { pl: "Rozliczenia międzyokresowe przychodów [krótkoterminowe]", en: "Deferred Revenue Current" },
  DEFERRED_REVENUE_NON_CURRENT: { pl: "Rozliczenia międzyokresowe przychodów [długoterminowe]", en: "Deferred Revenue Non Current" },
  DEPRECIATION: { pl: "Amortyzacja", en: "Depreciation & Amortization" },
  DEPRECIATION_INTANGIBLES: { pl: "Amortyzacja wartości niematerialnych", en: "Depreciation Intangibles" },
  DEPRECIATION_PPE: { pl: "Amortyzacja rzeczowych aktywów trwałych", en: "Depreciation Ppe" },
  DERIVATIVE_INSTRUMENTS: { pl: "Instrumenty pochodne", en: "Derivative Instruments" },
  DIVIDENDS: { pl: "Dywidendy i inne wpłaty na rzecz właścicieli", en: "Dividends" },
  DIVIDENDS_DECLARED: { pl: "Zadeklarowane dywidendy", en: "Dividends Declared" },
  DIVIDENDS_MINORITY: { pl: "Dywidendy wypłacone udziałowcom niekontrolującym", en: "Dividends Minority" },
  DIVIDENDS_RECEIVED: { pl: "Dywidendy otrzymane", en: "Dividends Received" },
  EBIT: { pl: "Zysk na działalności operacyjnej", en: "EBIT / Operating Profit" },
  EBITDA: { pl: "EBITDA (wyliczona)", en: "EBITDA" },
  EBT: { pl: "Zysk przed opodatkowaniem", en: "Ebt" },
  EMPLOYEE_BENEFITS_LT: { pl: "Rezerwa na świadczenia emerytalne i podobne [długoterminowe]", en: "Employee Benefits Lt" },
  EMPLOYEE_BENEFITS_ST: { pl: "Rezerwa na świadczenia emerytalne i podobne [krótkoterminowe]", en: "Employee Benefits St" },
  EPS_BASIC: { pl: "Zysk na jedną akcję — podstawowy", en: "Eps Basic" },
  EPS_DILUTED: { pl: "Zysk na jedną akcję — rozwodniony", en: "Eps Diluted" },
  EQUITY: { pl: "KAPITAŁ WŁASNY", en: "Total Equity" },
  EQUITY_METHOD_INCOME: { pl: "Udział w wynikach jednostek stowarzyszonych", en: "Equity Method Income" },
  EQUITY_METHOD_INVESTMENTS: { pl: "Inwestycje wyceniane metodą praw własności", en: "Equity Method Investments" },
  EQUITY_PARENT: { pl: "Kapitały własne akcjonariuszy CD PROJEKT S.A.", en: "Equity Parent" },
  FCF: { pl: "Wolne przepływy pieniężne (wyliczone)", en: "Free Cash Flow" },
  FIN_EXPENSE: { pl: "Koszty finansowe", en: "Fin Expense" },
  FIN_INCOME: { pl: "Przychody finansowe", en: "Fin Income" },
  FINANCIAL_RESULT_NET: { pl: "Wynik na działalności finansowej netto", en: "Financial Result Net" },
  FINANCING_HYBRID_BONDS: { pl: "Obligacje hybrydowe", en: "Financing Hybrid Bonds" },
  FINANCING_NCI: { pl: "Transakcje z udziałowcami niekontrolującymi", en: "Financing Nci" },
  FINANCING_SHORT_TERM_DEBT: { pl: "Zadłużenie krótkoterminowe (działalność finansowa)", en: "Financing Short Term Debt" },
  FIXED_ASSETS: { pl: "AKTYWA TRWAŁE", en: "Fixed Assets" },
  FX_ON_CASH: { pl: "Różnice kursowe od środków pieniężnych", en: "Fx On Cash" },
  FX_RESERVE: { pl: "Różnice kursowe z przeliczenia", en: "Fx Reserve" },
  GAINS_DISPOSALS: { pl: "Zyski ze zbycia aktywów", en: "Gains Disposals" },
  GNA: { pl: "Koszty ogólnego zarządu, w tym:", en: "Gna" },
  GNA_EXTERNAL: { pl: "Koszty ogólnego zarządu — usługi obce", en: "Gna External" },
  GNA_IT: { pl: "Koszty ogólnego zarządu — IT", en: "Gna It" },
  GNA_PAYROLL: { pl: "Koszty ogólnego zarządu — wynagrodzenia", en: "Gna Payroll" },
  GNA_RENT: { pl: "Koszty ogólnego zarządu — najem", en: "Gna Rent" },
  GROSS_MARGIN: { pl: "Zysk brutto na sprzedaży", en: "Gross Margin" },
  HEDGE_RESERVE: { pl: "Kapitał z wyceny instrumentów zabezpieczających", en: "Hedge Reserve" },
  IMPAIRMENT_RECEIVABLES: { pl: "(Utrata wartości)/odwrócenie utraty wartości instrumentów finansowych", en: "Impairment Receivables" },
  INTANGIBLES: { pl: "Aktywa niematerialne", en: "Intangibles" },
  INTANGIBLES_GOODWILL: { pl: "Wartość firmy", en: "Intangibles Goodwill" },
  INTANGIBLES_SOFTWARE: { pl: "Nakłady na prace rozwojowe", en: "Intangibles Software" },
  INTEREST_BANK: { pl: "Odsetki od kredytów bankowych", en: "Interest Bank" },
  INTEREST_EXPENSE: { pl: "Koszty z tytułu odsetek (Nota 4)", en: "Interest Expense" },
  INTEREST_LEASE: { pl: "Odsetki od zobowiązań leasingowych", en: "Interest Lease" },
  INTEREST_PAID: { pl: "Odsetki [wydatki finansowe]", en: "Interest Paid" },
  INVENTORY: { pl: "Zapasy", en: "Inventory" },
  INVENTORY_FG: { pl: "Zapasy — wyroby gotowe", en: "Inventory Fg" },
  INVENTORY_RAW: { pl: "Zapasy — materiały", en: "Inventory Raw" },
  INVENTORY_WIP: { pl: "Zapasy — produkcja w toku", en: "Inventory Wip" },
  INVESTING_ACQUISITIONS: { pl: "Nabycie jednostek zależnych", en: "Investing Acquisitions" },
  INVESTING_ASSOCIATES: { pl: "Zakup udziałów w private equity w segmencie gamingowym", en: "Investing Associates" },
  INVESTING_DISPOSAL_BUSINESS: { pl: "Saldo środków pieniężnych w GOG na dzień zbycia", en: "Investing Disposal Business" },
  INVESTING_DISPOSAL_INVESTMENTS: { pl: "Wykup obligacji", en: "Investing Disposal Investments" },
  INVESTING_DISPOSAL_PPE: { pl: "Zbycie aktywów niematerialnych oraz rzeczowych aktywów trwałych", en: "Investing Disposal Ppe" },
  INVESTING_DISPOSAL_PROCEEDS: { pl: "Wpływy ze zbycia aktywów", en: "Investing Disposal Proceeds" },
  INVESTING_JV: { pl: "Inwestycje we wspólne przedsięwzięcia", en: "Investing Jv" },
  INVESTING_MATURITY_PROCEEDS: { pl: "Wygaśnięcie lokat bankowych powyżej 3 miesięcy", en: "Investing Maturity Proceeds" },
  INVESTING_SECURITIES: { pl: "Założenie lokat bankowych powyżej 3 miesięcy", en: "Investing Securities" },
  INVESTING_SUBSIDIARIES: { pl: "Nabycie udziałów w spółkach zależnych", en: "Investing Subsidiaries" },
  INVESTMENT_PROPERTY: { pl: "Nieruchomości inwestycyjne", en: "Investment Property" },
  INVESTMENTS_ASSOCIATES: { pl: "Akcje i udziały w jednostkach podporządkowanych nieobjętych konsolidacją", en: "Investments Associates" },
  LEASE_REPAYMENT: { pl: "Płatności zobowiązań z tytułu umów leasingu", en: "Lease Repayment" },
  LIABILITIES_HELD_FOR_SALE: { pl: "Zobowiązania związane z aktywami przeznaczonymi do sprzedaży", en: "Liabilities Held For Sale" },
  LONG_TERM_BORROWINGS: { pl: "Kredyty i pożyczki długoterminowe", en: "Long Term Borrowings" },
  LONG_TERM_DEBT: { pl: "Pozostałe zobowiązania finansowe [długoterminowe]", en: "Long-term Debt" },
  LONG_TERM_DEBT_BANK: { pl: "Zadłużenie długoterminowe — kredyty bankowe", en: "Long Term Debt Bank" },
  LONG_TERM_DEBT_LEASE: { pl: "Zadłużenie długoterminowe — leasing", en: "Long Term Debt Lease" },
  LT_FINANCIAL_ASSETS: { pl: "Pozostałe aktywa finansowe [aktywa trwałe]", en: "Lt Financial Assets" },
  LT_PREPAIDS: { pl: "Rozliczenia międzyokresowe [aktywa trwałe]", en: "Lt Prepaids" },
  LT_RECEIVABLES: { pl: "Pozostałe należności [aktywa trwałe]", en: "Lt Receivables" },
  MARKETABLE_SECURITIES: { pl: "Papiery wartościowe przeznaczone do obrotu", en: "Marketable Securities" },
  MINORITY_INTEREST: { pl: "Udziały niekontrolujące", en: "Minority Interest" },
  NET_CHANGE_CASH: { pl: "Przepływy pieniężne netto razem", en: "Net Change in Cash" },
  NET_CONTINUING: { pl: "Zysk netto z działalności kontynuowanej", en: "Net Continuing" },
  NET_INCOME: { pl: "Zysk netto", en: "Net Income" },
  NET_MINORITY: { pl: "Zysk netto przypadający udziałowcom niekontrolującym", en: "Net Minority" },
  NET_PARENT: { pl: "Zysk netto przypadający akcjonariuszom jednostki dominującej", en: "Net Parent" },
  OCI_ACTUARIAL: { pl: "Zyski lub straty aktuarialne", en: "Oci Actuarial" },
  OCI_DERIVATIVES: { pl: "Wycena instrumentów finansowych wycenianych w wartości godziwej przez inne całkowite dochody po uwzględnieniu efektu podatkowego", en: "Oci Derivatives" },
  OCI_FX: { pl: "Różnice kursowe z wyceny jednostek zagranicznych", en: "Oci Fx" },
  OCI_HEDGE: { pl: "Inne całkowite dochody — rachunkowość zabezpieczeń", en: "Oci Hedge" },
  OCI_NON_RECLASSIFIABLE: { pl: "Inne całkowite dochody, które nie zostaną przekwalifikowane na zyski lub straty", en: "Oci Non Reclassifiable" },
  OCI_PENSION_REMEASUREMENT: { pl: "Inne całkowite dochody — przeszacowanie świadczeń pracowniczych", en: "Oci Pension Remeasurement" },
  OCI_RECLASSIFIABLE: { pl: "Inne całkowite dochody, które zostaną przekwalifikowane na zyski lub straty po spełnieniu określonych warunków", en: "Oci Reclassifiable" },
  OCI_TOTAL: { pl: "Inne całkowite dochody razem", en: "Oci Total" },
  OPENING_CASH: { pl: "Środki pieniężne na początek okresu", en: "Opening Cash" },
  OPERATING_ADJUSTMENTS: { pl: "Korekty razem:", en: "Operating Adjustments" },
  OPERATING_BEFORE_WC: { pl: "Przepływy operacyjne przed zmianami kapitału obrotowego", en: "Operating Before Wc" },
  OPERATING_DEPRECIATION: { pl: "Amortyzacja (korekta w przepływach)", en: "Operating Depreciation" },
  OPERATING_DEPRECIATION_INTANGIBLES: { pl: "Amortyzacja prac rozwojowych ujęta jako koszt własny sprzedaży", en: "Operating Depreciation Intangibles" },
  OPERATING_DEPRECIATION_PPE: { pl: "Amortyzacja rzeczowych aktywów trwałych, aktywów niematerialnych, nakładów na prace rozwojowe oraz nieruchomości inwestycyjnych", en: "Operating Depreciation Ppe" },
  OPERATING_DEPRECIATION_ROU: { pl: "Amortyzacja aktywów z tytułu prawa do użytkowania", en: "Operating Depreciation Rou" },
  OPERATING_DIVIDEND_INCOME: { pl: "Przychody z dywidend (korekta w przepływach)", en: "Operating Dividend Income" },
  OPERATING_EBT: { pl: "Zysk przed opodatkowaniem (przepływy)", en: "Operating Ebt" },
  OPERATING_EQUITY_METHOD: { pl: "Udział w wynikach jednostek wycenianych metodą praw własności", en: "Operating Equity Method" },
  OPERATING_FV_CHANGES: { pl: "(Zysk)/strata z tytułu różnic kursowych", en: "Operating Fv Changes" },
  OPERATING_FV_DERIVATIVES: { pl: "Wycena instrumentów pochodnych (korekta)", en: "Operating Fv Derivatives" },
  OPERATING_GAIN_DISPOSAL: { pl: "(Zysk)/strata z działalności inwestycyjnej", en: "Operating Gain Disposal" },
  OPERATING_GENERATED: { pl: "Gotówka z działalności operacyjnej", en: "Operating Generated" },
  OPERATING_IMPAIRMENT: { pl: "Odpisy z tytułu utraty wartości (korekta)", en: "Operating Impairment" },
  OPERATING_INTEREST_COST: { pl: "Koszty odsetek (korekta w przepływach)", en: "Operating Interest Cost" },
  OPERATING_INTEREST_INCOME: { pl: "Odsetki i udziały w zyskach", en: "Operating Interest Income" },
  OPERATING_NET_INCOME: { pl: "Zysk netto [przepływy]", en: "Operating Net Income" },
  OPERATING_OTHER_ADJ: { pl: "Inne korekty", en: "Operating Other Adj" },
  OPERATING_SBC: { pl: "Koszty programów motywacyjnych rozliczanych w akcjach", en: "Operating Sbc" },
  OPERATING_WRITE_DOWNS: { pl: "Odpisy aktualizujące (korekta)", en: "Operating Write Downs" },
  OPEX: { pl: "Koszty operacyjne (SG&A)", en: "Operating Expenses (SG&A)" },
  OTHER_CURRENT_ASSETS: { pl: "Pozostałe aktywa obrotowe", en: "Other Current Assets" },
  OTHER_CURRENT_ASSETS_PREPAIDS: { pl: "Rozliczenia międzyokresowe [aktywa obrotowe]", en: "Other Current Assets Prepaids" },
  OTHER_CURRENT_ASSETS_VAT: { pl: "Pozostałe aktywa obrotowe — podatek VAT do odliczenia", en: "Other Current Assets Vat" },
  OTHER_CURRENT_FINANCIAL_ASSETS: { pl: "Pozostałe aktywa finansowe [aktywa obrotowe]", en: "Other Current Financial Assets" },
  OTHER_CURRENT_LIABILITIES: { pl: "Pozostałe zobowiązania [krótkoterminowe]", en: "Other Current Liabilities" },
  OTHER_CURRENT_LIABILITIES_ACCRUALS: { pl: "Pozostałe zobowiązania krótkoterminowe — rozliczenia międzyokresowe", en: "Other Current Liabilities Accruals" },
  OTHER_CURRENT_LIABILITIES_TAX: { pl: "Zobowiązania z tytułu bieżącego podatku dochodowego", en: "Other Current Liabilities Tax" },
  OTHER_EQUITY_MOVEMENTS: { pl: "Pozostałe kapitały", en: "Other Movements in Retained Earnings" },
  OTHER_EQUITY_RESERVES: { pl: "Kapitał zapasowy", en: "Other Equity Reserves" },
  OTHER_EXPENDITURE: { pl: "Wydatki okołotransakcyjne związane ze sprzedażą udziałów", en: "Other Expenditure" },
  OTHER_EXPENSE: { pl: "Pozostałe koszty", en: "Other Expense" },
  OTHER_FIN: { pl: "Pozostałe przychody i koszty finansowe", en: "Other Fin" },
  OTHER_FINANCING: { pl: "Płatności należności z tytułu umów leasingu", en: "Other Financing" },
  OTHER_INCOME: { pl: "Pozostałe przychody", en: "Other Income" },
  OTHER_INVESTING: { pl: "Inne wpływy inwestycyjne", en: "Other Investing" },
  OTHER_NON_CURRENT_ASSETS: { pl: "Pozostałe aktywa trwałe", en: "Other Non Current Assets" },
  OTHER_NON_CURRENT_ASSETS_DEFERRED_TAX: { pl: "Aktywa z tytułu odroczonego podatku dochodowego", en: "Other Non Current Assets Deferred Tax" },
  OTHER_NON_CURRENT_LIABILITIES: { pl: "Pozostałe zobowiązania [długoterminowe]", en: "Other Non Current Liabilities" },
  OTHER_NON_CURRENT_LIABILITIES_DEFERRED_TAX: { pl: "Rezerwy z tytułu odroczonego podatku dochodowego", en: "Other Non Current Liabilities Deferred Tax" },
  OTHER_NON_CURRENT_LIABILITIES_PROVISIONS: { pl: "Pozostałe rezerwy [długoterminowe]", en: "Other Non Current Liabilities Provisions" },
  OTHER_OP_INCOME: { pl: "Pozostałe przychody operacyjne", en: "Other Op Income" },
  OTHER_OP_RESULT: { pl: "Wynik na pozostałej działalności operacyjnej", en: "Other Op Result" },
  OTHER_OPEX: { pl: "Pozostałe koszty operacyjne", en: "Other Opex" },
  OTHER_OPEX_IMPAIRMENT: { pl: "Pozostałe koszty operacyjne — odpisy z tytułu utraty wartości", en: "Other Opex Impairment" },
  OTHER_OPEX_PROVISIONS: { pl: "Pozostałe koszty operacyjne — rezerwy", en: "Other Opex Provisions" },
  OTHER_PROVISIONS: { pl: "Pozostałe rezerwy [krótkoterminowe]", en: "Other Provisions" },
  OTHER_RECEIPTS: { pl: "Pozostałe wpływy", en: "Other Receipts" },
  OTHER_ST_RECEIVABLES: { pl: "Pozostałe należności [aktywa obrotowe]", en: "Other St Receivables" },
  OTHER_TAX_PAYABLES: { pl: "Pozostałe zobowiązania podatkowe", en: "Other Tax Payables" },
  OTHER_TAX_RECEIVABLES: { pl: "Pozostałe należności podatkowe", en: "Other Tax Receivables" },
  PENSION_DEFICIT: { pl: "Niedobór programu świadczeń pracowniczych", en: "Pension Deficit" },
  PENSION_SURPLUS: { pl: "Nadwyżka programu świadczeń pracowniczych", en: "Pension Surplus" },
  PPE: { pl: "Rzeczowe aktywa trwałe", en: "Ppe" },
  PPE_LAND: { pl: "Rzeczowe aktywa trwałe — grunty i budynki", en: "Ppe Land" },
  PPE_MACHINERY: { pl: "Rzeczowe aktywa trwałe — maszyny i urządzenia", en: "Ppe Machinery" },
  PPE_VEHICLES: { pl: "Rzeczowe aktywa trwałe — środki transportu", en: "Ppe Vehicles" },
  PRODUCTION_COSTS: { pl: "Koszty wytworzenia sprzedanych produktów i usług", en: "Production Costs" },
  PROVISIONS: { pl: "Rezerwy", en: "Provisions" },
  RETAINED_EARNINGS: { pl: "Zyski zatrzymane", en: "Retained Earnings" },
  RETAINED_EARNINGS_CURRENT: { pl: "Wynik finansowy bieżącego okresu", en: "Retained Earnings Current" },
  RETAINED_EARNINGS_PRIOR: { pl: "Niepodzielony wynik finansowy", en: "Retained Earnings Prior" },
  REVENUE: { pl: "Przychody ze sprzedaży", en: "Revenue" },
  REVENUE_OTHER: { pl: "Przychody ze sprzedaży towarów i materiałów", en: "Revenue Other" },
  REVENUE_PRODUCT: { pl: "Przychody ze sprzedaży produktów", en: "Revenue Product" },
  REVENUE_PRODUCT_DOMESTIC: { pl: "Przychody ze sprzedaży produktów — kraj", en: "Revenue Product Domestic" },
  REVENUE_PRODUCT_EXPORT: { pl: "Przychody ze sprzedaży produktów — eksport", en: "Revenue Product Export" },
  REVENUE_SEGMENT: { pl: "Przychody — segment", en: "Revenue Segment" },
  REVENUE_SERVICE: { pl: "Przychody ze sprzedaży usług", en: "Revenue Service" },
  REVENUE_SERVICE_PROJECTS: { pl: "Przychody z usług — projekty", en: "Revenue Service Projects" },
  REVENUE_SERVICE_SUBSCRIPTION: { pl: "Przychody z usług — abonamenty", en: "Revenue Service Subscription" },
  RND: { pl: "koszty prac badawczych", en: "Rnd" },
  ROU_ASSETS: { pl: "Aktywa z tytułu prawa do użytkowania", en: "Rou Assets" },
  SELLING: { pl: "Koszty sprzedaży", en: "Selling" },
  SELLING_COMMISSIONS: { pl: "Koszty sprzedaży — prowizje", en: "Selling Commissions" },
  SELLING_LOGISTICS: { pl: "Koszty sprzedaży — logistyka", en: "Selling Logistics" },
  SELLING_MARKETING: { pl: "Koszty sprzedaży — marketing", en: "Selling Marketing" },
  SGA: { pl: "Koszty sprzedaży i ogólnego zarządu", en: "Sga" },
  SHARE_BUYBACK: { pl: "Zakup akcji własnych w celu realizacji uprawnień w programie motywacyjnym", en: "Share Buyback" },
  SHARE_CAPITAL: { pl: "Kapitał zakładowy", en: "Share Capital" },
  SHARE_ISSUANCE: { pl: "Wpływy z emisji akcji", en: "Share Issuance" },
  SHARE_PREMIUM: { pl: "Kapitał zapasowy ze sprzedaży akcji powyżej wartości nominalnej", en: "Share Premium" },
  SHARES_OUTSTANDING: { pl: "Liczba akcji w tysiącach", en: "Shares Outstanding" },
  SHORT_TERM_DEBT: { pl: "Pozostałe zobowiązania finansowe [krótkoterminowe]", en: "Short Term Debt" },
  SHORT_TERM_DEBT_BANK: { pl: "Zadłużenie krótkoterminowe — kredyty bankowe", en: "Short Term Debt Bank" },
  SHORT_TERM_DEBT_LEASE: { pl: "Zadłużenie krótkoterminowe — leasing", en: "Short Term Debt Lease" },
  ST_INVESTMENTS: { pl: "Lokaty bankowe powyżej 3 miesięcy", en: "St Investments" },
  TAX_CURRENT: { pl: "Bieżący podatek dochodowy (Nota 5)", en: "Tax Current" },
  TAX_DEFERRED: { pl: "Odroczony podatek dochodowy (Nota 5)", en: "Tax Deferred" },
  TAX_EXPENSE: { pl: "Podatek dochodowy", en: "Income Tax Expense" },
  TAX_RECEIVABLES: { pl: "Należności z tytułu podatków", en: "Tax Receivables" },
  TAX_REFUND: { pl: "Zwrot podatku", en: "Tax Refund" },
  TAXES_PAID: { pl: "Podatek dochodowy (zapłacony)/zwrócony", en: "Taxes Paid" },
  TOTAL_ASSETS: { pl: "AKTYWA RAZEM", en: "Total Assets" },
  TOTAL_LIABILITIES: { pl: "Zobowiązania razem (wyliczone)", en: "Total Liabilities" },
  TOTAL_LIABILITIES_EQUITY: { pl: "PASYWA RAZEM", en: "Total Liabilities and Equity" },
  TOTAL_REVENUE_AND_INCOME: { pl: "Przychody i zyski razem", en: "Total Revenue And Income" },
  TREASURY_SHARES: { pl: "Akcje własne", en: "Treasury Shares" },
  WORKING_CAPITAL: { pl: "Kapitał obrotowy", en: "Working Capital" },
};

export type FinanceLabelLanguage = 'pl' | 'en';

/** Nazwy z DTO (`GET /statements/:bv/lines`) — taksonomia tej instalacji; używane, gdy kodu nie ma w katalogu powyżej. */
export interface FinanceLineLabelFallback {
  lineNamePl?: string | null;
  lineName?: string | null;
}

function isPlaceholderName(code: string, name: string): boolean {
  // `line_name_pl` bywa w bazie zwykłym echem kodu („Ap Trade" dla AP_TRADE) —
  // to nie jest nazwa pozycji, tylko ten sam kod w innej pisowni.
  const titleCased = code
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
  return name.trim().toLowerCase() === titleCased.toLowerCase();
}

/**
 * Nazwa pozycji dla kodu kanonicznego. NIGDY nie zwraca gołego kodu — brak
 * nazwy to jawne „Nieznana pozycja (KOD)", żeby luka w słowniku była widoczna
 * jako luka, a nie udawała etykiety.
 */
export function financeLineLabel(
  lineCode: string | null | undefined,
  options?: { language?: FinanceLabelLanguage; fallback?: FinanceLineLabelFallback | null }
): string {
  const code = String(lineCode ?? '').trim();
  if (!code) return 'Nieznana pozycja';
  const language = options?.language ?? 'pl';
  const known = FINANCE_LINE_LABELS[code];
  if (known) return language === 'en' ? known.en : known.pl;

  const fallback = options?.fallback;
  const candidates =
    language === 'en'
      ? [fallback?.lineName, fallback?.lineNamePl]
      : [fallback?.lineNamePl, fallback?.lineName];
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (value && !isPlaceholderName(code, value)) return value;
  }
  return `Nieznana pozycja (${code})`;
}

/** `true` gdy kod ma etykietę w katalogu — używane przez test pokrycia, nie przez render. */
export function hasFinanceLineLabel(lineCode: string): boolean {
  return Object.prototype.hasOwnProperty.call(FINANCE_LINE_LABELS, lineCode);
}
