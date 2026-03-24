# Finance Direct Import Report

- Organization: `dbr77`
- Statements imported: 15
- Ready: 0
- Recoverable: 15
- Rejected: 0

| Document | Type | Eligible | Mapped | Coverage | Readiness | Persisted status |
| --- | --- | ---: | ---: | ---: | --- | --- |
| BMW Group Financial Statements 2024 | BS | 33 | 25 | 76% | recoverable | mapped |
| BMW Group Financial Statements 2024 | P&L | 40 | 18 | 45% | recoverable | mapped |
| BMW Group Financial Statements 2024 | CF | 36 | 21 | 58% | recoverable | mapped |
| KGHM SRR 2024 | BS | 24 | 14 | 58% | recoverable | mapped |
| KGHM SRR 2024 | P&L | 15 | 14 | 93% | recoverable | mapped |
| KGHM SRR 2024 | CF | 31 | 17 | 55% | recoverable | mapped |
| bp Annual Report 2025 | BS | 34 | 20 | 59% | recoverable | mapped |
| bp Annual Report 2025 | P&L | 50 | 19 | 38% | recoverable | mapped |
| bp Annual Report 2025 | CF | 42 | 21 | 50% | recoverable | mapped |
| Coca-Cola 10-K 2025 | BS | 32 | 25 | 78% | recoverable | mapped |
| Coca-Cola 10-K 2025 | P&L | 22 | 17 | 77% | recoverable | mapped |
| Coca-Cola 10-K 2025 | CF | 29 | 13 | 45% | recoverable | mapped |
| Tesla 10-K 2024 | BS | 30 | 20 | 67% | recoverable | mapped |
| Tesla 10-K 2024 | P&L | 39 | 17 | 44% | recoverable | mapped |
| Tesla 10-K 2024 | CF | 31 | 15 | 48% | recoverable | mapped |

## BMW Group Financial Statements 2024 / BS

- File: `knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf`
- Statement ID: `f93d8ea8-2025-41a8-b240-5577109c0c42`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 34
- Eligible lines: 33
- Mapped lines: 25
- Coverage: 76%
- Validation status: `warnings`
- Readiness: `recoverable` (60)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `BS_EQUATION_INCOMPLETE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Leased products 23 2024`, `Other investments 2024`, `Other assets 28 2024`, `Financial assets 26 2024`, `Other provisions 34 2024`, `Financial liabilities 36 2024`, `Current tax 35 2024`, `Current provisions and liabilities 2024`
- Persisted status: `mapped`

## BMW Group Financial Statements 2024 / P&L

