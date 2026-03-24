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
- Comparison period: `2025`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 45
- Mapped lines: 11
- Coverage: 24%
- Readiness: `recoverable` (6)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Other operating income 2024 | fsl-bs-other-equity-reserves | 1.335 |
| Interest and similar income 2024 | fsl-bs-ar | 10 |
| Capital expenditure on non-current assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 12.371 |
| Investments accounted for using the equity method 2024 | fsl-bs-equity-method-investments | 553443 |
| Write-downs on inventories to their net realisable value amount- ing to € 2024 | fsl-bs-inventory | 522 |
| reversal of impairment losses on leased products amounted to € 2024 | fsl-bs-equity-parent | 311 |
| Financial and other assets - Automotive 2024 | fsl-bs-other-current-financial-assets | 61.208 |
| Trade payables - Automotive 2024 | fsl-bs-ap | 12.556 |
| Total liabilities – Financial Services 2024 | fsl-bs-total-liabilities | 147.929 |
| Non-operating assets – Other Entities 2024 | fsl-bs-other-non-current-assets | 23.442 |
| Total Group assets 2024 | fsl-bs-total-assets | 267.732 |

| Unmapped labels | Value |
| --- | ---: |
| Revenues 2024 | 124.917 |
| thereof external revenues 2024 | 103.524 |
| thereof inter-segment revenues 2024 | 21.393 |
| Cost of sales 2024 | 107.729 |
| Selling and administrative expenses 2024 | 9.357 |
| Other operating expenses 2024 | 1.273 |
| Segment result Automotive and Motorcycles 2024 | 7.893 |
| Interest and similar expenses 2024 | 20 |
| Other financial result 2024 | 37 |
| Segment result Financial Services and Other Entities 2024 | 2.538 |
| Result from equity accounted investments 2024 | 14 |
| Depreciation and amortisation on non-current assets 2024 | 8.504 |
| Segment assets 2024 | 70.804 |
| Reconciliation of segment result Total for reportable segments 2024 | 11.466 |
| Financial result of Automotive segment 2024 | 349 |
| Elimination of inter-segment items 2024 | 146 |
| Group profit before tax 2024 | 10.971 |
| Reconciliation of capital expenditure on non-current assets Total for reportable segments 2024 | 44.032 |
| Total Group capital expenditure on non-current assets 2024 | 36.752 |
| Reconciliation of depreciation and amortisation on non-current assets Total for reportable segments 2024 | 19.327 |
| Total Group depreciation and amortisation on non-current assets 2024 | 14.628 |
| Reconciliation of segment assets Total for reportable segments 2024 | 197.237 |
| Financial and other assets - Motorcycles 2024 | 56 |
| Europe 2024 | 60.78 |
| thereof Germany 2024 | 19.845 |
| Asia 2024 | 46.558 |
| thereof China 2024 | 31.786 |
| Americas 2024 | 31.941 |
| thereof USA 2024 | 27.048 |
| Other regions 2024 | 3.101 |
| Eliminations – – 2024 | 8.411 |
| Group 2024 | 142.38 |
| LIST OF INVESTMENTS AT 2024 | 31 |
| subsidiaries apply the exemptions available in § 2024 | 264 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 58
- Mapped lines: 22
- Coverage: 38%
- Readiness: `recoverable` (46)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `PL_GROSS_MISMATCH`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Revenues 2024 | fsl-pl-revenue | 7 |
| Cost of sales 2024 | fsl-pl-cogs | 8 |
| Gross profit 2024 | fsl-pl-gross | 22.895 |
| Selling and administrative expenses 2024 | fsl-pl-gna | 9 |
| Other operating income 2024 | fsl-pl-ebit | 10 |
| Other operating expenses 2024 | fsl-pl-other-opex | 10 |
| Result from equity accounted investments 2024 | fsl-pl-equity-method-income | 24 |
| Other financial result 2024 | fsl-pl-other-fin | 12 |
| Profit/loss before tax 2024 | fsl-pl-ebt | 10.971 |
| Income taxes 2024 | fsl-pl-tax | 13 |
| Net profit/loss 2024 | fsl-pl-net | 7.678 |
| Attributable to non-controlling interests 2024 | fsl-pl-net-minority | 388875 |
| Items not expected to be reclassified to the income statement in the future 2024 | fsl-pl-oci-non-reclassifiable | 252 |
| Items that can be reclassified to the income statement in the future 2024 | fsl-pl-oci-reclassifiable | 592 |
| Other comprehensive income for the period after tax 2024 | fsl-pl-oci-total | 19 |
| Total comprehensive income 2024 | fsl-pl-comprehensive-income | 7.338 |
| A S S E T S Intangible assets 2024 | fsl-pl-depreciation-intangibles | 21 |
| Property, plant and equipment 2024 | fsl-pl-depreciation-ppe | 22 |
| Deferred tax 2024 | fsl-pl-tax-deferred | 13 |
| Inventories 2024 | fsl-pl-cbn-inventory-change | 29 |
| Current tax 2024 | fsl-pl-tax-current | 27 |
| Cash and cash equivalents 2024 | fsl-pl-fin-income | 19.287 |

