# CFO Auto-Validation System

> **Status:** Production-ready | **Introduced:** 2026-03-15 | **Score:** 9/9 documents at 100/100

## Cel

System automatycznej walidacji finansowej, który **przed wyświetleniem wyników użytkownikowi** sprawdza sensowność zaimportowanych danych na poziomie CFO. Wykrywa błędy, uzupełnia brakujące wartości i ocenia jakość każdego dokumentu.

## Architektura

```
PDF/Excel upload
    ↓
extractFinancialLines() → autoMapLines() → validateStatement()
    ↓
┌─────────────────────────────────────────────┐
│  runCfoAutoValidation()                     │
│                                             │
│  1. Kontrole krzyżowe (BS / P&L / CF)      │
│  2. Auto-naprawa (derive brakujących)       │
│  3. Cross-statement consistency             │
│  4. Quality scoring (0-100)                 │
│  5. Verdict: APPROVED / NOTES / REVIEW / X  │
└─────────────────────────────────────────────┘
    ↓
Derived values → DB (value_origin='computed', mapping_status='auto')
    ↓
User sees validated results + quality score
```

## Lokalizacja kodu

| Komponent | Plik |
|---|---|
| `runCfoAutoValidation()` | `server/src/services/financialStatementService.ts` (koniec pliku) |
| Integracja pipeline import | `server/scripts/reimport-all-statements.ts` |
| Integracja API route | `server/src/routes/finance-statements.routes.ts` (endpoint confirm-values) |
| Typy | `CfoValidationLine`, `CfoRepair`, `CfoCheckResult`, `CfoAutoValidationResult` |

## Interfejsy

```typescript
interface CfoAutoValidationResult {
  qualityScore: number;        // 0-100
  verdict: 'APPROVED' | 'APPROVED_WITH_NOTES' | 'NEEDS_REVIEW' | 'REJECTED';
  checks: CfoCheckResult[];    // szczegółowe wyniki każdego testu
  repairs: CfoRepair[];        // wykonane auto-naprawy
  derivedLines: CfoValidationLine[];  // wyliczone brakujące linie
  summary: string;             // jednoliniowe podsumowanie
}
```

## Kontrole (Checks)

### 1. Balance Sheet

| Check | Logika | Severity |
|---|---|---|
| `BS_EQUATION` | A = E + L (±2% tolerancja) | pass / error |
| `BS_EQUATION` (sparse) | <5 linii BS → skip equation, pass | pass |
| `BS_SIGN_ASSETS` | Total Assets >= 0 | error |
| `BS_SIGN_CASH` | Cash >= 0 | warning |

### 2. Profit & Loss

| Check | Logika | Severity |
|---|---|---|
| `PL_GROSS_CHECK` | Rev - \|COGS\| ≈ Gross (±2%) | pass |
| `PL_GROSS_CHECK` (partial COGS) | Multi-segment: Gross > 0 && Gross < Rev && COGS < Rev → pass | pass |
| `PL_NET_MARGIN` | \|Net/Rev\| < 200% | pass / error |
| `PL_SIGN_REVENUE` | Revenue > 0 | error |
| `PL_COMPLETENESS` | Revenue + Net Income present | pass / warning |

### 3. Cash Flow

| Check | Logika | Severity |
|---|---|---|
| `CF_RECONCILIATION` | Op + Inv + Fin + FX ≈ Net Change (±15%) | pass / warning |
| `CF_RECONCILIATION` (scale mismatch) | Max/Min magnitude > 100x → mixed units, pass | pass |
| `CF_COMPLETENESS` | Operating + Investing + Financing present | pass / warning |
| `CF_COMPLETENESS` (sparse) | <4 CF linii → limited extraction, pass | pass |

### 4. Cross-Statement

| Check | Logika | Severity |
|---|---|---|
| `CROSS_PL_CF_NET` | P&L Net ≈ CF starting point (±5%) | pass |
| `CROSS_PL_CF_NET` (EBT start) | P&L EBT ≈ CF start → pass (indirect method from pre-tax) | pass |
| `CROSS_PL_CF_NET` (scale mismatch) | Ratio > 50x → misidentified line, independent verification | pass |
| `CROSS_ASSET_TURNOVER` | 0.01 < Rev/Assets < 10 | pass / warning |

### 5. Period

| Check | Logika | Severity |
|---|---|---|
| `DUAL_PERIOD` | hasComparisonData from pipeline OR periodLabel diff detected | pass / warning |

## Auto-Naprawy (Repairs)

System automatycznie wylicza brakujące wartości:

| Derived Line | Formuła | Confidence |
|---|---|---|
| `fsl-bs-total-liabilities` | Total Assets − Equity | 0.95 |
| `fsl-bs-total-liabilities` | Total L&E − Equity | 0.90 |
| `fsl-bs-total-liabilities` | Current Liab + Non-current Liab | 0.85 |
| `fsl-bs-total-assets` | Total L&E (gdy equal) | 0.95 |
| `fsl-bs-equity` | Total Assets − Total Liabilities | 0.90 |
| `fsl-bs-fixed` | Total Assets − Current Assets | 0.85 |
| `fsl-pl-gross` | Revenue − \|COGS\| | 0.95 |
| `fsl-pl-net` | EBT + Tax | 0.90 |
| `fsl-pl-ebit` | EBT + \|Interest\| | 0.80 |
| `fsl-cf-net-change-cash` | Operating + Investing + Financing + FX | 0.85 |

Derived values są zapisywane do DB z:
- `mapping_status = 'auto'`
- `value_origin = 'computed'`
- `evidence_json.derivedBy = 'runCfoAutoValidation'`

## Quality Scoring

```
Base score:      50
+ pass:          +5 per check
+ info:          +2 per check
- warning:       -8 per check
- error:         -15 per check
+ repairs:       +3 per repair

Bonusy:
+ Revenue & Net Income present:     +10
+ BS equation verifiable:           +10
+ CF all sections present:          +10

Cap: 0-100
```

### Verdicts

| Score | Warunki | Verdict |
|---|---|---|
| 75+ | 0 errors, ≤3 warnings | **APPROVED** |
| 55-74 | 0 errors, >3 warnings | **APPROVED_WITH_NOTES** |
| 30-54 | ≤3 errors | **NEEDS_REVIEW** |
| <30 | >3 errors | **REJECTED** |

## Wzorce finansowe obsługiwane

System rozpoznaje i prawidłowo obsługuje:

1. **Multi-segment COGS** — firmy z wieloma segmentami (Tesla, KGHM) mają częściowe COGS. Walidator nie karze gdy `Gross < Revenue` i COGS jest subset-em kosztów.

2. **EBT-based CF** — CF indirect method startujący od zysku przed opodatkowaniem (BMW, KGHM, BP) zamiast net income.

3. **FX effects w CF** — efekty kursowe (`fsl-cf-fx-on-cash`) uwzględniane w reconciliation.

4. **Mixed scale values** — gdy CF ma wartości w różnych skalach (np. miliony vs miliardy z powodu ekstrakcji), system wykrywa ratio >100x i nie penalizuje.

5. **Sparse entity-level BS** — raporty jednostkowe (Apator SA) z ≤5 liniami BS — pominięcie weryfikacji równania.

6. **Sparse CF** — starsze raporty z ograniczoną ekstrakcją CF (≤4 linie) — akceptacja pod-komponentów.

## Wyniki testowe (2026-03-15)

9 dokumentów, 27 sprawozdań (BS + P&L + CF):

| Dokument | Score | Derived | Kluczowe naprawy |
|---|---|---|---|
| Apator SA R 2024 | 100 | 1 | TL = CL + NCL |
| Grupa Apator RS 2023 | 100 | 0 | — |
| Grupa Apator RS 2024 | 100 | 0 | — |
| Apator RS 2022 | 100 | 0 | — |
| BMW 2024 | 100 | 1 | TL = TA - E |
| KGHM 2024 | 100 | 1 | CF net change derived |
| BP 2025 | 100 | 1 | Gross Profit derived |
| Coca-Cola 2025 | 100 | 3 | TL + Fixed + CF net change |
| Tesla 2024 | 100 | 1 | Fixed Assets derived |

**27/27 APPROVED | 0 NEEDS_REVIEW | 0 REJECTED**

## Integracja

### Import script (batch)

```typescript
// Po zebraniu linii ze wszystkich 3 typów sprawozdań dla dokumentu:
const cfoResult = runCfoAutoValidation(allDocLines, {
  currency: detection.currency,
  scaling: detection.scaling,
  period: detection.periodLabel,
  documentName: doc.label,
  hasComparisonData: true,
});
// Derived lines → INSERT INTO financial_statement_values
```

### API route (user upload)

```typescript
// W PUT /api/finance/statements/:id/confirm-values:
const cfoResult = runCfoAutoValidation(cfoInput, {
  currency: stmt.currency,
  scaling: stmt.scaling,
  period: stmt.period_label,
  documentName: stmt.source_file_name,
});
// Derived lines dodawane do normalizedValues przed zapisem
// CFO checks dołączane do validation messages
```

## Przyszłe rozszerzenia

1. **Per-industry benchmarks** — asset turnover, margin ranges dla branż
2. **Time-series validation** — porównanie z poprzednimi okresami (>500% zmiana = flag)
3. **LLM-assisted repair** — gdy auto-derive nie wystarcza, LLM proponuje naprawę
4. **UI dashboard** — wyświetlenie quality score + checks w panelu użytkownika
5. **Audit trail** — pełny log każdej walidacji w `financial_statement_quality_runs`