- File: `knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf`
- Statement ID: `c1940630-f38f-4da2-9fe2-469f1667d2e4`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 44
- Eligible lines: 40
- Mapped lines: 18
- Coverage: 45%
- Validation status: `warnings`
- Readiness: `recoverable` (51)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Sales of products previously leased to customers 2024`, `Interest income on credit financing and finance leases 2024`, `Revenues from service contracts, telematics and roadside assistance 2024`, `Manufacturing costs 2024`, `Cost of sales relating to financial services business 2024`, `Research and development expenses 2024`, `Expenses for service contracts, telematics and roadside assistance 2024`, `Warranty expenditure 2024`, `Other cost of sales 2024`, `Research and development expenditure 2024`
- Persisted status: `mapped`

## BMW Group Financial Statements 2024 / CF

- File: `knowledge/Finanse/Samples/BMW-Group-Financial-Statements-2024-en.pdf`
- Statement ID: `1dee99e5-6ec5-4d5d-82d5-a6bb9a83c327`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 36
- Eligible lines: 36
- Mapped lines: 21
- Coverage: 58%
- Validation status: `warnings`
- Readiness: `recoverable` (66)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation codes: `LOW_MAPPING_COVERAGE`
- Top unmapped labels: `Interest received * 2024`, `Result from equity accounted investments 2024`, `Change in leased products 2024`, `Change in receivables from sales financing 2024`, `Change in other operating assets and liabilities 2024`, `Total investment in intangible assets and property, plant and equipment 2024`, `Proceeds from subsidies for intangible assets and property, plant and equipment 2024`, `Expenditure for investment assets 2024`, `Payment of dividends to shareholders of BMW AG 2024`, `Payment of dividends to non-controlling interests 2024`
- Persisted status: `mapped`

## KGHM SRR 2024 / BS

- File: `knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf`
- Statement ID: `6752943d-9aae-4d66-98ce-4d91eab03c31`
- Parse method: `text_extraction`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Detected statement type: `CF`
- Contained statement types: `CF`, `BS`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 24
- Eligible lines: 24
- Mapped lines: 14
- Coverage: 58%
- Validation status: `needs_review`
- Readiness: `recoverable` (34)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`, `VALIDATION_HARD_FAIL`
- Validation codes: `BS_EQUATION_MISMATCH`, `BS_CURRENT_LIABILITIES_EXCEED_TOTAL`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `AKTYWA Rzeczowe aktywa trwałe górnicze i hutnicze 2024`, `Aktywa niematerialne górnicze i hutnicze 2024`, `Pozostałe aktywa rzeczowe i niematerialne 2024`, `Zaangażowanie we wspólne przedsięwzięcia - udzielone pożyczki 2024`, `Instrumenty finansowe razem 2024`, `ZOBOWIĄZANIA I KAPITAŁ WŁASNY Nota 2024`, `Kapitał własny udziałowców niekontrolujących 2024`, `Zobowiązania wobec dostawców i pozostałe 2024`, `Zobowiązanie długo i krótkoterminowe 2024`, `RAZEM ZOBOWIĄZANIA I KAPITAŁ WŁASNY 2024`
- Persisted status: `mapped`

## KGHM SRR 2024 / P&L

- File: `knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf`
- Statement ID: `26a19bae-0bde-44dd-98c9-3a44a8ff0755`
- Parse method: `text_extraction`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Detected statement type: `CF`
- Contained statement types: `CF`, `BS`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 15
- Eligible lines: 15
- Mapped lines: 14
- Coverage: 93%
- Validation status: `warnings`
- Readiness: `recoverable` (84)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `PL_GROSS_MISMATCH`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Łączne całkowite dochody przypadające: akcjonariuszom Jednostki Dominującej 2024`
- Persisted status: `mapped`

## KGHM SRR 2024 / CF

- File: `knowledge/Finanse/Samples/Skonsolidowane sprawozdanie finansowe KGHM SRR_2024.pdf`
- Statement ID: `129cc562-15cd-4345-b74a-ce313947de9a`
- Parse method: `text_extraction`
- Document class: `mixed_report`
- Extraction strategy: `pdf_layout_mixed`
- Detected statement type: `CF`
- Contained statement types: `CF`, `BS`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 32
- Eligible lines: 31
- Mapped lines: 17
- Coverage: 55%
- Validation status: `warnings`
- Readiness: `recoverable` (57)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Przepływy pieniężne z działalności operacyjnej Zysk/(strata) przed opodatkowaniem 2024`, `Odsetki od pożyczek udzielonych wspólnemu przedsięwzięciu ( 2024`, `Pozostałe odsetki 2024`, `i wartości niematerialnych 2024`, `wspólnemu przedsięwzięciu ( 2024`, `z działalności inwestycyjnej i wyceny środków pieniężnych ( 2024`, `z działalności finansowej 2024`, `Razem wyłączenia przychodów i kosztów 2024`, `Przepływy pieniężne z działalności inwestycyjnej Nota 2024`, `Wydatki na aktywa finansowe przeznaczone na likwidację kopalń i innych obiektów technologicznych ( 2024`
- Persisted status: `mapped`

## bp Annual Report 2025 / BS