| Unmapped labels | Value |
| --- | ---: |
| Profit/loss before financial result 2024 | 11.509 |
| Interest and similar income 2024 | 11655 |
| Interest and similar expenses 2024 | 11 |
| Financial result 2024 | 538 |
| Attributable to shareholders of the BMW AG 2024 | 7.29 |
| Remeasurement of the net liability for defined benefit pension plans 2024 | 33302 |
| Derivative financial instruments 2024 | 3.306 |
| Other comprehensive income from equity accounted investments 2024 | 7 |
| Currency translation foreign operations 2024 | 1.108 |
| Total comprehensive income attributable to shareholders of BMW AG 2024 | 7.014 |
| Balance Sheet for Group and Segments at 2024 | 31 |
| Leased products 2024 | 23 |
| Investments accounted for using the equity method 2024 | 24553 |
| Other investments 2024 | 1.099 |
| Receivables from sales financing 2024 | 25 |
| Financial assets 2024 | 26834 |
| Other assets 2024 | 28 |
| Non-current assets 2024 | 171.345 |
| Trade receivables 2024 | 30 |
| Current assets 2024 | 96.387 |
| Total assets 2024 | 267.732 |
| Capital reserves 2024 | 31 |
| Revenue reserves 2024 | 31 |
| Accumulated other equity 2024 | 31 |
| Treasury shares 2024 | 31 |
| Equity attributable to shareholders of BMW AG 2024 | 31 |
| Non-controlling interests 2024 | 2.688 |
| Equity 2024 | 95.003 |
| Pension provisions 2024 | 33222 |
| Other provisions 2024 | 34 |
| Financial liabilities 2024 | 36 |
| Other liabilities 2024 | 37 |
| Non-current provisions and liabilities 2024 | 85.04 |
| Trade payables 2024 | 38 |
| Current provisions and liabilities 2024 | 87.689 |
| Total equity and liabilities 2024 | 267.732 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 28
- Mapped lines: 10
- Coverage: 36%
- Readiness: `recoverable` (50)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Proceeds from the disposal of investment assets and other business units 2024 | fsl-cf-investing-disposal-proceeds | 13 |
| Investments in marketable securities and investment funds 2024 | fsl-cf-investing-subsidiaries | 1.062 |
| Cash inflow/outflow from investing activities 2024 | fsl-cf-investing | 11.369 |
| Payment of dividends to shareholders of BMW AG 2024 | fsl-cf-capex | 3.781 |
| Interest paid * 2024 | fsl-cf-interest-paid | 196 |
| Change in other financial liabilities 2024 | fsl-cf-change-wc-other | 3.937 |
| Cash inflow/outflow from financing activities 2024 | fsl-cf-financing | 5.766 |
| Change in cash and cash equivalents 2024 | fsl-cf-net-change-cash | 1.96 |
| Cash and cash equivalents as at 2024 | fsl-cf-opening-cash | 1 |
| Treasury share redemption – – – – – – – – – – – Reclassification resulting from share redemption – – – – – – – – – – – Other changes – – 2024 | fsl-cf-operating-equity-method | 21 |

