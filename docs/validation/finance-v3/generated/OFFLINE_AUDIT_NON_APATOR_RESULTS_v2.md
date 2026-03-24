# Real Statement Import Audit

## BMW Group Financial Statements 2024

- File: `knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `millions`
- Extracted text length: 289394

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 33
- Mapped lines: 22
- Coverage: 67%
- Readiness: `recoverable` (54)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| A S S E T S Intangible assets 21 2024 | fsl-bs-intangibles | 20.22 |
| Property, plant and equipment 22 2024 | fsl-bs-ppe | 39.581 |
| Investments accounted for using the equity method 2024 | fsl-bs-equity-method-investments | 24553 |
| Receivables from sales financing 25 2024 | fsl-bs-ar | 55.149 |
| Financial assets 2024 | fsl-bs-lt-financial-assets | 26834 |
| Deferred tax 13 2024 | fsl-bs-other-non-current-assets-deferred-tax | 3.244 |
| Non-current assets 2024 | fsl-bs-fixed | 171.345 |
| Inventories 29 2024 | fsl-bs-inventory | 24.387 |
| Trade receivables 30 2024 | fsl-bs-ar-trade | 2.834 |
| Current tax 27 2024 | fsl-bs-other-current-liabilities-tax | 1.316 |
| Cash and cash equivalents 2024 | fsl-bs-cash | 19.287 |
| Current assets 2024 | fsl-bs-current-assets | 96.387 |
| Total assets 2024 | fsl-bs-total-assets | 267.732 |
| Accumulated other equity 31 2024 | fsl-bs-other-equity-reserves | 2.09 |
| Treasury shares 31 2024 | fsl-bs-treasury-shares | 1.502 |
| Equity attributable to shareholders of BMW AG 31 2024 | fsl-bs-equity-parent | 92.315 |
| Non-controlling interests 2024 | fsl-bs-minority-interest | 2.688 |
| Equity 2024 | fsl-bs-equity | 95.003 |
| Pension provisions 2024 | fsl-bs-provisions | 33222 |
| Other liabilities 37 2024 | fsl-bs-other-current-liabilities | 7.597 |
| Non-current provisions and liabilities 2024 | fsl-bs-other-non-current-liabilities-provisions | 85.04 |
| Trade payables 38 2024 | fsl-bs-ap | 14.126 |

| Unmapped labels | Value |
| --- | ---: |
| Leased products 23 2024 | 48.838 |
| Other investments 2024 | 1.099 |
| Other assets 28 2024 | 1.827 |
| Financial assets 26 2024 | 2.565 |
| Capital reserves 31 2024 | 2.456 |
| Revenue reserves 31 2024 | 92.812 |
| Other provisions 34 2024 | 7.83 |
| Financial liabilities 36 2024 | 66.77 |
| Current tax 35 2024 | 1.131 |
| Current provisions and liabilities 2024 | 87.689 |
| Total equity and liabilities 2024 | 267.732 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 58
- Mapped lines: 22
- Coverage: 38%
- Readiness: `recoverable` (52)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Revenues 7 2024 | fsl-pl-revenue | 142.38 |
| Cost of sales 8 2024 | fsl-pl-cogs | 119.485 |
| Gross profit 2024 | fsl-pl-gross | 22.895 |
| Selling and administrative expenses 9 2024 | fsl-pl-gna | 11.296 |
| Other operating income 10 2024 | fsl-pl-ebit | 1.411 |
| Other operating expenses 10 2024 | fsl-pl-other-opex | 1.501 |
| Interest and similar income 2024 | fsl-pl-fin-income | 11655 |
| Interest and similar expenses 11 2024 | fsl-pl-fin-expense | 573 |
| Other financial result 12 2024 | fsl-pl-other-fin | 606 |
| Profit/loss before tax 2024 | fsl-pl-ebt | 10.971 |
| Income taxes 13 2024 | fsl-pl-tax | 3.293 |
| Net profit/loss 2024 | fsl-pl-net | 7.678 |
| Attributable to non-controlling interests 2024 | fsl-pl-net-minority | 388875 |
| Attributable to shareholders of the BMW AG 2024 | fsl-pl-net-parent | 7.29 |
| Items that can be reclassified to the income statement in the future 2024 | fsl-pl-oci-reclassifiable | 592 |
| Other comprehensive income for the period after tax 19 2024 | fsl-pl-oci-total | 340 |
| Total comprehensive income 2024 | fsl-pl-comprehensive-income | 7.338 |
| A S S E T S Intangible assets 21 2024 | fsl-pl-depreciation-intangibles | 20.22 |
| Property, plant and equipment 22 2024 | fsl-pl-depreciation-ppe | 39.581 |
| Deferred tax 13 2024 | fsl-pl-tax-deferred | 3.244 |
| Current tax 27 2024 | fsl-pl-tax-current | 1.316 |
| Equity 2024 | fsl-pl-equity-method-income | 95.003 |

| Unmapped labels | Value |
| --- | ---: |
| Profit/loss before financial result 2024 | 11.509 |
| Result from equity accounted investments 24 – 14 2024 | 159 |
| Financial result 2024 | 538 |
| Remeasurement of the net liability for defined benefit pension plans 2024 | 33302 |
| Items not expected to be reclassified to the income statement in the future 2024 | 252 |
| Derivative financial instruments 2024 | 3.306 |
| Currency translation foreign operations 2024 | 1.108 |
| Total comprehensive income attributable to shareholders of BMW AG 2024 | 7.014 |
| Leased products 23 2024 | 48.838 |
| Investments accounted for using the equity method 2024 | 24553 |
| Other investments 2024 | 1.099 |
| Receivables from sales financing 25 2024 | 55.149 |
| Financial assets 2024 | 26834 |
| Other assets 28 2024 | 1.827 |
| Non-current assets 2024 | 171.345 |
| Inventories 29 2024 | 24.387 |
| Trade receivables 30 2024 | 2.834 |
| Financial assets 26 2024 | 2.565 |
| Cash and cash equivalents 2024 | 19.287 |
| Current assets 2024 | 96.387 |
| Total assets 2024 | 267.732 |
| Capital reserves 31 2024 | 2.456 |
| Revenue reserves 31 2024 | 92.812 |
| Accumulated other equity 31 2024 | 2.09 |
| Treasury shares 31 2024 | 1.502 |
| Equity attributable to shareholders of BMW AG 31 2024 | 92.315 |
| Non-controlling interests 2024 | 2.688 |
| Pension provisions 2024 | 33222 |
| Other provisions 34 2024 | 7.83 |
| Financial liabilities 36 2024 | 66.77 |
| Other liabilities 37 2024 | 7.597 |
| Non-current provisions and liabilities 2024 | 85.04 |
| Current tax 35 2024 | 1.131 |
| Trade payables 38 2024 | 14.126 |
| Current provisions and liabilities 2024 | 87.689 |
| Total equity and liabilities 2024 | 267.732 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 93
- Mapped lines: 19
- Coverage: 20%
- Readiness: `recoverable` (39)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Interest and similar income 2024 | fsl-cf-operating-interest-income | 11655 |
| Profit/loss before tax 2024 | fsl-cf-operating-net-income | 10.971 |
| A S S E T S Intangible assets 21 2024 | fsl-cf-operating-depreciation-intangibles | 20.22 |
| Property, plant and equipment 22 2024 | fsl-cf-capex | 39.581 |
| Equity 2024 | fsl-cf-operating-equity-method | 95.003 |
| Income taxes paid 2024 | fsl-cf-taxes-paid | 3.794 |
| Changes in working capital 2024 | fsl-cf-change-wc | 396 |
| Change in trade receivables 2024 | fsl-cf-change-wc-ar | 1.379 |
| Change in trade payables 2024 | fsl-cf-change-wc-ap | 1.647 |
| Change in provisions 2024 | fsl-cf-change-wc-provisions | 726 |
| Cash inflow/outflow from operating activities 2024 | fsl-cf-operating | 7.566 |
| Investments in marketable securities and investment funds 2024 | fsl-cf-investing-subsidiaries | 1.062 |
| Proceeds from the disposal of marketable securities and investment funds 2024 | fsl-cf-investing-disposal-proceeds | 1.834 |
| Cash inflow/outflow from investing activities 2024 | fsl-cf-investing | 11.369 |
| Interest paid * 2024 | fsl-cf-interest-paid | 196 |
| Change in other financial liabilities 2024 | fsl-cf-change-wc-other | 3.937 |
| Cash inflow/outflow from financing activities 2024 | fsl-cf-financing | 5.766 |
| Effect of exchange rate on cash and cash equivalents – 3 2024 | fsl-cf-opening-cash | 705 |
| Change in cash and cash equivalents 2024 | fsl-cf-net-change-cash | 1.96 |

| Unmapped labels | Value |
| --- | ---: |
| Revenues 7 2024 | 142.38 |
| Cost of sales 8 2024 | 119.485 |
| Gross profit 2024 | 22.895 |
| Selling and administrative expenses 9 2024 | 11.296 |
| Other operating income 10 2024 | 1.411 |
| Other operating expenses 10 2024 | 1.501 |
| Profit/loss before financial result 2024 | 11.509 |
| Result from equity accounted investments 24 – 14 2024 | 159 |
| Interest and similar expenses 11 2024 | 573 |
| Other financial result 12 2024 | 606 |
| Financial result 2024 | 538 |
| Income taxes 13 2024 | 3.293 |
| Net profit/loss 2024 | 7.678 |
| Attributable to non-controlling interests 2024 | 388875 |
| Attributable to shareholders of the BMW AG 2024 | 7.29 |
| Remeasurement of the net liability for defined benefit pension plans 2024 | 33302 |
| Items not expected to be reclassified to the income statement in the future 2024 | 252 |
| Derivative financial instruments 2024 | 3.306 |
| Currency translation foreign operations 2024 | 1.108 |
| Items that can be reclassified to the income statement in the future 2024 | 592 |
| Other comprehensive income for the period after tax 19 2024 | 340 |
| Total comprehensive income 2024 | 7.338 |
| Total comprehensive income attributable to shareholders of BMW AG 2024 | 7.014 |
| Leased products 23 2024 | 48.838 |
| Investments accounted for using the equity method 2024 | 24553 |
| Other investments 2024 | 1.099 |
| Receivables from sales financing 25 2024 | 55.149 |
| Financial assets 2024 | 26834 |
| Deferred tax 13 2024 | 3.244 |
| Other assets 28 2024 | 1.827 |
| Non-current assets 2024 | 171.345 |
| Inventories 29 2024 | 24.387 |
| Trade receivables 30 2024 | 2.834 |
| Financial assets 26 2024 | 2.565 |
| Current tax 27 2024 | 1.316 |
| Cash and cash equivalents 2024 | 19.287 |
| Current assets 2024 | 96.387 |
| Total assets 2024 | 267.732 |
| Capital reserves 31 2024 | 2.456 |
| Revenue reserves 31 2024 | 92.812 |
| Accumulated other equity 31 2024 | 2.09 |
| Treasury shares 31 2024 | 1.502 |
| Equity attributable to shareholders of BMW AG 31 2024 | 92.315 |
| Non-controlling interests 2024 | 2.688 |
| Pension provisions 2024 | 33222 |
| Other provisions 34 2024 | 7.83 |
| Financial liabilities 36 2024 | 66.77 |
| Other liabilities 37 2024 | 7.597 |
| Non-current provisions and liabilities 2024 | 85.04 |
| Current tax 35 2024 | 1.131 |
| Trade payables 38 2024 | 14.126 |
| Current provisions and liabilities 2024 | 87.689 |
| Total equity and liabilities 2024 | 267.732 |
| Interest received * 2024 | 644683 |
| Other interest and similar income/expenses * 2024 | 433 |
| Depreciation and amortisation of tangible and intangible assets 2024 | 8.65 |
| Other non-cash income and expense items 2024 | 339179 |
| Result from equity accounted investments 2024 | 14159 |
| Change in leased products 2024 | 5.231 |
| Change in receivables from sales financing 2024 | 4.144 |
| Change in inventories 2024 | 128 |
| Change in other operating assets and liabilities 2024 | 1.672 |
| Total investment in intangible assets and property, plant and equipment 2024 | 12.205 |
| Proceeds from subsidies for intangible assets and property, plant and equipment 2024 | 192 |
| Proceeds from the disposal of intangible assets and property, plant and equipment 2024 | 21116 |
| Expenditure for investment assets 2024 | 162 |
| Treasury shares acquired 2024 | 1.002 |
| Payment of dividends to shareholders of BMW AG 2024 | 3.781 |
| Payment of dividends to non-controlling interests 2024 | 1.013 |
| Intragroup financing and equity transactions – 2024 | 2.001 |
| Proceeds from issue of non-current financial liabilities 2024 | 30.025 |
| Repayment of non-current financial liabilities 2024 | 22.182 |
| Cash and cash equivalents as at 1 January 2024 | 17.327 |
| Cash and cash equivalents as at 31 December 2024 | 19.287 |

## KGHM SRR 2024

- File: `knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf`
- Detected type: `CF`
- Contained statement types: `CF`, `BS`, `P&L`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Currency / scaling: `PLN` / `millions`
- Extracted text length: 511416

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 24
- Mapped lines: 15
- Coverage: 63%
- Readiness: `recoverable` (37)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`, `VALIDATION_HARD_FAIL`
- Validation blockers: `BS_EQUATION_MISMATCH`, `BS_CURRENT_LIABILITIES_EXCEED_TOTAL`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Rzeczowe i niematerialne aktywa górnicze i hutnicze 2024 | fsl-bs-intangibles | 26880 |
| Pozostałe rzeczowe aktywa trwałe 2024 | fsl-bs-ppe | 3087 |
| Pozostałe aktywa rzeczowe i niematerialne 2024 | fsl-bs-other-current-assets | 3300 |
| Aktywa trwałe 2024 | fsl-bs-fixed | 42285 |
| Zapasy 2024 | fsl-bs-inventory | 8063 |
| Aktywa obrotowe 2024 | fsl-bs-current-assets | 11607 |
| RAZEM AKTYWA 2024 | fsl-bs-total-assets | 53892 |
| niż z tytułu wyceny instrumentów finansowych 2024 | fsl-bs-ar | 1778 |
| Kapitał własny akcjonariuszy Jednostki Dominującej 2024 | fsl-bs-equity-parent | 30990 |
| Kapitał własny 2024 | fsl-bs-equity | 31058 |
| Zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-bs-employee-benefits-st | 2784 |
| Rezerwy na koszty likwidacji kopalń i innych obiektów technologicznych 2024 | fsl-bs-total-liabilities | 2084 |
| Zobowiązania długoterminowe 2024 | fsl-bs-long-term-debt | 11828 |
| Pozostałe zobowiązania 2024 | fsl-bs-other-non-current-liabilities | 1061 |
| Zobowiązania krótkoterminowe 2024 | fsl-bs-current-liabilities | 11006 |

