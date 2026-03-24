# Ratio Coverage Matrix — Canonical Lines vs Ratio Requirements

> **Last updated**: 2026-03-15
> **Registry version**: `finance-v2-l3`
> **Ratio catalog**: 34 single-period ratios + 8 growth ratios = **42 total**

---

## 1. Podsumowanie zmian

| Metryka | Przed | Po |
|---------|-------|-----|
| Wskaźniki single-period | 16 | **34** (+112%) |
| Wskaźniki dynamiki | 4 | **8** (+100%) |
| **Razem** | **20** | **42** |
| Linie computed (P&L) | 3 | **6** (+NOPAT, EBT Margin, Effective Tax Rate) |
| Linie computed (BS) | 2 | **6** (+Total Debt, Net Debt, Invested Capital, Capital Employed) |
| Linie computed (CF) | 1 | **1** (FCF — dodano formułę) |
| Cross-statement resolver | brak | **tak** (D&A z CF → P&L fallback) |

---

## 2. Pełna matryca: Wskaźnik → Wymagane linie kanoniczne

### Płynność (4)

| Wskaźnik | Linie | BS | P&L | CF | Status |
|----------|-------|:---:|:---:|:---:|--------|
| Current Ratio | CURRENT_ASSETS, CURRENT_LIABILITIES | ✅✅ | — | — | ✅ |
| Quick Ratio | CURRENT_ASSETS, INVENTORY, CURRENT_LIABILITIES | ✅✅✅ | — | — | ✅ |
| Cash Ratio | CASH, CURRENT_LIABILITIES | ✅✅ | — | — | ✅ |
| WC / Revenue | CURRENT_ASSETS, CURRENT_LIABILITIES, REVENUE | ✅✅ | ✅ | — | ✅ NEW |

### Rentowność (10)

| Wskaźnik | Linie | BS | P&L | CF | Status |
|----------|-------|:---:|:---:|:---:|--------|
| Gross Margin | GROSS_PROFIT, REVENUE | — | ✅✅ | — | ✅ |
| Operating Margin | EBIT, REVENUE | — | ✅✅ | — | ✅ |
| EBT Margin | EBT, REVENUE | — | ✅✅ | — | ✅ NEW |
| EBITDA Margin | EBITDA*, REVENUE | — | ✅✅ | (✅)¹ | ✅ |
| Net Margin | NET_INCOME, REVENUE | — | ✅✅ | — | ✅ |
| ROA | NET_INCOME, TOTAL_ASSETS | ✅ | ✅ | — | ✅ |
| ROE | NET_INCOME, TOTAL_EQUITY | ✅ | ✅ | — | ✅ |
| ROCE | EBIT, TOTAL_ASSETS, CURRENT_LIABILITIES | ✅✅ | ✅ | — | ✅ NEW |
| ROIC | EBIT, TAX, EBT, EQUITY, LTD, STD, CASH | ✅✅✅✅ | ✅✅✅ | — | ✅ NEW |
| Effective Tax Rate | TAX_EXPENSE, EBT | — | ✅✅ | — | ✅ NEW |

¹ *EBITDA computed: EBIT + D&A, D&A fallback z CF*

### Zadłużenie (8)

| Wskaźnik | Linie | BS | P&L | CF | Status |
|----------|-------|:---:|:---:|:---:|--------|
| Debt-to-Equity | TOTAL_LIABILITIES, TOTAL_EQUITY | ✅✅ | — | — | ✅ |
| Debt Ratio | TOTAL_LIABILITIES, TOTAL_ASSETS | ✅✅ | — | — | ✅ |
| Equity Ratio | TOTAL_EQUITY, TOTAL_ASSETS | ✅✅ | — | — | ✅ NEW |
| Financial Leverage | TOTAL_ASSETS, TOTAL_EQUITY | ✅✅ | — | — | ✅ NEW |
| Net Debt / EBITDA | LTD, STD, CASH, EBITDA* | ✅✅✅ | ✅ | (✅) | ✅ NEW |
| Interest Coverage | EBIT, INTEREST_EXPENSE | — | ✅✅ | — | ✅ |
| Debt Service Coverage | OPERATING_CF, INTEREST_PAID, DEBT_REPAYMENT | — | — | ✅✅✅ | ✅ NEW |
| OCF / Total Debt | OPERATING_CF, LTD, STD | ✅✅ | — | ✅ | ✅ NEW |

### Efektywność (8)

| Wskaźnik | Linie | BS | P&L | CF | Status |
|----------|-------|:---:|:---:|:---:|--------|
| Asset Turnover | REVENUE, TOTAL_ASSETS | ✅ | ✅ | — | ✅ NEW |
| Fixed Asset Turnover | REVENUE, FIXED_ASSETS | ✅ | ✅ | — | ✅ NEW |
| WC Turnover | REVENUE, CA, CL | ✅✅ | ✅ | — | ✅ NEW |
| Inventory Turnover | COGS, INVENTORY | ✅ | ✅ | — | ✅ |
| DIO | INVENTORY, COGS | ✅ | ✅ | — | ✅ NEW |
| DSO | AR, REVENUE | ✅ | ✅ | — | ✅ |
| DPO | AP, COGS | ✅ | ✅ | — | ✅ |
| CCC | AR, REVENUE, INVENTORY, COGS, AP | ✅✅✅ | ✅✅ | — | ✅ |

