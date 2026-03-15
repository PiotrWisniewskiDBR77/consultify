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
- Mapped lines: 25
- Coverage: 76%
- Readiness: `recoverable` (60)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `REQUIRED_LINES_MISSING`

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
| Capital reserves 31 2024 | fsl-bs-share-premium | 2.456 |
| Revenue reserves 31 2024 | fsl-bs-retained-earnings | 92.812 |
| Accumulated other equity 31 2024 | fsl-bs-other-equity-reserves | 2.09 |
| Treasury shares 31 2024 | fsl-bs-treasury-shares | 1.502 |
| Equity attributable to shareholders of BMW AG 31 2024 | fsl-bs-equity-parent | 92.315 |
| Non-controlling interests 2024 | fsl-bs-minority-interest | 2.688 |
| Equity 2024 | fsl-bs-equity | 95.003 |
| Pension provisions 2024 | fsl-bs-provisions | 33222 |
| Other liabilities 37 2024 | fsl-bs-other-current-liabilities | 7.597 |
| Non-current provisions and liabilities 2024 | fsl-bs-other-non-current-liabilities-provisions | 85.04 |
| Trade payables 38 2024 | fsl-bs-ap | 14.126 |
| Total equity and liabilities 2024 | fsl-bs-total-liabilities-equity | 267.732 |

| Unmapped labels | Value |
| --- | ---: |
| Leased products 23 2024 | 48.838 |
| Other investments 2024 | 1.099 |
| Other assets 28 2024 | 1.827 |
| Financial assets 26 2024 | 2.565 |
| Other provisions 34 2024 | 7.83 |
| Financial liabilities 36 2024 | 66.77 |
| Current tax 35 2024 | 1.131 |
| Current provisions and liabilities 2024 | 87.689 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 25
- Mapped lines: 19
- Coverage: 76%
- Readiness: `recoverable` (83)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Revenues 7 2024 | fsl-pl-revenue | 142.38 |
| Cost of sales 8 2024 | fsl-pl-cogs | 119.485 |
| Gross profit 2024 | fsl-pl-gross | 22.895 |
| Selling and administrative expenses 9 2024 | fsl-pl-gna | 11.296 |
| Other operating income 10 2024 | fsl-pl-other-income | 1.411 |
| Other operating expenses 10 2024 | fsl-pl-other-opex | 1.501 |
| Profit/loss before financial result 2024 | fsl-pl-ebit | 11.509 |
| Result from equity accounted investments 24 – 14 2024 | fsl-pl-equity-method-income | 159 |
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

| Unmapped labels | Value |
| --- | ---: |
| Financial result 2024 | 538 |
| Remeasurement of the net liability for defined benefit pension plans 2024 | 33302 |
| Items not expected to be reclassified to the income statement in the future 2024 | 252 |
| Derivative financial instruments 2024 | 3.306 |
| Currency translation foreign operations 2024 | 1.108 |
| Total comprehensive income attributable to shareholders of BMW AG 2024 | 7.014 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 34
- Mapped lines: 24
- Coverage: 71%
- Readiness: `recoverable` (74)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Profit/loss before tax 2024 | fsl-cf-operating-ebt | 10.971 |
| Income taxes paid 2024 | fsl-cf-taxes-paid | 3.794 |
| Interest received * 2024 | fsl-cf-operating-interest-income | 644683 |
| Depreciation and amortisation of tangible and intangible assets 2024 | fsl-cf-operating-depreciation | 8.65 |
| Result from equity accounted investments 2024 | fsl-cf-operating-equity-method | 14159 |
| Changes in working capital 2024 | fsl-cf-change-wc | 396 |
| Change in inventories 2024 | fsl-cf-change-wc-inventory | 128 |
| Change in trade receivables 2024 | fsl-cf-change-wc-ar | 1.379 |
| Change in trade payables 2024 | fsl-cf-change-wc-ap | 1.647 |
| Change in provisions 2024 | fsl-cf-change-wc-provisions | 726 |
| Change in other operating assets and liabilities 2024 | fsl-cf-change-wc-other | 1.672 |
| Cash inflow/outflow from operating activities 2024 | fsl-cf-operating | 7.566 |
| Total investment in intangible assets and property, plant and equipment 2024 | fsl-cf-capex | 12.205 |
| Proceeds from the disposal of intangible assets and property, plant and equipment 2024 | fsl-cf-investing-disposal-proceeds | 21116 |
| Investments in marketable securities and investment funds 2024 | fsl-cf-investing-securities | 1.062 |
| Cash inflow/outflow from investing activities 2024 | fsl-cf-investing | 11.369 |
| Treasury shares acquired 2024 | fsl-cf-share-buyback | 1.002 |
| Payment of dividends to shareholders of BMW AG 2024 | fsl-cf-dividends | 3.781 |
| Intragroup financing and equity transactions – 2024 | fsl-cf-investing-acquisitions | 2.001 |
| Interest paid * 2024 | fsl-cf-interest-paid | 196 |
| Proceeds from issue of non-current financial liabilities 2024 | fsl-cf-debt-drawdown | 30.025 |
| Cash inflow/outflow from financing activities 2024 | fsl-cf-financing | 5.766 |
| Effect of exchange rate on cash and cash equivalents – 3 2024 | fsl-cf-fx-on-cash | 705 |
| Change in cash and cash equivalents 2024 | fsl-cf-net-change-cash | 1.96 |

