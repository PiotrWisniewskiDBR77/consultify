# Professional Financial Analysis Readiness Assessment

> **Standard**: Investment Banking / Harvard MBA Corporate Finance
> **Date**: 2026-03-15
> **System**: Consultify Finance Module v3

---

## Executive Summary

System został przeanalizowany pod kątem zdolności do przeprowadzenia pełnej profesjonalnej
analizy finansowej na poziomie:

1. **Analityka bankowa (credit analysis, debt advisory)**
2. **Equity research / investment banking**
3. **Wycena przedsiębiorstw (DCF, multiples)**
4. **Budżetowanie i planowanie finansowe**
5. **MBA-level case study analysis**

### Verdict: ✅ READY (z jednym zastrzeżeniem)

| Obszar | Status | Pokrycie |
|--------|--------|----------|
| 3-Statement Model | ✅ | P&L + BS + CF w pełni powiązane |
| Ratio Analysis | ✅ | 42 wskaźniki (34 single + 8 growth) |
| Composite Scores | ✅ | DuPont 5F, Altman Z, Piotroski F |
| Valuation Inputs | ✅ | UFCF, EV Bridge, WACC Inputs |
| Budgeting Drivers | ✅ | SGR, Retention, Operating Leverage |
| Market Data | ⚠️ | Wymaga zewnętrznego inputu (Market Cap, Beta) |

---

## 1. Analiza 3-Statement Model

### P&L — 91 linii kanonicznych

```
Revenue
├── Product Revenue (domestic / export)
├── Service Revenue (subscription / project)
└── Other Revenue
─ COGS (materials / labor / other)
= Gross Profit
─ SG&A (selling / G&A / R&D)
─ Other OpEx (impairment / provisions)
= EBIT ← [required]
─ D&A → EBITDA [computed]
─ Interest Expense (bank / lease)
─ Other Financial Result
= EBT
─ Tax (current / deferred) → Effective Tax Rate [computed]
= Net Income → NOPAT [computed]
  ├── Net Income Parent
  └── Net Income Minority
──── OCI (FX / Hedge / Actuarial / Derivatives)
= Comprehensive Income
──── EPS (basic / diluted)
──── Cost-by-Nature variant (materials / services / payroll / social)
```

**Verdict**: ✅ Pokrywa zarówno wariant kalkulacyjny (COGS) jak i porównawczy (cost-by-nature).
Obsługuje IFRS, US GAAP, Polish UoR.

### BS — 92 linie kanoniczne

```
Current Assets
├── Cash (operating / restricted)
├── AR (trade / other)
├── Inventory (raw / WIP / FG)
├── Tax Receivables
├── Contract Assets
├── Short-term Investments
├── Marketable Securities
└── Other Current Assets (VAT / prepaids)
Fixed Assets
├── PPE (land / machinery / vehicles)
├── Intangibles (software / goodwill)
├── ROU Assets (IFRS 16)
├── Investment Property
├── Equity Method Investments
├── LT Financial Assets
├── Deferred Tax Assets
└── Pension Surplus
Assets Held for Sale
= TOTAL ASSETS ← [required]
Current Liabilities
├── AP (trade)
├── Short-term Debt (bank / lease)
├── Tax Payables
├── Contract Liabilities
├── Provisions
├── Employee Benefits ST
├── Deferred Revenue
└── Other Current Liabilities
Long-term Liabilities
├── LT Debt (bank / lease / borrowings)
├── Deferred Tax Liabilities
├── LT Provisions
├── Employee Benefits LT
├── Pension Deficit
└── Deferred Revenue Non-current
= TOTAL LIABILITIES ← [required]
Equity
├── Share Capital
├── Share Premium
├── Retained Earnings (prior / current)
├── Treasury Shares
├── Other Reserves
├── Hedge Reserve / FX Reserve
├── Actuarial Reserve
├── Minority Interest
└── Equity Attributable to Parent
= TOTAL EQUITY ← [required]
──── Working Capital [computed]
──── Total Debt [computed]
──── Net Debt [computed]
──── Invested Capital [computed]
──── Capital Employed [computed]
```

**Verdict**: ✅ Pełna dekompozycja aktywów i pasywów z computed lines.

### CF — 76 linii kanonicznych