### Cash Flow (4)

| Wskaźnik | Linie | BS | P&L | CF | Status |
|----------|-------|:---:|:---:|:---:|--------|
| OCF / Net Income | OPERATING_CF, NET_INCOME | — | ✅ | ✅ | ✅ NEW |
| FCF / Revenue | OPERATING_CF, CAPEX, REVENUE | — | ✅ | ✅✅ | ✅ NEW |
| Capex / Revenue | CAPEX, REVENUE | — | ✅ | ✅ | ✅ NEW |
| Capex / D&A | CAPEX, DEPRECIATION | — | ✅ | ✅ | ✅ NEW |

### Dynamiki (8)

| Wskaźnik | Wymaga | Status |
|----------|--------|--------|
| Revenue Growth | REVENUE (2 okresy) | ✅ |
| Gross Profit Growth | GROSS_PROFIT (2 okresy) | ✅ NEW |
| EBIT Growth | EBIT (2 okresy) | ✅ NEW |
| EBITDA Growth | EBITDA* (2 okresy) | ✅ |
| Net Income Growth | NET_INCOME (2 okresy) | ✅ |
| Asset Growth | TOTAL_ASSETS (2 okresy) | ✅ |
| Equity Growth | TOTAL_EQUITY (2 okresy) | ✅ NEW |
| Operating CF Growth | OPERATING_CF (2 okresy) | ✅ NEW |

---

## 3. Computed Lines (auto-derived)

System automatycznie oblicza te linie gdy brakuje wartości bezpośrednich:

| Linia computed | Formuła | Fallback |
|----------------|---------|----------|
| **EBITDA** | EBIT + \|D&A\| | D&A z CF jeśli brak w P&L |
| **NET_INCOME** | — | Fallback z NET_INCOME_CONTINUING |
| **TOTAL_DEBT** | LONG_TERM_DEBT + SHORT_TERM_DEBT | — |
| **NET_DEBT** | TOTAL_DEBT − CASH | — |
| **INVESTED_CAPITAL** | TOTAL_EQUITY + NET_DEBT | — |
| **CAPITAL_EMPLOYED** | TOTAL_ASSETS − CURRENT_LIABILITIES | — |
| **FREE_CASH_FLOW** | OPERATING_CF + CAPEX | CAPEX jest ujemny |
| **NOPAT** | EBIT × (1 − effective tax rate) | ETR = 19% jeśli brak danych |

---

## 4. Minimalne wymagania na sprawozdanie

Aby system mógł obliczyć **100% wskaźników**, sprawozdanie musi zawierać:

### P&L (minimum 8 linii)
- `REVENUE`, `COGS`, `GROSS_PROFIT`, `EBIT`, `INTEREST_EXPENSE`, `EBT`, `TAX_EXPENSE`, `NET_INCOME`

### BS (minimum 10 linii)
- `CURRENT_ASSETS`, `CASH`, `AR`, `INVENTORY`, `FIXED_ASSETS`, `TOTAL_ASSETS`
- `CURRENT_LIABILITIES`, `AP`, `TOTAL_LIABILITIES`, `TOTAL_EQUITY`
- Plus `SHORT_TERM_DEBT`, `LONG_TERM_DEBT` (dla zadłużenia)

### CF (minimum 4 linie)
- `OPERATING_CF`, `CAPEX`, `INTEREST_PAID`, `DEBT_REPAYMENT`
- Plus `DEPRECIATION_ADDBACK` (dla EBITDA gdy brak D&A w P&L)

**Łącznie**: ~24 linie wystarczą do pełnej analizy wskaźnikowej.

---

## 5. Pokrycie analityczne vs benchmark narzędzi

| Obszar analizy | Power BI | Airtable | **Consultify** |
|----------------|----------|----------|----------------|
| Płynność | ✅ | ✅ | ✅ (4 wskaźniki) |
| Rentowność | ✅ | ✅ | ✅ (10 wskaźników) |
| Zadłużenie | ✅ | ⚠️ | ✅ (8 wskaźników) |
| Efektywność | ✅ | ⚠️ | ✅ (8 wskaźników + CCC) |
| Cash Flow | ⚠️ manual | ❌ | ✅ (4 wskaźniki) |
| Dynamiki YoY | ✅ | ✅ | ✅ (8 metryk) |
| DuPont decomp. | ❌ | ❌ | ✅ (3 składniki) |
| Cross-statement | ❌ manual | ❌ | ✅ (auto D&A fallback) |
| Computed lines | ❌ manual | ❌ | ✅ (8 auto-derived) |
| **Łącznie wskaźników** | ~15–20 | ~10 | **42** |