| Unmapped labels | Value |
| --- | ---: |
| Other interest and similar income/expenses * 2024 | 433 |
| Other non-cash income and expense items 2024 | 339179 |
| Change in leased products 2024 | 5.231 |
| Change in receivables from sales financing 2024 | 4.144 |
| Proceeds from subsidies for intangible assets and property, plant and equipment 2024 | 192 |
| Expenditure for investment assets 2024 | 162 |
| Proceeds from the disposal of marketable securities and investment funds 2024 | 1.834 |
| Payment of dividends to non-controlling interests 2024 | 1.013 |
| Repayment of non-current financial liabilities 2024 | 22.182 |
| Change in other financial liabilities 2024 | 3.937 |

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
- Mapped lines: 14
- Coverage: 58%
- Readiness: `recoverable` (34)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`, `VALIDATION_HARD_FAIL`
- Validation blockers: `BS_EQUATION_MISMATCH`, `BS_CURRENT_LIABILITIES_EXCEED_TOTAL`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Rzeczowe i niematerialne aktywa górnicze i hutnicze 2024 | fsl-bs-intangibles | 26880 |
| Pozostałe rzeczowe aktywa trwałe 2024 | fsl-bs-ppe | 3087 |
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
| Pozostałe aktywa rzeczowe i niematerialne 2024 | 3300 |
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
- Readiness: `recoverable` (78)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Przychody z umów z klientami 2024 | fsl-pl-revenue | 35320 |
| Koszty sprzedanych produktów, towarów i materiałów 2024 | fsl-pl-cogs-other | -29348 |
| Koszty sprzedaży i koszty ogólnego zarządu 2024 | fsl-pl-sga | -2205 |
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
- Extracted lines: 31
- Mapped lines: 16
- Coverage: 52%
- Readiness: `recoverable` (55)
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
| Wydatki z tytułu dywidend wypłaconych akcjonariuszom Jednostki Dominującej ( 2024 | fsl-cf-dividends | 300 |
| Przepływy pieniężne netto z działalności finansowej ( 2024 | fsl-cf-financing | 217 |
| Stan środków pieniężnych i ich ekwiwalentów na początek okresu 2024 | fsl-cf-opening-cash | 1729 |
| Stan środków pieniężnych i ich ekwiwalentów na koniec okresu, w tym: 2024 | fsl-cf-closing-cash | 715 |

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
- Extracted lines: 34
- Mapped lines: 26
- Coverage: 76%
- Readiness: `recoverable` (61)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Non-current assets Property, plant and equipment 12 2025 | fsl-bs-ppe | 98.633 |
| Goodwill 14 2025 | fsl-bs-intangibles-goodwill | 10.3 |
| Intangible assets 15 2025 | fsl-bs-intangibles | 8.197 |
| Investments in joint ventures 16 2025 | fsl-bs-equity-method-investments | 13.4 |
| Fixed assets 2025 | fsl-bs-fixed | 138.712 |
| Loans 2025 | fsl-bs-long-term-debt-bank | 1.991 |
| Trade and other receivables 20 2025 | fsl-bs-ar-trade | 2.376 |
| Deferred tax assets 9 2025 | fsl-bs-other-non-current-assets-deferred-tax | 4.325 |
| Defined benefit pension plan surpluses 24 2025 | fsl-bs-pension-surplus | 7.771 |
| Inventories 19 2025 | fsl-bs-inventory | 22.499 |
| Cash and cash equivalents 25 2025 | fsl-bs-cash | 36.556 |
| Assets classified as held for sale 2 2025 | fsl-bs-assets-held-for-sale | 6.347 |
| Total assets 2025 | fsl-bs-total-assets | 278.526 |
| Current liabilities Trade and other payables 22 2025 | fsl-bs-ap-trade | 56.843 |
| Accruals 2025 | fsl-bs-other-current-liabilities-accruals | 5.572 |
| Lease liabilities 28 2025 | fsl-bs-short-term-debt-lease | 2.832 |
| Finance debt 26 2025 | fsl-bs-long-term-debt | 3.356 |
| Current tax payable 2025 | fsl-bs-other-current-liabilities-tax | 1.262 |
| Provisions 23 2025 | fsl-bs-provisions | 4.709 |
| Non-current liabilities Other payables 22 2025 | fsl-bs-other-non-current-liabilities | 7.975 |
| Deferred tax liabilities 9 2025 | fsl-bs-other-non-current-liabilities-deferred-tax | 7.642 |
| Defined benefit pension plan and other post-employment benefit plan deficits 24 2025 | fsl-bs-pension-deficit | 4.816 |
| Total liabilities 2025 | fsl-bs-total-liabilities | 204.526 |
| Equity bp shareholders’ equity 32 2025 | fsl-bs-equity-parent | 53.052 |
| Non-controlling interests 32 2025 | fsl-bs-minority-interest | 20.948 |
| Total equity 32 2025 | fsl-bs-equity | 74 |

| Unmapped labels | Value |
| --- | ---: |
| bp Annual Report and Form 20-F 2025 | 157 |
| Investments in associates 17 2025 | 7.325 |
| Other investments 2025 | 18857 |
| Derivative financial instruments 30 2025 | 20.957 |
| Prepayments 2025 | 3.422 |
| Current tax receivable 2025 | 1.153 |
| Liabilities directly associated with assets classified as held for sale 2 2025 | 1.594 |
| Net assets 2025 | 74 |

### P&L

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 23
- Mapped lines: 16
- Coverage: 70%
- Readiness: `recoverable` (62)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Sales and other operating revenues 6 2025 | fsl-pl-revenue | 189.335 |
| Earnings from joint ventures – after interest and tax 2025 | fsl-pl-equity-method-income | 16 |
| Interest and other income 7 2025 | fsl-pl-other-income | 1.609 |
| Production and similar taxes 5 2025 | fsl-pl-other-fin | 1.698 |
| Depreciation, depletion and amortization 5 2025 | fsl-pl-depreciation | 17.822 |
| Net impairment and losses on sale of businesses and fixed assets 4 2025 | fsl-pl-other-opex-impairment | 6.037 |
| Distribution and administration expenses 2025 | fsl-pl-gna | 17.494 |
| Profit (loss) before interest and taxation 2025 | fsl-pl-ebit | 12.642 |
| Finance costs 7 2025 | fsl-pl-fin-expense | 5.106 |
| Net finance (income) expense relating to pensions and other post-employment benefits 2025 | fsl-pl-fin-income | 24 |
| Profit (loss) before taxation 2025 | fsl-pl-ebt | 7.746 |
| Taxation 9 2025 | fsl-pl-tax | 6.451 |
| Profit (loss) for the year 2025 | fsl-pl-net | 1.295 |
| Attributable to bp shareholders 2025 | fsl-pl-net-parent | 55381 |
| Non-controlling interests 2025 | fsl-pl-net-minority | 1.24 |
| Per ADS (dollars) Basic 11 2025 | fsl-pl-eps-basic | 11 |

| Unmapped labels | Value |
| --- | ---: |
| Earnings from associates – after interest and tax 2025 | 17918 |
| Gains on sale of businesses and fixed assets 2025 | 4987678 |
| Total revenues and other income 2025 | 192.549 |
| Purchases 19 2025 | 110.64 |
| Production and manufacturing expenses 2025 | 25.646 |
| Exploration expense 2025 | 8570974 |
| Diluted 11 2025 | 11 |

### CF

- Selected period: `2025`
- Comparison period: `2024`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 42
- Mapped lines: 29
- Coverage: 69%
- Readiness: `recoverable` (73)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Depreciation, depletion and amortization 5 2025 | fsl-cf-operating-depreciation | 17.822 |
| Impairment and (gain) loss on sale of businesses and fixed assets 4 2025 | fsl-cf-operating-gain-disposal | 5.05 |
| Earnings from joint ventures and associates 2025 | fsl-cf-operating-equity-method | -618 |
| Dividends received from joint ventures and associates 2025 | fsl-cf-dividends-received | 2.111 |
| Interest receivable 2025 | fsl-cf-operating-interest-income | -1.352 |
| Finance costs 7 2025 | fsl-cf-operating-interest-cost | 5.106 |
| Interest paid 2025 | fsl-cf-interest-paid | -3.538 |
| Share-based payments 2025 | fsl-cf-operating-sbc | 1.077 |
| Net charge for provisions, less payments 2025 | fsl-cf-change-wc-provisions | 1.294 |
| (Increase) decrease in inventories 2025 | fsl-cf-change-wc-inventory | 1.622 |
| (Increase) decrease in other current and non-current assets 2025 | fsl-cf-change-wc-other | -4.286 |
| Increase (decrease) in other current and non-current liabilities 2025 | fsl-cf-change-wc-ap | -2.156 |
| Income taxes paid 2025 | fsl-cf-taxes-paid | -6.589 |
| Net cash provided by operating activities 2025 | fsl-cf-operating | 24.493 |
| Acquisitions, net of cash acquired 2025 | fsl-cf-investing-acquisitions | 3 |
| Investment in joint ventures 2025 | fsl-cf-investing-jv | -267 |
| Total cash capital expenditure 2025 | fsl-cf-capex | -14.533 |
| Proceeds from disposals of fixed assets 4 2025 | fsl-cf-investing-disposal-proceeds | 1.142 |
| Proceeds from loan repayments 2025 | fsl-cf-debt-drawdown-bank | 173 |
| Net cash used in investing activities 2025 | fsl-cf-investing | -11.504 |
| Financing activities Repurchase of shares 2025 | fsl-cf-share-buyback | -4.486 |
| Lease liability payments 2025 | fsl-cf-debt-repayment-lease | -3.091 |
| Proceeds from long-term financing 2025 | fsl-cf-debt-drawdown | 2.724 |
| Repayments of long-term financing 2025 | fsl-cf-debt-repayment | -5.695 |
| Dividends paid bp shareholders 10 2025 | fsl-cf-dividends | -5.059 |
| Net cash provided by (used in) financing activities 2025 | fsl-cf-financing | -15.88 |
| Increase (decrease) in cash and cash equivalents 2025 | fsl-cf-net-change-cash | -2.645 |
| Cash and cash equivalents at beginning of year 2025 | fsl-cf-opening-cash | 39.269 |
| Cash and cash equivalents at end of yeara 2025 | fsl-cf-closing-cash | 36.624 |

| Unmapped labels | Value |
| --- | ---: |
| Operating activities Profit (loss) before taxation 2025 | 7.746 |
| Interest received 2025 | 1.223 |
| Net finance expense relating to pensions and other post-employment benefits 2025 | 24 |
| Investing activities Expenditure on property, plant and equipment, intangible and other assets 2025 | -13.221 |
| Investment in associates 2025 | -110 |
| Proceeds from disposals of businesses, net of cash disposed 4 2025 | 1.714 |
| Net increase (decrease) in short-term debt 2025 | -343 |
| Issue of perpetual hybrid bonds 2025 | 500 |
| Redemption of perpetual hybrid bonds 32 2025 | -1.2 |
| Payments relating to perpetual hybrid bonds 2025 | -1.196 |
| Payments relating to transactions involving non-controlling interests (other) 2025 | -2 |
| Receipts relating to transactions involving non-controlling interests (other) 2025 | 2.474 |
| Non-controlling interests 2025 | -506 |

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
- Mapped lines: 28
- Coverage: 88%
- Readiness: `recoverable` (68)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `BS_EQUATION_INCOMPLETE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| ASSETS Current Assets Cash and cash equivalents $ 2024 | fsl-bs-cash | 10.828 |
| Short-term investments 2024 | fsl-bs-st-investments | 2.02 |
| Trade accounts receivable, less allowances of $ 2024 | fsl-bs-ar-trade | 506 |
| Inventories 2024 | fsl-bs-inventory | 4.728 |
| Prepaid expenses and other current assets 2024 | fsl-bs-other-current-assets-prepaids | 3.129 |
| Total Current Assets 2024 | fsl-bs-current-assets | 25.997 |
| Equity method investments 2024 | fsl-bs-equity-method-investments | 18.087 |
| Deferred income tax assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 1.319 |
| Property, plant and equipment — net 2024 | fsl-bs-ppe | 10.303 |
| Trademarks with indefinite lives 2024 | fsl-bs-intangibles | 13.301 |
| Goodwill 2024 | fsl-bs-intangibles-goodwill | 18.139 |
| Other noncurrent assets 2024 | fsl-bs-other-non-current-assets | 13.403 |
| Total Assets $ 2024 | fsl-bs-total-assets | 100.549 |
| LIABILITIES AND EQUITY Current Liabilities Accounts payable and accrued expenses $ 2024 | fsl-bs-other-current-liabilities-accruals | 21.715 |
| Loans and notes payable 2024 | fsl-bs-short-term-debt | 1.499 |
| Accrued income taxes 2024 | fsl-bs-other-current-liabilities-tax | 1.387 |
| Total Current Liabilities 2024 | fsl-bs-current-liabilities | 25.249 |
| Long-term debt 2024 | fsl-bs-long-term-debt | 42.375 |
| Other noncurrent liabilities 2024 | fsl-bs-other-non-current-liabilities | 4.084 |
| Deferred income tax liabilities 2024 | fsl-bs-other-non-current-liabilities-deferred-tax | 2.469 |
| The Coca-Cola Company Shareowners’ Equity Common stock, $ 2024 | fsl-bs-share-capital | 0.25 |
| Capital surplus 2024 | fsl-bs-share-premium | 19.801 |
| Reinvested earnings 2024 | fsl-bs-retained-earnings | 76.054 |
| Accumulated other comprehensive income (loss) 2024 | fsl-bs-other-equity-reserves | -16.843 |
| Treasury stock, at cost 2024 | fsl-bs-treasury-shares | 2.738 |
| Equity attributable to noncontrolling interests 2024 | fsl-bs-equity-parent | 1.516 |
| Total Equity 2024 | fsl-bs-equity | 26.372 |
| Total Liabilities and Equity $ 2024 | fsl-bs-total-liabilities-equity | 100.549 |