| Unmapped labels | Value |
| --- | ---: |
| AKTYWA Rzeczowe aktywa trwałe górnicze i hutnicze 2024 | 24050 |
| Aktywa niematerialne górnicze i hutnicze 2024 | 2830 |
| Zaangażowanie we wspólne przedsięwzięcia - udzielone pożyczki 2024 | 9800 |
| Instrumenty finansowe razem 2024 | 1726 |
| ZOBOWIĄZANIA I KAPITAŁ WŁASNY Nota 2024 | 8.2 |
| Kapitał własny udziałowców niekontrolujących 2024 | 68 |
| Zobowiązania wobec dostawców i pozostałe 2024 | 5132 |
| Zobowiązanie długo i krótkoterminowe 2024 | 22834 |
| RAZEM ZOBOWIĄZANIA I KAPITAŁ WŁASNY 2024 | 53892 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 15
- Mapped lines: 14
- Coverage: 93%
- Readiness: `recoverable` (84)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `PL_GROSS_MISMATCH`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Przychody z umów z klientami 2024 | fsl-pl-revenue | 35320 |
| Koszty sprzedanych produktów, towarów i materiałów 2024 | fsl-pl-cogs | -29348 |
| Koszty sprzedaży i koszty ogólnego zarządu 2024 | fsl-pl-selling | -2205 |
| Zysk/(strata) netto ze sprzedaży 2024 | fsl-pl-gross | 3767 |
| Pozostałe koszty operacyjne, w tym: 2024 | fsl-pl-other-opex | -1118 |
| straty z tytułu utraty wartości instrumentów finansowych ( 2024 | fsl-pl-impairment-receivables | 1 |
| Koszty finansowe ( 2024 | fsl-pl-fin-expense | 516 |
| Zysk/(strata) przed opodatkowaniem 2024 | fsl-pl-ebt | 4608 |
| Podatek dochodowy 2024 | fsl-pl-tax | -1738 |
| ZYSK/(STRATA) NETTO 2024 | fsl-pl-net | 2870 |
| Zysk/(strata) netto przypadający: akcjonariuszom Jednostki Dominującej 2024 | fsl-pl-net-parent | 2868 |
| Zysk/(strata) na akcję podstawowy i rozwodniony (w PLN) 2024 | fsl-pl-eps-basic | 14.34 |
| Zyski/(straty) aktuarialne, po uwzględnieniu efektu podatkowego 2024 | fsl-pl-oci-actuarial | 271 |
| ŁĄCZNE CAŁKOWITE DOCHODY 2024 | fsl-pl-comprehensive-income | 2726 |

| Unmapped labels | Value |
| --- | ---: |
| Łączne całkowite dochody przypadające: akcjonariuszom Jednostki Dominującej 2024 | 2725 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 52
- Mapped lines: 18
- Coverage: 35%
- Readiness: `recoverable` (43)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja ujęta w wyniku finansowym 2024 | fsl-cf-operating-depreciation | 2006 |
| Zysk z tytułu odwrócenia utraty wartości rzeczowych aktywów trwałych i wartości niematerialnych ( 2024 | fsl-cf-operating-gain-disposal | 74 |
| Zmiana stanu pozostałych należności i zobowiązań innych niż kapitał obrotowy 2024 | fsl-cf-change-wc-other | 163 |
| Podatek dochodowy, z tego: ( 2024 | fsl-cf-taxes-paid | 413 |
| Zmiana stanu kapitału obrotowego, w tym: ( 2024 | fsl-cf-change-wc | 875 |
| zmiana stanu zobowiązań handlowych objętych mechanizmami faktoringu odwrotnego 2024 | fsl-cf-change-wc-ap | -1007 |
| Przepływy pieniężne netto z działalności operacyjnej 2024 | fsl-cf-operating | 4690 |
| Wydatki na pozostałe rzeczowe aktywa trwałe i wartości niematerialne ( 2024 | fsl-cf-capex-intangibles | 679 |
| Wydatki na nabycie jednostek zależnych ( 2024 | fsl-cf-capex | 63 |
| Pozostałe ( 2024 | fsl-cf-operating-other-adj | 22 |
| Przepływy pieniężne netto z działalności inwestycyjnej 2024 | fsl-cf-investing | -5506 |
| Spłata odsetek, z tego: ( 2024 | fsl-cf-operating-interest-income | 202 |
| Przepływy pieniężne netto z działalności finansowej ( 2024 | fsl-cf-financing | 217 |
| Stan środków pieniężnych i ich ekwiwalentów na początek okresu 2024 | fsl-cf-opening-cash | 1729 |
| Stan środków pieniężnych i ich ekwiwalentów na koniec okresu, w tym: 2024 | fsl-cf-closing-cash | 715 |
| Rzeczowe i niematerialne aktywa górnicze i hutnicze 2024 | fsl-cf-debt-drawdown | 26880 |
| niż z tytułu wyceny instrumentów finansowych 2024 | fsl-cf-operating-fv-changes | 1778 |
| Zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-cf-operating-dividend-income | 2784 |

| Unmapped labels | Value |
| --- | ---: |
| Przepływy pieniężne z działalności operacyjnej Zysk/(strata) przed opodatkowaniem 2024 | 4608 |
| Odsetki od pożyczek udzielonych wspólnemu przedsięwzięciu ( 2024 | 552 |
| Pozostałe odsetki 2024 | 183 |
| i wartości niematerialnych 2024 | 312 |
| wspólnemu przedsięwzięciu ( 2024 | 226 |
| z działalności inwestycyjnej i wyceny środków pieniężnych ( 2024 | 495 |
| z działalności finansowej 2024 | 84 |
| Razem wyłączenia przychodów i kosztów 2024 | 1370 |
| wydatki z tytułu zapłaty podatku dochodowego 2024 | -1027 |
| Przepływy pieniężne z działalności inwestycyjnej Nota 2024 | 9.1 |
| Wydatki na aktywa finansowe przeznaczone na likwidację kopalń i innych obiektów technologicznych ( 2024 | 45 |
| Udzielone zaliczki na rzeczowe aktywa trwałe i wartości niematerialne ( 2024 | 31 |
| Wpływy z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego 2024 | 64 |
| Wydatki z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego ( 2024 | 75 |
| od zobowiązań handlowych objętych mechanizmami faktoringu odwrotnego ( 2024 | 164 |
| Wydatki z tytułu dywidend wypłaconych akcjonariuszom Jednostki Dominującej ( 2024 | 300 |
| AKTYWA Rzeczowe aktywa trwałe górnicze i hutnicze 2024 | 24050 |
| Aktywa niematerialne górnicze i hutnicze 2024 | 2830 |
| Pozostałe rzeczowe aktywa trwałe 2024 | 3087 |
| Pozostałe aktywa rzeczowe i niematerialne 2024 | 3300 |
| Zaangażowanie we wspólne przedsięwzięcia - udzielone pożyczki 2024 | 9800 |
| Instrumenty finansowe razem 2024 | 1726 |
| RAZEM AKTYWA 2024 | 53892 |
| ZOBOWIĄZANIA I KAPITAŁ WŁASNY Nota 2024 | 8.2 |
| Kapitał własny akcjonariuszy Jednostki Dominującej 2024 | 30990 |
| Kapitał własny udziałowców niekontrolujących 2024 | 68 |
| Kapitał własny 2024 | 31058 |
| Rezerwy na koszty likwidacji kopalń i innych obiektów technologicznych 2024 | 2084 |
| Zobowiązania długoterminowe 2024 | 11828 |
| Zobowiązania wobec dostawców i pozostałe 2024 | 5132 |
| Pozostałe zobowiązania 2024 | 1061 |
| Zobowiązania krótkoterminowe 2024 | 11006 |
| Zobowiązanie długo i krótkoterminowe 2024 | 22834 |
| RAZEM ZOBOWIĄZANIA I KAPITAŁ WŁASNY 2024 | 53892 |

## bp Annual Report 2025

- File: `knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `thousands`
- Extracted text length: 1715848

### BS

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 35
- Mapped lines: 13
- Coverage: 37%
- Readiness: `recoverable` (33)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Sales and other operating revenues 2025 | fsl-bs-ar-trade | 4.426 |
| Other comprehensive income — — — Total comprehensive income 2025 | fsl-bs-other-equity-reserves | 812 |
| Non-current assets 2025 | fsl-bs-fixed | 22.564 |
| Total assets 2025 | fsl-bs-total-assets | 26.574 |
| Total liabilities 2025 | fsl-bs-total-liabilities | 16.414 |
| Less: non-controlling interests — 2025 | fsl-bs-minority-interest | 10.16 |
| b Azule Energy includes cash and cash equivalents of $ 2025 | fsl-bs-cash | 596 |
| Current assets 2025 | fsl-bs-current-assets | 2.005 |
| Current liabilities 2025 | fsl-bs-current-liabilities | 2.528 |
| Non-current liabilities 2025 | fsl-bs-long-term-debt | 5.679 |
| Group investment in joint ventures Group share of net assets (as above) 2025 | fsl-bs-rou-assets | 5.08 |
| LNG, crude oil and oil products, natural gas, refinery operating costs, plant processing fees 2025 | fsl-bs-ppe | 2.23 |
| charge and 2025 | fsl-bs-ar | 133 |

| Unmapped labels | Value |
| --- | ---: |
| Azule Energy 2025 | 406504 |
| Profit (loss) before interest and taxation 2025 | 1.266 |
| Finance costs 2025 | 304512 |
| Profit (loss) before taxationa 2025 | 962 |
| Taxation 2025 | 150376 |
| Profit (loss) for the year 2025 | 812 |
| Current assetsb 2025 | 4.01 |
| Current liabilitiesc 2025 | 5.056 |
| Non-current liabilitiesd 2025 | 11.358 |
| Net assets 2025 | 10.16 |
| a Azule Energy includes depreciation and amortisation of $ 2025 | 2.729 |
| c Azule Energy includes current financial liabilities of $ 2025 | 4.635 |
| d Azule Energy includes non-current financial liabilities of $ 2025 | 5.827 |
| Profit (loss) before taxation 2025 | 481 |
| Other comprehensive income — — — 2025 | -3 |
| Total comprehensive income 2025 | 406 |
| Less: non-controlling interests 2025 | -90 |
| Cumulative impairment charge 2025 | -3.066 |
| Loans made by group companies to joint ventures 2025 | -4 |
| LNG, crude oil and oil products, natural gas 2025 | 2.47 |
| bp's share of net impairment charges recognized by joint ventures in 2025 | 1.111 |
| group's US offshore wind investments. 2025 | 200 |

### P&L

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 43
- Mapped lines: 15
- Coverage: 35%
- Readiness: `recoverable` (25)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `PL_NET_INCOME_OUTLIER`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Sales and other operating revenues 2025 | fsl-pl-revenue | 4.426 |
| Finance costs 2025 | fsl-pl-fin-expense | 304512 |
| Profit (loss) for the year 2025 | fsl-pl-net | 812 |
| Other comprehensive income — — — Total comprehensive income 2025 | fsl-pl-oci-total | 812 |
| Less: non-controlling interests — 2025 | fsl-pl-net-minority | 10.16 |
| a Azule Energy includes depreciation and amortisation of $ 2025 | fsl-pl-depreciation-ppe | 2.729 |
| b Azule Energy includes cash and cash equivalents of $ 2025 | fsl-pl-fin-income | 596 |
| d Azule Energy includes non-current financial liabilities of $ 2025 | fsl-pl-depreciation | 5.827 |
| Profit (loss) before taxation 2025 | fsl-pl-ebt | 481 |
| Total comprehensive income 2025 | fsl-pl-comprehensive-income | 406 |
| Group investment in joint ventures Group share of net assets (as above) 2025 | fsl-pl-depreciation-intangibles | 5.08 |
| Group investment in associates Group share of net assets (as above) 2025 | fsl-pl-equity-method-income | 7.293 |
| bp's share of impairment charges taken by associates in 2025 | fsl-pl-other-opex-impairment | 265 |
| Current Non-current Current Non-current Equity investmentsa 2025 | fsl-pl-tax-current | 816 |
| Other 2025 | fsl-pl-revenue-other | 98 |

| Unmapped labels | Value |
| --- | ---: |
| Azule Energy 2025 | 406504 |
| Profit (loss) before interest and taxation 2025 | 1.266 |
| Profit (loss) before taxationa 2025 | 962 |
| Taxation 2025 | 150376 |
| Non-current assets 2025 | 22.564 |
| Current assetsb 2025 | 4.01 |
| Total assets 2025 | 26.574 |
| Current liabilitiesc 2025 | 5.056 |
| Non-current liabilitiesd 2025 | 11.358 |
| Total liabilities 2025 | 16.414 |
| Net assets 2025 | 10.16 |
| c Azule Energy includes current financial liabilities of $ 2025 | 4.635 |
| Other comprehensive income — — — 2025 | -3 |
| Current assets 2025 | 2.005 |
| Current liabilities 2025 | 2.528 |
| Non-current liabilities 2025 | 5.679 |
| Less: non-controlling interests 2025 | -90 |
| Cumulative impairment charge 2025 | -3.066 |
| Loans made by group companies to joint ventures 2025 | -4 |
| LNG, crude oil and oil products, natural gas 2025 | 2.47 |
| LNG, crude oil and oil products, natural gas, refinery operating costs, plant processing fees 2025 | 2.23 |
| bp's share of net impairment charges recognized by joint ventures in 2025 | 1.111 |
| charge and 2025 | 133 |
| group's US offshore wind investments. 2025 | 200 |
| Profit before interest and taxation 2025 | 1.94 |
| Other comprehensive income 2025 | -4 |
| Crude oil and oil products, natural gas, transportation tariff 2025 | 6.708 |
| are related to various entities. bp has commitments amounting to $ 2025 | 6.993 |

### CF

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 108
- Mapped lines: 25
- Coverage: 23%
- Readiness: `recoverable` (41)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Repurchase of ordinary share capital 2025 | fsl-cf-operating-equity-method | -3.558 |
| Intangible assets 15 2025 | fsl-cf-capex-intangibles | 8.197 |
| Prepayments 2025 | fsl-cf-change-wc-prepaids | 3.422 |
| Lease liabilities 28 2025 | fsl-cf-debt-drawdown-lease | 2.832 |
| Operating activities Profit (loss) before taxation 2025 | fsl-cf-operating-net-income | 7.746 |
| Depreciation, depletion and amortization 5 2025 | fsl-cf-operating-depreciation | 17.822 |
| Impairment and (gain) loss on sale of businesses and fixed assets 4 2025 | fsl-cf-operating-gain-disposal | 5.05 |
| Dividends received from joint ventures and associates 2025 | fsl-cf-dividends-received | 2.111 |
| Interest paid 2025 | fsl-cf-interest-paid | -3.538 |
| Income taxes paid 2025 | fsl-cf-taxes-paid | -6.589 |
| Net cash provided by operating activities 2025 | fsl-cf-operating | 24.493 |
| Investment in associates 2025 | fsl-cf-investing-subsidiaries | -110 |
| Proceeds from disposals of fixed assets 4 2025 | fsl-cf-investing-disposal-proceeds | 1.142 |
| Proceeds from disposals of businesses, net of cash disposed 4 2025 | fsl-cf-capex | 1.714 |
| Proceeds from loan repayments 2025 | fsl-cf-debt-drawdown-bank | 173 |
| Net cash used in investing activities 2025 | fsl-cf-investing | -11.504 |
| Lease liability payments 2025 | fsl-cf-debt-repayment-lease | -3.091 |
| Proceeds from long-term financing 2025 | fsl-cf-debt-drawdown | 2.724 |
| Repayments of long-term financing 2025 | fsl-cf-debt-repayment | -5.695 |
| Receipts relating to transactions involving non-controlling interests (other) 2025 | fsl-cf-other-receipts | 2.474 |
| Dividends paid bp shareholders 10 2025 | fsl-cf-dividends | -5.059 |
| Net cash provided by (used in) financing activities 2025 | fsl-cf-financing | -15.88 |
| Increase (decrease) in cash and cash equivalents 2025 | fsl-cf-net-change-cash | -2.645 |
| Cash and cash equivalents at beginning of year 2025 | fsl-cf-opening-cash | 39.269 |
| Cash and cash equivalents at end of yeara 2025 | fsl-cf-closing-cash | 36.624 |

| Unmapped labels | Value |
| --- | ---: |
| bp Annual Report and Form 20-F 2025 | 155 |
| Profit (loss) for the year 2025 | 1.295 |
| Cash flow hedges marked to market 2025 | 30287 |
| Cash flow hedges reclassified to the income statement 2025 | 30 |
| Costs of hedging marked to market 30 27 2025 | -2 |
| Costs of hedging reclassified to the income statement 30 34 2025 | -2 |
| Share of items relating to equity-accounted entities, net of tax 2025 | 16 |
| Income tax relating to items that may be reclassified 9 2025 | -22 |
| Remeasurements of equity investments 2025 | -6 |
| Income tax relating to items that will not be reclassifieda 9 2025 | 55734 |
| Other comprehensive income 2025 | 1.932 |
| Total comprehensive income 2025 | 3.227 |
| Attributable to bp shareholders 2025 | 1.872 |
| Non-controlling interests 2025 | 1.355 |
| shareholders' equity Non-controlling interests Total equity Hybrid bonds Other interest At 1 January 2025 | 48.229 |
| Profit for the year — — — — 55 2025 | 55799 |
| Other comprehensive income — 2025 | 1.804 |
| Total comprehensive income — 2025 | 1.804 |
| Dividendsb — — — 2025 | -5.087 |
| Cash flow hedges transferred to the balance sheet, net of tax — — 2025 | -6 |
| Share-based payments, net of tax 35 2025 | 3.917 |
| Issue of perpetual hybrid bonds — — — — — 2025 | 500 |
| Redemption of perpetual hybrid bonds, net of tax — — — — — 2025 | -1.2 |
| Payments on perpetual hybrid bonds — 2025 | -9 |
| Transactions involving non-controlling interests, net of tax — — — 2025 | -65 |
| At 31 December 2025 | 48.264 |
| At 1 January 2025 | 48.013 |
| Profit for the year — — — 2025 | 381381 |
| Repurchase of ordinary share capital — — — 2025 | -7.302 |
| Share-based payments, net of tax 2025 | 216 |
| Issue of perpetual hybrid bonds — — — 2025 | -22 |
| Redemption of perpetual hybrid bonds, net of tax — — — — 9 9 2025 | -1.3 |
| Payments on perpetual hybrid bonds — — — — — 2025 | -610 |
| Non-current assets Property, plant and equipment 12 2025 | 98.633 |
| Goodwill 14 2025 | 10.3 |
| Investments in joint ventures 16 2025 | 13.4 |
| Investments in associates 17 2025 | 7.325 |
| Other investments 2025 | 18857 |
| Fixed assets 2025 | 138.712 |
| Loans 2025 | 1.991 |
| Trade and other receivables 20 2025 | 2.376 |
| Derivative financial instruments 30 2025 | 20.957 |
| Deferred tax assets 9 2025 | 4.325 |
| Defined benefit pension plan surpluses 24 2025 | 7.771 |
| Inventories 19 2025 | 22.499 |
| Current tax receivable 2025 | 1.153 |
| Cash and cash equivalents 25 2025 | 36.556 |
| Assets classified as held for sale 2 2025 | 6.347 |
| Total assets 2025 | 278.526 |
| Current liabilities Trade and other payables 22 2025 | 56.843 |
| Accruals 2025 | 5.572 |
| Finance debt 26 2025 | 3.356 |
| Current tax payable 2025 | 1.262 |
| Provisions 23 2025 | 4.709 |
| Liabilities directly associated with assets classified as held for sale 2 2025 | 1.594 |
| Non-current liabilities Other payables 22 2025 | 7.975 |
| Deferred tax liabilities 9 2025 | 7.642 |
| Defined benefit pension plan and other post-employment benefit plan deficits 24 2025 | 4.816 |
| Total liabilities 2025 | 204.526 |
| Net assets 2025 | 74 |
| Equity bp shareholders’ equity 32 2025 | 53.052 |
| Non-controlling interests 32 2025 | 20.948 |
| Total equity 32 2025 | 74 |
| Earnings from joint ventures and associates 2025 | -618 |
| Interest receivable 2025 | -1.352 |
| Interest received 2025 | 1.223 |
| Finance costs 7 2025 | 5.106 |
| Net finance expense relating to pensions and other post-employment benefits 2025 | 24 |
| Share-based payments 2025 | 1.077 |
| Net charge for provisions, less payments 2025 | 1.294 |
| (Increase) decrease in inventories 2025 | 1.622 |
| (Increase) decrease in other current and non-current assets 2025 | -4.286 |
| Increase (decrease) in other current and non-current liabilities 2025 | -2.156 |
| Investing activities Expenditure on property, plant and equipment, intangible and other assets 2025 | -13.221 |
| Acquisitions, net of cash acquired 2025 | 3 |
| Investment in joint ventures 2025 | -267 |
| Total cash capital expenditure 2025 | -14.533 |
| Financing activities Repurchase of shares 2025 | -4.486 |
| Net increase (decrease) in short-term debt 2025 | -343 |
| Issue of perpetual hybrid bonds 2025 | 500 |
| Redemption of perpetual hybrid bonds 32 2025 | -1.2 |
| Payments relating to perpetual hybrid bonds 2025 | -1.196 |
| Payments relating to transactions involving non-controlling interests (other) 2025 | -2 |

## Coca-Cola 10-K 2025

- File: `knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `millions`
- Extracted text length: 608897

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 54
- Mapped lines: 25
- Coverage: 46%
- Readiness: `recoverable` (25)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`, `VALIDATION_HARD_FAIL`
- Validation blockers: `BS_EQUATION_MISMATCH`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Other Comprehensive Income: Net foreign currency translation adjustments 2024 | fsl-bs-fx-reserve | -2.893 |
| Net change in pension and other postretirement benefit liabilities 2024 | fsl-bs-ar-trade | 109 |
| ASSETS Current Assets Cash and cash equivalents $ 2024 | fsl-bs-cash | 10.828 |
| Short-term investments 2024 | fsl-bs-short-term-debt | 2.02 |
| Trade accounts receivable, less allowances of $ 2024 | fsl-bs-ar | 506 |
| Inventories 2024 | fsl-bs-inventory | 4.728 |
| Total Current Assets 2024 | fsl-bs-current-assets | 25.997 |
| Equity method investments 2024 | fsl-bs-equity-method-investments | 18.087 |
| Deferred income tax assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 1.319 |
| Property, plant and equipment — net 2024 | fsl-bs-ppe | 10.303 |
| Goodwill 2024 | fsl-bs-intangibles-goodwill | 18.139 |
| Other noncurrent assets 2024 | fsl-bs-other-non-current-assets | 13.403 |
| Total Assets $ 2024 | fsl-bs-total-assets | 100.549 |
| LIABILITIES AND EQUITY Current Liabilities Accounts payable and accrued expenses $ 2024 | fsl-bs-other-current-liabilities-accruals | 21.715 |
| Loans and notes payable 2024 | fsl-bs-long-term-borrowings | 1.499 |
| Current maturities of long-term debt 2024 | fsl-bs-long-term-debt-bank | 648 |
| Total Current Liabilities 2024 | fsl-bs-current-liabilities | 25.249 |
| Long-term debt 2024 | fsl-bs-long-term-debt | 42.375 |
| Deferred income tax liabilities 2024 | fsl-bs-other-non-current-liabilities-deferred-tax | 2.469 |
| The Coca-Cola Company Shareowners’ Equity Common stock, $ 2024 | fsl-bs-share-capital | 0.25 |
| Capital surplus 2024 | fsl-bs-share-premium | 19.801 |
| Accumulated other comprehensive income (loss) 2024 | fsl-bs-other-equity-reserves | -16.843 |
| Equity attributable to noncontrolling interests 2024 | fsl-bs-equity-parent | 1.516 |
| Total Equity 2024 | fsl-bs-equity | 26.372 |
| Total Liabilities and Equity $ 2024 | fsl-bs-total-liabilities | 100.549 |

| Unmapped labels | Value |
| --- | ---: |
| Net Operating Revenues $ 2024 | 47.061 |
| Cost of goods sold 2024 | 18.324 |
| Gross Profit 2024 | 28.737 |
| Selling, general and administrative expenses 2024 | 14.582 |
| Other operating charges 2024 | 4.163 |
| Operating Income 2024 | 9.992 |
| Interest income 2024 | 988907 |
| Interest expense 2024 | 1.656 |
| Equity income (loss) — net 2024 | 1.77 |
| Other income (loss) — net 2024 | 1.992 |
| Income Before Income Taxes 2024 | 13.086 |
| Income taxes 2024 | 2.437 |
| Consolidated Net Income 2024 | 10.649 |
| Net Income Attributable to Shareowners of The Coca-Cola Company $ 2024 | 10.631 |
| Average Shares Outstanding — Basic 2024 | 4.309 |
| Average Shares Outstanding — Diluted 2024 | 4.32 |
| Consolidated Net Income $ 2024 | 10.649 |
| Total Comprehensive Income 2024 | 8.072 |
| Less: Comprehensive income (loss) attributable to noncontrolling interests 2024 | 9 |
| Total Comprehensive Income Attributable to Shareowners of The Coca-Cola Company $ 2024 | 8.063 |
| Total Cash, Cash Equivalents and Short-Term Investments 2024 | 12.848 |
| Marketable securities 2024 | 1.723 |
| Prepaid expenses and other current assets 2024 | 3.129 |
| Trademarks with indefinite lives 2024 | 13.301 |
| Accrued income taxes 2024 | 1.387 |
| Other noncurrent liabilities 2024 | 4.084 |
| Reinvested earnings 2024 | 76.054 |
| Treasury stock, at cost 2024 | 2.738 |
| Equity Attributable to Shareowners of The Coca-Cola Company 2024 | 24.856 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 54
- Mapped lines: 22
- Coverage: 41%
- Readiness: `recoverable` (54)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Net Operating Revenues $ 2024 | fsl-pl-revenue | 47.061 |
| Cost of goods sold 2024 | fsl-pl-cogs | 18.324 |
| Gross Profit 2024 | fsl-pl-gross | 28.737 |
| Selling, general and administrative expenses 2024 | fsl-pl-gna | 14.582 |
| Other operating charges 2024 | fsl-pl-other-op-income | 4.163 |
| Operating Income 2024 | fsl-pl-ebit | 9.992 |
| Interest income 2024 | fsl-pl-fin-income | 988907 |
| Interest expense 2024 | fsl-pl-interest | 1.656 |
| Other income (loss) — net 2024 | fsl-pl-other-income | 1.992 |
| Income taxes 2024 | fsl-pl-tax | 2.437 |
| Consolidated Net Income 2024 | fsl-pl-net | 10.649 |
| Average Shares Outstanding — Basic 2024 | fsl-pl-shares-outstanding | 4.309 |
| Net change in pension and other postretirement benefit liabilities 2024 | fsl-pl-cbn-inventory-change | 109 |
| Total Comprehensive Income 2024 | fsl-pl-comprehensive-income | 8.072 |
| Less: Comprehensive income (loss) attributable to noncontrolling interests 2024 | fsl-pl-net-minority | 9 |
| Equity method investments 2024 | fsl-pl-equity-method-income | 18.087 |
| Deferred income tax assets 2024 | fsl-pl-tax-deferred | 1.319 |
| Property, plant and equipment — net 2024 | fsl-pl-depreciation-ppe | 10.303 |
| LIABILITIES AND EQUITY Current Liabilities Accounts payable and accrued expenses $ 2024 | fsl-pl-opex | 21.715 |
| Long-term debt 2024 | fsl-pl-ebt | 42.375 |
| Accumulated other comprehensive income (loss) 2024 | fsl-pl-oci-total | -16.843 |
| Equity Attributable to Shareowners of The Coca-Cola Company 2024 | fsl-pl-net-parent | 24.856 |

| Unmapped labels | Value |
| --- | ---: |
| Equity income (loss) — net 2024 | 1.77 |
| Income Before Income Taxes 2024 | 13.086 |
| Net Income Attributable to Shareowners of The Coca-Cola Company $ 2024 | 10.631 |
| Average Shares Outstanding — Diluted 2024 | 4.32 |
| Consolidated Net Income $ 2024 | 10.649 |
| Other Comprehensive Income: Net foreign currency translation adjustments 2024 | -2.893 |
| Total Comprehensive Income Attributable to Shareowners of The Coca-Cola Company $ 2024 | 8.063 |
| ASSETS Current Assets Cash and cash equivalents $ 2024 | 10.828 |
| Short-term investments 2024 | 2.02 |
| Total Cash, Cash Equivalents and Short-Term Investments 2024 | 12.848 |
| Marketable securities 2024 | 1.723 |
| Trade accounts receivable, less allowances of $ 2024 | 506 |
| Inventories 2024 | 4.728 |
| Prepaid expenses and other current assets 2024 | 3.129 |
| Total Current Assets 2024 | 25.997 |
| Trademarks with indefinite lives 2024 | 13.301 |
| Goodwill 2024 | 18.139 |
| Other noncurrent assets 2024 | 13.403 |
| Total Assets $ 2024 | 100.549 |
| Loans and notes payable 2024 | 1.499 |
| Current maturities of long-term debt 2024 | 648 |
| Accrued income taxes 2024 | 1.387 |
| Total Current Liabilities 2024 | 25.249 |
| Other noncurrent liabilities 2024 | 4.084 |
| Deferred income tax liabilities 2024 | 2.469 |
| The Coca-Cola Company Shareowners’ Equity Common stock, $ 2024 | 0.25 |
| Capital surplus 2024 | 19.801 |
| Reinvested earnings 2024 | 76.054 |
| Treasury stock, at cost 2024 | 2.738 |
| Equity attributable to noncontrolling interests 2024 | 1.516 |
| Total Equity 2024 | 26.372 |
| Total Liabilities and Equity $ 2024 | 100.549 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 18
- Mapped lines: 7
- Coverage: 39%
- Readiness: `recoverable` (40)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Operating Activities Consolidated net income $ 2024 | fsl-cf-operating-net-income | 10.649 |
| Deferred income taxes 2024 | fsl-cf-taxes-paid | -11 |
| Net Cash Provided by Operating Activities 2024 | fsl-cf-operating | 6.805 |
| Proceeds from disposals of investments 2024 | fsl-cf-investing-disposal-proceeds | 6.589 |
| Purchases of property, plant and equipment 2024 | fsl-cf-capex | -2.064 |
| Other investing activities 2024 | fsl-cf-other-investing | 194 |
| Net Cash Provided by (Used in) Investing Activities 2024 | fsl-cf-investing | 2.524 |

| Unmapped labels | Value |
| --- | ---: |
| Stock-based compensation expense 2024 | 286254 |
| Equity (income) loss — net of dividends 2024 | -802 |
| Significant (gains) losses — net 2024 | -1.737 |
| Other operating charges 2024 | 4 |
| Other items 2024 | -311 |
| Net change in operating assets and liabilities 2024 | -6.234 |
| Investing Activities Purchases of investments 2024 | -5.64 |
| Acquisitions of businesses, equity method investments and nonmarketable securities 2024 | -315 |
| Proceeds from disposals of businesses, equity method investments and nonmarketable securities 2024 | 3.485 |
| Proceeds from disposals of property, plant and equipment 40 2024 | 74 |
| Collateral (paid) received associated with hedging activities — net 2024 | 235366 |

## Tesla 10-K 2024

- File: `knowledge/Finanse/Samples/tsla-20241231-gen.pdf`
- Detected type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Currency / scaling: `EUR` / `millions`
- Extracted text length: 479664

### BS

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 69
- Mapped lines: 22
- Coverage: 32%
- Readiness: `recoverable` (35)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Assets Current assets Cash and cash equivalents $ 2024 | fsl-bs-cash | 16.139 |
| Short-term investments 2024 | fsl-bs-short-term-debt | 20.424 |
| Accounts receivable, net 2024 | fsl-bs-ar | 4.418 |
| Inventory 2024 | fsl-bs-inventory | 12.017 |
| Total current assets 2024 | fsl-bs-current-assets | 58.36 |
| Operating lease vehicles, net 2024 | fsl-bs-ppe-vehicles | 5.581 |
| Property, plant and equipment, net 2024 | fsl-bs-ppe | 35.836 |
| Operating lease right-of-use assets 2024 | fsl-bs-rou-assets | 5.16 |
| Deferred tax assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 6.524 |
| Other non-current assets 2024 | fsl-bs-other-non-current-assets | 4.215 |
| Total assets $ 2024 | fsl-bs-total-assets | 122.07 |
| Accrued liabilities and other 2024 | fsl-bs-ar-trade | 10.723 |
| Total current liabilities 2024 | fsl-bs-current-liabilities | 28.821 |
| Other long-term liabilities 2024 | fsl-bs-long-term-debt | 10.495 |
| Total liabilities 2024 | fsl-bs-total-liabilities | 48.39 |
| Common stock; $ 2024 | fsl-bs-share-capital | 0.001 |
| Additional paid-in capital 2024 | fsl-bs-share-premium | 38.371 |
| Retained earnings 2024 | fsl-bs-retained-earnings | 35.209 |
| Total stockholders’ equity 2024 | fsl-bs-equity | 72.913 |
| Net income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | fsl-bs-minority-interest | 62 |
| Net income attributable to common stockholders $ 2024 | fsl-bs-equity-parent | 7.091 |
| Other comprehensive income — — — 2024 | fsl-bs-other-equity-reserves | 218 |

| Unmapped labels | Value |
| --- | ---: |
| Prepaid expenses and other current assets 2024 | 5.362 |
| Solar energy systems, net 2024 | 4.924 |
| Digital assets, net 2024 | 1.076 |
| Liabilities Current liabilities Accounts payable $ 2024 | 12.474 |
| Deferred revenue 2024 | 3.168 |
| Current portion of debt and finance leases 2024 | 2.456 |
| Debt and finance leases, net of current portion 2024 | 5.757 |
| Deferred revenue, net of current portion 2024 | 3.317 |
| Equity Stockholders’ equity Preferred stock; $ 2024 | 0.001 |
| December 2024 | 31 |
| Total liabilities and equity $ 2024 | 122.07 |
| Revenues Automotive sales $ 2024 | 72.48 |
| Automotive regulatory credits 2024 | 2.763 |
| Automotive leasing 2024 | 1.827 |
| Total automotive revenues 2024 | 77.07 |
| Energy generation and storage 2024 | 10.086 |
| Services and other 2024 | 10.534 |
| Total revenues 2024 | 97.69 |
| Cost of revenues Automotive sales 2024 | 61.87 |
| Total automotive cost of revenues 2024 | 62.873 |
| Total cost of revenues 2024 | 80.24 |
| Gross profit 2024 | 17.45 |
| Operating expenses Research and development 2024 | 4.54 |
| Selling, general and administrative 2024 | 5.15 |
| Restructuring and other 2024 | 684 |
| Total operating expenses 2024 | 10.374 |
| Income from operations 2024 | 7.076 |
| Interest income 2024 | 1.569 |
| Interest expense 2024 | -350 |
| Other income (expense), net 2024 | 695172 |
| Income before income taxes 2024 | 8.99 |
| Provision for (benefit from) income taxes 2024 | 1.837 |
| Net income 2024 | 7.153 |
| Weighted average shares used in computing net income per share of common stock Basic 2024 | 3.197 |
| Diluted 2024 | 3.498 |
| Net income $ 2024 | 7.153 |
| Comprehensive income 2024 | 6.626 |
| Less: Comprehensive income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | 62 |
| Comprehensive income attributable to common stockholders $ 2024 | 6.564 |
| Stock-based compensation — — 2024 | 1.806 |
| Distributions to noncontrolling interests 2024 | -46 |
| Buy-outs of noncontrolling interests 2024 | -11 |
| Net (loss) income 2024 | -102 |
| Other comprehensive loss — — — 2024 | -415 |
| Adjustments for prior periods from adopting ASU 2024 | -8 |
| net of tax — — — — 2024 | 236236 |
| Net income 6 — — — 2024 | 7.091 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 39
- Mapped lines: 16
- Coverage: 41%
- Readiness: `recoverable` (48)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Energy generation and storage 2024 | fsl-pl-cogs-materials | 10.086 |
| Total revenues 2024 | fsl-pl-revenue | 97.69 |
| Gross profit 2024 | fsl-pl-gross | 17.45 |
| Operating expenses Research and development 2024 | fsl-pl-other-opex | 4.54 |
| Selling, general and administrative 2024 | fsl-pl-opex | 5.15 |
| Income from operations 2024 | fsl-pl-ebit | 7.076 |
| Interest income 2024 | fsl-pl-fin-income | 1.569 |
| Interest expense 2024 | fsl-pl-interest | -350 |
| Other income (expense), net 2024 | fsl-pl-other-income | 695172 |
| Provision for (benefit from) income taxes 2024 | fsl-pl-tax | 1.837 |
| Net income 2024 | fsl-pl-net | 7.153 |
| Diluted 2024 | fsl-pl-eps-diluted | 3.498 |
| Comprehensive income 2024 | fsl-pl-comprehensive-income | 6.626 |
| Less: Comprehensive income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | fsl-pl-net-minority | 62 |
| Comprehensive income attributable to common stockholders $ 2024 | fsl-pl-net-parent | 6.564 |
| Other comprehensive income — — — 2024 | fsl-pl-oci-total | 218 |

| Unmapped labels | Value |
| --- | ---: |
| Revenues Automotive sales $ 2024 | 72.48 |
| Automotive regulatory credits 2024 | 2.763 |
| Automotive leasing 2024 | 1.827 |
| Total automotive revenues 2024 | 77.07 |
| Services and other 2024 | 10.534 |
| Cost of revenues Automotive sales 2024 | 61.87 |
| Total automotive cost of revenues 2024 | 62.873 |
| Total cost of revenues 2024 | 80.24 |
| Restructuring and other 2024 | 684 |
| Total operating expenses 2024 | 10.374 |
| Income before income taxes 2024 | 8.99 |
| Net income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | 62 |
| Net income attributable to common stockholders $ 2024 | 7.091 |
| Weighted average shares used in computing net income per share of common stock Basic 2024 | 3.197 |
| Net income $ 2024 | 7.153 |
| Stock-based compensation — — 2024 | 1.806 |
| Distributions to noncontrolling interests 2024 | -46 |
| Buy-outs of noncontrolling interests 2024 | -11 |
| Net (loss) income 2024 | -102 |
| Other comprehensive loss — — — 2024 | -415 |
| Adjustments for prior periods from adopting ASU 2024 | -8 |
| net of tax — — — — 2024 | 236236 |
| Net income 6 — — — 2024 | 7.091 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 31
- Mapped lines: 15
- Coverage: 48%
- Readiness: `recoverable` (53)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Deferred income taxes 2024 | fsl-cf-taxes-paid | 477 |
| Digital assets (gain) loss, net 2024 | fsl-cf-operating-gain-disposal | -589 |
| Inventory 2024 | fsl-cf-change-wc-inventory | 937 |
| Net cash provided by operating activities 2024 | fsl-cf-operating | 14.923 |
| Purchases of investments 2024 | fsl-cf-capex | -35.955 |
| Proceeds from maturities of investments 2024 | fsl-cf-investing-disposal-proceeds | 28.31 |
| Net cash used in investing activities 2024 | fsl-cf-investing | -18.787 |
| Repayments of debt 2024 | fsl-cf-debt-repayment | -2.5 |
| Principal payments on finance leases 2024 | fsl-cf-lease-repayment | -381 |
| Distributions paid to noncontrolling interests in subsidiaries 2024 | fsl-cf-investing-subsidiaries | -104 |
| Net cash provided by (used in) financing activities 2024 | fsl-cf-financing | 3.853 |
| Cash and cash equivalents and restricted cash, beginning of period 2024 | fsl-cf-opening-cash | 17.189 |
| Cash and cash equivalents and restricted cash, end of period $ 2024 | fsl-cf-closing-cash | 17.037 |
| Supplemental Disclosures Cash paid during the period for interest $ 2024 | fsl-cf-interest-paid | 277 |
| Cash paid during the period for income taxes, net of refunds $ 2024 | fsl-cf-operating-net-income | 1.331 |

| Unmapped labels | Value |
| --- | ---: |
| Cash Flows from Operating Activities Net income $ 2024 | 7.153 |
| Stock-based compensation 2024 | 1.999 |
| Inventory and purchase commitments write-downs 2024 | 335463 |
| Foreign currency transaction net unrealized (gain) loss 2024 | -73 |
| Non-cash interest and other operating activities 2024 | 172 |
| Changes in operating assets and liabilities: Accounts receivable 2024 | -1.083 |
| Operating lease vehicles 2024 | -590 |
| Prepaid expenses and other assets 2024 | -3.273 |
| Accounts payable, accrued and other liabilities 2024 | 3.588 |
| Deferred revenue 2024 | 502 |
| Purchases of solar energy systems, net of sales 2024 | -3 |
| Cash Flows from Financing Activities Proceeds from issuances of debt 2024 | 5.744 |
| Proceeds from exercises of stock options and other stock issuances 2024 | 1.241 |
| Debt issuance costs 2024 | -14 |
| Payments for buy-outs of noncontrolling interests in subsidiaries 2024 | -133 |
| Effect of exchange rate changes on cash and cash equivalents and restricted cash 2024 | -141 |