- File: `knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf`
- Statement ID: `36c6af92-10d8-4d08-9249-cc1518184e78`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2025`
- Comparison period: `2024`
- Extracted lines: 34
- Eligible lines: 34
- Mapped lines: 20
- Coverage: 59%
- Validation status: `warnings`
- Readiness: `recoverable` (42)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `BS_EQUATION_OK`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `bp Annual Report and Form 20-F 2025`, `Investments in joint ventures 16 2025`, `Investments in associates 17 2025`, `Other investments 2025`, `Derivative financial instruments 30 2025`, `Defined benefit pension plan surpluses 24 2025`, `Prepayments 2025`, `Current tax receivable 2025`, `Finance debt 26 2025`, `Current tax payable 2025`
- Persisted status: `mapped`

## bp Annual Report 2025 / P&L

- File: `knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf`
- Statement ID: `2707dad7-f0fc-4a12-be8b-964bceac3f33`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2025`
- Comparison period: `2023`
- Extracted lines: 55
- Eligible lines: 50
- Mapped lines: 19
- Coverage: 38%
- Validation status: `warnings`
- Readiness: `recoverable` (40)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `PL_NET_INCOME_OUTLIER`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Other income statement items Depreciation, depletion and amortization US 2025`, `Non-US 2025`, `Additions to non-current assetsa c 2025`, `group Segment revenues Sales and other operating revenues 2025`, `Less: sales and other operating revenues between segments 2025`, `Third party sales and other operating revenues 2025`, `Segment results Replacement cost profit (loss) before interest and taxation 2025`, `Profit (loss) before interest and taxation 2025`, `Other income statement items Production and similar taxes 2025`, `Non-current assets Non-current assetsb c 2025`
- Persisted status: `mapped`

## bp Annual Report 2025 / CF

- File: `knowledge/Finanse/Samples/bp-annual-report-and-form-20f-2025.pdf`
- Statement ID: `2a404154-071e-443e-9a57-939c2fa6b456`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2025`
- Comparison period: `2024`
- Extracted lines: 44
- Eligible lines: 42
- Mapped lines: 21
- Coverage: 50%
- Validation status: `warnings`
- Readiness: `recoverable` (60)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation codes: `LOW_MAPPING_COVERAGE`
- Top unmapped labels: `Earnings from joint ventures and associates 2025`, `Interest receivable 2025`, `Interest received 2025`, `Finance costs 7 2025`, `Net finance expense relating to pensions and other post-employment benefits 2025`, `Share-based payments 2025`, `Net charge for provisions, less payments 2025`, `(Increase) decrease in inventories 2025`, `(Increase) decrease in other current and non-current assets 2025`, `Increase (decrease) in other current and non-current liabilities 2025`
- Persisted status: `mapped`

## Coca-Cola 10-K 2025 / BS

- File: `knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf`
- Statement ID: `2b7aa129-63ab-46d8-abba-58f4dbf38df8`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 33
- Eligible lines: 32
- Mapped lines: 25
- Coverage: 78%
- Validation status: `warnings`
- Readiness: `recoverable` (62)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `BS_EQUATION_INCOMPLETE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Total Cash, Cash Equivalents and Short-Term Investments 2024`, `Marketable securities 2024`, `Prepaid expenses and other current assets 2024`, `Trademarks with indefinite lives 2024`, `Accrued income taxes 2024`, `Other noncurrent liabilities 2024`, `Equity Attributable to Shareowners of The Coca-Cola Company 2024`
- Persisted status: `mapped`

## Coca-Cola 10-K 2025 / P&L