| Unmapped labels | Value |
| --- | ---: |
| Total Cash, Cash Equivalents and Short-Term Investments 2024 | 12.848 |
| Marketable securities 2024 | 1.723 |
| Current maturities of long-term debt 2024 | 648 |
| Equity Attributable to Shareowners of The Coca-Cola Company 2024 | 24.856 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 14
- Mapped lines: 13
- Coverage: 93%
- Readiness: `recoverable` (95)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: none

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Net Operating Revenues $ 2024 | fsl-pl-revenue | 47.061 |
| Cost of goods sold 2024 | fsl-pl-cogs | 18.324 |
| Gross Profit 2024 | fsl-pl-gross | 28.737 |
| Selling, general and administrative expenses 2024 | fsl-pl-gna | 14.582 |
| Other operating charges 2024 | fsl-pl-other-opex | 4.163 |
| Operating Income 2024 | fsl-pl-ebit | 9.992 |
| Interest income 2024 | fsl-pl-fin-income | 988907 |
| Interest expense 2024 | fsl-pl-interest | 1.656 |
| Equity income (loss) — net 2024 | fsl-pl-equity-method-income | 1.77 |
| Other income (loss) — net 2024 | fsl-pl-other-income | 1.992 |
| Income Before Income Taxes 2024 | fsl-pl-ebt | 13.086 |
| Income taxes 2024 | fsl-pl-tax | 2.437 |
| Consolidated Net Income 2024 | fsl-pl-net | 10.649 |