| Unmapped labels | Value |
| --- | ---: |
| Proceeds from the disposal of marketable securities and investment funds 2024 | 1.834 |
| Payments out of equity 2024 | 22 |
| Treasury shares acquired 2024 | 1.002 |
| Payment of dividends to non-controlling interests 2024 | 1.013 |
| Intragroup financing and equity transactions – 2024 | 2.001 |
| Proceeds from issue of non-current financial liabilities 2024 | 30.025 |
| Repayment of non-current financial liabilities 2024 | 22.182 |
| Effect of exchange rate on cash and cash equivalents 2024 | 3 |
| Effect of changes in composition of Group on cash and cash equivalents 2024 | 27 |
| Net profit – 2024 | 7.29 |
| Other comprehensive income for the period after tax – 2024 | 252978 |
| Comprehensive income at 2024 | 7.542 |
| Dividend payments – – 2024 | 3.781 |
| Treasury shares acquired – – – – – – – 2024 | 1.002 |
| Other comprehensive income for the period after tax – – 2024 | 118 |
| Treasury share redemption – – 2024 | 2 |
| Reclassification resulting from share redemption 2024 | 24 |
| Other changes – – 2024 | 95 |

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
- Extracted lines: 19
- Mapped lines: 17
- Coverage: 89%
- Readiness: `recoverable` (82)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `PL_GROSS_MISMATCH`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Przychody z umów z klientami 2024 | fsl-pl-revenue | 35320 |
| Koszty sprzedanych produktów, towarów i materiałów 2024 | fsl-pl-cogs | -29348 |
| Koszty sprzedaży i koszty ogólnego zarządu 2024 | fsl-pl-selling | -2205 |
| Zysk/(strata) netto ze sprzedaży 2024 | fsl-pl-gross | 3767 |
| pozostałe odsetki obliczone z zastosowaniem metody efektywnej stopy procentowej 2024 | fsl-pl-interest-lease | 63 |
| Pozostałe koszty operacyjne, w tym: 2024 | fsl-pl-other-opex | -1118 |
| straty z tytułu utraty wartości instrumentów finansowych ( 2024 | fsl-pl-impairment-receivables | 1 |
| Koszty finansowe ( 2024 | fsl-pl-fin-expense | 516 |
| Zysk/(strata) przed opodatkowaniem 2024 | fsl-pl-ebt | 4608 |
| Podatek dochodowy 2024 | fsl-pl-tax | -1738 |
| ZYSK/(STRATA) NETTO 2024 | fsl-pl-net | 2870 |
| Zysk/(strata) netto przypadający: akcjonariuszom Jednostki Dominującej 2024 | fsl-pl-net-parent | 2868 |
| Zysk/(strata) na akcję podstawowy i rozwodniony (w PLN) 2024 | fsl-pl-eps-basic | 14.34 |
| Różnice kursowe z przeliczenia sprawozdań jednostek o walucie funkcjonalnej innej niż PLN 2024 | fsl-pl-oci-fx | 15 |
| Zyski/(straty) aktuarialne, po uwzględnieniu efektu podatkowego 2024 | fsl-pl-oci-actuarial | 271 |
| Pozostałe całkowite dochody, które nie zostaną przeklasyfikowane do wyniku 2024 | fsl-pl-oci-non-reclassifiable | 286 |
| ŁĄCZNE CAŁKOWITE DOCHODY 2024 | fsl-pl-comprehensive-income | 2726 |

| Unmapped labels | Value |
| --- | ---: |
| na udziały niekontrolujące 2024 | 2 |
| Łączne całkowite dochody przypadające: akcjonariuszom Jednostki Dominującej 2024 | 2725 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 60
- Mapped lines: 22
- Coverage: 37%
- Readiness: `recoverable` (45)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Amortyzacja ujęta w wyniku finansowym 2024 | fsl-cf-operating-depreciation | 2006 |
| Straty ze zbycia rzeczowych aktywów trwałych i wartości niematerialnych 2024 | fsl-cf-operating-gain-disposal | 25 |
| Zmiana stanu pozostałych należności i zobowiązań innych niż kapitał obrotowy 2024 | fsl-cf-change-wc-other | 163 |
| Pozostałe korekty ( 2024 | fsl-cf-operating-other-adj | 33 |
| Podatek dochodowy, z tego: ( 2024 | fsl-cf-taxes-paid | 413 |
| wpływy z tytułu zwrotu podatku dochodowego 2024 | fsl-cf-debt-drawdown | 614 |
| Zmiana stanu kapitału obrotowego, w tym: ( 2024 | fsl-cf-change-wc | 875 |
| zmiana stanu zobowiązań handlowych objętych mechanizmami faktoringu odwrotnego 2024 | fsl-cf-change-wc-ap | -1007 |
| Przepływy pieniężne netto z działalności operacyjnej 2024 | fsl-cf-operating | 4690 |
| Wydatki na pozostałe rzeczowe aktywa trwałe i wartości niematerialne ( 2024 | fsl-cf-capex-intangibles | 679 |
| Wydatki na nabycie jednostek zależnych ( 2024 | fsl-cf-capex | 63 |
| Wpływy z tytułu spłaty pożyczek udzielonych wspólnemu przedsięwzięciu (kapitał) 2024 | fsl-cf-debt-repayment | 346 |
| Wpływy ze zbycia rzeczowych aktywów trwałych i wartości niematerialnych 2024 | fsl-cf-investing-disposal-proceeds | 46 |
| Przepływy pieniężne netto z działalności inwestycyjnej 2024 | fsl-cf-investing | -5506 |
| Spłata odsetek, z tego: ( 2024 | fsl-cf-operating-interest-income | 202 |
| Przepływy pieniężne netto z działalności finansowej ( 2024 | fsl-cf-financing | 217 |
| Różnice kursowe 2024 | fsl-cf-operating-fv-derivatives | 19 |
| Stan środków pieniężnych i ich ekwiwalentów na początek okresu 2024 | fsl-cf-opening-cash | 1729 |
| Stan środków pieniężnych i ich ekwiwalentów na koniec okresu, w tym: 2024 | fsl-cf-closing-cash | 715 |
| środki pieniężne o ograniczonej możliwości dysponowania 2024 | fsl-cf-change-wc-restricted-cash | 24 |
| niż z tytułu wyceny instrumentów finansowych 2024 | fsl-cf-operating-fv-changes | 1778 |
| Zobowiązania z tytułu świadczeń pracowniczych 2024 | fsl-cf-operating-dividend-income | 2784 |

| Unmapped labels | Value |
| --- | ---: |
| Przepływy pieniężne z działalności operacyjnej Zysk/(strata) przed opodatkowaniem 2024 | 4608 |
| Odsetki od pożyczek udzielonych wspólnemu przedsięwzięciu ( 2024 | 552 |
| Pozostałe odsetki 2024 | 183 |
| i wartości niematerialnych 2024 | 312 |
| Zysk z tytułu odwrócenia utraty wartości rzeczowych aktywów trwałych i wartości niematerialnych ( 2024 | 74 |
| wspólnemu przedsięwzięciu ( 2024 | 226 |
| z działalności inwestycyjnej i wyceny środków pieniężnych ( 2024 | 495 |
| z działalności finansowej 2024 | 84 |
| Razem wyłączenia przychodów i kosztów 2024 | 1370 |
| wydatki z tytułu zapłaty podatku dochodowego 2024 | -1027 |
| Przepływy pieniężne z działalności inwestycyjnej Nota 2024 | 9.1 |
| Wydatki na aktywa finansowe przeznaczone na likwidację kopalń i innych obiektów technologicznych ( 2024 | 45 |
| Udzielone zaliczki na rzeczowe aktywa trwałe i wartości niematerialne ( 2024 | 31 |
| Pozostałe ( 2024 | 22 |
| Wpływy z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego 2024 | 64 |
| Wydatki z tytułu instrumentów pochodnych związanych ze źródłami finansowania zewnętrznego ( 2024 | 75 |
| od zobowiązań handlowych objętych mechanizmami faktoringu odwrotnego ( 2024 | 164 |
| Wydatki z tytułu dywidend wypłaconych akcjonariuszom Jednostki Dominującej ( 2024 | 300 |
| Pozostałe 2024 | 7 |
| AKTYWA Rzeczowe aktywa trwałe górnicze i hutnicze 2024 | 24050 |
| Aktywa niematerialne górnicze i hutnicze 2024 | 2830 |
| Rzeczowe i niematerialne aktywa górnicze i hutnicze 2024 | 26880 |
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
- Extracted lines: 37
- Mapped lines: 14
- Coverage: 38%
- Readiness: `recoverable` (33)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| The joint venture that is material to the group at 2025 | fsl-bs-equity-parent | 50 |
| Sales and other operating revenues 2025 | fsl-bs-ar-trade | 4.426 |
| Other comprehensive income — — — Total comprehensive income 2025 | fsl-bs-other-equity-reserves | 812 |
| Non-current assets 2025 | fsl-bs-fixed | 22.564 |
| Total assets 2025 | fsl-bs-total-assets | 26.574 |
| Total liabilities 2025 | fsl-bs-total-liabilities | 16.414 |
| b Azule Energy includes cash and cash equivalents of $ 2025 | fsl-bs-cash | 596 |
| Non-controlling interest — — — 2025 | fsl-bs-minority-interest | 1 |
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
| Less: non-controlling interests — 2025 | 10.16 |
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

- Selected period: `2023`
- Comparison period: `2025`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 77
- Mapped lines: 20
- Coverage: 26%
- Readiness: `recoverable` (25)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Total sales and other operating revenues 2023 | fsl-pl-revenue | 189.335 |
| Interest and other income Interest income from Financial assets measured at amortized cost 2023 | fsl-pl-interest | 1.203 |
| Other incomea 2023 | fsl-pl-other-income | 277 |
| Expenditure on research and development 2023 | fsl-pl-other-opex | 274301 |
| Costs relating to the Gulf of America oil spill (pre-interest and tax)c 2023 | fsl-pl-depreciation-ppe | 31 |
| Finance costs Interest expense on lease liabilities 2023 | fsl-pl-fin-expense | 704468 |
| Capitalized at 4.69% 2023 | fsl-pl-depreciation | -142 |
| Other exploration costs 2023 | fsl-pl-cogs-other | 227207 |
| Intangible assets – exploration and appraisal expenditurea 2023 | fsl-pl-depreciation-intangibles | 3.963 |
| Current tax Charge for the yeara 2023 | fsl-pl-tax-current | 6.501 |
| Adjustment in respect of prior yearsc 2023 | fsl-pl-cbn-inventory-change | 675 |
| Tax charge on profit 2023 | fsl-pl-ebt | 6.451 |
| mainly relates to transactions involving non-controlling interests. 2023 | fsl-pl-net-minority | 190 |
| Tax rate computed at the weighted average statutory ratea 2023 | fsl-pl-shares-outstanding | 55 |
| Increase (decrease) resulting from Tax reported in equity-accounted entities 2023 | fsl-pl-equity-method-income | -5 |
| Deferred tax not recognized 2023 | fsl-pl-tax-deferred | 5 |
| Items not deductible for tax purposesb 2023 | fsl-pl-oci-non-reclassifiable | 11 |
| Charge (credit) for the year in the income statement 2023 | fsl-pl-tax | 138 |
| Pension plan and other post-employment benefit plan deficits 2023 | fsl-pl-cbn-social-security | 48 |
| Dividends announced and paid in cash Preference shares 2023 | fsl-pl-fin-income | 1 |

| Unmapped labels | Value |
| --- | ---: |
| Other income statement items Production and similar taxes 2023 | 136 |
| Non-current assets Non-current assetsb c 2023 | 64.238 |
| Crude oil 2023 | 2.063 |
| Oil products 2023 | 114.207 |
| Natural gas, LNG and NGLs 2023 | 27.477 |
| Non-oil products and other revenues from contracts with customers 2023 | 15.132 |
| Revenue from contracts with customers 2023 | 158.879 |
| Other operating revenuesa 2023 | 30.456 |
| Financial assets measured at fair value through profit or loss 2023 | 129181 |
| Interest expense on other liabilities measured at amortized costd 2023 | 3.419 |
| Unwinding of discount on provisions 2023 | 675617 |
| Unwinding of discount on other payables measured at amortized cost 2023 | 472393 |
| e Tax relief on capitalized interest is approximately $ 2023 | 130 |
| Exploration and evaluation costs Exploration expenditure written off 2023 | 343767 |
| Exploration expense for the year 2023 | 570974 |
| Impairment losses 2023 | 26 |
| Liabilities 2023 | 33 |
| Net assets 2023 | 3.93 |
| Cash used in operating activities 2023 | 227207 |
| Cash used in investing activities 2023 | 1.169 |
| a Amount capitalized at 2023 | 536 |
| the Middle East and North Africa region 2023 | 1.182 |
| Deferred tax Origination and reversal of temporary differences in the current yearb 2023 | -537 |
| Germany. 2023 | 96 |
| to price assumptions and profit forecasts 2023 | 263 |
| liability or asset. In 2023 | 658 |
| for further information. The total tax credit recognized directly in equity was $ 2023 | 56 |
| Profit (loss) before taxation 2023 | 7.746 |
| Tax charge (credit) on profit or loss 2023 | 6.451 |
| Effective tax rate 2023 | 83 |
| Adjustments in respect of prior years 2023 | 6 |
| Foreign exchange 2023 | -4 |
| Tax rate change effect of UK Energy Profits Levyc 2023 | 7 |
| Otherd 2023 | 5 |
| Exchange adjustments 2023 | -63 |
| Deferred tax liability Depreciation 2023 | -897 |
| Pension plan surpluses 2023 | -3 |
| Derivative financial instruments 2023 | 37 |
| Other taxable temporary differencesa 2023 | 37 |
| Deferred tax asset Depreciation 2023 | 993 |
| Lease liabilities 2023 | -395 |
| Tax credits 2023 | -111 |
| Loss carry forward 2023 | 580194 |
| Other deductible temporary differencesb 2023 | 211 |
| Net deferred tax charge (credit) and net deferred tax liability 2023 | 138 |
| Of which – deferred tax liabilities 2023 | 7.642 |
| Of the $ 2023 | 4.325 |
| Germany, $ 2023 | 473 |
| Taxable temporary differences associated with investments in subsidiaries and equity-accounted entities 2023 | 0.7 |
| these tax credits expire in the period 2023 | -2035 |
| Current tax benefit relating to the utilization of previously unrecognized deferred tax assets 2023 | 101 |
| Deferred tax benefit relating to the recognition of previously unrecognized deferred tax assets 2023 | 156280 |
| The quarterly dividend which is expected to be paid on 2023 | 27 |
| Ordinary shares March 2023 | 6.1761 |
| June 2023 | 5.8993 |
| September 2023 | 6.1942 |
| December 2023 | 6.2394 |

### CF

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 107
- Mapped lines: 26
- Coverage: 24%
- Readiness: `recoverable` (42)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Cash flow hedges reclassified to the income statement 2025 | fsl-cf-operating-net-income | 30 |
| Intangible assets 2025 | fsl-cf-capex-intangibles | 15 |
| Prepayments 2025 | fsl-cf-change-wc-prepaids | 3.422 |
| Lease liabilities 2025 | fsl-cf-debt-drawdown-lease | 28 |
| Provisions 2025 | fsl-cf-change-wc-provisions | 23 |
| Equity bp shareholders’ equity 2025 | fsl-cf-operating-equity-method | 32 |
| Depreciation, depletion and amortization 2025 | fsl-cf-operating-depreciation | 5 |
| Impairment and (gain) loss on sale of businesses and fixed assets 2025 | fsl-cf-operating-gain-disposal | 4 |
| Dividends received from joint ventures and associates 2025 | fsl-cf-dividends-received | 2.111 |
| Interest paid 2025 | fsl-cf-interest-paid | -3.538 |
| Income taxes paid 2025 | fsl-cf-taxes-paid | -6.589 |
| Net cash provided by operating activities 2025 | fsl-cf-operating | 24.493 |
| Investment in associates 2025 | fsl-cf-investing-subsidiaries | -110 |
| Proceeds from disposals of fixed assets 2025 | fsl-cf-investing-disposal-proceeds | 4 |
| Proceeds from disposals of businesses, net of cash disposed 2025 | fsl-cf-capex | 4 |
| Proceeds from loan repayments 2025 | fsl-cf-debt-drawdown-bank | 173 |
| Net cash used in investing activities 2025 | fsl-cf-investing | -11.504 |
| Lease liability payments 2025 | fsl-cf-debt-repayment-lease | -3.091 |
| Proceeds from long-term financing 2025 | fsl-cf-debt-drawdown | 2.724 |
| Repayments of long-term financing 2025 | fsl-cf-debt-repayment | -5.695 |
| Receipts relating to transactions involving non-controlling interests (other) 2025 | fsl-cf-other-receipts | 2.474 |
| Dividends paid bp shareholders 2025 | fsl-cf-dividends | 10 |
| Net cash provided by (used in) financing activities 2025 | fsl-cf-financing | -15.88 |
| Increase (decrease) in cash and cash equivalents 2025 | fsl-cf-net-change-cash | -2.645 |
| Cash and cash equivalents at beginning of year 2025 | fsl-cf-opening-cash | 39.269 |
| Cash and cash equivalents at end of yeara 2025 | fsl-cf-closing-cash | 36.624 |

| Unmapped labels | Value |
| --- | ---: |
| Items that may be reclassified subsequently to profit or loss Currency translation differencesa 2025 | 1.863 |
| Cash flow hedges marked to market 2025 | 30287 |
| Costs of hedging marked to market 2025 | 30 |
| Costs of hedging reclassified to the income statement 2025 | 30 |
| Share of items relating to equity-accounted entities, net of tax 2025 | 16 |
| Income tax relating to items that may be reclassified 2025 | 9 |
| Remeasurements of equity investments 2025 | -6 |
| Cash flow hedges that will subsequently be transferred to the balance sheet 2025 | 30 |
| Income tax relating to items that will not be reclassifieda 2025 | 9 |
| Other comprehensive income 2025 | 1.932 |
| Total comprehensive income 2025 | 3.227 |
| Attributable to bp shareholders 2025 | 1.872 |
| Non-controlling interests 2025 | 1.355 |
| shareholders' equity Non-controlling interests Total equity Hybrid bonds Other interest At 2025 | 48.229 |
| Profit for the year — — — 2025 | 55 |
| Other comprehensive income — 2025 | 1.804 |
| Total comprehensive income — 2025 | 1.804 |
| Dividendsb — — — 2025 | -5.087 |
| Cash flow hedges transferred to the balance sheet, net of tax — — 2025 | -6 |
| Repurchase of ordinary share capital 2025 | -3.558 |
| Share-based payments, net of tax 2025 | 35 |
| Share of equity-accounted entities’ changes in equity, net of tax — — — 2025 | 1 |
| Issue of perpetual hybrid bonds — — — — — 2025 | 500 |
| Redemption of perpetual hybrid bonds, net of tax — — — — — 2025 | -1.2 |
| Payments on perpetual hybrid bonds — 2025 | -9 |
| Transactions involving non-controlling interests, net of tax — — — 2025 | -65 |
| Repurchase of ordinary share capital — — — 2025 | -7.302 |
| Issue of perpetual hybrid bonds — — — 2025 | -22 |
| Redemption of perpetual hybrid bonds, net of tax — — — 2025 | 9 |
| Payments on perpetual hybrid bonds — — — — — 2025 | -610 |
| Non-current assets Property, plant and equipment 2025 | 12 |
| Goodwill 2025 | 14 |
| Investments in joint ventures 2025 | 16 |
| Investments in associates 2025 | 17 |
| Other investments 2025 | 18857 |
| Fixed assets 2025 | 138.712 |
| Loans 2025 | 1.991 |
| Trade and other receivables 2025 | 20 |
| Derivative financial instruments 2025 | 30 |
| Deferred tax assets 2025 | 9 |
| Defined benefit pension plan surpluses 2025 | 24 |
| Inventories 2025 | 19 |
| Current tax receivable 2025 | 1.153 |
| Cash and cash equivalents 2025 | 25 |
| Assets classified as held for sale 2025 | 2 |
| Total assets 2025 | 278.526 |
| Current liabilities Trade and other payables 2025 | 22 |
| Accruals 2025 | 5.572 |
| Finance debt 2025 | 26 |
| Current tax payable 2025 | 1.262 |
| Liabilities directly associated with assets classified as held for sale 2025 | 2 |
| Non-current liabilities Other payables 2025 | 22 |
| Deferred tax liabilities 2025 | 9 |
| Defined benefit pension plan and other post-employment benefit plan deficits 2025 | 24 |
| Total liabilities 2025 | 204.526 |
| Net assets 2025 | 74 |
| Total equity 2025 | 32 |
| Albert Manifold Chair Carol Howle Interim Chief executive officer 2025 | 6 |
| Operating activities Profit (loss) before taxation 2025 | 7.746 |
| Earnings from joint ventures and associates 2025 | -618 |
| Remeasurement of joint ventures 2025 | 3 |
| Interest receivable 2025 | -1.352 |
| Interest received 2025 | 1.223 |
| Finance costs 2025 | 7 |
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
| Redemption of perpetual hybrid bonds 2025 | 32 |
| Payments relating to perpetual hybrid bonds 2025 | -1.196 |
| Payments relating to transactions involving non-controlling interests (other) 2025 | -2 |
| Currency translation differences relating to cash and cash equivalents 2025 | 246 |

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
- Extracted lines: 32
- Mapped lines: 23
- Coverage: 72%
- Readiness: `recoverable` (43)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`, `VALIDATION_HARD_FAIL`
- Validation blockers: `BS_EQUATION_MISMATCH`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
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

- Selected period: `2023`
- Comparison period: `2025`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 13
- Mapped lines: 3
- Coverage: 23%
- Readiness: `recoverable` (0)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| statements and whether we will apply the standard prospectively or retrospectively. In November 2023 | fsl-pl-cbn-inventory-change | 2024 |
| will be applied prospectively. The Company is currently evaluating the impact that ASU 2023 | fsl-pl-oci-non-reclassifiable | -3 |
| Acquisitions Our Company’s acquisitions of businesses, equity method investments and nonmarketable securities totaled $ 2023 | fsl-pl-depreciation-ppe | 315 |

| Unmapped labels | Value |
| --- | ---: |
| In December 2023 | -9 |
| for our year ending December 2023 | -9 |
| (Subtopic 2023 | 220 |
| annual disclosures are effective for our year ending December 2023 | 31 |
| during 2023 | 2022 |
| information on these investments. Divestitures During 2023 | 2024 |
| investee, for which we received cash proceeds of $ 2023 | 302 |
| received cash proceeds of $ 2023 | 123 |
| December 2023 | 31 |
| which we received net cash proceeds of $ 2023 | 1.652 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 39
- Mapped lines: 7
- Coverage: 18%
- Readiness: `recoverable` (26)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Total $ 2024 | fsl-cf-operating-adjustments | 428 |
| Current maturities of long-term debt $ — $ 2024 | fsl-cf-debt-repayment | 552 |
| Long-term debt 2024 | fsl-cf-debt-drawdown | 11.824 |
| The Company reclassified a gain of $ 2024 | fsl-cf-operating-gain-disposal | 3 |
| Foreign currency contracts Net operating revenues $ 2024 | fsl-cf-operating | 211 |
| Consolidated net income $ 2024 | fsl-cf-operating-net-income | 8.439 |
| Company equity method investments $ 2024 | fsl-cf-operating-equity-method | 18.087 |

| Unmapped labels | Value |
| --- | ---: |
| were $ 2024 | 2023 |
| foreign currency denominated assets and liabilities were $ 2024 | 2023 |
| December 2024 | 2023 |
| Company’s interest rate cash flow hedging program was $ 2024 | 750 |
| Foreign currency contracts $ 2024 | 457 |
| Foreign currency contracts 2024 | 37 |
| Interest rate contracts 2024 | -54 |
| Commodity contracts 2024 | 6 |
| As of December 2024 | 31 |
| (in millions): Notional Values Gain (Loss) Recognized in OCI as of December 2024 | 31 |
| Foreign currency denominated debt 2024 | 13.221 |
| economic hedges were $ 2024 | 2023 |
| Foreign currency contracts Cost of goods sold 2024 | -44 |
| Foreign currency contracts Other income (loss) — net 2024 | -107 |
| Commodity contracts Cost of goods sold 2024 | -97 |
| Other derivative instruments Selling, general and administrative expenses 2024 | 17 |
| Net operating revenues $ 2024 | 99.043 |
| Cost of goods sold 2024 | 58.527 |
| Gross profit $ 2024 | 40.516 |
| Operating income $ 2024 | 12.536 |
| Less: Net income attributable to noncontrolling interests 2024 | 98 |
| Net income attributable to common shareowners $ 2024 | 8.341 |
| Company equity income (loss) — net $ 2024 | 1.77 |
| Current assets $ 2024 | 33.72 |
| Noncurrent assets 2024 | 72.039 |
| Total assets $ 2024 | 105.759 |
| Current liabilities $ 2024 | 26.959 |
| Noncurrent liabilities 2024 | 33.004 |
| Total liabilities $ 2024 | 59.963 |
| Equity attributable to shareowners of investees $ 2024 | 44.295 |
| Equity attributable to noncontrolling interests 2024 | 1.501 |
| Total equity $ 2024 | 45.796 |

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
| Unrealized net gain (loss) on investments, net of tax 2024 | 12 |
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

### P&L

- Selected period: `2024`
- Comparison period: `n/a`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 56
- Mapped lines: 15
- Coverage: 27%
- Readiness: `recoverable` (8)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Assets Digital assets, net $ 2024 | fsl-pl-depreciation-intangibles | 184 |
| Deferred tax assets 2024 | fsl-pl-tax-deferred | 6.733 |
| Other 2024 | fsl-pl-revenue-other | 1 |
| Other income (expense), net Before adoption $ 2024 | fsl-pl-other-income | 108 |
| Provision for (benefit from) income taxes Before adoption $ 2024 | fsl-pl-tax | 409 |
| Net income attributable to common stockholders Before adoption $ 2024 | fsl-pl-net | 1.129 |
| There were no accumulated impairment losses as of December 2024 | fsl-pl-impairment-receivables | 2023 |
| Corporate debt securities 2024 | fsl-pl-ebt | 118 |
| Total $ 2024 | fsl-pl-oci-total | 23.253 |
| Certificates of deposit and time deposits 2024 | fsl-pl-depreciation-ppe | 12.767 |
| Total cash, cash equivalents and short-term investments $ 2024 | fsl-pl-fin-income | 36.549 |
| Raw materials $ 2024 | fsl-pl-cogs-materials-raw | 5.242 |
| Finished goods 2024 | fsl-pl-cbn-inventory-change | -1 |
| Computer equipment, hardware and software 2024 | fsl-pl-gna-it | 2.902 |
| Less: Accumulated depreciation 2024 | fsl-pl-depreciation | -15.588 |

| Unmapped labels | Value |
| --- | ---: |
| expenses. The ASU is effective for annual periods beginning after December 2024 | 15 |
| the provisions of this ASU. Recently adopted accounting pronouncements In November 2024 | 2023 |
| interim periods within fiscal years beginning after December 2024 | 15 |
| In December 2024 | 2023 |
| is effective for annual periods beginning after December 2024 | 15 |
| Adjustments from Adoption of the New Crypto Assets Standard Balances at January 2024 | 1 |
| Stockholders' equity Retained earnings 2024 | 27.882 |
| During the years ended December 2024 | 2023 |
| December 2024 | 31 |
| summarizes the amounts shown on our consolidated balance sheet as of December 2024 | 31 |
| Units Cost Basis Fair Value Digital assets held: Bitcoin 2024 | 11.509 |
| As of: Consolidated Balance Sheets (unaudited): March 2024 | 30 |
| Digital assets, net Before adoption $ 2024 | 184 |
| Adjustments 2024 | 638538 |
| As adjusted $ 2024 | 822 |
| Deferred tax assets Before adoption $ 2024 | 6.769 |
| Three Months Ended Condensed Consolidated Statements of Operations (unaudited): March 2024 | 30 |
| Net income per share of common stock attributable to common stockholders Basic Before adoption $ 2024 | 0.37 |
| Diluted Before adoption $ 2024 | 0.34 |
| The unaudited impact of adoption for the three months ended December 2024 | 347 |
| for (benefit from) income taxes, thus contributing $ 2024 | 270 |
| There were no impairment losses recorded for any period during the year ended December 2024 | 31 |
| Digital assets, net did not change throughout the year ended December 2024 | 31 |
| adopted as of January 2024 | 1 |
| Goodwill decreased $ 2024 | 9 |
| The net carrying value of our intangible assets decreased from $ 2024 | 178 |
| on a recurring basis were as follows (in millions): December 2024 | 31 |
| Commercial paper 2024 | 3.919 |
| U.S. government securities 2024 | 3.62 |
| Money market funds 2024 | 1.753 |
| Digital assets 2024 | 1.076 |
| As of December 2024 | 31 |
| Work in process 2024 | 1.532 |
| Service parts 2024 | 1.303 |
| value. During the years ended December 2024 | 31 |
| Machinery, equipment, vehicles and office furniture $ 2024 | 18.339 |
| Land and buildings 2024 | 10.677 |
| AI infrastructure 2024 | 5.152 |
| Tooling 2024 | 3.883 |
| Leasehold improvements 2024 | 3.688 |
| Construction in progress 2024 | 6.783 |

### CF

- Selected period: `2025`
- Comparison period: `n/a`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 26
- Mapped lines: 1
- Coverage: 4%
- Readiness: `recoverable` (4)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `CF_CORE_LINES_MISSING`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Cost of Revenues and Gross Margin Year Ended December 2025 | fsl-cf-capex | 31 |

| Unmapped labels | Value |
| --- | ---: |
| Automotive sales $ 2025 | 72.48 |
| Automotive regulatory credits 2025 | 2.763 |
| Automotive leasing 2025 | 1.827 |
| Total automotive revenues 2025 | 77.07 |
| Services and other 2025 | 10.534 |
| Total automotive & services and other segment revenue 2025 | 87.604 |
| Energy generation and storage segment revenue 2025 | 10.086 |
| Total revenues $ 2025 | 97.69 |
| Automotive sales revenue decreased $6.03 billion, or 2025 | 8 |
| well as mix. Additionally, there was a decrease of approximately 2025 | 22 |
| Automotive regulatory credits revenue increased $ 2025 | 973 |
| December 2025 | 31 |
| Automotive leasing revenue decreased $ 2025 | 293 |
| Energy generation and storage revenue increased $4.05 billion, or 2025 | 67 |
| Cost of revenues Automotive sales $ 2025 | 61.87 |
| Total automotive cost of revenues 2025 | 62.873 |
| Total automotive & services and other segment cost of revenues 2025 | 72.794 |
| Energy generation and storage segment 2025 | 7.446 |
| Total cost of revenues $ 2025 | 80.24 |
| Gross profit total automotive $ 2025 | 14.197 |
| Gross profit total automotive & services and other segment $ 2025 | 14.81 |
| Gross profit energy generation and storage segment $ 2025 | 2.64 |
| Total gross profit $ 2025 | 17.45 |
| Cost of automotive sales revenue decreased $3.25 billion, or 2025 | 5 |
| Cybertruck. Cost of automotive leasing revenue decreased $ 2025 | 265 |