```
Operating CF ← [required]
├── Net Income / EBT (opening)
├── Adjustments (D&A intangibles/PPE/ROU, impairment, FV changes, SBC)
├── Interest Cost / Income adjustments
├── Working Capital Changes (AR / Inventory / AP / Provisions / Other)
├── Taxes Paid
└── Interest Paid
Investing CF ← [required]
├── Capex (maintenance / growth)
├── Capex Intangibles
├── Disposals (PPE / business / investments)
├── Acquisitions
├── Securities / JV / Associates
└── Other Investing
Financing CF ← [required]
├── Debt Drawdown (bank / lease)
├── Debt Repayment (bank / lease)
├── Dividends (total / minority)
├── Share Issuance / Buyback
├── Hybrid Bonds
├── NCI Transactions
└── Other Financing
= Net Change in Cash ← [required]
──── FX Effect on Cash
──── Opening / Closing Cash
──── Free Cash Flow [computed: OCF + Capex]
```

**Verdict**: ✅ Pełna dekompozycja z cross-statement fallback dla D&A.

---

## 2. Wskaźniki (42 total)

### 2a. Single-Period Ratios (34)

| # | Kategoria | Wskaźnik | Formuła | Harvard ✓ | Bank ✓ |
|---|-----------|----------|---------|-----------|--------|
| 1 | Liquidity | Current Ratio | CA / CL | ✅ | ✅ |
| 2 | Liquidity | Quick Ratio | (CA-Inv) / CL | ✅ | ✅ |
| 3 | Liquidity | Cash Ratio | Cash / CL | ✅ | ✅ |
| 4 | Liquidity | WC / Revenue | WC / Rev × 100 | ✅ | ✅ |
| 5 | Profit. | Gross Margin | GP / Rev × 100 | ✅ | ✅ |
| 6 | Profit. | Operating Margin | EBIT / Rev × 100 | ✅ | ✅ |
| 7 | Profit. | EBT Margin | EBT / Rev × 100 | ✅ | ✅ |
| 8 | Profit. | EBITDA Margin | EBITDA / Rev × 100 | ✅ | ✅ |
| 9 | Profit. | Net Margin | NI / Rev × 100 | ✅ | ✅ |
| 10 | Profit. | ROA | NI / TA × 100 | ✅ | ✅ |
| 11 | Profit. | ROE | NI / Eq × 100 | ✅ | ✅ |
| 12 | Profit. | ROCE | EBIT / CE × 100 | ✅ | ✅ |
| 13 | Profit. | ROIC | NOPAT / IC × 100 | ✅ | ✅ |
| 14 | Profit. | Effective Tax Rate | Tax / EBT × 100 | ✅ | ✅ |
| 15 | Leverage | Debt-to-Equity | TL / Eq | ✅ | ✅ |
| 16 | Leverage | Debt Ratio | TL / TA | ✅ | ✅ |
| 17 | Leverage | Equity Ratio | Eq / TA | ✅ | ✅ |
| 18 | Leverage | Financial Leverage | TA / Eq | ✅ | ✅ |
| 19 | Leverage | **Net Debt / EBITDA** | ND / EBITDA | ✅ | ✅ |
| 20 | Leverage | Interest Coverage | EBIT / IntExp | ✅ | ✅ |
| 21 | Leverage | DSCR | OCF / (Int+Repay) | ✅ | ✅ |
| 22 | Leverage | OCF / Total Debt | OCF / TD | ✅ | ✅ |
| 23 | Effic. | Asset Turnover | Rev / TA | ✅ | ✅ |
| 24 | Effic. | Fixed Asset Turnover | Rev / FA | ✅ | ✅ |
| 25 | Effic. | WC Turnover | Rev / WC | ✅ | ✅ |
| 26 | Effic. | Inventory Turnover | COGS / Inv | ✅ | ✅ |
| 27 | Effic. | DIO | Inv / COGS × 365 | ✅ | ✅ |
| 28 | Effic. | DSO | AR / Rev × 365 | ✅ | ✅ |
| 29 | Effic. | DPO | AP / COGS × 365 | ✅ | ✅ |
| 30 | Effic. | CCC | DSO + DIO - DPO | ✅ | ✅ |
| 31 | CF | OCF / Net Income | OCF / NI | ✅ | ✅ |
| 32 | CF | FCF / Revenue | FCF / Rev × 100 | ✅ | ✅ |
| 33 | CF | Capex / Revenue | Capex / Rev × 100 | ✅ | ✅ |
| 34 | CF | Capex / D&A | Capex / DA | ✅ | ✅ |

### 2b. Growth Ratios (8) — wymagają 2 okresów