| Unmapped labels | Value |
| --- | ---: |
| Net Income Attributable to Shareowners of The Coca-Cola Company $ 2024 | 10.631 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 29
- Mapped lines: 22
- Coverage: 76%
- Readiness: `recoverable` (72)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Operating Activities Consolidated net income $ 2024 | fsl-cf-operating-net-income | 10.649 |
| Stock-based compensation expense 2024 | fsl-cf-operating-sbc | 286254 |
| Deferred income taxes 2024 | fsl-cf-operating-other-adj | -11 |
| Equity (income) loss — net of dividends 2024 | fsl-cf-operating-equity-method | -802 |
| Significant (gains) losses — net 2024 | fsl-cf-operating-gain-disposal | -1.737 |
| Net change in operating assets and liabilities 2024 | fsl-cf-change-wc | -6.234 |
| Net Cash Provided by Operating Activities 2024 | fsl-cf-operating | 6.805 |
| Investing Activities Purchases of investments 2024 | fsl-cf-investing-securities | -5.64 |
| Acquisitions of businesses, equity method investments and nonmarketable securities 2024 | fsl-cf-investing-acquisitions | -315 |
| Proceeds from disposals of businesses, equity method investments and nonmarketable securities 2024 | fsl-cf-investing-disposal-proceeds | 3.485 |
| Purchases of property, plant and equipment 2024 | fsl-cf-capex | -2.064 |
| Other investing activities 2024 | fsl-cf-other-investing | 194 |
| Net Cash Provided by (Used in) Investing Activities 2024 | fsl-cf-investing | 2.524 |
| Financing Activities Issuances of loans, notes payable and long-term debt 2024 | fsl-cf-debt-drawdown | 12.061 |
| Payments of loans, notes payable and long-term debt 2024 | fsl-cf-debt-repayment | -9.533 |
| Issuances of stock 2024 | fsl-cf-share-issuance | 747539 |
| Purchases of stock for treasury 2024 | fsl-cf-share-buyback | -1.795 |
| Dividends 2024 | fsl-cf-dividends | -8.359 |
| Other financing activities 2024 | fsl-cf-other-financing | -31 |
| Net Cash Provided by (Used in) Financing Activities 2024 | fsl-cf-financing | -6.91 |
| Cash, cash equivalents, restricted cash and restricted cash equivalents at beginning of year 2024 | fsl-cf-opening-cash | 9.692 |
| Cash, Cash Equivalents, Restricted Cash and Restricted Cash Equivalents at End of Year 2024 | fsl-cf-closing-cash | 11.488 |