- File: `knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf`
- Statement ID: `9b675d6b-df74-4a54-a99b-3c3dc0aad01d`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 24
- Eligible lines: 22
- Mapped lines: 17
- Coverage: 77%
- Validation status: `pass`
- Readiness: `recoverable` (84)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`
- Validation codes: none
- Top unmapped labels: `Equity income (loss) — net 2024`, `Net Income Attributable to Shareowners of The Coca-Cola Company $ 2024`, `Average Shares Outstanding — Diluted 2024`, `Consolidated Net Income $ 2024`, `Total Comprehensive Income Attributable to Shareowners of The Coca-Cola Company $ 2024`
- Persisted status: `mapped`

## Coca-Cola 10-K 2025 / CF

- File: `knowledge/Finanse/Samples/nyse-ko-2025-10K-25644916.pdf`
- Statement ID: `40d8bc59-76b7-450f-aea0-fce00c1cc47f`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 33
- Eligible lines: 29
- Mapped lines: 13
- Coverage: 45%
- Validation status: `warnings`
- Readiness: `recoverable` (50)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Equity (income) loss — net of dividends 2024`, `Significant (gains) losses — net 2024`, `Other operating charges 2024`, `Other items 2024`, `Net change in operating assets and liabilities 2024`, `Investing Activities Purchases of investments 2024`, `Acquisitions of businesses, equity method investments and nonmarketable securities 2024`, `Proceeds from disposals of businesses, equity method investments and nonmarketable securities 2024`, `Proceeds from disposals of property, plant and equipment 40 2024`, `Collateral (paid) received associated with hedging activities — net 2024`
- Persisted status: `mapped`

## Tesla 10-K 2024 / BS

- File: `knowledge/Finanse/Samples/tsla-20241231-gen.pdf`
- Statement ID: `27880105-89b7-4568-9e6f-15e4e7fdd2ed`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 30
- Eligible lines: 30
- Mapped lines: 20
- Coverage: 67%
- Validation status: `warnings`
- Readiness: `recoverable` (60)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `BS_EQUATION_OK`, `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Prepaid expenses and other current assets 2024`, `Solar energy systems, net 2024`, `Digital assets, net 2024`, `Liabilities Current liabilities Accounts payable $ 2024`, `Deferred revenue 2024`, `Current portion of debt and finance leases 2024`, `Debt and finance leases, net of current portion 2024`, `Deferred revenue, net of current portion 2024`, `Equity Stockholders’ equity Preferred stock; $ 2024`, `December 2024`
- Persisted status: `mapped`

## Tesla 10-K 2024 / P&L

- File: `knowledge/Finanse/Samples/tsla-20241231-gen.pdf`
- Statement ID: `e9fea90f-3ce3-40ce-a795-e446fad7f3b5`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 39
- Eligible lines: 39
- Mapped lines: 17
- Coverage: 44%
- Validation status: `warnings`
- Readiness: `recoverable` (50)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Revenues Automotive sales $ 2024`, `Automotive regulatory credits 2024`, `Automotive leasing 2024`, `Total automotive revenues 2024`, `Services and other 2024`, `Cost of revenues Automotive sales 2024`, `Total automotive cost of revenues 2024`, `Total cost of revenues 2024`, `Restructuring and other 2024`, `Total operating expenses 2024`
- Persisted status: `mapped`

## Tesla 10-K 2024 / CF

- File: `knowledge/Finanse/Samples/tsla-20241231-gen.pdf`
- Statement ID: `11cf526d-df0d-4e8b-9d36-ebf9bd2b5858`
- Parse method: `text_extraction`
- Document class: `native_pdf`
- Extraction strategy: `pdf_layout_primary`
- Detected statement type: `BS`
- Contained statement types: `BS`, `CF`, `P&L`
- Selected period: `2024`
- Comparison period: `2023`
- Extracted lines: 34
- Eligible lines: 31
- Mapped lines: 15
- Coverage: 48%
- Validation status: `warnings`
- Readiness: `recoverable` (53)
- Reason codes: `UNMAPPED_FINANCIAL_LINES`, `MISSING_REQUIRED_CANONICAL_LINES`
- Validation codes: `LOW_MAPPING_COVERAGE`, `REQUIRED_LINES_MISSING`
- Top unmapped labels: `Cash Flows from Operating Activities Net income $ 2024`, `Inventory and purchase commitments write-downs 2024`, `Foreign currency transaction net unrealized (gain) loss 2024`, `Deferred income taxes 2024`, `Non-cash interest and other operating activities 2024`, `Changes in operating assets and liabilities: Accounts receivable 2024`, `Operating lease vehicles 2024`, `Prepaid expenses and other assets 2024`, `Accounts payable, accrued and other liabilities 2024`, `Deferred revenue 2024`
- Persisted status: `mapped`