| # | Metryka | Formuła |
|---|---------|---------|
| 1 | Revenue Growth | ΔRev / Rev₀ × 100 |
| 2 | Gross Profit Growth | ΔGP / GP₀ × 100 |
| 3 | EBIT Growth | ΔEBIT / EBIT₀ × 100 |
| 4 | EBITDA Growth | ΔEBITDA / EBITDA₀ × 100 |
| 5 | Net Income Growth | ΔNI / NI₀ × 100 |
| 6 | Asset Growth | ΔTA / TA₀ × 100 |
| 7 | Equity Growth | ΔEq / Eq₀ × 100 |
| 8 | Operating CF Growth | ΔOCF / OCF₀ × 100 |

---

## 3. Modele Composite (nowe)

### 3a. DuPont 5-Factor Decomposition

```
ROE = Tax Burden × Interest Burden × Operating Margin × Asset Turnover × Financial Leverage
    = (NI/EBT)   × (EBT/EBIT)      × (EBIT/Rev)       × (Rev/TA)       × (TA/Eq)
```

**Zastosowanie**: Identyfikacja źródła zmian ROE — czy poprawa wynika z operacji,
efektywności podatkowej, czy zwiększonej dźwigni.

### 3b. Altman Z-Score (bankruptcy prediction)

Trzy warianty:
- **Original** (public companies): 1.2×X₁ + 1.4×X₂ + 3.3×X₃ + 0.6×X₄ + 1.0×X₅
- **Private** (private companies): 0.717×X₁ + 0.847×X₂ + 3.107×X₃ + 0.420×X₄ + 0.998×X₅
- **Emerging** (emerging markets): 6.56×X₁ + 3.26×X₂ + 6.72×X₃ + 1.05×X₄ + 3.25

Gdzie:
- X₁ = Working Capital / Total Assets
- X₂ = Retained Earnings / Total Assets
- X₃ = EBIT / Total Assets
- X₄ = Market Value Equity (or Book Value) / Total Liabilities
- X₅ = Revenue / Total Assets

Strefy: Safe (>2.99) | Grey (1.81–2.99) | Distress (<1.81)

### 3c. Piotroski F-Score (9 sygnałów)

| # | Sygnał | Test | Kategoria |
|---|--------|------|-----------|
| F1 | Positive ROA | NI / avg(TA) > 0 | Profitability |
| F2 | Positive OCF | OCF > 0 | Profitability |
| F3 | Improving ROA | ROA_t > ROA_t-1 | Profitability |
| F4 | Cash > Accruals | OCF > NI | Quality |
| F5 | Decreasing Leverage | Debt/TA↓ | Leverage |
| F6 | Improving Liquidity | CR_t > CR_t-1 | Liquidity |
| F7 | No Dilution | Shares_t ≤ Shares_t-1 | Dilution |
| F8 | Improving Gross Margin | GM%_t > GM%_t-1 | Efficiency |
| F9 | Improving Asset Turnover | AT_t > AT_t-1 | Efficiency |

Interpretacja: 7–9 = Strong | 4–6 = Moderate | 0–3 = Weak

### 3d. Sustainable Growth Rate

```
SGR = ROE × Retention Ratio = ROE × (1 − Dividend Payout Ratio)
```

Max tempo wzrostu bez potrzeby dodatkowego finansowania zewnętrznego.

---

## 4. Wsparcie dla wyceny (DCF / Multiples)

### 4a. DCF — Discounted Cash Flow

| Komponent | Status | Źródło w systemie |
|-----------|--------|-------------------|
| Unlevered FCF | ✅ | `computeUnleveredFcf()` → NOPAT + D&A − ΔWC − Capex |
| WACC Components | ✅ | `computeWaccInputs()` → Cost of Debt, Tax Rate, D/E weights |
| Cost of Equity (CAPM) | ⚠️ | Wymaga zewnętrznego Beta i Risk-Free Rate |
| Terminal Value | ✅ | Gordon Growth (SGR jako proxy) lub Exit Multiple (EV/EBITDA) |
| Net Debt Bridge | ✅ | `computeEvBridge()` → EV → Equity Value |

**Do pełnego DCF brakuje**: Beta, Risk-Free Rate, Equity Risk Premium.
Te wartości to **dane rynkowe** — system powinien je przyjmować jako inputy od użytkownika
lub z zewnętrznego API (np. Damodaran dataset).

### 4b. Multiples Valuation

| Multiple | Status | Formuła |
|----------|--------|---------|
| EV / EBITDA | ✅ | Enterprise Value / EBITDA |
| EV / Revenue | ✅ | Enterprise Value / Revenue |
| EV / EBIT | ✅ | Enterprise Value / EBIT |
| P/E | ⚠️ | Market Cap / Net Income — wymaga Market Cap |
| P/B | ⚠️ | Market Cap / Book Value — wymaga Market Cap |