| Unmapped labels | Value |
| --- | ---: |
| Other operating charges 2024 | 4 |
| Other items 2024 | -311 |
| Proceeds from disposals of investments 2024 | 6.589 |
| Proceeds from disposals of property, plant and equipment 40 2024 | 74 |
| Collateral (paid) received associated with hedging activities — net 2024 | 235366 |
| Less: Restricted cash and restricted cash equivalents at end of year 2024 | 660326 |
| Cash and Cash Equivalents at End of Year $ 2024 | 10.828 |

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
- Extracted lines: 30
- Mapped lines: 25
- Coverage: 83%
- Readiness: `recoverable` (51)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`, `VALIDATION_HARD_FAIL`
- Validation blockers: `BS_EQUATION_MISMATCH`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Assets Current assets Cash and cash equivalents $ 2024 | fsl-bs-cash | 16.139 |
| Short-term investments 2024 | fsl-bs-st-investments | 20.424 |
| Accounts receivable, net 2024 | fsl-bs-ar | 4.418 |
| Inventory 2024 | fsl-bs-inventory | 12.017 |
| Prepaid expenses and other current assets 2024 | fsl-bs-other-current-assets-prepaids | 5.362 |
| Total current assets 2024 | fsl-bs-current-assets | 58.36 |
| Operating lease vehicles, net 2024 | fsl-bs-ppe-vehicles | 5.581 |
| Property, plant and equipment, net 2024 | fsl-bs-ppe | 35.836 |
| Operating lease right-of-use assets 2024 | fsl-bs-rou-assets | 5.16 |
| Deferred tax assets 2024 | fsl-bs-other-non-current-assets-deferred-tax | 6.524 |
| Other non-current assets 2024 | fsl-bs-other-non-current-assets | 4.215 |
| Total assets $ 2024 | fsl-bs-total-assets | 122.07 |
| Accrued liabilities and other 2024 | fsl-bs-other-current-liabilities-accruals | 10.723 |
| Deferred revenue 2024 | fsl-bs-deferred-revenue-current | 3.168 |
| Current portion of debt and finance leases 2024 | fsl-bs-short-term-debt | 2.456 |
| Total current liabilities 2024 | fsl-bs-current-liabilities | 28.821 |
| Debt and finance leases, net of current portion 2024 | fsl-bs-long-term-debt | 5.757 |
| Deferred revenue, net of current portion 2024 | fsl-bs-deferred-revenue-non-current | 3.317 |
| Other long-term liabilities 2024 | fsl-bs-other-current-liabilities | 10.495 |
| Total liabilities 2024 | fsl-bs-total-liabilities | 48.39 |
| Equity Stockholders’ equity Preferred stock; $ 2024 | fsl-bs-equity | 0.001 |
| Common stock; $ 2024 | fsl-bs-share-capital | 0.001 |
| Additional paid-in capital 2024 | fsl-bs-share-premium | 38.371 |
| Retained earnings 2024 | fsl-bs-retained-earnings | 35.209 |
| Total liabilities and equity $ 2024 | fsl-bs-total-liabilities-equity | 122.07 |

| Unmapped labels | Value |
| --- | ---: |
| Solar energy systems, net 2024 | 4.924 |
| Digital assets, net 2024 | 1.076 |
| Liabilities Current liabilities Accounts payable $ 2024 | 12.474 |
| December 2024 | 31 |
| Total stockholders’ equity 2024 | 72.913 |

### P&L

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 29
- Mapped lines: 21
- Coverage: 72%
- Readiness: `recoverable` (76)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation blockers: `PL_GROSS_MISMATCH`, `LOW_MAPPING_COVERAGE`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Revenues Automotive sales $ 2024 | fsl-pl-revenue-product | 72.48 |
| Automotive regulatory credits 2024 | fsl-pl-revenue-other | 2.763 |
| Automotive leasing 2024 | fsl-pl-revenue-service | 1.827 |
| Total revenues 2024 | fsl-pl-revenue | 97.69 |
| Total automotive cost of revenues 2024 | fsl-pl-cogs | 62.873 |
| Gross profit 2024 | fsl-pl-gross | 17.45 |
| Operating expenses Research and development 2024 | fsl-pl-rnd | 4.54 |
| Selling, general and administrative 2024 | fsl-pl-sga | 5.15 |
| Restructuring and other 2024 | fsl-pl-other-opex | 684 |
| Total operating expenses 2024 | fsl-pl-opex | 10.374 |
| Income from operations 2024 | fsl-pl-ebit | 7.076 |
| Interest income 2024 | fsl-pl-fin-income | 1.569 |
| Interest expense 2024 | fsl-pl-interest | -350 |
| Other income (expense), net 2024 | fsl-pl-other-income | 695172 |
| Income before income taxes 2024 | fsl-pl-ebt | 8.99 |
| Provision for (benefit from) income taxes 2024 | fsl-pl-tax | 1.837 |
| Net income 2024 | fsl-pl-net | 7.153 |
| Diluted 2024 | fsl-pl-eps-diluted | 3.498 |
| Comprehensive income 2024 | fsl-pl-comprehensive-income | 6.626 |
| Less: Comprehensive income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | fsl-pl-net-minority | 62 |
| Comprehensive income attributable to common stockholders $ 2024 | fsl-pl-net-parent | 6.564 |

| Unmapped labels | Value |
| --- | ---: |
| Total automotive revenues 2024 | 77.07 |
| Energy generation and storage 2024 | 10.086 |
| Services and other 2024 | 10.534 |
| Cost of revenues Automotive sales 2024 | 61.87 |
| Total cost of revenues 2024 | 80.24 |
| Net income (loss) attributable to noncontrolling interests and redeemable noncontrolling interests in subsidiaries 2024 | 62 |
| Net income attributable to common stockholders $ 2024 | 7.091 |
| Net income $ 2024 | 7.153 |

### CF

- Selected period: `2024`
- Comparison period: `2023`
- Selection strategy: `detected_period_fallback`
- Extracted lines: 31
- Mapped lines: 21
- Coverage: 68%
- Readiness: `recoverable` (66)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation blockers: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`

| Mapped labels | Canonical ID | Value |
| --- | --- | ---: |
| Stock-based compensation 2024 | fsl-cf-operating-sbc | 1.999 |
| Foreign currency transaction net unrealized (gain) loss 2024 | fsl-cf-operating-net-income | -73 |
| Deferred income taxes 2024 | fsl-cf-operating-other-adj | 477 |
| Digital assets (gain) loss, net 2024 | fsl-cf-operating-gain-disposal | -589 |
| Changes in operating assets and liabilities: Accounts receivable 2024 | fsl-cf-change-wc | -1.083 |
| Inventory 2024 | fsl-cf-change-wc-inventory | 937 |
| Prepaid expenses and other assets 2024 | fsl-cf-change-wc-other | -3.273 |
| Accounts payable, accrued and other liabilities 2024 | fsl-cf-change-wc-ap | 3.588 |
| Net cash provided by operating activities 2024 | fsl-cf-operating | 14.923 |
| Purchases of solar energy systems, net of sales 2024 | fsl-cf-capex | -3 |
| Purchases of investments 2024 | fsl-cf-investing-securities | -35.955 |
| Net cash used in investing activities 2024 | fsl-cf-investing | -18.787 |
| Cash Flows from Financing Activities Proceeds from issuances of debt 2024 | fsl-cf-financing | 5.744 |
| Repayments of debt 2024 | fsl-cf-debt-repayment | -2.5 |
| Proceeds from exercises of stock options and other stock issuances 2024 | fsl-cf-share-issuance | 1.241 |
| Principal payments on finance leases 2024 | fsl-cf-lease-repayment | -381 |
| Distributions paid to noncontrolling interests in subsidiaries 2024 | fsl-cf-investing-subsidiaries | -104 |
| Effect of exchange rate changes on cash and cash equivalents and restricted cash 2024 | fsl-cf-fx-on-cash | -141 |
| Cash and cash equivalents and restricted cash, beginning of period 2024 | fsl-cf-opening-cash | 17.189 |
| Supplemental Disclosures Cash paid during the period for interest $ 2024 | fsl-cf-interest-paid | 277 |
| Cash paid during the period for income taxes, net of refunds $ 2024 | fsl-cf-taxes-paid | 1.331 |

| Unmapped labels | Value |
| --- | ---: |
| Cash Flows from Operating Activities Net income $ 2024 | 7.153 |
| Inventory and purchase commitments write-downs 2024 | 335463 |
| Non-cash interest and other operating activities 2024 | 172 |
| Operating lease vehicles 2024 | -590 |
| Deferred revenue 2024 | 502 |
| Proceeds from maturities of investments 2024 | 28.31 |
| Debt issuance costs 2024 | -14 |
| Payments for buy-outs of noncontrolling interests in subsidiaries 2024 | -133 |
| Net cash provided by (used in) financing activities 2024 | 3.853 |
| Cash and cash equivalents and restricted cash, end of period $ 2024 | 17.037 |