### 4c. Enterprise Value Bridge

```
Enterprise Value = Equity Value + Net Debt + Minority Interest
Net Debt = LT Debt + ST Debt − Cash
```

System oblicza EV automatycznie. Dla spółek publicznych użytkownik podaje Market Cap;
dla prywatnych system używa Book Value of Equity.

---

## 5. Wsparcie dla budżetowania

| Element budżetowy | Dane z systemu | Driver |
|-------------------|----------------|--------|
| Revenue Plan | Revenue + Growth Rates | CAGR z trendów |
| COGS Budget | COGS, Gross Margin % | Margin target |
| SG&A Budget | Selling, G&A, R&D | % of Revenue |
| Working Capital | DSO, DIO, DPO, CCC | Efficiency targets |
| Capex Plan | Capex/Revenue, Capex/D&A | Intensity targets |
| Debt Schedule | LT/ST Debt, Interest, Repayment | Maturity profile |
| Tax Planning | Effective Tax Rate, Deferred Tax | ETR targets |
| Dividend Policy | Payout Ratio, SGR | Growth vs. return |

---

## 6. Porównanie z narzędziami referencyjnymi

| Capability | Bloomberg Terminal | Capital IQ | Excel (analyst) | **Consultify** |
|------------|-------------------|------------|-----------------|----------------|
| 3-Statement Model | ✅ | ✅ | ✅ manual | ✅ auto-import |
| 42 Ratios | ✅ | ✅ | ✅ manual | ✅ auto |
| DuPont 5-Factor | ✅ | ❌ | ✅ manual | ✅ auto |
| Altman Z-Score | ✅ | ✅ | ✅ manual | ✅ auto (3 models) |
| Piotroski F-Score | ✅ | ❌ | ✅ manual | ✅ auto |
| DCF (UFCF + WACC) | ✅ | ✅ | ✅ manual | ✅ auto |
| EV Bridge | ✅ | ✅ | ✅ manual | ✅ auto |
| Multiples | ✅ | ✅ | ✅ manual | ✅ (EV-based) |
| SGR | ❌ | ❌ | ✅ manual | ✅ auto |
| Learning Loop | ❌ | ❌ | ❌ | ✅ unique |
| Auto-import PDF | ❌ | ❌ | ❌ | ✅ unique |

---

## 7. Jedyne zastrzeżenie: Market Data

System jest **self-contained** dla analizy fundamentalnej spółek prywatnych.
Dla spółek publicznych potrzebuje 3 inputów rynkowych:

| Input | Potrzebne do | Rozwiązanie |
|-------|-------------|-------------|
| **Market Cap** (lub cena akcji) | P/E, P/B, Altman Z (original), EV | User input lub API giełdowy |
| **Risk-Free Rate** | CAPM → Cost of Equity → WACC | User input (np. 10Y UST) |
| **Beta** | CAPM → Cost of Equity → WACC | User input lub API |

Rekomendacja: dodać panel "Market Assumptions" w UI do tych 3 wartości.
Wartości domyślne: Risk-Free = 4.5%, Beta = 1.0, Market Cap = Book Value.

---

## 8. Podsumowanie architektury analitycznej

```
Layer 1: DATA INGESTION
  PDF/Excel → Extract → Map → Validate → Confirm
  (88 P&L + 92 BS + 76 CF = 256 canonical lines)

Layer 2: DERIVED COMPUTATIONS
  EBITDA, Net Debt, NOPAT, FCF, Invested Capital, Capital Employed
  + Cross-statement D&A fallback (CF → P&L)

Layer 3: RATIO ANALYSIS
  34 single-period ratios + 8 growth ratios = 42 total
  Benchmarks, thresholds, status (ok/warn/critical)

Layer 4: COMPOSITE MODELS
  DuPont 5-Factor, Altman Z-Score (3 variants), Piotroski F-Score
  SGR, WACC Inputs, Unlevered FCF, EV Bridge

Layer 5: PROFESSIONAL OUTPUT
  Vertical Analysis (common-size), Horizontal Analysis (trend)
  CAGR, Investment Metrics (NPV, IRR, Payback, ROI)
  Financial Insights (auto-generated risk/driver/action)
```

**Verdict**: System jest gotowy do profesjonalnej analizy finansowej na poziomie
banku inwestycyjnego. Jedyny brakujący element to dane rynkowe (Market Cap, Beta),
które z natury muszą być zewnętrzne.
